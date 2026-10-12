/** Turn any number into a 32-bit integer seed. */
export function hashSeed(seed: number): number {
  let h = Math.floor((Number.isFinite(seed) ? seed : 0) * 2654435761) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Small, fast, seeded PRNG (mulberry32). Returns floats in [0, 1). */
export function createRandom(seed: number): () => number {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lattice = (i: number, salt: number): number => {
  let h = Math.imul(i ^ salt, 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 15), 0x165667b1);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

/** Smooth 1D value noise in [0, 1]; `salt` picks an independent stream. */
export function valueNoise(t: number, salt = 0): number {
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  const a = lattice(i, salt);
  const b = lattice(i + 1, salt);
  return a + (b - a) * u;
}
