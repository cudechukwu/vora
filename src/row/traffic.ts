import { CROSSWALK_W, Crossing, ROAD, WALK_MAX_Z, WALK_MIN_Z } from './layout';
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
}

export interface TrafficState {
  t: number;
  vehicles: Vehicle[];
  crossings: Crossing[];
  zMin: number;
  zMax: number;
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
  return { t: 0, vehicles, crossings, zMin, zMax };
}

/** Something in the road traffic must stop for: a person (a point), or a parked car (hl/hw: half length/width). */
export interface Obstacle extends XZ { hl?: number; hw?: number }

/** Advance the world by dt seconds. `people` are pedestrians (and stopped cars) the traffic must not hit. */
export function stepTraffic(s: TrafficState, dt: number, people: Obstacle[] = []): void {
  s.t += dt;
  const light = lightAt(s.t);
  const yLeft = yellowLeft(s.t);

  LANES.forEach((lane, li) => {
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

      if (light !== 'green') {
        for (const c of s.crossings) {
          const dist = (stopLineZ(c, d) - front) * d;
          if (dist < -0.01 || dist > LOOKAHEAD) continue; // already past it, or far off
          const clears = light === 'yellow' && v.speed > 0.5 && dist / v.speed < yLeft - 0.3;
          if (!clears) room = Math.min(room, dist);
        }
      }

      const halfW = v.kind === 'bike' ? 0.9 : 1.6;
      for (const p of people) {
        const hl = p.hl ?? 0;
        if (Math.abs(p.x - lane.x) > halfW + 0.4 + (p.hw ?? 0)) continue;
        const ahead = (p.z - front) * d - hl;
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
    for (const v of vs) {
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
