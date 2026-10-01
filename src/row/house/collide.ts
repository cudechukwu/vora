import type { Box, Extra } from '../collide';
import {
  FRONT_DOOR, FURNITURE, Level, LOT, PORCH, PORCH_STEPS, R, ROOM_DOORS, STAIRS, STAIRWELL, UPSTAIRS_Y,
  WALLS, Wall, inStairs, stairY, toLocal, toWorld,
} from './plan';

// ─── House collisions + floors (pure) ──────────────────────────────────
// Ground floor: walls (with gaps at doors/arches) and furniture are solid.
// Upstairs: you can only stand on actual floor — the corridor, the landing,
// the stairs and your room (the other bedrooms are closed). The stairs
// carry you between floors: halfway up, you're upstairs.

/** Local rect → world box. */
const box = (u0: number, u1: number, v0: number, v1: number): Box => {
  const a = toWorld(u0, v0), b = toWorld(u1, v1);
  return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) };
};

/** Solid pieces of a wall: everything except doors/arches, inflated by your radius. */
export function wallPieces(w: Wall, pad = R): Box[] {
  const gaps = w.openings.filter((o) => o.kind !== 'window').sort((a, b) => a.a - b.a);
  const pieces: [number, number][] = [];
  let at = w.a;
  for (const g of gaps) { if (g.a > at) pieces.push([at, g.a]); at = Math.max(at, g.b); }
  if (at < w.b) pieces.push([at, w.b]);
  const t = 0.1 + pad;
  return pieces.map(([a, b]) => (w.axis === 'v'
    ? box(w.at - t, w.at + t, a - pad, b + pad)
    : box(a - pad, b + pad, w.at - t, w.at + t)));
}

const furniture = (level: Level) => FURNITURE.filter((f) => f.level === level).map((f) => box(f.u0 - R, f.u1 + R, f.v0 - R, f.v1 + R));

const GROUND_SOLIDS: Box[] = [
  ...WALLS.filter((w) => w.level === 0).flatMap((w) => wallPieces(w)),
  ...furniture(0),
  // porch rails: both ends, and the front except the steps
  box(PORCH.u0 - R, 0, PORCH.v0 - R, PORCH.v0 + 0.1 + R),
  box(PORCH.u0 - R, 0, PORCH.v1 - 0.1 - R, PORCH.v1 + R),
  box(PORCH.u0 - 0.1 - R, PORCH.u0 + 0.1 + R, PORCH.v0, PORCH_STEPS.v0 + R),
  box(PORCH.u0 - 0.1 - R, PORCH.u0 + 0.1 + R, PORCH_STEPS.v1 - R, PORCH.v1),
  box(-1.45 - R, -0.95 + R, -7.2 - R, -4.8 + R), // porch bench
];

/** The free lane up the stairs: from the side wall (v 7.4) to the outside wall (v 9), less wall thickness + your radius. */
export const STAIRS_CHANNEL = { v0: 7.4 + 0.1 + R - 0.001, v1: 9 - 0.1 - R + 0.001 }; // a hair wider than the gap downstairs, never narrower

/** Keeps bikes and scooters out: the front doorway is shut to anything on wheels. */
const DOOR_BLOCK = box(-0.4, 0.4, FRONT_DOOR.v0 - 0.2, FRONT_DOOR.v1 + 0.2);

/** Upstairs floor you can stand on (already inset by your radius from the walls). */
const [r1u] = ROOM_DOORS.R1;
const UPSTAIRS_FLOOR: Box[] = [
  box(0.4, 15.6, 1.9, 3.6), // corridor
  box(3.9, 9.7, 3.6, STAIRWELL.v0 - R), // landing, up to the stairwell rail
  box(STAIRWELL.u1 + R, 9.7, STAIRWELL.v0 - R, 8.7), // beside the top of the stairs
  // the stairs themselves — exactly the channel that's free downstairs too (between the side wall and the
  // outside wall), so switching floors halfway up or down can never put you inside a wall
  box(STAIRS.u0 - 0.2, STAIRS.u1 + 0.4, STAIRS_CHANNEL.v0, STAIRS_CHANNEL.v1),
  box(0.4, 16 / 3 - 0.4, -8.6, 1.1), // your room
  box(r1u - 0.35, r1u + 0.35, 0.9, 2.1), // your door
];

/** The world past the far sidewalk is only open on your lot. */
const LOTS: Box[] = [box(LOT.u0, LOT.u1, LOT.v0, LOT.v1)];

export function houseExtra(level: Level, riding: boolean): Extra {
  if (level === 1) return { walkable: UPSTAIRS_FLOOR, solids: furniture(1), lots: LOTS };
  return { solids: riding ? [...GROUND_SOLIDS, DOOR_BLOCK] : GROUND_SOLIDS, lots: LOTS };
}

/** Which floor you're on after moving to (x, z): only the stairs change it. */
export function levelAt(level: Level, x: number, z: number): Level {
  const { u, v } = toLocal(x, z);
  return inStairs(u, v) ? (stairY(u) > UPSTAIRS_Y / 2 ? 1 : 0) : level;
}

/** Height of the floor under you. */
export function floorY(level: Level, x: number, z: number): number {
  const { u, v } = toLocal(x, z);
  if (inStairs(u, v)) return stairY(u);
  return level === 1 ? UPSTAIRS_Y : 0;
}
