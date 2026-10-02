// ─── Deterministic value noise ─────────────────────────────────────────
// Stable hash-based noise so terrain bumps and tree placement don't shimmer
// between frames. No Math.random — same input always yields same output.

function hash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263; // two large primes
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return ((h >>> 0) % 100000) / 100000; // 0..1
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t); // smoothstep
}

/** Smooth 2D value noise in [0,1] at world-ish coordinates. */
export function noise2(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

/** Stable pseudo-random in [0,1] keyed by an integer id (for variety). */
export function rng(id: number): number {
  return hash(id * 2654435761, id ^ 0x9e3779b9);
}
