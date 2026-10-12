import type { Outline } from './shapes';
import type { Pose } from './poses';
import { TAU, clamp, fract } from './math';
import { valueNoise } from './random';

export interface MotionInput {
  /** Animation clock in seconds (already multiplied by `speed`). */
  time: number;
  /** Smoothed 0–1 input level. */
  level: number;
  /** Per-buddy phase offset so a row of buddies does not move in lockstep. */
  phase: number;
}

/** 0–1 "how open is the mouth" signal that sounds like speech: syllables with gaps. */
export function talkSignal(time: number, salt = 0): number {
  const syllable = valueNoise(time * 7.5, salt);
  const phrase = valueNoise(time * 0.9, salt + 17);
  const gate = clamp((phrase - 0.28) * 3, 0, 1);
  return clamp(syllable * 1.25 * gate, 0, 1);
}

export interface HopState {
  /** Height off the floor (body units, positive is up). */
  lift: number;
  /** Vertical scale from squash (on landing) and stretch (in the air). */
  stretch: number;
}

/** A hop cycle: 65% in the air, then a squash on the ground. */
export function hopState(time: number, rate: number, height: number): HopState {
  if (height <= 0) return { lift: 0, stretch: 1 };
  const amount = height / 0.32;
  const phi = fract(time * rate);
  const air = 0.65;
  if (phi < air) {
    const u = phi / air;
    const v = Math.cos(Math.PI * u); // 1 taking off, -1 landing
    return { lift: height * Math.sin(Math.PI * u), stretch: 1 + 0.14 * amount * Math.abs(v) };
  }
  const g = Math.sin((Math.PI * (phi - air)) / (1 - air));
  return { lift: 0, stretch: 1 - 0.2 * amount * g };
}

/**
 * Write the animated target for every rim point. The body physics then chases
 * these targets, which is where the jiggle and lag come from.
 */
export function computeTargets(
  outline: Outline,
  pose: Readonly<Pose>,
  input: MotionInput,
  outX: Float64Array,
  outY: Float64Array,
): void {
  const { x: rx, y: ry, height: h } = outline;
  const n = rx.length;
  const t = input.time + input.phase * 10;
  const cy0 = -h / 2;

  const breathe = 1 + pose.breathe * Math.sin(TAU * pose.breatheRate * t);
  const talk = pose.pulse > 0 ? talkSignal(t, 5) : 0;
  const pulse = pose.pulse * talk;
  const hop = hopState(t, pose.hopRate, pose.hop);

  let sy = pose.scaleY * breathe * (1 + pulse) * hop.stretch * (1 - 0.48 * pose.melt);
  let sx = (pose.scaleX * (1 + pulse * 0.5) * (1 + 0.4 * pose.melt)) / Math.sqrt(breathe * hop.stretch);
  sy = Math.max(sy, 0.2);
  sx = Math.max(sx, 0.2);

  const swayW = TAU * pose.swayRate * t;
  const swayBase = pose.sway * Math.sin(swayW);
  const swayTop = pose.sway * Math.sin(swayW - 0.9) * 1.15;
  const shiver = pose.shiver * (Math.sin(TAU * 13 * t) * 0.7 + Math.sin(TAU * 21.3 * t) * 0.3);
  const rippleAmp = pose.ripple + pose.levelGain * clamp(input.level, 0, 1);
  const rippleW = TAU * 1.7 * t;
  const churnW = TAU * pose.churnRate * t;
  const lift = hop.lift;

  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    let dx = rx[i];
    let dy = ry[i] - cy0;
    const bottom = clamp(ry[i] / -h, 0, 1); // 0 at the bottom … 1 at the top
    const low = 1 - bottom;

    // Radial surface waves: listening ripples and working churn.
    let dr = 0;
    if (rippleAmp > 0) dr += rippleAmp * Math.sin(7 * a - rippleW) * (0.3 + 0.7 * bottom);
    if (pose.churn > 0) {
      dr += pose.churn * (Math.sin(3 * a + churnW) + 0.5 * Math.sin(5 * a - churnW * 1.4)) * (0.35 + 0.65 * bottom);
    }
    if (dr !== 0) {
      const len = Math.hypot(dx, dy) || 1;
      dx += (dx / len) * dr;
      dy += (dy / len) * dr;
    }

    // Stretch, and spread the bottom out as it melts.
    dx *= sx * (1 + pose.melt * 0.35 * low);
    dy *= sy;

    outX[i] = dx + swayBase * low + swayTop * bottom + shiver * (0.6 + 0.4 * bottom) +
      pose.shiver * 0.25 * Math.sin(i * 12.9898 + t * 47);
    outY[i] = cy0 * sy + dy - lift;
  }
}
