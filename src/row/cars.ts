import { Box, Extra, XZ, blockedAt, inBox } from './collide';
import { ROAD, RowStop } from './layout';
import { LANES, TrafficState, Vehicle, addVehicle, laneX, removeVehicle } from './traffic';
import { DRIVEWAYS, RoommateId, toWorld } from './house/plan';

// ─── Cars you can own, drive, steal and jack (pure rules, no three.js) ──
// Your car sits in your driveway (left of your house, from the street);
// kofi's sits in the other one. Get in yours and drive. Get in anyone
// else's and you've stolen it. Walk up to a car stopped on High Street
// and you can pull the driver out and take it.
//
// Driving is one-thumb, like the bikes: push the stick where you want to
// go and the car steers that way; point it behind the car and you reverse.
//
// A stranger's car left in the road rejoins traffic once you've walked
// away. Your car and kofi's get towed back to their driveways instead.

export type CarKind = 'car' | 'truck';
/** Whose it is: you, a roommate, or (null) a stranger. */
export type Owner = 'you' | RoommateId | null;

export interface Car {
  id: number;
  kind: CarKind;
  len: number;
  color: number;
  x: number;
  z: number;
  heading: number; // radians, 0 = +z (same as people)
  speed: number; // m/s along the heading; negative = reversing
  owner: Owner;
  cruise: number; // how fast it goes when it's back in traffic
  stolen: boolean; // you've taken it without asking
}

export interface Garage { cars: Car[]; driving: number | null }

export const SPEC = {
  car: { top: 16, reverse: 5, accel: 6, turn: 2.1, halfW: 0.95 },
  truck: { top: 11, reverse: 3.5, accel: 3.5, turn: 1.5, halfW: 1.2 },
} as const;
const BRAKE = 14; // m/s² when you pull the stick the other way
const COAST = 4; // m/s² when you let go
const REVERSE_ARC = 2.1; // stick more than this far (rad) from the nose = reverse

export const REACH = 1.7; // how close (to the side of a car) you must be to get in
export const JACK_SPEED = 3; // a car in traffic must be this slow (m/s) to jack
export const JACK_REACH = 3; // …and this close — step out in front of one, it stops, and it's in reach
export const LEAVE_AFTER = 40; // metres you must be from a car left in the road before it's moved

export const YOUR_PAINT = 0x2b3a66;
export const KOFI_PAINT = 0xd8c9a0;

/** Centre to back axle. */
const axle = (c: { len: number }) => c.len / 2 - 0.9;
const fwd = (h: number) => ({ x: Math.sin(h), z: Math.cos(h) });
/** The driver's side (left, in a US car). */
const left = (h: number) => ({ x: Math.cos(h), z: -Math.sin(h) });

export const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Where a driveway's car parks, facing the street (backed in). */
export function drivewaySpot(owner: 'you' | RoommateId) {
  const d = DRIVEWAYS.find((x) => x.owner === owner)!;
  return { ...toWorld(d.park.u, d.park.v), heading: -Math.PI / 2 };
}

const mkCar = (id: number, owner: Owner, color: number, at: { x: number; z: number; heading: number }): Car =>
  ({ id, kind: 'car', len: 4.4, color, ...at, speed: 0, owner, cruise: 10.5, stolen: false });

/** Your car + kofi's, each in its driveway (yours wherever you last left it, if saved). */
export function createGarage(saved: SavedCar | null = null): Garage {
  return {
    cars: [mkCar(0, 'you', YOUR_PAINT, saved ?? drivewaySpot('you')), mkCar(1, 'kofi', KOFI_PAINT, drivewaySpot('kofi'))],
    driving: null,
  };
}

/** How far a point is from the edge of a car's footprint (0 = touching / inside). */
export function distToCar(c: { x: number; z: number; heading: number; len: number; kind: CarKind }, p: XZ): number {
  const dx = p.x - c.x, dz = p.z - c.z, f = fwd(c.heading);
  const along = dx * f.x + dz * f.z, across = dx * f.z - dz * f.x;
  return Math.hypot(Math.max(0, Math.abs(along) - c.len / 2), Math.max(0, Math.abs(across) - SPEC[c.kind].halfW));
}

/** The nearest parked car you could get into, if any. */
export function carAt(g: Garage, p: XZ, reach = REACH): Car | undefined {
  let best: Car | undefined, bd = reach;
  for (const c of g.cars) {
    if (c.id === g.driving) continue;
    const d = distToCar(c, p);
    if (d <= bd) { bd = d; best = c; }
  }
  return best;
}

/** A traffic vehicle as a car-shaped thing (where it is, which way it faces). */
export const asCar = (v: Vehicle) =>
  ({ x: laneX(v), z: v.z, heading: LANES[v.lane].dir > 0 ? 0 : Math.PI, len: v.len, kind: v.kind as CarKind });

/** The nearest car or truck on High Street that's stopped (or nearly) right next to you. */
export function jackable(t: TrafficState, p: XZ, reach = JACK_REACH): Vehicle | undefined {
  let best: Vehicle | undefined, bd = reach;
  for (const v of t.vehicles) {
    if (v.kind === 'bike' || v.speed > JACK_SPEED) continue;
    const d = distToCar(asCar(v), p);
    if (d <= bd) { bd = d; best = v; }
  }
  return best;
}

let nextId = 100;

/**
 * Pull the driver out and take the car. It leaves the traffic sim and becomes yours to drive
 * (a stranger's, stolen). Returns the car and where the driver lands (on the road, by their door).
 */
export function carjack(t: TrafficState, g: Garage, vehicleId: number): { car: Car; driver: XZ & { heading: number } } | null {
  const v = removeVehicle(t, vehicleId);
  if (!v || v.kind === 'bike') { if (v) t.vehicles.push(v); return null; }
  const c = asCar(v);
  const car: Car = { id: nextId++, kind: c.kind, len: v.len, color: v.color, x: c.x, z: c.z, heading: c.heading, speed: 0, owner: null, cruise: v.cruise, stolen: true };
  g.cars.push(car);
  g.driving = car.id;
  const l = left(car.heading), out = SPEC[car.kind].halfW + 0.9;
  return { car, driver: { x: car.x + l.x * out, z: car.z + l.z * out, heading: Math.atan2(l.x, l.z) } };
}

/** Get into a parked car. Taking one that isn't yours is stealing it. */
export function getIn(g: Garage, id: number): Car | null {
  const c = g.cars.find((x) => x.id === id);
  if (!c || g.driving !== null) return null;
  g.driving = id;
  c.speed = 0;
  if (c.owner !== 'you') c.stolen = true;
  return c;
}

/** Get out: the car stays where it is; you step out on the driver's side. */
export function getOut(g: Garage): XZ | null {
  const c = g.cars.find((x) => x.id === g.driving);
  if (!c) return null;
  g.driving = null;
  c.speed = 0;
  const l = left(c.heading), out = SPEC[c.kind].halfW + 0.7;
  return { x: c.x + l.x * out, z: c.z + l.z * out };
}

export const driven = (g: Garage) => g.cars.find((c) => c.id === g.driving);

/**
 * One step of driving. `stick` is the direction you're pushing in world space (length = how hard, 0..1).
 * Updates speed + heading and returns where the car wants to be (collisions are driveMove's job).
 */
export function stepCar(c: Car, dt: number, stick: XZ): XZ {
  if (!(dt > 0)) return { x: c.x, z: c.z };
  const spec = SPEC[c.kind];
  const mag = Math.min(1, Math.hypot(stick.x, stick.z));
  let target = 0, aim = c.heading;
  if (mag > 0.05) {
    const want = Math.atan2(stick.x, stick.z);
    const diff = wrap(want - c.heading);
    const backwards = Math.abs(diff) > REVERSE_ARC;
    if (backwards) {
      // stop first, then back up — tail swinging toward where you're pointing
      target = c.speed > 0.3 ? 0 : -spec.reverse * mag;
      aim = want + Math.PI;
    } else {
      // ease off in tight turns
      target = c.speed < -0.3 ? 0 : spec.top * mag * (1 - 0.55 * Math.min(1, Math.abs(diff) / 1.6));
      aim = want;
    }
  }
  const d = target - c.speed;
  const braking = mag > 0.05 && (target * c.speed < 0 || (target === 0 && c.speed !== 0));
  const slowing = Math.abs(target) < Math.abs(c.speed);
  const rate = braking ? BRAKE : slowing ? COAST : spec.accel;
  c.speed += Math.sign(d) * Math.min(Math.abs(d), rate * dt);
  // a car only turns while it rolls, and it turns about its back axle: the nose swings, the tail follows
  const turn = spec.turn * Math.min(1, Math.abs(c.speed) / 3) * dt;
  const ax = axle(c), f0 = fwd(c.heading);
  const rear = { x: c.x - f0.x * ax, z: c.z - f0.z * ax };
  c.heading = wrap(c.heading + Math.max(-turn, Math.min(turn, wrap(aim - c.heading))));
  const f = fwd(c.heading);
  return { x: rear.x + f.x * (ax + c.speed * dt), z: rear.z + f.z * (ax + c.speed * dt) };
}

/** Points around a car's outline (corners, middle of each end, centre) that must stay clear. */
export function outline(c: { len: number; kind: CarKind }, x: number, z: number, h: number): XZ[] {
  const f = fwd(h), l = left(h), hl = c.len / 2 - 0.1, hw = SPEC[c.kind].halfW - 0.1;
  const at = (a: number, s: number) => ({ x: x + f.x * a + l.x * s, z: z + f.z * a + l.z * s });
  return [at(0, 0), at(hl, 0), at(-hl, 0), at(hl, hw), at(hl, -hw), at(-hl, hw), at(-hl, -hw), at(0, hw), at(0, -hw)];
}

/** How far a blocked point is from the nearest free spot (0 if it's free). */
export function depthIn(p: XZ, blocked: (p: XZ) => boolean): number {
  if (!blocked(p)) return 0;
  const free = (a: number, d: number) => !blocked({ x: p.x + Math.sin(a) * d, z: p.z + Math.cos(a) * d });
  let best = 6;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    let d = 0.25;
    while (d < best + 0.25 && !free(a, d)) d += 0.25;
    if (!free(a, d)) continue;
    // home in on the edge, so tiny moves out of a wall count
    let lo = d - 0.25, hi = d;
    for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (free(a, m)) hi = m; else lo = m; }
    best = Math.min(best, hi);
  }
  return best;
}

/**
 * Move (and turn) a car toward `want` / its new heading, from where it was (`from`, at heading `was`).
 * The rule: no part of the car may end up somewhere it wasn't already blocked. So it can never be pushed
 * into a wall — and if it's somehow in one, any move that doesn't make things worse gets it out.
 * Slides along walls where it can; if the turn itself is what hits, it keeps its old heading.
 */
export function driveMove(c: Car, want: XZ, stops: RowStop[], extra: Extra, was = c.heading): { x: number; z: number; hit: boolean; scrape: boolean } {
  const blocked = (p: XZ) => blockedAt(p, stops, extra);
  const start = outline(c, c.x, c.z, was);
  const before = start.map(blocked);
  // already (somehow) in something: only moves that leave it less far in are allowed
  const stuck = before.some(Boolean);
  const depthBefore = stuck ? start.reduce((s, p) => s + depthIn(p, blocked), 0) : 0;
  const ok = (x: number, z: number, h: number) => {
    const pts = outline(c, x, z, h);
    if (!pts.every((p, i) => before[i] || !blocked(p))) return false;
    return !stuck || pts.reduce((s, p) => s + depthIn(p, blocked), 0) < depthBefore - 1e-9 || pts.every((p) => !blocked(p));
  };
  const h = c.heading;
  if (ok(want.x, want.z, h)) return { ...want, hit: false, scrape: false };
  const tries: [number, number, number][] = [
    [want.x, c.z, h], [c.x, want.z, h], // glancing bump: keep the axis that still works
    [want.x, want.z, was], [want.x, c.z, was], [c.x, want.z, was], // it was the turn that hit
    [c.x, c.z, h],
  ];
  for (const [x, z, hh] of tries) {
    const moved = Math.abs(x - c.x) > 1e-6 || Math.abs(z - c.z) > 1e-6;
    if ((moved || hh !== was) && ok(x, z, hh)) { c.heading = hh; return { x, z, hit: !moved, scrape: moved }; }
  }
  c.heading = was;
  return { x: c.x, z: c.z, hit: true, scrape: false };
}

/** A parked car's footprint (axis-aligned, close enough for collisions), padded by `pad`. */
export function footprint(c: Car, pad = 0): Box {
  const f = fwd(c.heading), hw = SPEC[c.kind].halfW, hl = c.len / 2;
  const ex = Math.abs(f.x) * hl + Math.abs(f.z) * hw + pad, ez = Math.abs(f.z) * hl + Math.abs(f.x) * hw + pad;
  return { x0: c.x - ex, x1: c.x + ex, z0: c.z - ez, z1: c.z + ez };
}

/** Is the car sitting on High Street? */
export const onRoad = (c: XZ) => c.x > ROAD.x0 && c.x < ROAD.x1;

/** The traffic lane a car is lined up in (right lane for its direction, ±0.3 rad), if any. */
export function laneFor(c: Car): number | null {
  const dir = Math.cos(c.heading) > Math.cos(0.3) ? 1 : Math.cos(c.heading) < -Math.cos(0.3) ? -1 : 0;
  if (!dir) return null;
  let best: number | null = null, bd = 1.6;
  LANES.forEach((l, i) => {
    if (l.bikes || l.dir !== dir) return;
    const d = Math.abs(l.x - c.x);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

/**
 * Cars you've left in the road, once you're far enough away: a stranger's car is driven off
 * (back into traffic, if it's lined up in a lane, else just gone); yours and kofi's are towed home.
 * Returns what happened to each, so the view can follow.
 */
export function clearRoad(g: Garage, t: TrafficState, you: XZ): { car: Car; fate: 'traffic' | 'gone' | 'towed'; vehicle?: Vehicle }[] {
  const out: { car: Car; fate: 'traffic' | 'gone' | 'towed'; vehicle?: Vehicle }[] = [];
  for (const c of [...g.cars]) {
    if (c.id === g.driving || !onRoad(c) || Math.hypot(c.x - you.x, c.z - you.z) < LEAVE_AFTER) continue;
    if (c.owner) {
      Object.assign(c, drivewaySpot(c.owner), { speed: 0, stolen: false });
      out.push({ car: c, fate: 'towed' });
      continue;
    }
    g.cars.splice(g.cars.indexOf(c), 1);
    const lane = laneFor(c);
    if (lane === null) { out.push({ car: c, fate: 'gone' }); continue; }
    const vehicle = addVehicle(t, { kind: c.kind, lane, z: c.z, cruise: c.cruise, len: c.len, color: c.color });
    out.push({ car: c, fate: 'traffic', vehicle });
  }
  return out;
}

/** Parked cars as things traffic must stop for (if they're in the road). */
export const roadBlocks = (g: Garage) =>
  g.cars.filter((c) => onRoad(c)).map((c) => {
    const b = footprint(c);
    return { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, hw: (b.x1 - b.x0) / 2, hl: (b.z1 - b.z0) / 2 };
  });

/** Has a roommate's car gone missing from their driveway? */
export function missing(g: Garage, owner: RoommateId): boolean {
  const c = g.cars.find((x) => x.owner === owner);
  if (!c) return true;
  const s = drivewaySpot(owner);
  return Math.hypot(c.x - s.x, c.z - s.z) > 3;
}

/** Is a point in a driveway? */
export const inDriveway = (p: XZ) => DRIVEWAYS.some((d) => {
  const a = toWorld(d.u0, d.v0), b = toWorld(d.u1, d.v1);
  return inBox(p, { x0: a.x, x1: b.x, z0: a.z, z1: b.z });
});

// ── your car stays where you left it ──
export interface SavedCar { x: number; z: number; heading: number }

export const saveMine = (g: Garage): string => {
  const c = g.cars.find((x) => x.owner === 'you')!;
  return JSON.stringify({ x: +c.x.toFixed(2), z: +c.z.toFixed(2), heading: +c.heading.toFixed(3) });
};

/** Parse a saved spot; anything odd (or left in the road) → back to the driveway. */
export function loadMine(raw: string | null): SavedCar | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (![s?.x, s?.z, s?.heading].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
    if (onRoad(s)) return null; // it'd have been towed
    return { x: s.x, z: s.z, heading: s.heading };
  } catch { return null; }
}
