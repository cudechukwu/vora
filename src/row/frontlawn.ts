import { PATH_HALF, ROAD, RowStop, WALK_MAX_Z, WALK_MIN_Z, XZ, byId, layoutRow } from './layout';
import { rng } from './noise';

// ─── The lawn in front of College Row (pure) ───────────────────────────
// From the user's photos and aerial views (2026-10-07): between the walk along the row and High Street, a big open
// lawn of mown grass under big old trees, crossed by walks. The walkways between the buildings carry straight on
// across it to the crosswalks; a straight walk out from the chapel; a V from North College's portico, its two arms
// spreading to the street; a Y from South College; a big X in front of Judd and the chapel; benches by the walks. A
// sidewalk runs along High Street on this side (`NEAR_WALK`).

export interface LawnWalk { a: XZ; b: XZ; w: number }

/** The sidewalk along High Street, on the campus side. */
export const NEAR_WALK = { x0: ROAD.x0 - 3.2, x1: ROAD.x0 } as const;
/** The lawn: from the walk along the row to that sidewalk. */
export const FRONT_LAWN = { x0: PATH_HALF + 0.25, x1: NEAR_WALK.x0, z0: WALK_MAX_Z, z1: WALK_MIN_Z } as const;

const W = PATH_HALF, S = NEAR_WALK.x0 + 0.3; // where a walk meets the row's walk, and the sidewalk

/** Its walks (not counting the walkways between the buildings, which run on straight across it). */
export function frontWalks(stops: RowStop[] = layoutRow().stops): LawnWalk[] {
  const at = (id: Parameters<typeof byId>[1]) => byId(stops, id);
  const chapel = at('chapel'), south = at('south'), north = at('north'), judd = at('judd');
  return [
    // the straight walk out from the chapel's door
    { a: { x: W, z: chapel.doorZ }, b: { x: S, z: chapel.doorZ }, w: 2.2 },
    // the V from North College's portico: two arms spreading to the street
    { a: { x: W, z: north.doorZ }, b: { x: S, z: north.doorZ - 22 }, w: 2.2 },
    { a: { x: W, z: north.doorZ }, b: { x: S, z: north.doorZ + 22 }, w: 2.2 },
    // the Y from South College: its stem straight out, then two arms
    { a: { x: W, z: south.doorZ }, b: { x: 16, z: south.doorZ }, w: 2.2 },
    { a: { x: 16, z: south.doorZ }, b: { x: S, z: south.doorZ - 12 }, w: 2 },
    { a: { x: 16, z: south.doorZ }, b: { x: S, z: south.doorZ + 12 }, w: 2 },
    // the big X in front of Judd and the chapel, corner to corner
    { a: { x: W, z: judd.z0 }, b: { x: S, z: chapel.z1 + 4 }, w: 2.2 },
    { a: { x: W, z: chapel.z1 + 4 }, b: { x: S, z: judd.z0 }, w: 2.2 },
  ];
}

/** How far p is from the edge of the nearest walk across the lawn (the walkways between the buildings included). */
export function frontWalkDist(p: XZ, walks: LawnWalk[], crossings: { z: number; w: number }[]): number {
  let best = Infinity;
  for (const wk of walks) {
    const dx = wk.b.x - wk.a.x, dz = wk.b.z - wk.a.z, t = Math.max(0, Math.min(1, ((p.x - wk.a.x) * dx + (p.z - wk.a.z) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(p.x - (wk.a.x + dx * t), p.z - (wk.a.z + dz * t)) - wk.w / 2);
  }
  for (const c of crossings) best = Math.min(best, Math.abs(p.z - c.z) - c.w / 2);
  return best;
}

/** The big old trees on it: scattered, off the walks, not too close to each other. */
export function frontTrees(stops: RowStop[] = layoutRow().stops, crossings = layoutRow().crossings): (XZ & { s: number })[] {
  const walks = frontWalks(stops), out: (XZ & { s: number })[] = [];
  const L = FRONT_LAWN;
  for (let i = 0; out.length < 18 && i < 900; i++) { // (a few big ones, well apart: the user, 2026-10-07)
    const p = { x: L.x0 + 3 + rng(7100 + i) * (L.x1 - L.x0 - 5), z: L.z0 + rng(7300 + i) * (L.z1 - L.z0) };
    if (frontWalkDist(p, walks, crossings) < 3) continue;
    if (out.some((t) => Math.hypot(t.x - p.x, t.z - p.z) < 18)) continue;
    out.push({ ...p, s: 1.9 + rng(7500 + i) * 0.7 });
  }
  return out;
}

/** Benches beside the walks (facing them): a point beside each walk, along it. */
export function frontBenches(stops: RowStop[] = layoutRow().stops): (XZ & { rot: number })[] {
  return frontWalks(stops).slice(0, 7).map((wk, i) => {
    const t = 0.55, dx = wk.b.x - wk.a.x, dz = wk.b.z - wk.a.z, l = Math.hypot(dx, dz), side = i % 2 ? 1 : -1;
    return { x: wk.a.x + dx * t + (-dz / l) * side * (wk.w / 2 + 1), z: wk.a.z + dz * t + (dx / l) * side * (wk.w / 2 + 1), rot: Math.atan2(dx, dz) };
  });
}
