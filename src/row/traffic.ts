import { CROSSWALK_W, Crossing, ROAD, WALK_MAX_Z, WALK_MIN_Z } from './layout';
import { CHURCH } from './southend';
import type { XZ } from './collide';
import { rng } from './noise';

// ─── High Street traffic (pure simulation, no three.js) ────────────────
// Cars, trucks and bikes in four lanes. Every vehicle, every step:
//   1. works out how much road it has ("room") before it must stop —
//      the vehicle ahead, a red light at a crosswalk, a person in its lane;
//   2. eases toward the speed that lets it stop within that room;
//   3. never moves further than the room, so it physically cannot run a
//      red, hit the car ahead, or drive through you.
// Right-hand traffic: vehicles heading +z keep to the −x half of the road.
// The same sim runs Church Street (`createChurchTraffic`, its lanes along x). Where it meets High Street there's a
// signal (`JUNCTION`): High Street's light is the crosswalks' (`lightAt`); Church Street gets green in High Street's
// red (`churchLightAt`). Cars turn between the two (`stepJunction`): right out of Church onto High Street, left off
// High Street into Church, and at Church Street's west end, round and back. No bikes on Church: no lane for them.

export type Kind = 'car' | 'truck' | 'bike';
export type Light = 'green' | 'yellow' | 'red';

export interface Lane { x: number; dir: 1 | -1; bikes: boolean }
export const LANES: Lane[] = [
  { x: ROAD.x0 + 2.6, dir: 1, bikes: false },
  { x: ROAD.x0 + 6.4, dir: -1, bikes: false },
  { x: ROAD.x0 + 0.8, dir: 1, bikes: true },
  { x: ROAD.x0 + 8.2, dir: -1, bikes: true },
];

export const SIGNAL = { green: 16, yellow: 3, red: 11 } as const;
export const SIGNAL_CYCLE = SIGNAL.green + SIGNAL.yellow + SIGNAL.red;

/** Light for road traffic at time t (s). People may cross while it's red. */
export function lightAt(t: number): Light {
  const u = ((t % SIGNAL_CYCLE) + SIGNAL_CYCLE) % SIGNAL_CYCLE;
  return u < SIGNAL.green ? 'green' : u < SIGNAL.green + SIGNAL.yellow ? 'yellow' : 'red';
}

/** Seconds of yellow left at time t (0 if not yellow). */
function yellowLeft(t: number): number {
  const u = ((t % SIGNAL_CYCLE) + SIGNAL_CYCLE) % SIGNAL_CYCLE;
  return lightAt(t) === 'yellow' ? SIGNAL.green + SIGNAL.yellow - u : 0;
}

/** Church Street's light at the junction: green while High Street's is red (a second of all-red either side). */
export function churchLightAt(t: number): Light {
  const u = ((t % SIGNAL_CYCLE) + SIGNAL_CYCLE) % SIGNAL_CYCLE, g0 = SIGNAL.green + SIGNAL.yellow + 1;
  return u >= g0 && u < g0 + CHURCH_GREEN ? 'green' : u >= g0 + CHURCH_GREEN && u < g0 + CHURCH_GREEN + 2.5 ? 'yellow' : 'red';
}
const CHURCH_GREEN = SIGNAL.red - 1 - 2.5 - 1; // (then yellow, then a second of all-red before High Street goes)
function churchYellowLeft(t: number): number {
  const u = ((t % SIGNAL_CYCLE) + SIGNAL_CYCLE) % SIGNAL_CYCLE;
  return churchLightAt(t) === 'yellow' ? SIGNAL.green + SIGNAL.yellow + 1 + CHURCH_GREEN + 2.5 - u : 0;
}

/** Where Church Street meets High Street: the stop lines (High Street's either side of Church's mouth, Church's short of High Street's curb). */
export const JUNCTION = {
  z: (CHURCH.z0 + CHURCH.z1) / 2,
  highStop: { s: CHURCH.z0 - 1.6, n: CHURCH.z1 + 1.6 }, // (heading +z stops at s, heading −z at n)
  churchStop: ROAD.x0 - 1.4,
} as const;

/** A stop line: `at` (along the road) for traffic heading `dir`, and its light. */
export interface StopLine { at: number; dir: 1 | -1; light: (t: number) => Light; yLeft: (t: number) => number }

/** z a vehicle's front bumper must not pass while the light is against it. */
export function stopLineZ(c: Crossing, dir: 1 | -1): number {
  return c.z - dir * (CROSSWALK_W / 2 + 1.2);
}

export interface Vehicle {
  id: number;
  kind: Kind;
  lane: number;
  z: number; // centre
  speed: number; // m/s, ≥ 0
  cruise: number;
  len: number;
  color: number;
  /** seconds this vehicle has been held up by someone standing in its way (drivers honk at that) */
  waited?: number;
  /** when it last went by the junction with Church Street (so each pass counts once) */
  passedAt?: number;
}

export interface TrafficState {
  t: number;
  vehicles: Vehicle[];
  crossings: Crossing[];
  /** the ends of the road (along it); off one end, a vehicle comes back in at the other, unless `hold` */
  zMin: number;
  zMax: number;
  /** its lanes ('x' of each is across the road); and which world axis the road runs along */
  lanes: Lane[];
  axis: 'z' | 'x';
  stops: StopLine[];
  /** vehicles wait at the ends of the road instead of wrapping round (stepJunction moves them on) */
  hold?: boolean;
  /** how many have gone by the junction heading north (every third turns into Church Street) */
  passes?: number;
}

/** World position of a vehicle (its centre), for either road. */
export function vehicleXZ(s: TrafficState, v: Vehicle): XZ {
  const across = s.lanes[v.lane].x;
  return s.axis === 'z' ? { x: across, z: v.z } : { x: v.z, z: across };
}

const KIND: Record<Kind, { len: number; cruise: [number, number] }> = {
  car: { len: 4.4, cruise: [9, 12] },
  truck: { len: 8, cruise: [7.5, 9.5] },
  bike: { len: 1.8, cruise: [4, 5.5] },
};
const PAINT = [0xc8302a, 0xf1f1ee, 0x1e1e22, 0x2b3a66, 0x8a9aa6, 0x3d6b4f, 0xd8c9a0, 0x6b2d2a, 0x4a6fa5];

export const MIN_GAP = 2.2; // bumper to bumper, stopped
export const PED_GAP = 2.5; // how far short of a person a vehicle stops
const DECEL = 4; // comfortable braking, m/s²
const HARD_BRAKE = 9;
const ACCEL = 2.5;
const LOOKAHEAD = 70;

const brakeSpeed = (room: number) => Math.sqrt(2 * DECEL * Math.max(0, room));

export function createTraffic(crossings: Crossing[], perLane = 5, bikesPerLane = 2): TrafficState {
  const zMin = WALK_MAX_Z - 60, zMax = WALK_MIN_Z + 60;
  const vehicles: Vehicle[] = [];
  let id = 0;
  LANES.forEach((lane, li) => {
    const n = lane.bikes ? bikesPerLane : perLane;
    for (let i = 0; i < n; i++) {
      const r = rng(id * 31 + 7);
      const kind: Kind = lane.bikes ? 'bike' : r < 0.2 ? 'truck' : 'car';
      const [c0, c1] = KIND[kind].cruise;
      const cruise = c0 + rng(id * 17 + 3) * (c1 - c0);
      vehicles.push({
        id, kind, lane: li,
        z: zMin + ((i + 0.5 + rng(id) * 0.3) / n) * (zMax - zMin),
        speed: cruise, cruise, len: KIND[kind].len,
        color: PAINT[Math.floor(rng(id * 13 + 1) * PAINT.length)],
      });
      id++;
    }
  });
  const stops: StopLine[] = [];
  for (const c of crossings) for (const d of [1, -1] as const) stops.push({ at: stopLineZ(c, d), dir: d, light: lightAt, yLeft: yellowLeft });
  stops.push({ at: JUNCTION.highStop.s, dir: 1, light: lightAt, yLeft: yellowLeft }, { at: JUNCTION.highStop.n, dir: -1, light: lightAt, yLeft: yellowLeft });
  return { t: 0, vehicles, crossings, zMin, zMax, lanes: LANES, axis: 'z', stops };
}

/** Church Street's lanes: eastbound keeps to the south (+z) half, westbound the north. */
export const CHURCH_LANES: Lane[] = [
  { x: (CHURCH.z0 + CHURCH.z1) / 2 + 1.9, dir: 1, bikes: false },
  { x: (CHURCH.z0 + CHURCH.z1) / 2 - 1.9, dir: -1, bikes: false },
];
/** Where Church Street's lanes end: west, the end of the road; east, out in High Street (where cars turn onto it). */
export const CHURCH_ENDS = { west: CHURCH.x0 + 3, east: LANES[0].x + 2.2 } as const;

export function createChurchTraffic(perLane = 2): TrafficState {
  const vehicles: Vehicle[] = [];
  let id = 0;
  CHURCH_LANES.forEach((_, li) => {
    for (let i = 0; i < perLane; i++) {
      const cruise = 8 + rng(id * 17 + 503) * 2.5;
      vehicles.push({
        id, kind: rng(id * 31 + 507) < 0.15 ? 'truck' : 'car', lane: li, speed: cruise, cruise, len: 0,
        z: CHURCH_ENDS.west + 30 + ((i + 0.3 + li * 0.5) / perLane) * (CHURCH_ENDS.east - CHURCH_ENDS.west - 70),
        color: PAINT[Math.floor(rng(id * 13 + 509) * PAINT.length)],
      });
      vehicles[vehicles.length - 1].len = KIND[vehicles[vehicles.length - 1].kind].len;
      id++;
    }
  });
  const churchStop: StopLine = { at: JUNCTION.churchStop, dir: 1, light: churchLightAt, yLeft: churchYellowLeft };
  return { t: 0, vehicles, crossings: [], zMin: CHURCH_ENDS.west, zMax: CHURCH_ENDS.east, lanes: CHURCH_LANES, axis: 'x', stops: [churchStop], hold: true };
}

/** Is a lane clear around `at` (along it): nothing within `ahead` in front or `behind` behind (by direction)? */
function laneClear(s: TrafficState, lane: number, at: number, ahead: number, behind: number, except?: Vehicle): boolean {
  const d = s.lanes[lane].dir;
  return s.vehicles.every((o) => {
    if (o === except || o.lane !== lane) return true;
    const rel = (o.z - at) * d; // + ahead of the spot
    return rel > ahead + o.len / 2 || rel < -behind - o.len / 2;
  });
}

/** Cars turning between High Street and Church Street. Returns the moves made, so the views can hand meshes over. */
export interface Turn { from: 'high' | 'church'; to: 'high' | 'church'; oldId: number; vehicle: Vehicle }
export function stepJunction(high: TrafficState, church: TrafficState): Turn[] {
  const turns: Turn[] = [];
  const move = (from: TrafficState, to: TrafficState, v: Vehicle, lane: number, at: number, speed: number, fromName: Turn['from'], toName: Turn['to']) => {
    removeVehicle(from, v.id);
    const nv = addVehicle(to, { kind: v.kind, lane, z: at, cruise: v.cruise, len: v.len, color: v.color });
    nv.speed = speed;
    turns.push({ from: fromName, to: toName, oldId: v.id, vehicle: nv });
  };
  for (const v of [...church.vehicles]) {
    const d = church.lanes[v.lane].dir, front = v.z + (d * v.len) / 2;
    if (d > 0 && front >= CHURCH_ENDS.east - 0.3) {
      // right onto High Street, heading +z (south), if its lane's clear there
      if (laneClear(high, 0, JUNCTION.z + 2, 6, 12)) move(church, high, v, 0, JUNCTION.z + 2, 3, 'church', 'high');
    } else if (d < 0 && front <= CHURCH_ENDS.west + 0.3) {
      // round at the end of the road, and back east
      if (laneClear(church, 0, v.z, 8, 10)) move(church, church, v, 0, v.z, 1.5, 'church', 'church');
    }
  }
  for (const v of [...high.vehicles]) {
    // every third car heading −z (north) turns left into Church Street as it reaches the junction
    if (v.kind === 'bike' || v.lane !== 1) continue;
    if (v.z > JUNCTION.z + 1 || v.z < JUNCTION.z - 1 || (v.passedAt !== undefined && high.t - v.passedAt < 5)) continue;
    v.passedAt = high.t;
    high.passes = (high.passes ?? 0) + 1;
    if (high.passes % 3 !== 0) continue;
    const at = CHURCH_ENDS.east - 2;
    if (church.vehicles.length < 7 && laneClear(church, 1, at, 10, 4)) move(high, church, v, 1, at, Math.min(v.speed, 4), 'high', 'church');
  }
  return turns;
}

/** Something in the road traffic must stop for: a person (a point), or a parked car (hl/hw: half length/width). */
export interface Obstacle extends XZ { hl?: number; hw?: number }

/** Advance the world by dt seconds. `people` are pedestrians (and stopped cars) the traffic must not hit. */
export function stepTraffic(s: TrafficState, dt: number, people: Obstacle[] = []): void {
  s.t += dt;
  const across = (p: XZ) => (s.axis === 'z' ? p.x : p.z), along = (p: XZ) => (s.axis === 'z' ? p.z : p.x);

  s.lanes.forEach((lane, li) => {
    const d = lane.dir;
    // leader first: the one furthest along
    const vs = s.vehicles.filter((v) => v.lane === li).sort((a, b) => (b.z - a.z) * d);
    vs.forEach((v, i) => {
      const front = v.z + (d * v.len) / 2;
      let room = Infinity, personRoom = Infinity;

      if (i > 0) {
        const lead = vs[i - 1];
        room = Math.min(room, (lead.z - v.z) * d - lead.len / 2 - v.len / 2 - MIN_GAP);
      }

      for (const sl of s.stops) {
        if (sl.dir !== d) continue;
        const light = sl.light(s.t);
        if (light === 'green') continue;
        const dist = (sl.at - front) * d;
        if (dist < -0.01 || dist > LOOKAHEAD) continue; // already past it, or far off
        const clears = light === 'yellow' && v.speed > 0.5 && dist / v.speed < sl.yLeft(s.t) - 0.3;
        if (!clears) room = Math.min(room, dist);
      }
      if (s.hold) room = Math.min(room, ((d > 0 ? s.zMax : s.zMin) - front) * d); // (waiting at the end to turn)

      const halfW = v.kind === 'bike' ? 0.9 : 1.6;
      for (const p of people) {
        const hl = p.hl ?? 0;
        if (Math.abs(across(p) - lane.x) > halfW + 0.4 + (p.hw ?? 0)) continue;
        const ahead = (along(p) - front) * d - hl;
        if (ahead < -v.len - 2 * hl || ahead > LOOKAHEAD) continue;
        room = Math.min(room, ahead - PED_GAP);
        personRoom = Math.min(personRoom, ahead - PED_GAP);
      }

      // held up by a person (not a light or the car ahead) and stopped: the driver's getting impatient
      const heldByPerson = personRoom <= room + 1e-6 && personRoom < 3 && v.speed < 0.5;
      v.waited = heldByPerson ? (v.waited ?? 0) + dt : 0;
      const target = Math.min(v.cruise, brakeSpeed(room));
      v.speed = target < v.speed ? Math.max(target, v.speed - HARD_BRAKE * dt) : Math.min(target, v.speed + ACCEL * dt);
      let step = v.speed * dt;
      if (step > room) {
        step = Math.max(0, room);
        v.speed = Math.min(v.speed, step / dt);
      }
      v.z += d * step;
    });

    // off the end → re-enter behind the last vehicle in the lane
    if (!s.hold) for (const v of vs) {
      const gone = d > 0 ? v.z > s.zMax : v.z < s.zMin;
      if (!gone) continue;
      const tail = vs.filter((o) => o !== v).reduce((m, o) => (d > 0 ? Math.min(m, o.z) : Math.max(m, o.z)), d > 0 ? s.zMin : s.zMax);
      v.z = d > 0 ? Math.min(s.zMin, tail - 20) : Math.max(s.zMax, tail + 20);
    }
  });
}

/** World x of a vehicle (lane centre). */
export const laneX = (v: Vehicle) => LANES[v.lane].x;

/** Take a vehicle out of the simulation (someone's taken it). */
export function removeVehicle(s: TrafficState, id: number): Vehicle | undefined {
  const i = s.vehicles.findIndex((v) => v.id === id);
  return i < 0 ? undefined : s.vehicles.splice(i, 1)[0];
}

/** Put a vehicle (back) into a lane at z, at a standstill. Gets a fresh id. */
export function addVehicle(s: TrafficState, v: Omit<Vehicle, 'id' | 'speed'>): Vehicle {
  const id = s.vehicles.reduce((m, o) => Math.max(m, o.id), -1) + 1;
  const nv: Vehicle = { ...v, id, speed: 0 };
  s.vehicles.push(nv);
  return nv;
}
