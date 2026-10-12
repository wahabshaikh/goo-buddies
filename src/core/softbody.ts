import { polygonArea, polygonPerimeter } from './math';

/**
 * A ring of verlet mass points. Each point is pulled towards a moving target
 * (the animated pose), neighbours share their displacement (so a dent spreads),
 * and an area constraint keeps the goo incompressible (poke one side, the rest bulges).
 */
export interface SoftBody {
  n: number;
  x: Float64Array;
  y: Float64Array;
  px: Float64Array;
  py: Float64Array;
  /** Target positions, written by the motion code every step. */
  tx: Float64Array;
  ty: Float64Array;
  /** Scratch for normals and smoothing. */
  nx: Float64Array;
  ny: Float64Array;
  sx: Float64Array;
  sy: Float64Array;
}

export interface StepParams {
  /** Spring strength towards the target, in 1/s². */
  stiffness: number;
  /** Fraction of velocity lost per second (as an exponential rate). */
  damping: number;
  /** 0–1: how hard the area constraint is enforced per step. */
  pressure: number;
  /** 0–1: how much neighbouring points share their displacement per step. */
  smoothing: number;
  /** y of the floor in body units; points cannot go below it. */
  floorY: number;
  /** 0–1: horizontal velocity lost on touching the floor. */
  friction: number;
}

export const defaultStepParams: StepParams = {
  stiffness: 260,
  damping: 4.5,
  pressure: 0.6,
  smoothing: 0.3,
  floorY: 0,
  friction: 0.35,
};

export function createBody(n: number): SoftBody {
  const f = () => new Float64Array(n);
  return { n, x: f(), y: f(), px: f(), py: f(), tx: f(), ty: f(), nx: f(), ny: f(), sx: f(), sy: f() };
}

/** Place every point exactly on its target, at rest. */
export function snapToTargets(body: SoftBody): void {
  body.x.set(body.tx);
  body.y.set(body.ty);
  body.px.set(body.tx);
  body.py.set(body.ty);
}

export const bodyArea = (body: SoftBody): number => polygonArea(body.x, body.y, body.n);
export const targetArea = (body: SoftBody): number => polygonArea(body.tx, body.ty, body.n);

/** Outward vertex normals (unit), written into body.nx / body.ny. */
export function computeNormals(body: SoftBody): void {
  const { n, x, y, nx, ny } = body;
  for (let i = 0; i < n; i++) {
    const a = i === 0 ? n - 1 : i - 1;
    const b = i === n - 1 ? 0 : i + 1;
    const dx = x[b] - x[a];
    const dy = y[b] - y[a];
    const len = Math.hypot(dx, dy) || 1;
    nx[i] = dy / len;
    ny[i] = -dx / len;
  }
}

/** Advance the body by one fixed step of `dt` seconds. */
export function stepBody(body: SoftBody, p: StepParams, dt: number): void {
  const { n, x, y, px, py, tx, ty, sx, sy } = body;
  const keep = Math.exp(-p.damping * dt);
  const k = p.stiffness * dt * dt;

  // Verlet integration with a spring towards the target.
  for (let i = 0; i < n; i++) {
    const vx = (x[i] - px[i]) * keep;
    const vy = (y[i] - py[i]) * keep;
    px[i] = x[i];
    py[i] = y[i];
    x[i] += vx + (tx[i] - x[i]) * k;
    y[i] += vy + (ty[i] - y[i]) * k;
  }

  // Share displacement-from-target with neighbours: dents spread, features (bumps, tips) survive.
  if (p.smoothing > 0) {
    for (let i = 0; i < n; i++) {
      const a = i === 0 ? n - 1 : i - 1;
      const b = i === n - 1 ? 0 : i + 1;
      const da = (x[a] - tx[a] + x[b] - tx[b]) / 2 - (x[i] - tx[i]);
      const db = (y[a] - ty[a] + y[b] - ty[b]) / 2 - (y[i] - ty[i]);
      sx[i] = da * p.smoothing;
      sy[i] = db * p.smoothing;
    }
    for (let i = 0; i < n; i++) {
      x[i] += sx[i];
      y[i] += sy[i];
    }
  }

  // Keep the area: push the rim out (or in) along its normals.
  if (p.pressure > 0) {
    const goal = polygonArea(tx, ty, n);
    const area = polygonArea(x, y, n);
    const perimeter = polygonPerimeter(x, y, n) || 1;
    const push = ((goal - area) / perimeter) * p.pressure;
    computeNormals(body);
    for (let i = 0; i < n; i++) {
      x[i] += body.nx[i] * push;
      y[i] += body.ny[i] * push;
    }
  }

  // The floor.
  for (let i = 0; i < n; i++) {
    if (y[i] > p.floorY) {
      y[i] = p.floorY;
      py[i] = p.floorY;
      px[i] += (x[i] - px[i]) * p.friction;
    }
  }
}

/** Shove the rim near (cx, cy) inwards: a poke. Returns how many points were moved. */
export function pokeBody(body: SoftBody, cx: number, cy: number, radius: number, strength: number): number {
  const { n, x, y } = body;
  let bx = 0;
  let by = 0;
  for (let i = 0; i < n; i++) {
    bx += x[i];
    by += y[i];
  }
  bx /= n;
  by /= n;
  let moved = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.hypot(x[i] - cx, y[i] - cy);
    if (d > radius * 2) continue;
    const w = Math.exp(-((d / radius) ** 2));
    const ix = bx - x[i];
    const iy = by - y[i];
    const il = Math.hypot(ix, iy) || 1;
    x[i] += (ix / il) * strength * w;
    y[i] += (iy / il) * strength * w;
    moved++;
  }
  return moved;
}

/** Pull rim point `index` (and, falling off, its neighbours) towards (gx, gy): a drag. */
export function pullBody(
  body: SoftBody,
  index: number,
  gx: number,
  gy: number,
  spread: number,
  strength: number,
): void {
  const { n, x, y } = body;
  const dx = gx - x[index];
  const dy = gy - y[index];
  const reach = Math.ceil(spread * 2.5);
  for (let o = -reach; o <= reach; o++) {
    const i = (((index + o) % n) + n) % n;
    const w = Math.exp(-((o / spread) ** 2)) * strength;
    x[i] += dx * w;
    y[i] += dy * w;
  }
}

/** Index of the rim point nearest (px, py), and its distance. */
export function nearestPoint(body: SoftBody, px: number, py: number): [index: number, distance: number] {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < body.n; i++) {
    const d = Math.hypot(body.x[i] - px, body.y[i] - py);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return [best, bestD];
}

/** Total kinetic "energy" proxy: sum of squared per-step velocities. Useful for tests and settling. */
export function bodyMotion(body: SoftBody): number {
  let e = 0;
  for (let i = 0; i < body.n; i++) {
    const vx = body.x[i] - body.px[i];
    const vy = body.y[i] - body.py[i];
    e += vx * vx + vy * vy;
  }
  return e;
}
