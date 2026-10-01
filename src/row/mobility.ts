import type { XZ } from './collide';
import { Crossing, PATH_HALF, RowStop, byId } from './layout';

// ─── Getting around (pure rules, no three.js) ──────────────────────────
// On foot you walk; keep the stick pushed and you break into a run. Bikes
// and scooters sit in racks or lie around loose — hop on, ride, and leave
// them anywhere (or click them into a rack with a free space).

export type Mode = 'foot' | 'scooter' | 'bike';
export type RideKind = 'bike' | 'scooter';

/** Top speeds, m/s. */
export const SPEED = { walk: 3.2, run: 6.8, scooter: 8.5, bike: 11 } as const; // bike ~25 mph flat out
export const RUN_AFTER = 2; // seconds of holding the stick pushed before you run
export const RUN_MAG = 0.75; // how far the stick counts as "pushed"
const ACCEL: Record<Mode, number> = { foot: 9, scooter: 5, bike: 4.5 };
const BRAKE = 14;

export const MOUNT_RADIUS = 2.2; // how close you must be to get on
export const RACK_RADIUS = 3.5; // how close to a rack for "Park"
export const SLOT_GAP = 0.9;

export interface Rideable { id: number; kind: RideKind; x: number; z: number; heading: number; rack: number | null; slot: number | null }
export interface Rack { id: number; x: number; z: number; slots: number }
export interface Mobility { rideables: Rideable[]; racks: Rack[] }

export interface Mover {
  mode: Mode;
  riding: number | null; // rideable id
  held: number; // seconds the stick has been pushed past RUN_MAG
  speed: number; // current m/s
}

export const newMover = (): Mover => ({ mode: 'foot', riding: null, held: 0, speed: 0 });
export const isRunning = (m: Mover) => m.mode === 'foot' && m.held >= RUN_AFTER;

/** Speed you're heading for with the stick at `mag` (0..1). */
export function targetSpeed(m: Mover, mag: number): number {
  const top = m.mode === 'foot' ? (isRunning(m) ? SPEED.run : SPEED.walk) : SPEED[m.mode];
  return top * Math.min(1, Math.max(0, mag));
}

/** Advance the run timer and ease speed toward the target. Returns the new speed. */
export function stepMover(m: Mover, dt: number, mag: number): number {
  if (!(dt > 0)) return m.speed; // no time passed (or a bogus negative frame): nothing changes
  m.held = mag >= RUN_MAG ? m.held + dt : 0;
  const target = targetSpeed(m, mag);
  const d = target - m.speed;
  // on wheels, you build speed: quick off the line, slower and slower toward the top
  const pull = m.mode === 'foot' ? ACCEL.foot : ACCEL[m.mode] * (1 - 0.8 * Math.min(1, m.speed / SPEED[m.mode]) ** 2);
  m.speed += d > 0 ? Math.min(d, pull * dt) : Math.max(d, -BRAKE * dt);
  return m.speed;
}

/** Where slot i of a rack is. Bikes stand side by side along z, front wheel toward the walk (+x). */
export function slotPos(r: Rack, i: number) {
  return { x: r.x, z: r.z + (i - (r.slots - 1) / 2) * SLOT_GAP, heading: Math.PI / 2 };
}

export function freeSlot(mob: Mobility, r: Rack): number | null {
  for (let i = 0; i < r.slots; i++) {
    if (!mob.rideables.some((v) => v.rack === r.id && v.slot === i)) return i;
  }
  return null;
}

/** Racks + loose scooters, placed from the layout. Spawn gets a rack right beside it. */
export function createMobility(stops: RowStop[], crossings: Crossing[], spawn: XZ): Mobility {
  const rackX = -PATH_HALF - 1.3; // right at the edge of the walk, reachable without leaving it
  const racks: Rack[] = [{ id: 0, x: rackX, z: spawn.z + 5, slots: 5 }];
  for (const c of crossings) racks.push({ id: racks.length, x: rackX, z: c.z + c.w / 2 + 2.6, slots: 4 });

  const mob: Mobility = { rideables: [], racks };
  const park = (kind: RideKind, rack: number, slot: number) => {
    const p = slotPos(racks[rack], slot);
    mob.rideables.push({ id: mob.rideables.length, kind, ...p, rack, slot });
  };
  park('bike', 0, 0); park('bike', 0, 1); park('scooter', 0, 3);
  racks.slice(1).forEach((r) => { park('bike', r.id, 0); park('bike', r.id, 2); });

  // dockless scooters left along the walk
  const loose = (x: number, z: number, heading: number) =>
    mob.rideables.push({ id: mob.rideables.length, kind: 'scooter', x, z, heading, rack: null, slot: null });
  loose(PATH_HALF + 0.3, spawn.z + 14, 0.3);
  loose(PATH_HALF + 0.3, byId(stops, 'chapel').doorZ + 4, -0.4);
  loose(-PATH_HALF - 3.5, byId(stops, 'north').doorZ + 7, 2.2);
  return mob;
}

/** Closest free rideable within reach, if any. */
export function nearestRideable(mob: Mobility, p: XZ, mover: Mover, maxD = MOUNT_RADIUS): Rideable | undefined {
  let best: Rideable | undefined, bd = maxD;
  for (const v of mob.rideables) {
    if (v.id === mover.riding) continue;
    const d = Math.hypot(v.x - p.x, v.z - p.z);
    if (d <= bd) { bd = d; best = v; }
  }
  return best;
}

/** Closest rack with a free space within reach, if any. */
export function nearestRackWithSpace(mob: Mobility, p: XZ, maxD = RACK_RADIUS): Rack | undefined {
  let best: Rack | undefined, bd = maxD;
  for (const r of mob.racks) {
    const d = Math.hypot(r.x - p.x, r.z - p.z);
    if (d <= bd && freeSlot(mob, r) !== null) { bd = d; best = r; }
  }
  return best;
}

export type Action =
  | { kind: 'ride'; target: Rideable }
  | { kind: 'park'; rack: Rack }
  | { kind: 'getoff' };

/** What the action button would do right now. */
export function actionAt(mob: Mobility, mover: Mover, p: XZ): Action | null {
  if (mover.riding !== null) {
    const rack = nearestRackWithSpace(mob, p);
    return rack ? { kind: 'park', rack } : { kind: 'getoff' };
  }
  const v = nearestRideable(mob, p, mover);
  return v ? { kind: 'ride', target: v } : null;
}

export function mount(mob: Mobility, mover: Mover, id: number): boolean {
  const v = mob.rideables[id];
  if (!v || mover.riding !== null) return false;
  mover.riding = id;
  mover.mode = v.kind;
  mover.held = 0;
  v.rack = v.slot = null;
  return true;
}

/** Keep the ridden bike/scooter under you. */
export function carry(mob: Mobility, mover: Mover, p: XZ, heading: number) {
  if (mover.riding === null) return;
  const v = mob.rideables[mover.riding];
  v.x = p.x; v.z = p.z; v.heading = heading;
}

/**
 * Get off. Near a rack with space it clicks into the nearest free slot;
 * otherwise it's left right where you are. Returns where you now stand.
 */
export function dismount(mob: Mobility, mover: Mover, p: XZ, heading: number): { parked: 'rack' | 'ground'; standAt: XZ } | null {
  if (mover.riding === null) return null;
  const v = mob.rideables[mover.riding];
  mover.riding = null;
  mover.mode = 'foot';
  mover.held = 0;
  mover.speed = Math.min(mover.speed, SPEED.walk);
  const rack = nearestRackWithSpace(mob, p);
  if (rack) {
    const slot = freeSlot(mob, rack)!;
    Object.assign(v, slotPos(rack, slot), { rack: rack.id, slot });
    return { parked: 'rack', standAt: { x: v.x + 1.5, z: v.z } }; // step back onto the walk
  }
  Object.assign(v, { x: p.x, z: p.z, heading, rack: null, slot: null });
  // step off to the side (your right)
  return { parked: 'ground', standAt: { x: p.x - Math.cos(heading) * 0.9, z: p.z + Math.sin(heading) * 0.9 } };
}
