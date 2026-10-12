import { describe, expect, test } from 'bun:test';
import { darken, desaturate, lighten, mixColor, parseColor, toCss } from '../src/core/color';
import { clamp, damp, lerp, pointInPolygon, polygonArea, smoothstep } from '../src/core/math';
import { createRandom, hashSeed, valueNoise } from '../src/core/random';
import { buildOutline, getOutline, RIM_POINTS } from '../src/core/shapes';
import {
  gooMaterials,
  gooShapes,
  gooStates,
  isGooMaterial,
  isGooShape,
  isGooState,
} from '../src/types';

describe('lists', () => {
  test('exports every state, shape and material', () => {
    expect(gooStates).toEqual([
      'idle', 'thinking', 'searching', 'listening', 'speaking', 'working', 'happy', 'error', 'sleeping',
    ]);
    expect(gooShapes).toEqual(['drop', 'round', 'cube', 'puffball']);
    expect(gooMaterials).toEqual(['jelly', 'slime', 'gummy']);
  });

  test('guards', () => {
    expect(isGooState('thinking')).toBe(true);
    expect(isGooState('dancing')).toBe(false);
    expect(isGooShape('drop')).toBe(true);
    expect(isGooShape(3)).toBe(false);
    expect(isGooMaterial('gummy')).toBe(true);
    expect(isGooMaterial('rubber')).toBe(false);
  });
});

describe('math', () => {
  test('basics', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(lerp(2, 4, 0.5)).toBe(3);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });

  test('damp is frame-rate independent', () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = damp(a, 1, 3, 1 / 60);
    let b = 0;
    for (let i = 0; i < 120; i++) b = damp(b, 1, 3, 1 / 120);
    expect(a).toBeCloseTo(b, 10);
    expect(a).toBeCloseTo(1 - Math.exp(-3), 10);
  });

  test('polygon area and containment', () => {
    const xs = [0, 2, 2, 0];
    const ys = [0, 0, 2, 2];
    expect(polygonArea(xs, ys)).toBe(4);
    expect(pointInPolygon(1, 1, xs, ys)).toBe(true);
    expect(pointInPolygon(3, 1, xs, ys)).toBe(false);
  });
});

describe('random', () => {
  test('same seed, same sequence; different seed, different sequence', () => {
    const a = createRandom(0.3);
    const b = createRandom(0.3);
    const c = createRandom(0.7);
    const sa = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(sa);
    expect([c(), c(), c()]).not.toEqual(sa);
    for (const v of sa) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  test('hashSeed tolerates odd input', () => {
    expect(Number.isInteger(hashSeed(Number.NaN))).toBe(true);
    expect(hashSeed(1)).not.toBe(hashSeed(2));
  });

  test('valueNoise is smooth and bounded', () => {
    for (let t = 0; t < 10; t += 0.05) {
      const v = valueNoise(t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(Math.abs(valueNoise(t + 0.001) - v)).toBeLessThan(0.01);
    }
  });
});

describe('color', () => {
  test('parses hex and rgb()', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('#4fd1a5')).toEqual({ r: 79, g: 209, b: 165 });
    expect(parseColor('#4fd1a580')).toEqual({ r: 79, g: 209, b: 165 });
    expect(parseColor('rgb(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3 });
    expect(parseColor('rgba(1 2 3 / 50%)')).toEqual({ r: 1, g: 2, b: 3 });
    expect(parseColor('papayawhip')).toBeNull();
  });

  test('mixes', () => {
    const red = { r: 255, g: 0, b: 0 };
    expect(mixColor(red, { r: 0, g: 0, b: 255 }, 0.5)).toEqual({ r: 127.5, g: 0, b: 127.5 });
    expect(lighten(red, 1)).toEqual({ r: 255, g: 255, b: 255 });
    expect(darken(red, 1)).toEqual({ r: 0, g: 0, b: 0 });
    const grey = desaturate(red, 1);
    expect(grey.r).toBeCloseTo(grey.g);
    expect(toCss({ r: 1.4, g: 2.6, b: 3 }, 2)).toBe('rgba(1,3,3,1)');
  });
});

describe('shapes', () => {
  test.each([...gooShapes])('%s outline is normalised and well formed', (shape) => {
    const o = buildOutline(shape);
    expect(o.x.length).toBe(RIM_POINTS);
    expect(polygonArea(o.x, o.y)).toBeGreaterThan(0);
    expect(Math.min(...o.x)).toBeCloseTo(-1, 5);
    expect(Math.max(...o.x)).toBeCloseTo(1, 5);
    expect(Math.max(...o.y)).toBeCloseTo(0, 5);
    expect(Math.min(...o.y)).toBeCloseTo(-o.height, 5);
    expect(o.height).toBeGreaterThan(1.5);
    expect(o.height).toBeLessThan(2.6);
    // Evenly spaced by arc length.
    const gaps: number[] = [];
    for (let i = 0; i < RIM_POINTS; i++) {
      const j = (i + 1) % RIM_POINTS;
      gaps.push(Math.hypot(o.x[j] - o.x[i], o.y[j] - o.y[i]));
    }
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThan(1.6);
  });

  test('the drop is taller than it is wide', () => {
    expect(getOutline('drop').height).toBeGreaterThan(2);
  });

  test('outlines are cached', () => {
    expect(getOutline('cube')).toBe(getOutline('cube'));
  });
});
