import type { GooState } from '../types';
import { damp } from './math';

/**
 * Everything a state means for the body, face and particles, as plain numbers,
 * so switching states is just easing one pose into another.
 */
export interface Pose {
  /** Base stretch of the body. */
  scaleX: number;
  scaleY: number;
  /** Slow breathing: amplitude (fraction of height) and rate (Hz). */
  breathe: number;
  breatheRate: number;
  /** Side-to-side ooze: amplitude (body units) and rate (Hz). */
  sway: number;
  swayRate: number;
  /** Bouncing: hop height (body units) and rate (Hz). */
  hop: number;
  hopRate: number;
  /** Fast nervous jitter (body units). */
  shiver: number;
  /** Surface ripple at rest, plus how much the `level` prop adds to it. */
  ripple: number;
  levelGain: number;
  /** Talking pulse of the whole body. */
  pulse: number;
  /** Churning waves round the rim (amplitude, Hz). */
  churn: number;
  churnRate: number;
  /** 0 standing, 1 a puddle. */
  melt: number;
  /** Multiplier on the spring stiffness: lower is wobblier. */
  stiffness: number;
  /** 0 the chosen colour, 1 a murky swamp version of it. */
  murk: number;
  /** Eyes: openness, resting gaze, how much they dart about. */
  eyeOpen: number;
  lookX: number;
  lookY: number;
  dart: number;
  /** Eye styles, as weights: ^ ^, X X and closed. Plain round eyes fill the rest. */
  eyeHappy: number;
  eyeCross: number;
  eyeClosed: number;
  /** Mouth: -1 frown … 1 smile, resting openness, width, and how much it talks. */
  mouthCurve: number;
  mouthOpen: number;
  mouthWidth: number;
  talk: number;
  blush: number;
  /** Particles per second. */
  bubbles: number;
  droplets: number;
  zees: number;
  sparkles: number;
}

const base: Pose = {
  scaleX: 1,
  scaleY: 1,
  breathe: 0.025,
  breatheRate: 0.35,
  sway: 0.02,
  swayRate: 0.18,
  hop: 0,
  hopRate: 1.6,
  shiver: 0,
  ripple: 0,
  levelGain: 0,
  pulse: 0,
  churn: 0,
  churnRate: 0.6,
  melt: 0,
  stiffness: 1,
  murk: 0,
  eyeOpen: 1,
  lookX: 0,
  lookY: 0,
  dart: 0,
  eyeHappy: 0,
  eyeCross: 0,
  eyeClosed: 0,
  mouthCurve: 0.45,
  mouthOpen: 0,
  mouthWidth: 1,
  talk: 0,
  blush: 0,
  bubbles: 0,
  droplets: 0,
  zees: 0,
  sparkles: 0,
};

export const statePoses: Readonly<Record<GooState, Readonly<Pose>>> = {
  idle: base,
  thinking: {
    ...base,
    scaleX: 0.9,
    scaleY: 1.14,
    breathe: 0.03,
    sway: 0.05,
    swayRate: 0.22,
    lookX: 0.55,
    lookY: -0.8,
    eyeOpen: 0.85,
    mouthCurve: -0.05,
    mouthWidth: 0.6,
    bubbles: 2.6,
  },
  searching: {
    ...base,
    sway: 0.28,
    swayRate: 0.45,
    stiffness: 0.85,
    dart: 1,
    eyeOpen: 1.05,
    mouthCurve: 0.1,
    mouthWidth: 0.7,
  },
  listening: {
    ...base,
    scaleY: 1.04,
    breathe: 0.015,
    ripple: 0.012,
    levelGain: 0.09,
    eyeOpen: 1.1,
    lookY: -0.15,
    mouthCurve: 0.3,
    mouthOpen: 0.12,
    mouthWidth: 0.55,
  },
  speaking: {
    ...base,
    pulse: 0.06,
    eyeOpen: 1,
    mouthCurve: 0.35,
    mouthWidth: 0.95,
    talk: 1,
  },
  working: {
    ...base,
    scaleX: 1.05,
    scaleY: 0.96,
    breathe: 0,
    churn: 0.06,
    churnRate: 0.9,
    stiffness: 0.9,
    eyeOpen: 0.7,
    lookY: 0.55,
    mouthCurve: 0,
    mouthWidth: 0.5,
    droplets: 2.4,
  },
  happy: {
    ...base,
    hop: 0.32,
    hopRate: 1.7,
    stiffness: 0.75,
    eyeHappy: 1,
    mouthCurve: 1,
    mouthOpen: 0.45,
    mouthWidth: 1.15,
    blush: 1,
    sparkles: 2,
  },
  error: {
    ...base,
    scaleX: 1.04,
    scaleY: 0.94,
    breathe: 0,
    sway: 0,
    shiver: 0.035,
    stiffness: 1.5,
    murk: 1,
    eyeCross: 1,
    mouthCurve: -0.9,
    mouthWidth: 0.8,
  },
  sleeping: {
    ...base,
    breathe: 0.05,
    breatheRate: 0.22,
    sway: 0,
    melt: 1,
    stiffness: 0.6,
    eyeClosed: 1,
    eyeOpen: 0,
    mouthCurve: 0,
    mouthOpen: 0.14,
    mouthWidth: 0.35,
    zees: 0.55,
  },
};

export const poseKeys = Object.keys(base) as (keyof Pose)[];

export const clonePose = (pose: Readonly<Pose>): Pose => ({ ...pose });

/** Linear blend of two poses (t = 0 gives `a`, 1 gives `b`). */
export function blendPose(a: Readonly<Pose>, b: Readonly<Pose>, t: number, out: Pose = { ...a }): Pose {
  for (const k of poseKeys) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

/** Ease `current` towards `target` in place, frame-rate independently. */
export function approachPose(current: Pose, target: Readonly<Pose>, rate: number, dt: number): Pose {
  for (const k of poseKeys) current[k] = damp(current[k], target[k], rate, dt);
  return current;
}

/** The pose with every time-based motion removed: what `paused` and reduced motion draw. */
export function stillPose(pose: Readonly<Pose>): Pose {
  return {
    ...pose,
    // A talking mouth is caught mid-word.
    mouthOpen: pose.mouthOpen + pose.talk * 0.45,
    breathe: 0,
    sway: 0,
    hop: 0,
    shiver: 0,
    ripple: 0,
    levelGain: 0,
    pulse: 0,
    churn: 0,
    dart: 0,
    talk: 0,
  };
}
