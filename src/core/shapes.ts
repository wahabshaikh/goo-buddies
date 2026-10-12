import type { GooShape } from '../types';
import { TAU, polygonArea } from './math';

/** Number of mass points on every body's rim. Shared by all shapes so they can morph into each other. */
export const RIM_POINTS = 72;

export interface Outline {
  /** Rest positions in body units: x spans [-1, 1], the bottom sits on y = 0, up is -y. */
  x: Float64Array;
  y: Float64Array;
  /** Rest height (positive). */
  height: number;
  /** Where the face sits, as a fraction of the height measured up from the bottom. */
  faceHeight: number;
}

type Curve = (t: number) => [number, number];

// Each curve is traced once round t ∈ [0, 1) in canvas space (y down) and roughly unit sized;
// `buildOutline` then resamples it evenly by arc length and normalises it.
const curves: Record<GooShape, Curve> = {
  round(t) {
    const a = t * TAU;
    return [Math.cos(a), Math.sin(a) * 0.9];
  },
  cube(t) {
    // A superellipse: a soft rounded cube of jelly.
    const a = t * TAU;
    const p = 2 / 4.6;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [Math.sign(c) * Math.abs(c) ** p, Math.sign(s) * Math.abs(s) ** p * 0.92];
  },
  drop(t) {
    // A teardrop with its point up and a full, heavy bottom.
    const a = t * TAU;
    const x = Math.sin(a) * Math.sin(a / 2) ** 1.25;
    const y = -Math.cos(a) * 0.82;
    return [x, y];
  },
  puffball(t) {
    // A circle ringed with nine soft bumps (a pom-pom).
    const a = t * TAU;
    const r = 0.86 + 0.14 * Math.sqrt(Math.abs(Math.cos(a * 4.5)));
    return [Math.cos(a - Math.PI / 2) * r, Math.sin(a - Math.PI / 2) * r * 0.96];
  },
};

const faceHeights: Record<GooShape, number> = {
  round: 0.52,
  cube: 0.52,
  drop: 0.4,
  puffball: 0.5,
};

/** Resample a closed curve to `n` points evenly spaced along its length. */
export function resampleClosed(curve: Curve, n: number, dense = 2048): [Float64Array, Float64Array] {
  const dx = new Float64Array(dense + 1);
  const dy = new Float64Array(dense + 1);
  const len = new Float64Array(dense + 1);
  for (let i = 0; i <= dense; i++) {
    const [x, y] = curve(i / dense);
    dx[i] = x;
    dy[i] = y;
    if (i > 0) len[i] = len[i - 1] + Math.hypot(x - dx[i - 1], y - dy[i - 1]);
  }
  const total = len[dense];
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const target = (i / n) * total;
    while (k < dense - 1 && len[k + 1] < target) k++;
    const seg = len[k + 1] - len[k] || 1;
    const f = (target - len[k]) / seg;
    xs[i] = dx[k] + (dx[k + 1] - dx[k]) * f;
    ys[i] = dy[k] + (dy[k + 1] - dy[k]) * f;
  }
  return [xs, ys];
}

export function buildOutline(shape: GooShape, n = RIM_POINTS): Outline {
  const [xs, ys] = resampleClosed(curves[shape], n);
  // Keep a positive winding so outward normals are (dy, -dx) along the rim.
  if (polygonArea(xs, ys) < 0) {
    xs.reverse();
    ys.reverse();
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let minY = Infinity;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, xs[i]);
    maxX = Math.max(maxX, xs[i]);
    minY = Math.min(minY, ys[i]);
    maxY = Math.max(maxY, ys[i]);
  }
  const scale = 2 / (maxX - minX);
  const midX = (minX + maxX) / 2;
  for (let i = 0; i < n; i++) {
    xs[i] = (xs[i] - midX) * scale;
    ys[i] = (ys[i] - maxY) * scale;
  }
  return { x: xs, y: ys, height: (maxY - minY) * scale, faceHeight: faceHeights[shape] };
}

const cache = new Map<GooShape, Outline>();

/** The shared rest outline for a shape (built once). Do not mutate it. */
export function getOutline(shape: GooShape): Outline {
  let o = cache.get(shape);
  if (!o) {
    o = buildOutline(shape);
    cache.set(shape, o);
  }
  return o;
}
