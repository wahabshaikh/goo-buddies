import { describe, expect, test } from 'bun:test';
import { computeTargets } from '../src/core/motion';
import { statePoses } from '../src/core/poses';
import { getOutline, RIM_POINTS } from '../src/core/shapes';
import {
  bodyArea,
  bodyMotion,
  createBody,
  defaultStepParams,
  nearestPoint,
  pokeBody,
  pullBody,
  snapToTargets,
  stepBody,
  targetArea,
} from '../src/core/softbody';
import { gooShapes } from '../src/types';

const STEP = 1 / 120;

function restingBody(shape: (typeof gooShapes)[number] = 'round') {
  const body = createBody(RIM_POINTS);
  computeTargets(getOutline(shape), statePoses.idle, { time: 0, level: 0, phase: 0 }, body.tx, body.ty);
  snapToTargets(body);
  return body;
}

const run = (body: ReturnType<typeof createBody>, seconds: number) => {
  for (let t = 0; t < seconds; t += STEP) stepBody(body, defaultStepParams, STEP);
};

const finite = (body: ReturnType<typeof createBody>) =>
  [...body.x, ...body.y].every((v) => Number.isFinite(v));

describe('soft body', () => {
  test('a body sitting on its targets stays put', () => {
    const body = restingBody();
    const before = Float64Array.from(body.x);
    run(body, 1);
    for (let i = 0; i < body.n; i++) expect(Math.abs(body.x[i] - before[i])).toBeLessThan(1e-6);
    expect(bodyMotion(body)).toBeLessThan(1e-12);
  });

  test('a poke dents the rim, then the body springs back', () => {
    const body = restingBody();
    const [top] = nearestPoint(body, 0, -3);
    const restY = body.y[top];
    const moved = pokeBody(body, body.x[top], body.y[top], 0.5, 0.3);
    expect(moved).toBeGreaterThan(0);
    expect(body.y[top]).toBeGreaterThan(restY + 0.1); // pushed down, into the body
    run(body, 0.05);
    expect(bodyMotion(body)).toBeGreaterThan(0);
    run(body, 4);
    expect(Math.abs(body.y[top] - restY)).toBeLessThan(0.01);
    expect(bodyMotion(body)).toBeLessThan(1e-8);
  });

  test('the area constraint pushes back against a dent', () => {
    const body = restingBody();
    const rest = targetArea(body);
    pokeBody(body, 0, -1.8, 0.6, 0.4);
    const dented = bodyArea(body);
    expect(dented).toBeLessThan(rest);
    stepBody(body, defaultStepParams, STEP);
    expect(Math.abs(bodyArea(body) - rest)).toBeLessThan(Math.abs(dented - rest));
  });

  test('no point ever goes through the floor', () => {
    const body = restingBody('drop');
    for (let i = 0; i < body.n; i++) body.py[i] -= 0.2; // fling everything downwards
    for (let t = 0; t < 2; t += STEP) {
      stepBody(body, defaultStepParams, STEP);
      for (let i = 0; i < body.n; i++) expect(body.y[i]).toBeLessThanOrEqual(defaultStepParams.floorY);
    }
  });

  test('dragging stretches the body towards the pointer and it recovers on release', () => {
    const body = restingBody('cube');
    const [i] = nearestPoint(body, 2, -1);
    const restX = body.x[i];
    for (let t = 0; t < 0.5; t += STEP) {
      pullBody(body, i, restX + 0.8, body.ty[i], 4, 0.22);
      stepBody(body, defaultStepParams, STEP);
    }
    expect(body.x[i]).toBeGreaterThan(restX + 0.2);
    run(body, 4);
    expect(Math.abs(body.x[i] - restX)).toBeLessThan(0.01);
  });

  test('stays finite when hammered with pokes', () => {
    for (const shape of gooShapes) {
      const body = restingBody(shape);
      for (let k = 0; k < 40; k++) {
        pokeBody(body, Math.sin(k) * 1.2, -1 + Math.cos(k), 0.6, 0.6);
        run(body, 0.05);
      }
      expect(finite(body)).toBe(true);
    }
  });

  test('follows a moving target with lag (the jiggle)', () => {
    const body = restingBody();
    const outline = getOutline('round');
    // Jump the targets up by one unit: the body must lag, overshoot, then settle.
    computeTargets(outline, statePoses.idle, { time: 0, level: 0, phase: 0 }, body.tx, body.ty);
    for (let i = 0; i < body.n; i++) body.ty[i] -= 1;
    const top = body.ty.indexOf(Math.min(...body.ty));
    let minY = Infinity;
    for (let t = 0; t < 1; t += STEP) {
      stepBody(body, defaultStepParams, STEP);
      minY = Math.min(minY, body.y[top]);
    }
    expect(minY).toBeLessThan(body.ty[top]); // overshot
    run(body, 4);
    expect(Math.abs(body.y[top] - body.ty[top])).toBeLessThan(0.01);
  });
});
