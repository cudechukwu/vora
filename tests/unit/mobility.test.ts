import { describe, expect, it } from 'vitest';
import {
  MOUNT_RADIUS, RACK_RADIUS, RUN_AFTER, SPEED, actionAt, carry, createMobility, dismount, freeSlot,
  isRunning, mount, newMover, slotPos, stepMover,
} from '../../src/row/mobility';
import { ROAD, SPAWN, layoutRow } from '../../src/row/layout';

const { stops, crossings } = layoutRow();

const fresh = () => createMobility(stops, crossings, SPAWN);

/** Hold the stick at `mag` for `secs`, 60fps. */
function hold(m = newMover(), mag: number, secs: number) {
  for (let t = 0; t < secs; t += 1 / 60) stepMover(m, 1 / 60, mag);
  return m;
}

describe('walking and running', () => {
  it('walks at first', () => {
    const m = hold(newMover(), 1, RUN_AFTER - 0.2);
    expect(isRunning(m)).toBe(false);
    expect(m.speed).toBeCloseTo(SPEED.walk, 6);
  });

  it(`breaks into a run after holding the stick for ${RUN_AFTER}s`, () => {
    const m = hold(newMover(), 1, RUN_AFTER + 1.5);
    expect(isRunning(m)).toBe(true);
    expect(m.speed).toBeCloseTo(SPEED.run, 6);
  });

  it('a gentle push never runs', () => {
    const m = hold(newMover(), 0.5, 20);
    expect(isRunning(m)).toBe(false);
    expect(m.speed).toBeCloseTo(SPEED.walk * 0.5, 6);
  });

  it('easing off drops you back to a walk, and the timer starts over', () => {
    const m = hold(newMover(), 1, RUN_AFTER + 1);
    hold(m, 0.4, 0.2);
    expect(isRunning(m)).toBe(false);
    hold(m, 1, RUN_AFTER - 0.2);
    expect(isRunning(m)).toBe(false);
  });

  it('speeds up and slows down smoothly, never jumping', () => {
    const m = newMover();
    let prev = 0;
    for (let i = 0; i < 600; i++) {
      stepMover(m, 1 / 60, i < 400 ? 1 : 0);
      expect(Math.abs(m.speed - prev)).toBeLessThan(0.25);
      expect(m.speed).toBeGreaterThanOrEqual(0);
      prev = m.speed;
    }
    expect(m.speed).toBe(0);
  });

  it('ignores zero or negative frame times (no phantom speed at load)', () => {
    const m = newMover();
    stepMover(m, -1.6, 0);
    stepMover(m, 0, 1);
    expect(m.speed).toBe(0);
    expect(m.held).toBe(0);
  });

  it('gets faster on wheels: walk < run < scooter < bike', () => {
    expect(SPEED.walk).toBeLessThan(SPEED.run);
    expect(SPEED.run).toBeLessThan(SPEED.scooter);
    expect(SPEED.scooter).toBeLessThan(SPEED.bike);
  });
});

describe('bikes, scooters and racks', () => {
  it('puts a rack with a bike right next to where you start', () => {
    const mob = fresh();
    const a = actionAt(mob, newMover(), { x: -2.5, z: SPAWN.z + 5 });
    expect(a?.kind).toBe('ride');
  });

  it('parks every starting bike in its own slot, and nothing in a building or the road', () => {
    const mob = fresh();
    const taken = new Set<string>();
    for (const v of mob.rideables) {
      if (v.rack !== null) {
        const k = `${v.rack}:${v.slot}`;
        expect(taken.has(k)).toBe(false);
        taken.add(k);
      }
      const inBuilding = stops.some((s) => v.z < s.z0 && v.z > s.z1 && v.x < s.front && v.x > s.back);
      expect(inBuilding).toBe(false);
      expect(v.x < ROAD.x0 || v.x > ROAD.x1).toBe(true);
    }
    expect(mob.rideables.some((v) => v.kind === 'bike')).toBe(true);
    expect(mob.rideables.some((v) => v.kind === 'scooter' && v.rack === null)).toBe(true);
  });

  it('only offers a ride when you are close enough', () => {
    const mob = fresh();
    const v = mob.rideables[0];
    expect(actionAt(mob, newMover(), { x: v.x + MOUNT_RADIUS - 0.1, z: v.z })?.kind).toBe('ride');
    expect(actionAt(mob, newMover(), { x: v.x + MOUNT_RADIUS + 0.5, z: v.z + 5 })).toBeNull();
  });

  it('getting on takes it out of the rack and makes you faster', () => {
    const mob = fresh();
    const m = newMover();
    const bike = mob.rideables.find((v) => v.kind === 'bike')!;
    expect(mount(mob, m, bike.id)).toBe(true);
    expect(m.mode).toBe('bike');
    expect(bike.rack).toBeNull();
    hold(m, 1, 5);
    expect(m.speed).toBeCloseTo(SPEED.bike, 6);
    expect(mount(mob, m, 1)).toBe(false); // can't get on a second one
  });

  it('the bike goes where you go', () => {
    const mob = fresh();
    const m = newMover();
    mount(mob, m, 0);
    carry(mob, m, { x: 7, z: -40 }, 1.1);
    expect(mob.rideables[0]).toMatchObject({ x: 7, z: -40, heading: 1.1 });
  });

  it('leave it anywhere: it stays exactly where you got off', () => {
    const mob = fresh();
    const m = newMover();
    mount(mob, m, 0);
    const spot = { x: -60, z: crossings[1].z }; // out on Andrus Field
    carry(mob, m, spot, 0.5);
    const off = dismount(mob, m, spot, 0.5)!;
    expect(off.parked).toBe('ground');
    expect(mob.rideables[0]).toMatchObject({ x: -60, z: crossings[1].z, rack: null });
    expect(m.mode).toBe('foot');
    expect(Math.hypot(off.standAt.x - spot.x, off.standAt.z - spot.z)).toBeCloseTo(0.9, 6);
    expect(actionAt(mob, m, off.standAt)?.kind).toBe('ride'); // and you can hop back on
  });

  it('near a rack with space, it clicks into a free slot', () => {
    const mob = fresh();
    const m = newMover();
    const scooter = mob.rideables.find((v) => v.kind === 'scooter' && v.rack === null)!;
    mount(mob, m, scooter.id);
    const rack = mob.racks[1];
    const near = { x: rack.x + 2, z: rack.z };
    expect(actionAt(mob, m, near)?.kind).toBe('park');
    const off = dismount(mob, m, near, 0)!;
    expect(off.parked).toBe('rack');
    expect(scooter.rack).toBe(rack.id);
    const p = slotPos(rack, scooter.slot!);
    expect(scooter).toMatchObject({ x: p.x, z: p.z });
  });

  it('a full rack says "get off" instead, and leaves it beside the rack', () => {
    const mob = fresh();
    const rack = mob.racks[0];
    // fill every slot
    let s: number | null;
    while ((s = freeSlot(mob, rack)) !== null) {
      mob.rideables.push({ id: mob.rideables.length, kind: 'bike', ...slotPos(rack, s), rack: rack.id, slot: s });
    }
    const m = newMover();
    const loose = mob.rideables.find((v) => v.rack === null)!;
    mount(mob, m, loose.id);
    const near = { x: rack.x + 2, z: rack.z };
    expect(actionAt(mob, m, near)?.kind).toBe('getoff');
    expect(dismount(mob, m, near, 0)!.parked).toBe('ground');
  });

  it('racking many times never double-books a slot', () => {
    const mob = fresh();
    const m = newMover();
    const rack = mob.racks[1];
    for (let round = 0; round < 20; round++) {
      const v = mob.rideables[round % mob.rideables.length];
      if (!mount(mob, m, v.id)) continue;
      dismount(mob, m, { x: rack.x + 1, z: rack.z + (round % 3) - 1 }, 0);
      const slots = mob.rideables.filter((o) => o.rack === rack.id).map((o) => o.slot);
      expect(new Set(slots).size).toBe(slots.length);
      expect(slots.length).toBeLessThanOrEqual(rack.slots);
    }
    expect(RACK_RADIUS).toBeGreaterThan(MOUNT_RADIUS);
  });
});

describe('building speed on wheels', () => {
  it('a bike picks up speed the longer you pedal, topping out around 25 mph', () => {
    const m = newMover();
    m.mode = 'bike';
    const at = (secs: number) => { for (let t = 0; t < secs; t += 1 / 60) stepMover(m, 1 / 60, 1); return m.speed; };
    const a = at(1), b = at(2), c = at(20);
    expect(b).toBeGreaterThan(a + 1);
    expect(c).toBeCloseTo(SPEED.bike, 2);
    expect(SPEED.bike * 2.237).toBeGreaterThan(23);
  });
});
