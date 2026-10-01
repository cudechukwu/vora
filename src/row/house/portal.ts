import { FRONT_DOOR, HOUSE } from './plan';

// ─── The front door is a portal (pure) ─────────────────────────────────
// Outside, the house is a closed building. Step into the doorway (or tap
// "Go inside") and you're taken into the house — its own little world, no
// street or sky. Step back into the doorway from inside and you're put at
// the bottom of the porch steps, facing High Street, so leaving is never
// confusing.

/** Which world you're in: outside, inside your house, or inside Usdan. */
export type Where = 'out' | 'in' | 'usdan';

/** Where you appear (house-local u, v) and which way you face (radians, 0 = +v). */
export const ENTER_AT = { u: 1.7, v: (FRONT_DOOR.v0 + FRONT_DOOR.v1) / 2, heading: Math.PI / 2 }; // in the hall, facing in
export const EXIT_AT = { u: -3.9, v: (FRONT_DOOR.v0 + FRONT_DOOR.v1) / 2, heading: -Math.PI / 2 }; // foot of the porch steps, facing the street

const inDoorway = (v: number) => v > FRONT_DOOR.v0 + 0.1 && v < FRONT_DOOR.v1 - 0.1;

/** Should stepping onto (u, v) take you through the door? */
export function portalAt(where: Where, u: number, v: number): 'enter' | 'exit' | null {
  if (where === 'out' && u > -0.35 && u < 0.6 && inDoorway(v)) return 'enter';
  if (where === 'in' && u < 0.6 && inDoorway(v)) return 'exit';
  return null;
}

/** Close enough to the door to offer the button. */
export function nearDoor(where: Where, u: number, v: number): boolean {
  const mid = (FRONT_DOOR.v0 + FRONT_DOOR.v1) / 2;
  return where === 'out'
    ? u > -2.6 && u < 0 && Math.abs(v - mid) < 1.4
    : u > 0 && u < 2.4 && Math.abs(v - mid) < 1.4;
}

// ── keeping the camera out of the house ──

/** House footprint (+ a little margin), world coords. */
const BOX = { x0: HOUSE.x0 - 0.35, x1: HOUSE.x0 + HOUSE.depth + 0.35, z0: HOUSE.zc - HOUSE.width / 2 - 0.35, z1: HOUSE.zc + HOUSE.width / 2 + 0.35 };

/**
 * Outside, if the house stands between you and where the camera wants to be,
 * how far along that line (0..1) the camera may go before hitting the wall. 1 = clear.
 */
export function cameraClearance(you: { x: number; z: number }, cam: { x: number; z: number }): number {
  const dx = cam.x - you.x, dz = cam.z - you.z;
  let t0 = 0, t1 = 1;
  for (const [p, d, lo, hi] of [[you.x, dx, BOX.x0, BOX.x1], [you.z, dz, BOX.z0, BOX.z1]] as const) {
    if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return 1; continue; }
    let a = (lo - p) / d, b = (hi - p) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return 1;
  }
  return t0 > 0 ? t0 : 1; // you're outside the box, so the camera stops where the line enters it
}
