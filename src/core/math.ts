export const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Frame-rate independent exponential approach of `current` towards `target`.
 * `rate` is in 1/seconds: after 1/rate seconds ~63% of the gap is closed.
 */
export const damp = (current: number, target: number, rate: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-rate * dt));

export const fract = (x: number): number => x - Math.floor(x);

/** Signed shoelace area of a closed polygon (positive for the winding our outlines use). */
export function polygonArea(xs: ArrayLike<number>, ys: ArrayLike<number>, n = xs.length): number {
  let a = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) a += xs[j] * ys[i] - xs[i] * ys[j];
  return a / 2;
}

export function polygonPerimeter(xs: ArrayLike<number>, ys: ArrayLike<number>, n = xs.length): number {
  let p = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) p += Math.hypot(xs[i] - xs[j], ys[i] - ys[j]);
  return p;
}

/** Even–odd point-in-polygon test. */
export function pointInPolygon(
  px: number,
  py: number,
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  n = xs.length,
): boolean {
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const yi = ys[i];
    const yj = ys[j];
    if (yi > py !== yj > py && px < ((xs[j] - xs[i]) * (py - yi)) / (yj - yi) + xs[i]) {
      inside = !inside;
    }
  }
  return inside;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  cx: number;
  cy: number;
}

/** Bounding box plus vertex centroid. */
export function bounds(xs: ArrayLike<number>, ys: ArrayLike<number>, n = xs.length): Bounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const y = ys[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    sx += x;
    sy += y;
  }
  return { minX, maxX, minY, maxY, cx: sx / n, cy: sy / n };
}
