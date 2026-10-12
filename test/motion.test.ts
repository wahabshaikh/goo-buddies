import { describe, expect, test } from 'bun:test';
import { bounds } from '../src/core/math';
import { computeTargets, hopState, talkSignal } from '../src/core/motion';
import { approachPose, blendPose, clonePose, poseKeys, statePoses, stillPose } from '../src/core/poses';
import { getOutline, RIM_POINTS } from '../src/core/shapes';
import { gooStates, type GooState } from '../src/types';

const targets = (state: GooState, time = 0, level = 0) => {
  const x = new Float64Array(RIM_POINTS);
  const y = new Float64Array(RIM_POINTS);
  computeTargets(getOutline('round'), statePoses[state], { time, level, phase: 0 }, x, y);
  return { x, y, b: bounds(x, y) };
};

describe('poses', () => {
  test('every state has a complete, finite pose', () => {
    for (const state of gooStates) {
      for (const k of poseKeys) expect(Number.isFinite(statePoses[state][k])).toBe(true);
    }
  });

  test('blendPose interpolates every field', () => {
    const mid = blendPose(statePoses.idle, statePoses.sleeping, 0.5);
    expect(mid.melt).toBeCloseTo(0.5);
    expect(mid.eyeClosed).toBeCloseTo(0.5);
    expect(blendPose(statePoses.idle, statePoses.happy, 0)).toEqual({ ...statePoses.idle });
    expect(blendPose(statePoses.idle, statePoses.happy, 1)).toEqual({ ...statePoses.happy });
  });

  test('approachPose morphs smoothly and converges', () => {
    const pose = clonePose(statePoses.idle);
    approachPose(pose, statePoses.error, 4, 1 / 60);
    expect(pose.murk).toBeGreaterThan(0);
    expect(pose.murk).toBeLessThan(0.2);
    for (let i = 0; i < 300; i++) approachPose(pose, statePoses.error, 4, 1 / 60);
    for (const k of poseKeys) expect(pose[k]).toBeCloseTo(statePoses.error[k], 4);
  });

  test('stillPose removes all time-based motion but keeps the look', () => {
    const still = stillPose(statePoses.happy);
    expect(still.hop).toBe(0);
    expect(still.eyeHappy).toBe(1);
    const a = new Float64Array(RIM_POINTS);
    const b = new Float64Array(RIM_POINTS);
    const ay = new Float64Array(RIM_POINTS);
    const by = new Float64Array(RIM_POINTS);
    const s = stillPose(statePoses.speaking);
    computeTargets(getOutline('drop'), s, { time: 0, level: 0, phase: 0 }, a, ay);
    computeTargets(getOutline('drop'), s, { time: 3.7, level: 1, phase: 0 }, b, by);
    expect([...a]).toEqual([...b]);
    expect([...ay]).toEqual([...by]);
  });
});

describe('motion', () => {
  test('the body rests on the floor', () => {
    for (const state of ['idle', 'thinking', 'sleeping', 'error'] as const) {
      expect(targets(state).b.maxY).toBeCloseTo(0, 1);
    }
  });

  test('thinking stretches up, sleeping melts into a puddle', () => {
    const idle = targets('idle').b;
    const thinking = targets('thinking').b;
    const sleeping = targets('sleeping').b;
    const height = (b: typeof idle) => b.maxY - b.minY;
    const width = (b: typeof idle) => b.maxX - b.minX;
    expect(height(thinking)).toBeGreaterThan(height(idle));
    expect(height(sleeping)).toBeLessThan(height(idle) * 0.6);
    expect(width(sleeping)).toBeGreaterThan(width(idle) * 1.3);
  });

  test('listening ripples grow with the level', () => {
    const ripple = (level: number) => {
      const flat = targets('listening', 0.3, 0);
      const t = targets('listening', 0.3, level);
      let d = 0;
      for (let i = 0; i < RIM_POINTS; i++) d = Math.max(d, Math.abs(t.x[i] - flat.x[i]) + Math.abs(t.y[i] - flat.y[i]));
      return d;
    };
    expect(ripple(0)).toBe(0);
    expect(ripple(1)).toBeGreaterThan(ripple(0.3));
    expect(ripple(0.3)).toBeGreaterThan(0);
  });

  test('searching oozes side to side', () => {
    const xs = [0, 0.4, 0.8, 1.2, 1.6, 2].map((t) => targets('searching', t).b.cx);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.2);
  });

  test('happy hops: lifts off and squashes on landing', () => {
    let maxLift = 0;
    let minStretch = 1;
    let maxStretch = 1;
    for (let t = 0; t < 1; t += 0.01) {
      const h = hopState(t, 1, 0.32);
      maxLift = Math.max(maxLift, h.lift);
      minStretch = Math.min(minStretch, h.stretch);
      maxStretch = Math.max(maxStretch, h.stretch);
    }
    expect(maxLift).toBeCloseTo(0.32, 2);
    expect(minStretch).toBeLessThan(0.85);
    expect(maxStretch).toBeGreaterThan(1.1);
    expect(hopState(0.3, 1, 0)).toEqual({ lift: 0, stretch: 1 });
  });

  test('talkSignal stays in 0–1 and has pauses', () => {
    let zeros = 0;
    for (let t = 0; t < 20; t += 0.01) {
      const v = talkSignal(t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      if (v === 0) zeros++;
    }
    expect(zeros).toBeGreaterThan(0);
  });
});
