import { describe, expect, it } from 'vitest';
import {
  LANES, PED_GAP, SIGNAL, SIGNAL_CYCLE, TrafficState, Vehicle, createTraffic, lightAt, stepTraffic, stopLineZ,
} from '../../src/row/traffic';
import { layoutRow } from '../../src/row/layout';
import type { XZ } from '../../src/row/collide';
import { rng } from '../../src/noise';

const { crossings } = layoutRow();
const front = (v: Vehicle) => v.z + (LANES[v.lane].dir * v.len) / 2;
const rear = (v: Vehicle) => v.z - (LANES[v.lane].dir * v.len) / 2;

/** Run the sim with uneven frame times (like a real phone) and call `check` after every step. */
function run(s: TrafficState, seconds: number, check: (s: TrafficState, prev: Map<number, number>) => void, people: () => XZ[] = () => []) {
  let i = 0;
  while (s.t < seconds) {
    const dt = 0.005 + rng(i++) * 0.045; // 5–50 ms
    const prev = new Map(s.vehicles.map((v) => [v.id, v.z]));
    stepTraffic(s, dt, people());
    check(s, prev);
  }
}

describe('traffic signals', () => {
  it('cycles green → yellow → red', () => {
    expect(SIGNAL_CYCLE).toBe(SIGNAL.green + SIGNAL.yellow + SIGNAL.red);
    expect(lightAt(0)).toBe('green');
    expect(lightAt(SIGNAL.green - 0.01)).toBe('green');
    expect(lightAt(SIGNAL.green)).toBe('yellow');
    expect(lightAt(SIGNAL.green + SIGNAL.yellow - 0.01)).toBe('yellow');
    expect(lightAt(SIGNAL.green + SIGNAL.yellow)).toBe('red');
    expect(lightAt(SIGNAL_CYCLE - 0.01)).toBe('red');
    expect(lightAt(SIGNAL_CYCLE)).toBe('green');
    expect(lightAt(-0.01)).toBe('red');
  });
});

describe('High Street traffic', () => {
  it('starts with cars/trucks in car lanes, bikes in bike lanes, nobody overlapping', () => {
    const s = createTraffic(crossings);
    for (const v of s.vehicles) expect(v.kind === 'bike').toBe(LANES[v.lane].bikes);
    expect(s.vehicles.some((v) => v.kind === 'truck')).toBe(true);
    expect(s.vehicles.some((v) => v.kind === 'car')).toBe(true);
    assertNoOverlap(s);
  });

  it('never lets two vehicles in a lane overlap (20 minutes)', () => {
    const s = createTraffic(crossings);
    run(s, 1200, (st) => assertNoOverlap(st));
  });

  it('never drives backwards or faster than cruise', () => {
    const s = createTraffic(crossings);
    run(s, 300, (st, prev) => {
      for (const v of st.vehicles) {
        expect(v.speed).toBeGreaterThanOrEqual(0);
        expect(v.speed).toBeLessThanOrEqual(v.cruise + 1e-9);
        const moved = (v.z - prev.get(v.id)!) * LANES[v.lane].dir;
        if (Math.abs(moved) < 50) expect(moved).toBeGreaterThanOrEqual(-1e-9); // (ignore re-entry jumps)
      }
    });
  });

  it('never runs a red light', () => {
    const s = createTraffic(crossings);
    let violations = 0, throughOnGreen = 0;
    const fronts = new Map(s.vehicles.map((v) => [v.id, front(v)]));
    run(s, 1200, (st) => {
      const light = lightAt(st.t);
      for (const v of st.vehicles) {
        const d = LANES[v.lane].dir;
        const before = fronts.get(v.id)!, now = front(v);
        fronts.set(v.id, now);
        if (Math.abs(now - before) > 50) continue; // re-entered at the far end
        for (const c of st.crossings) {
          const line = stopLineZ(c, d);
          // stopping *on* the line is fine; passing it is not
          const crossed = (before - line) * d <= 1e-6 && (now - line) * d > 1e-6;
          if (!crossed) continue;
          if (light === 'red') violations++;
          else throughOnGreen++;
        }
      }
    });
    expect(violations).toBe(0);
    expect(throughOnGreen).toBeGreaterThan(50); // …but traffic does flow
  });

  it('queues at a red light and moves off when it turns green', () => {
    const s = createTraffic(crossings);
    // run to the end of a red phase
    run(s, SIGNAL_CYCLE * 3 - 0.2, () => {});
    expect(lightAt(s.t)).toBe('red');
    const stopped = s.vehicles.filter((v) => v.speed < 0.05 && v.kind !== 'bike');
    expect(stopped.length).toBeGreaterThan(0);
    run(s, s.t + 8, () => {});
    for (const v of stopped) expect(v.speed).toBeGreaterThan(0.5);
  });

  it('stops for a person standing in the lane, and goes again when they leave', () => {
    const s = createTraffic(crossings, 5, 0);
    const lane = 0; // heading +z
    // somewhere no vehicle is parked on at the start
    let pz = 0;
    while (s.vehicles.some((v) => v.lane === lane && Math.abs(v.z - pz) < v.len / 2 + 15)) pz -= 1;
    const person: XZ = { x: LANES[lane].x, z: pz };
    let standing = true;
    run(s, 120, (st) => {
      for (const v of st.vehicles.filter((o) => o.lane === lane)) {
        // anyone approaching from behind must stay PED_GAP short of the person
        if (rear(v) < person.z) expect(front(v)).toBeLessThanOrEqual(person.z - PED_GAP + 1e-6);
      }
    }, () => (standing ? [person] : []));
    const queued = s.vehicles.filter((v) => v.lane === lane && front(v) < person.z && front(v) > person.z - 40);
    expect(queued.length).toBeGreaterThan(0);
    expect(queued.every((v) => v.speed < 0.05)).toBe(true);

    standing = false;
    let passed = false; // (checked every step — they drive off the end and re-enter behind)
    run(s, s.t + SIGNAL_CYCLE + 10, () => { passed ||= queued.some((v) => front(v) > person.z && front(v) < person.z + 30); });
    expect(passed).toBe(true);
  });

  it('stops dead if you step out right beside a vehicle', () => {
    const s = createTraffic(crossings, 1, 0);
    const v = s.vehicles.find((o) => o.lane === 0)!;
    v.z = -500; v.speed = 0; // somewhere with no crossing
    s.t = 1; // green
    const beside: XZ = { x: LANES[0].x + 1.2, z: v.z };
    stepTraffic(s, 0.016, [beside]);
    expect(v.speed).toBe(0);
  });

  it('never gridlocks: every vehicle keeps making progress (10 minutes)', () => {
    const s = createTraffic(crossings);
    const travelled = new Map(s.vehicles.map((v) => [v.id, 0]));
    run(s, 600, (st, prev) => {
      for (const v of st.vehicles) {
        const m = Math.abs(v.z - prev.get(v.id)!);
        if (m < 50) travelled.set(v.id, travelled.get(v.id)! + m);
      }
    });
    for (const v of s.vehicles) expect(travelled.get(v.id)!, `${v.kind} #${v.id}`).toBeGreaterThan(v.kind === 'bike' ? 800 : 1200);
  });
});

function assertNoOverlap(s: TrafficState) {
  LANES.forEach((_, li) => {
    const vs = s.vehicles.filter((v) => v.lane === li).sort((a, b) => a.z - b.z);
    for (let i = 1; i < vs.length; i++) {
      const gap = vs[i].z - vs[i - 1].z - vs[i].len / 2 - vs[i - 1].len / 2;
      expect(gap, `lane ${li}`).toBeGreaterThan(0);
    }
  });
}

describe('impatient drivers', () => {
  it('a car stopped for someone standing in the road counts how long it has waited (that\'s when it honks)', async () => {
    const { addVehicle, createTraffic, stepTraffic, LANES } = await import('../../src/row/traffic');
    const t = createTraffic([], 0, 0);
    const v = addVehicle(t, { kind: 'car', lane: 0, z: -140, cruise: 10, len: 4.4, color: 0 });
    v.speed = 10;
    const you = { x: LANES[0].x, z: -100 };
    for (let i = 0; i < 60 * 12; i++) stepTraffic(t, 1 / 60, [you]);
    expect(v.speed).toBeLessThan(0.01);
    expect(v.waited!).toBeGreaterThan(5);
    stepTraffic(t, 1 / 60, []); // you step out of the way
    expect(v.waited).toBe(0);
  });

  it('waiting at a red light isn\'t waiting on you', async () => {
    const { createTraffic, stepTraffic } = await import('../../src/row/traffic');
    const { layoutRow } = await import('../../src/row/layout');
    const t = createTraffic(layoutRow().crossings);
    for (let i = 0; i < 60 * 60; i++) stepTraffic(t, 1 / 60, []);
    expect(t.vehicles.every((v) => (v.waited ?? 0) === 0)).toBe(true);
  });
});
