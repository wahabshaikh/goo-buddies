import type { GooMaterial, GooShape, GooState } from '../types';
import { type RGB, darken, desaturate, lighten, mixColor, resolveColor, toCss } from './color';
import { TAU, bounds, clamp, damp, lerp, pointInPolygon, type Bounds } from './math';
import { computeTargets, talkSignal } from './motion';
import { MAX_PARTICLES, GRAVITY, ParticleKind, type Particle } from './particles';
import { approachPose, clonePose, statePoses, stillPose, type Pose } from './poses';
import { createRandom } from './random';
import { RIM_POINTS, getOutline, type Outline } from './shapes';
import {
  computeNormals,
  createBody,
  defaultStepParams,
  nearestPoint,
  pokeBody,
  pullBody,
  snapToTargets,
  stepBody,
  type SoftBody,
  type StepParams,
} from './softbody';
import { canvasCssSize, layout } from './layout';

export interface EngineOptions {
  shape: GooShape;
  state: GooState;
  material: GooMaterial;
  size: number;
  color: string;
  speed: number;
  seed: number;
  level: number;
  floorShadow: boolean;
}

const STEP = 1 / 120;
const MAX_STEPS = 8;
const FALLBACK: RGB = { r: 79, g: 209, b: 165 };
const MURK: RGB = { r: 112, g: 108, b: 78 };

interface Grab {
  index: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  dragging: boolean;
}

interface MaterialLook {
  alpha: number;
  gloss: number;
  glossWidth: number;
  rim: number;
  core: number;
}

const materials: Record<GooMaterial, MaterialLook> = {
  jelly: { alpha: 0.62, gloss: 0.8, glossWidth: 0.07, rim: 0.45, core: 0.22 },
  slime: { alpha: 1, gloss: 0.92, glossWidth: 0.085, rim: 0.18, core: 0 },
  gummy: { alpha: 0.88, gloss: 0.42, glossWidth: 0.16, rim: 0.28, core: 0.1 },
};

/** Drives one buddy: its soft body, face, particles and drawing. Framework-free. */
export class GooEngine {
  readonly body: SoftBody = createBody(RIM_POINTS);
  private ctx: CanvasRenderingContext2D | null;
  private opts: EngineOptions;
  private outline: Outline;
  private pose: Pose;
  private target: Pose;
  private time = 0;
  private level = 0;
  private acc = 0;
  private rand: () => number;
  private phase: number;
  private particles: Particle[] = [];
  private emit = { bubbles: 0, droplets: 0, zees: 0, sparkles: 0 };
  private blinkIn = 2;
  private blinkT = -1;
  private gazeX = 0;
  private gazeY = 0;
  private dartX = 0;
  private dartY = 0;
  private dartIn = 0;
  private glanceX = 0;
  private glanceIn = 4;
  private glanceFor = 0;
  private hover: { x: number; y: number } | null = null;
  private grab: Grab | null = null;
  private reaction = 0;
  private baseColor: RGB = FALLBACK;
  private specks: Float64Array;
  private params: StepParams = { ...defaultStepParams };
  private dpr = 1;
  private still = false;

  constructor(private canvas: HTMLCanvasElement, options: EngineOptions) {
    this.ctx = canvas.getContext('2d');
    this.opts = options;
    this.outline = getOutline(options.shape);
    this.pose = clonePose(statePoses[options.state]);
    this.target = statePoses[options.state];
    this.rand = createRandom(options.seed);
    this.phase = this.rand();
    this.specks = new Float64Array(80).map(() => this.rand());
    this.baseColor = resolveColor(options.color, FALLBACK);
    this.level = options.level;
    this.layoutTargets(this.pose, this.time);
    snapToTargets(this.body);
    this.resize();
  }

  setOptions(next: EngineOptions): void {
    const prev = this.opts;
    this.opts = next;
    if (next.shape !== prev.shape) this.outline = getOutline(next.shape);
    if (next.state !== prev.state) {
      this.target = statePoses[next.state];
      this.blinkIn = 0; // blink through the change
    }
    if (next.color !== prev.color) this.baseColor = resolveColor(next.color, FALLBACK);
    if (next.seed !== prev.seed) {
      this.rand = createRandom(next.seed);
      this.phase = this.rand();
      this.specks = new Float64Array(80).map(() => this.rand());
    }
    if (next.size !== prev.size) this.resize();
  }

  resize(): void {
    const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const [w, h] = canvasCssSize(this.opts.size);
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
  }

  /** Advance by `dt` real seconds and draw. */
  tick(dt: number): void {
    this.still = false;
    const speed = Math.max(0, this.opts.speed);
    approachPose(this.pose, this.target, 4.2, dt);
    this.level = damp(this.level, clamp(this.opts.level, 0, 1), 14, dt);
    this.params.stiffness = defaultStepParams.stiffness * this.pose.stiffness;

    this.acc = Math.min(this.acc + dt, STEP * MAX_STEPS);
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.time += STEP * speed;
      this.layoutTargets(this.pose, this.time);
      this.applyGrab();
      stepBody(this.body, this.params, STEP);
    }

    const adt = dt * speed;
    this.updateFace(adt, dt);
    this.updateParticles(adt, true);
    this.draw();
  }

  /** Draw the still pose of the current state: no motion, but legible. */
  renderStill(): void {
    this.still = true;
    this.grab = null;
    this.reaction = 0;
    this.blinkT = -1;
    this.pose = clonePose(this.target);
    const pose = stillPose(this.target);
    this.layoutTargets(pose, 0);
    snapToTargets(this.body);
    this.gazeX = pose.lookX;
    this.gazeY = pose.lookY;
    // Pre-run the particles so a thinking buddy still has bubbles, a sleeping one z's.
    this.particles = [];
    this.emit = { bubbles: 0.5, droplets: 0.5, zees: 0.6, sparkles: 0.5 };
    const rand = this.rand;
    this.rand = createRandom(this.opts.seed + 0.5);
    for (let t = 0; t < 3; t += 1 / 30) this.updateParticles(1 / 30, false);
    this.rand = rand;
    this.draw();
  }

  // ---- pointer, in body units (origin: floor centre, y down) ----

  /** Convert a client-space point to body units given the box's bounding rect. */
  toUnits(clientX: number, clientY: number, rect: { left: number; top: number; width: number }): [number, number] {
    const size = this.opts.size;
    const scale = rect.width / size || 1;
    const unitPx = layout.unit * size * scale;
    return [
      (clientX - rect.left - (size * scale) / 2) / unitPx,
      (clientY - rect.top - layout.floor * size * scale) / unitPx,
    ];
  }

  /** Returns true if the pointer landed on the goo (and it is now held). */
  pointerDown(x: number, y: number): boolean {
    if (this.still) return false;
    const inside = pointInPolygon(x, y, this.body.x, this.body.y);
    const [index, d] = nearestPoint(this.body, x, y);
    if (!inside && d > 0.35) return false;
    this.grab = { index, startX: x, startY: y, x, y, dragging: false };
    return true;
  }

  pointerMove(x: number, y: number): void {
    this.hover = { x, y };
    const g = this.grab;
    if (!g) return;
    g.x = x;
    g.y = y;
    if (!g.dragging && Math.hypot(x - g.startX, y - g.startY) > 0.15) g.dragging = true;
  }

  pointerUp(): void {
    const g = this.grab;
    this.grab = null;
    if (!g || this.still) return;
    if (!g.dragging) {
      pokeBody(this.body, g.startX, g.startY, 0.5, 0.34);
      // A little shake everywhere so the whole body answers the poke.
      for (let i = 0; i < this.body.n; i++) {
        this.body.px[i] += (this.rand() - 0.5) * 0.02;
        this.body.py[i] += (this.rand() - 0.5) * 0.02;
      }
      this.reaction = 1;
    } else {
      this.reaction = 0.6;
    }
  }

  pointerLeave(): void {
    this.hover = null;
  }

  get isHeld(): boolean {
    return this.grab !== null;
  }

  // ---- simulation ----

  private layoutTargets(pose: Pose, time: number): void {
    computeTargets(this.outline, pose, { time, level: this.level, phase: this.phase }, this.body.tx, this.body.ty);
  }

  private applyGrab(): void {
    const g = this.grab;
    if (!g || !g.dragging) return;
    const { tx, ty } = this.body;
    // Goo stretches, but only so far.
    let dx = g.x - tx[g.index];
    let dy = g.y - ty[g.index];
    const len = Math.hypot(dx, dy);
    const max = 1.1;
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    pullBody(this.body, g.index, tx[g.index] + dx, ty[g.index] + dy, 4, 0.22);
  }

  private updateFace(adt: number, dt: number): void {
    const p = this.pose;
    // Blinks.
    if (this.blinkT >= 0) {
      this.blinkT += adt;
      if (this.blinkT > 0.16) this.blinkT = -1;
    } else {
      this.blinkIn -= adt;
      if (this.blinkIn <= 0) {
        this.blinkT = 0;
        this.blinkIn = this.rand() < 0.2 ? 0.28 : 1.8 + this.rand() * 3.6;
      }
    }
    // Darting (searching).
    this.dartIn -= adt;
    if (this.dartIn <= 0) {
      this.dartX = this.rand() * 2 - 1;
      this.dartY = (this.rand() - 0.5) * 0.7;
      this.dartIn = 0.22 + this.rand() * 0.55;
    }
    // Idle glances.
    if (this.glanceFor > 0) {
      this.glanceFor -= adt;
      if (this.glanceFor <= 0) this.glanceX = 0;
    } else {
      this.glanceIn -= adt;
      if (this.glanceIn <= 0) {
        this.glanceX = (this.rand() < 0.5 ? -1 : 1) * (0.4 + this.rand() * 0.4);
        this.glanceFor = 0.8 + this.rand() * 1.2;
        this.glanceIn = 3 + this.rand() * 5;
      }
    }
    let gx = p.lookX + p.dart * this.dartX + this.glanceX * (1 - p.dart) * (1 - p.eyeClosed);
    let gy = p.lookY + p.dart * this.dartY;
    // Look at a nearby pointer.
    if (this.hover && this.opts.speed > 0) {
      const b = bounds(this.body.x, this.body.y);
      const hx = this.hover.x - b.cx;
      const hy = this.hover.y - (b.minY + b.maxY) / 2;
      const d = Math.hypot(hx, hy);
      if (d < 4) {
        const w = clamp(1 - d / 4, 0, 1) * (1 - p.eyeClosed) * (1 - p.eyeCross);
        gx = lerp(gx, clamp(hx / 1.2, -1, 1), w);
        gy = lerp(gy, clamp(hy / 1.2, -1, 1), w);
      }
    }
    const rate = p.dart > 0.5 ? 26 : 9;
    this.gazeX = damp(this.gazeX, gx, rate, adt);
    this.gazeY = damp(this.gazeY, gy, rate, adt);
    this.reaction = damp(this.reaction, 0, 3, dt);
  }

  private spawn(p: Omit<Particle, 'age' | 'spin'> & { spin?: number }): void {
    if (this.particles.length >= MAX_PARTICLES) return;
    this.particles.push({ age: 0, spin: 0, ...p });
  }

  private updateParticles(adt: number, live: boolean): void {
    const p = this.pose;
    const target = this.target;
    const body = this.body;
    const b = bounds(body.x, body.y);
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    const r = this.rand;
    // Emission follows the pose while animating, the target when drawing a still.
    const rates = live ? p : target;
    const e = this.emit;

    e.bubbles += rates.bubbles * adt;
    while (e.bubbles >= 1) {
      e.bubbles -= 1;
      this.spawn({
        kind: ParticleKind.Bubble,
        x: b.cx + (r() - 0.5) * w * 0.45,
        y: b.maxY - 0.12 - r() * h * 0.2,
        vx: 0,
        vy: -(0.32 + r() * 0.3),
        life: 6,
        size: 0.05 + r() * 0.06,
        spin: r() * TAU,
      });
    }
    e.droplets += rates.droplets * adt;
    if (e.droplets >= 1) computeNormals(body);
    while (e.droplets >= 1) {
      e.droplets -= 1;
      let i = Math.floor(r() * body.n);
      for (let tries = 0; tries < 12 && body.ny[i] > -0.25; tries++) i = Math.floor(r() * body.n);
      const speed = 1.1 + r() * 1.0;
      this.spawn({
        kind: ParticleKind.Droplet,
        x: body.x[i] + body.nx[i] * 0.04,
        y: body.y[i] + body.ny[i] * 0.04,
        vx: body.nx[i] * speed,
        vy: body.ny[i] * speed - 1.3,
        life: 3,
        size: 0.06 + r() * 0.06,
      });
    }
    e.zees += rates.zees * adt;
    while (e.zees >= 1) {
      e.zees -= 1;
      this.spawn({
        kind: ParticleKind.Zee,
        x: b.maxX - w * 0.2,
        y: b.minY - 0.05,
        vx: 0.14,
        vy: -0.3,
        life: 3.4,
        size: 0.13,
        spin: r() * TAU,
      });
    }
    e.sparkles += rates.sparkles * adt;
    while (e.sparkles >= 1) {
      e.sparkles -= 1;
      this.spawn({
        kind: ParticleKind.Sparkle,
        x: b.cx + (r() - 0.5) * w * 1.3,
        y: b.minY + r() * h * 0.5 - 0.15,
        vx: 0,
        vy: -0.15,
        life: 0.8,
        size: 0.1 + r() * 0.08,
        spin: r() * TAU,
      });
    }

    const list = this.particles;
    let k = 0;
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      q.age += adt;
      switch (q.kind) {
        case ParticleKind.Bubble:
          q.spin += adt * 3;
          q.x += Math.sin(q.spin) * 0.08 * adt;
          q.y += q.vy * adt;
          // Pop on reaching the top of the goo (it may have moved under the bubble).
          if (q.y < b.minY + h * 0.12 + q.size || !pointInPolygon(q.x, q.y, body.x, body.y)) {
            q.kind = ParticleKind.Pop;
            q.age = 0;
            q.life = 0.3;
          }
          break;
        case ParticleKind.Droplet:
          q.vy += GRAVITY * adt;
          q.x += q.vx * adt;
          q.y += q.vy * adt;
          if (q.y >= -q.size * 0.5 && q.vy > 0) {
            q.kind = ParticleKind.Splat;
            q.y = 0;
            q.age = 0;
            q.life = 0.8;
          }
          break;
        case ParticleKind.Zee:
          q.spin += adt * 1.6;
          q.x += (q.vx + Math.sin(q.spin) * 0.12) * adt;
          q.y += q.vy * adt;
          q.size = 0.13 + 0.1 * (q.age / q.life);
          break;
        case ParticleKind.Sparkle:
          q.y += q.vy * adt;
          q.spin += adt * 2;
          break;
        default:
          break;
      }
      if (q.age < q.life) list[k++] = q;
    }
    list.length = k;
  }

  // ---- drawing ----

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const { size, material } = this.opts;
    const dpr = this.dpr;
    const u = layout.unit * size * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(u, 0, 0, u, dpr * size * (layout.padX + 0.5), dpr * size * (layout.padTop + layout.floor));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const p = this.pose;
    const look = materials[material];
    let color = this.baseColor;
    if (p.murk > 0.001) color = mixColor(color, desaturate(mixColor(color, MURK, 0.55), 0.5), p.murk);
    const body = this.body;
    const b = bounds(body.x, body.y);
    const ink = toCss(darken(color, 0.84));

    if (this.opts.floorShadow) this.drawShadow(ctx, b, color, material);
    this.drawOuterParticles(ctx, color, look, ink, false);

    const path = this.bodyPath();
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    const light = lighten(color, 0.42);
    const dark = darken(color, 0.38);

    // Body fill.
    const grad = ctx.createRadialGradient(
      b.minX + w * 0.36, b.minY + h * 0.3, 0,
      b.minX + w * 0.4, b.minY + h * 0.36, Math.max(w, h) * 0.95,
    );
    grad.addColorStop(0, toCss(light, look.alpha));
    grad.addColorStop(0.5, toCss(color, look.alpha));
    grad.addColorStop(1, toCss(dark, Math.min(1, look.alpha + 0.15)));
    ctx.fillStyle = grad;
    ctx.fill(path);

    ctx.save();
    ctx.clip(path);
    // Weight at the bottom.
    const shade = ctx.createLinearGradient(0, b.maxY - h * 0.5, 0, b.maxY);
    shade.addColorStop(0, toCss(dark, 0));
    shade.addColorStop(1, toCss(darken(color, 0.55), material === 'slime' ? 0.5 : 0.35));
    ctx.fillStyle = shade;
    ctx.fillRect(b.minX - 1, b.minY - 1, w + 2, h + 2);
    // A denser core, seen through the jelly.
    if (look.core > 0) {
      const cy = b.maxY - h * 0.4;
      const core = ctx.createRadialGradient(b.cx, cy, 0, b.cx, cy, Math.max(w, h) * 0.42);
      core.addColorStop(0, toCss(darken(color, 0.18), look.core));
      core.addColorStop(1, toCss(darken(color, 0.18), 0));
      ctx.fillStyle = core;
      ctx.fillRect(b.minX - 1, b.minY - 1, w + 2, h + 2);
    }
    // Sugar-dusted gummy.
    if (material === 'gummy') {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (let i = 0; i < this.specks.length; i += 2) {
        ctx.beginPath();
        ctx.arc(b.minX + this.specks[i] * w, b.minY + this.specks[i + 1] * h, 0.012, 0, TAU);
        ctx.fill();
      }
    }
    // Light caught inside the rim.
    ctx.lineWidth = 0.16;
    ctx.strokeStyle = toCss(lighten(color, 0.55), look.rim);
    ctx.stroke(path);
    this.drawInnerParticles(ctx, color);
    this.drawGloss(ctx, look);
    ctx.restore();

    // Edge.
    ctx.lineWidth = 0.028;
    ctx.strokeStyle = toCss(darken(color, 0.45), material === 'jelly' ? 0.35 : 0.5);
    ctx.stroke(path);

    this.drawFace(ctx, b, ink);
    this.drawOuterParticles(ctx, color, look, ink, true);
  }

  private bodyPath(): Path2D {
    const { n, x, y } = this.body;
    const path = new Path2D();
    // Closed Catmull–Rom spline through the rim points.
    path.moveTo(x[0], y[0]);
    for (let i = 0; i < n; i++) {
      const i0 = (i - 1 + n) % n;
      const i2 = (i + 1) % n;
      const i3 = (i + 2) % n;
      path.bezierCurveTo(
        x[i] + (x[i2] - x[i0]) / 6, y[i] + (y[i2] - y[i0]) / 6,
        x[i2] - (x[i3] - x[i]) / 6, y[i2] - (y[i3] - y[i]) / 6,
        x[i2], y[i2],
      );
    }
    path.closePath();
    return path;
  }

  private drawShadow(ctx: CanvasRenderingContext2D, b: Bounds, color: RGB, material: GooMaterial): void {
    const lift = clamp(-b.maxY, 0, 1);
    const w = (b.maxX - b.minX) * 0.55 * (1 - lift * 0.5);
    const a = 0.3 * (1 - lift * 0.9);
    ctx.save();
    ctx.translate(b.cx, 0.01);
    ctx.scale(w, 0.12);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, `rgba(0,0,0,${a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.fill();
    if (material === 'jelly') {
      // Light focused through the jelly onto the floor.
      const c = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.8);
      c.addColorStop(0, toCss(lighten(color, 0.2), 0.35 * (1 - lift)));
      c.addColorStop(1, toCss(color, 0));
      ctx.fillStyle = c;
      ctx.fill();
    }
    ctx.restore();
  }

  /** A gloss streak hugging the upper-left rim, so it follows every shape and squish. */
  private drawGloss(ctx: CanvasRenderingContext2D, look: MaterialLook): void {
    const body = this.body;
    computeNormals(body);
    const { n, x, y, nx, ny } = body;
    const lx = -0.62;
    const ly = -0.78;
    let start = -1;
    // Find the arc of points facing the light: start where facing rises above the threshold.
    for (let i = 0; i < n; i++) {
      const prev = (i - 1 + n) % n;
      if (nx[i] * lx + ny[i] * ly > 0.8 && nx[prev] * lx + ny[prev] * ly <= 0.8) {
        start = i;
        break;
      }
    }
    if (start < 0) return;
    const inset = 0.11;
    ctx.beginPath();
    let count = 0;
    let ex = 0;
    let ey = 0;
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n;
      if (nx[i] * lx + ny[i] * ly <= 0.8) break;
      ex = x[i] - nx[i] * inset;
      ey = y[i] - ny[i] * inset;
      if (count === 0) ctx.moveTo(ex, ey);
      else ctx.lineTo(ex, ey);
      count++;
    }
    if (count < 2) return;
    ctx.strokeStyle = `rgba(255,255,255,${look.gloss})`;
    ctx.lineWidth = look.glossWidth;
    if (look.glossWidth > 0.12) {
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = look.glossWidth * 1.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = look.glossWidth * 0.6;
    }
    ctx.stroke();
    // A small round glint just past the streak.
    ctx.fillStyle = `rgba(255,255,255,${look.gloss * 0.9})`;
    ctx.beginPath();
    ctx.arc(ex + 0.12, ey - 0.02, look.glossWidth * 0.42, 0, TAU);
    ctx.fill();
  }

  private drawInnerParticles(ctx: CanvasRenderingContext2D, color: RGB): void {
    const rim = toCss(lighten(color, 0.75), 0.75);
    const fill = toCss(lighten(color, 0.6), 0.3);
    for (const q of this.particles) {
      if (q.kind === ParticleKind.Bubble) {
        const grow = clamp(q.age / 0.3, 0, 1);
        const r = q.size * grow;
        ctx.beginPath();
        ctx.arc(q.x, q.y, r, 0, TAU);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = 0.018;
        ctx.strokeStyle = rim;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(q.x - r * 0.35, q.y - r * 0.35, r * 0.25, 0, TAU);
        ctx.fill();
      } else if (q.kind === ParticleKind.Pop) {
        const t = q.age / q.life;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.size * (1 + t * 1.5), 0, TAU);
        ctx.lineWidth = 0.012;
        ctx.strokeStyle = toCss(lighten(color, 0.8), 0.7 * (1 - t));
        ctx.stroke();
      }
    }
  }

  private drawOuterParticles(
    ctx: CanvasRenderingContext2D,
    color: RGB,
    look: MaterialLook,
    ink: string,
    front: boolean,
  ): void {
    for (const q of this.particles) {
      const t = q.age / q.life;
      if (!front && q.kind === ParticleKind.Splat) {
        ctx.fillStyle = toCss(color, look.alpha * 0.8 * (1 - t));
        ctx.beginPath();
        ctx.ellipse(q.x, -0.005, q.size * (1.4 + t * 1.2), q.size * 0.35, 0, 0, TAU);
        ctx.fill();
        continue;
      }
      if (!front) continue;
      if (q.kind === ParticleKind.Droplet) {
        const sp = Math.hypot(q.vx, q.vy) || 1;
        const stretch = 1 + Math.min(sp * 0.12, 0.6);
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(Math.atan2(q.vy, q.vx));
        ctx.fillStyle = toCss(color, Math.min(1, look.alpha + 0.15));
        ctx.beginPath();
        ctx.ellipse(0, 0, q.size * stretch, q.size / Math.sqrt(stretch), 0, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.arc(q.x - q.size * 0.3, q.y - q.size * 0.3, q.size * 0.28, 0, TAU);
        ctx.fill();
      } else if (q.kind === ParticleKind.Zee) {
        const a = Math.min(1, q.age / 0.4) * (1 - t * t);
        const s = q.size;
        ctx.beginPath();
        ctx.arc(q.x, q.y, s * 1.35, 0, TAU);
        ctx.fillStyle = toCss(lighten(color, 0.7), 0.3 * a);
        ctx.fill();
        ctx.lineWidth = 0.014;
        ctx.strokeStyle = toCss(lighten(color, 0.5), 0.6 * a);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(q.x - s * 0.5, q.y - s * 0.5);
        ctx.lineTo(q.x + s * 0.5, q.y - s * 0.5);
        ctx.lineTo(q.x - s * 0.5, q.y + s * 0.5);
        ctx.lineTo(q.x + s * 0.5, q.y + s * 0.5);
        ctx.lineWidth = s * 0.28;
        ctx.globalAlpha = a;
        ctx.strokeStyle = ink;
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (q.kind === ParticleKind.Sparkle) {
        const a = Math.sin(Math.PI * t);
        const s = q.size * (0.6 + 0.4 * a);
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.spin * 0.3);
        ctx.fillStyle = `rgba(255,236,150,${a})`;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const ang = (k / 8) * TAU;
          const rr = k % 2 === 0 ? s : s * 0.28;
          ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  private drawFace(ctx: CanvasRenderingContext2D, b: Bounds, ink: string): void {
    const p = this.pose;
    const o = this.outline;
    const w = (b.maxX - b.minX) / 2;
    const h = b.maxY - b.minY;
    const squash = Math.sqrt(clamp(h / o.height, 0.5, 1.2));
    const gx = clamp(this.gazeX, -1.2, 1.2);
    const gy = clamp(this.gazeY, -1.2, 1.2);
    const fx = lerp(b.cx, (b.minX + b.maxX) / 2, 0.5) + gx * 0.11;
    const fy = b.maxY - h * o.faceHeight + gy * 0.08;
    const spacing = 0.34 * clamp(w, 0.7, 1.45) ** 0.8;
    const eyeR = 0.125 * clamp(Math.sqrt(w), 0.85, 1.2);

    const react = this.reaction;
    // Eye styles cross-fade through a closed moment: round eyes fade out over the
    // first half of a change, the new style fades in over the second.
    const fadeIn = (w: number) => clamp(2 * w - 1, 0, 1);
    const happyW = clamp(p.eyeHappy + react, 0, 1);
    const crossW = clamp(p.eyeCross * (1 - react), 0, 1);
    const closedW = clamp(p.eyeClosed * (1 - react), 0, 1);
    const round = clamp(1 - 2 * (happyW + crossW + closedW), 0, 1);
    const happy = fadeIn(happyW);
    const cross = fadeIn(crossW);
    const closed = fadeIn(closedW);
    let blink = 1;
    if (this.blinkT >= 0) blink = 1 - Math.sin(Math.PI * clamp(this.blinkT / 0.16, 0, 1));

    // Blush.
    if (p.blush > 0.02) {
      ctx.fillStyle = `rgba(255,110,140,${0.35 * p.blush})`;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(fx + side * (spacing + eyeR * 0.9), fy + eyeR * 1.2, eyeR * 0.85, eyeR * 0.45, 0, 0, TAU);
        ctx.fill();
      }
    }

    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    for (const side of [-1, 1]) {
      const ex = fx + side * spacing + gx * 0.05;
      const ey = fy + gy * 0.05;
      if (round > 0.02) {
        const open = clamp(p.eyeOpen, 0, 1.2) * blink;
        const ry = eyeR * squash * Math.max(open, 0.08) * (0.7 + 0.3 * round);
        ctx.globalAlpha = round;
        ctx.beginPath();
        ctx.ellipse(ex, ey, eyeR * 0.8 * (0.7 + 0.3 * round), ry, 0, 0, TAU);
        ctx.fill();
        if (open > 0.35) {
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath();
          ctx.arc(ex - eyeR * 0.25 + gx * eyeR * 0.3, ey - ry * 0.38 + gy * ry * 0.3, eyeR * 0.26, 0, TAU);
          ctx.fill();
          ctx.fillStyle = ink;
        }
      }
      ctx.lineWidth = eyeR * 0.42;
      if (happy > 0.02) {
        ctx.globalAlpha = happy;
        ctx.beginPath();
        ctx.arc(ex, ey + eyeR * 0.35, eyeR * 0.72, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      if (closed > 0.02) {
        ctx.globalAlpha = closed;
        ctx.beginPath();
        ctx.arc(ex, ey - eyeR * 0.3, eyeR * 0.7, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
      if (cross > 0.02) {
        const s = eyeR * 0.6;
        ctx.globalAlpha = cross;
        ctx.beginPath();
        ctx.moveTo(ex - s, ey - s);
        ctx.lineTo(ex + s, ey + s);
        ctx.moveTo(ex + s, ey - s);
        ctx.lineTo(ex - s, ey + s);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Mouth.
    const mw = 0.19 * p.mouthWidth * clamp(w, 0.7, 1.4) ** 0.7;
    const mx = fx + gx * 0.05;
    const my = Math.min(fy + eyeR * 1.75, b.maxY - 0.1);
    const talk = p.talk > 0.01 ? p.talk * talkSignal(this.time + this.phase * 10, 5) : 0;
    const open = clamp(p.mouthOpen + talk * 0.75 + this.reaction * 0.5, 0, 1.2);
    const curve = p.mouthCurve * (1 - this.reaction * 0.5);
    if (open < 0.08) {
      ctx.lineWidth = eyeR * 0.32;
      ctx.beginPath();
      ctx.moveTo(mx - mw, my);
      ctx.quadraticCurveTo(mx, my + curve * mw * 0.9, mx + mw, my);
      ctx.stroke();
    } else {
      const top = curve * mw * 0.45;
      const depth = open * mw * 1.5 + Math.max(top, 0);
      ctx.beginPath();
      ctx.moveTo(mx - mw, my);
      ctx.quadraticCurveTo(mx, my + top, mx + mw, my);
      ctx.quadraticCurveTo(mx, my + depth * 1.6, mx - mw, my);
      ctx.closePath();
      ctx.fill();
      // Tongue.
      if (open > 0.25) {
        ctx.save();
        ctx.clip();
        ctx.fillStyle = 'rgba(255,120,140,0.85)';
        ctx.beginPath();
        ctx.ellipse(mx, my + depth * 0.95, mw * 0.55, depth * 0.38, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
  }
}
