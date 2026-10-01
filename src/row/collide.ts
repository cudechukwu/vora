import { BOUNDS, RowStop, inUsdan } from './layout';

// ─── Where you can walk ────────────────────────────────────────────────
// Buildings on the row are solid slabs from their facade to their back wall.
// The gaps between them (walkways) are open, so you can cut through
// to Andrus Field. Pure function: old position + wanted position → allowed.
//
// `extra` adds finer rules (used for your house): solid boxes, an optional
// set of walkable boxes you must stay inside (upstairs floors), and "lots"
// that extend the world past the far sidewalk (your front yard).

export interface XZ { x: number; z: number }
export interface Box { x0: number; x1: number; z0: number; z1: number }
export interface Extra {
  solids?: Box[];
  walkable?: Box[];
  lots?: Box[];
  /** Inside a building on the map (e.g. Usdan): ignore its outside walls, but stay where this says you can stand. */
  interior?: (p: XZ) => boolean;
}

const PAD = 0.8; // keep this far off a wall

export const inBox = (p: XZ, b: Box) => p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1;

function inside(stops: RowStop[], x: number, z: number): RowStop | undefined {
  return stops.find((s) => z <= s.z0 + 0.5 && z >= s.z1 - 0.5 && x < s.front + PAD && x > s.back - PAD);
}

function rowMove(prev: XZ, want: XZ, stops: RowStop[], xMax: number): XZ {
  let x = Math.min(xMax, Math.max(BOUNDS.xMin, want.x));
  let z = Math.min(BOUNDS.zMax, Math.max(BOUNDS.zMin, want.z));
  // Usdan (not on the row, a big triangle behind it): slide along its walls
  if (inUsdan({ x, z }, PAD) && !inUsdan(prev, PAD)) {
    if (!inUsdan({ x, z: prev.z }, PAD)) z = prev.z;
    else if (!inUsdan({ x: prev.x, z }, PAD)) x = prev.x;
    else return { x: prev.x, z: prev.z };
  }
  const hit = inside(stops, x, z);
  if (!hit) return { x, z };
  // slide along whichever wall you ran into
  if (prev.x >= hit.front + PAD) x = hit.front + PAD; // facade, from the walk
  else if (prev.x <= hit.back - PAD) x = hit.back - PAD; // back wall, from the back road
  else z = prev.z; // side wall, from a walkway
  // still stuck (e.g. a corner)? stay put
  return inside(stops, x, z) ? { x: prev.x, z: prev.z } : { x, z };
}

export function resolveMove(prev: XZ, want: XZ, stops: RowStop[], extra?: Extra): XZ {
  const lots = extra?.lots ?? [];
  const xMax = Math.max(BOUNDS.xMax, ...lots.map((l) => l.x1));
  const p = extra?.interior
    ? { x: Math.min(xMax, Math.max(BOUNDS.xMin, want.x)), z: Math.min(BOUNDS.zMax, Math.max(BOUNDS.zMin, want.z)) }
    : rowMove(prev, want, stops, xMax);
  if (!extra) return p;
  const ok = (q: XZ) =>
    (q.x <= BOUNDS.xMax || lots.some((l) => inBox(q, l)))
    && !(extra.solids ?? []).some((b) => inBox(q, b))
    && (!extra.walkable || extra.walkable.some((b) => inBox(q, b)))
    && (!extra.interior || extra.interior(q));
  if (ok(p)) return p;
  // safety net: if you're somehow already inside something (a car pulled up, a floor change), never freeze —
  // let any move that gets you out (or at least doesn't trap you) through
  if (!ok(prev)) return p;
  // slide: keep whichever axis still works
  const sx = { x: p.x, z: prev.z }, sz = { x: prev.x, z: p.z };
  if (ok(sx)) return sx;
  if (ok(sz)) return sz;
  return { x: prev.x, z: prev.z };
}

/** Would standing at p be against the rules (in a building, out of bounds, in a solid, off the floor)? */
export function blockedAt(p: XZ, stops: RowStop[], extra?: Extra): boolean {
  const lots = extra?.lots ?? [];
  if (p.x < BOUNDS.xMin || p.z < BOUNDS.zMin || p.z > BOUNDS.zMax) return true;
  if (p.x > BOUNDS.xMax && !lots.some((l) => inBox(p, l))) return true;
  if (inside(stops, p.x, p.z) || inUsdan(p, PAD)) return true;
  if (!extra) return false;
  return (extra.solids ?? []).some((b) => inBox(p, b)) || (!!extra.walkable && !extra.walkable.some((b) => inBox(p, b)));
}
