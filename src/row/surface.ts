import type { XZ } from './collide';
import { BACK_PATH, Crossing, FAR_WALK, PATH_HALF, PLAZA, PLAZA_GAP, ROAD } from './layout';
import { DRIVEWAYS, toWorld } from './house/plan';
import { FIELD_ROAD, LANDING, STAIRS } from './southend';

// ─── What's under your wheels (pure) ───────────────────────────────────
// Grass takes tyre marks; tar and concrete only when you're skidding.

export type Surface = 'tar' | 'paving' | 'grass';

const inX = (x: number, r: { x0: number; x1: number }) => x >= r.x0 && x <= r.x1;
const inBox = (p: XZ, b: { x0: number; x1: number; z0: number; z1: number }) => p.x >= b.x0 && p.x <= b.x1 && p.z >= b.z0 && p.z <= b.z1;

export function surfaceAt(p: XZ, crossings: Crossing[]): Surface {
  if (inX(p.x, ROAD) || inBox(p, FIELD_ROAD)) return 'tar';
  if (inBox(p, LANDING) || inBox(p, STAIRS)) return 'paving';
  if (inX(p.x, BACK_PATH) && p.z <= FIELD_ROAD.z1) return 'tar';
  if (Math.abs(p.x) <= PATH_HALF || inX(p.x, FAR_WALK) || inBox(p, PLAZA) || inBox(p, PLAZA_GAP)) return 'paving';
  if (crossings.some((c) => Math.abs(p.z - c.z) <= c.w / 2 && p.x > BACK_PATH.x0 - 6 && p.x < ROAD.x0)) return 'paving';
  if (DRIVEWAYS.some((d) => { const a = toWorld(d.u0, d.v0), b = toWorld(d.u1, d.v1); return inBox(p, { x0: a.x, x1: b.x, z0: a.z, z1: b.z }); })) return 'paving';
  return 'grass';
}

/** Should a wheel leave a mark here? Always on grass; on hard ground only when skidding (hard turns or braking at speed). */
export function leavesMark(s: Surface, speed: number, steer: number, braking: boolean): boolean {
  if (Math.abs(speed) < 0.8) return false;
  if (s === 'grass') return true;
  return (Math.abs(steer) > 0.7 && Math.abs(speed) > 11) || (braking && Math.abs(speed) > 8);
}
