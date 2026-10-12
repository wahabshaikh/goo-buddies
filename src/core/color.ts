import { clamp } from './math';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_FN = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i;

/** Parse `#rgb`, `#rrggbb` (with optional alpha) or `rgb()`; null if not understood. */
export function parseColor(input: string): RGB | null {
  const s = input.trim();
  const hex = HEX.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  const fn = RGB_FN.exec(s);
  if (fn) return { r: clamp(+fn[1], 0, 255), g: clamp(+fn[2], 0, 255), b: clamp(+fn[3], 0, 255) };
  return null;
}

let probe: CanvasRenderingContext2D | null | undefined;

/** Parse any CSS colour, falling back to the browser's own parser for names, hsl() and so on. */
export function resolveColor(input: string, fallback: RGB): RGB {
  const direct = parseColor(input);
  if (direct) return direct;
  if (typeof document === 'undefined') return fallback;
  if (probe === undefined) probe = document.createElement('canvas').getContext('2d');
  if (!probe) return fallback;
  probe.fillStyle = '#000';
  probe.fillStyle = input;
  return parseColor(String(probe.fillStyle)) ?? fallback;
}

export const mixColor = (a: RGB, b: RGB, t: number): RGB => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
});

const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };

export const lighten = (c: RGB, t: number): RGB => mixColor(c, WHITE, t);
export const darken = (c: RGB, t: number): RGB => mixColor(c, BLACK, t);

/** Pull a colour towards its own grey by `t` (0 keeps it, 1 is fully grey). */
export function desaturate(c: RGB, t: number): RGB {
  const l = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  return mixColor(c, { r: l, g: l, b: l }, t);
}

export function luminance(c: RGB): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

export const toCss = (c: RGB, alpha = 1): string =>
  `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${+clamp(alpha, 0, 1).toFixed(3)})`;
