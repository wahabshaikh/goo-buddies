export const enum ParticleKind {
  /** Rises inside the body (thinking). */
  Bubble,
  /** Ring left by a bubble popping at the top. */
  Pop,
  /** Flung off the surface (working). */
  Droplet,
  /** A droplet that hit the floor. */
  Splat,
  /** A sleepy z in a bubble. */
  Zee,
  /** A twinkle (happy). */
  Sparkle,
}

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds lived and seconds to live. */
  age: number;
  life: number;
  size: number;
  spin: number;
}

export const MAX_PARTICLES = 64;
export const GRAVITY = 7;
