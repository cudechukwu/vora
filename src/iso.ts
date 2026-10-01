import { TILE_W, TILE_H } from './config';

// ─── Isometric coordinate math ─────────────────────────────────────────
// Grid space (gx, gy) are floating-point tile coordinates.
// World space is the rendered 2D plane (before camera offset).
// We use the classic 2:1 diamond projection.

export interface Grid {
  gx: number;
  gy: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Grid tile -> world pixel (center of the tile's top diamond). */
export function gridToWorld(gx: number, gy: number): Point {
  return {
    x: (gx - gy) * (TILE_W / 2),
    y: (gx + gy) * (TILE_H / 2),
  };
}

/** World pixel -> floating grid coordinate. Inverse of gridToWorld. */
export function worldToGrid(x: number, y: number): Grid {
  const a = x / (TILE_W / 2);
  const b = y / (TILE_H / 2);
  return {
    gx: (a + b) / 2,
    gy: (b - a) / 2,
  };
}

/** Depth key for painter's-algorithm sorting. Higher = drawn in front. */
export function depth(gx: number, gy: number): number {
  return gx + gy;
}
