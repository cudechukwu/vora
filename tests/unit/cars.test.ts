import { beforeEach, describe, expect, it } from 'vitest';
import {
  Car, JACK_SPEED, LEAVE_AFTER, REACH, SPEC, carAt, carExtra, carjack, clearRoad, createGarage, distToCar,
  driveMove, driven, drivewaySpot, footprint, getIn, getOut, inDriveway, jackable, laneFor, loadMine, missing,
  onRoad, roadBlocks, saveMine, stepCar,
} from '../../src/row/cars';
import { resolveMove } from '../../src/row/collide';
import { FAR_WALK, ROAD, byId, layoutRow } from '../../src/row/layout';
import { LANES, TrafficState, addVehicle, createTraffic, removeVehicle, stepTraffic } from '../../src/row/traffic';
import { houseExtra } from '../../src/row/house/collide';
import { DRIVEWAYS, HOUSE, toLocal } from '../../src/row/house/plan';
import { World } from '../../src/row/world';

/** The tall lamps along High Street (+ walk lamps) as solids, like the game has them. */
const worldObstacles = () => World.lampSpots().map((l) => {
  const pr = (l.h > 5 ? 0.15 : 0.1) + 0.3;
  return { x0: l.x - pr, x1: l.x + pr, z0: l.z - pr, z1: l.z + pr };
});

const { stops, crossings } = layoutRow();
const STEP = 1 / 60;

/** Drive with the stick held in a fixed world direction for `secs`, colliding with the world. */
function drive(c: Car, stick: { x: number; z: number }, secs: number, extra = carExtra(houseExtra(0, true), c.kind)) {
  let hits = 0;
  for (let t = 0; t < secs; t += STEP) {
    const want = stepCar(c, STEP, stick);
    const r = driveMove(c, want, stops, extra);
    if (r.hit) { hits++; c.speed = 0; }
    c.x = r.x; c.z = r.z;
  }
  return hits;
}

const emptyRoad = (): TrafficState => ({ ...createTraffic(crossings, 0, 0) });

describe('driveways + whose car is whose', () => {
  it('there are two driveways, either side of the house, outside its walls', () => {
    expect(DRIVEWAYS).toHaveLength(2);
    const [mine, kofi] = DRIVEWAYS;
    expect(mine.owner).toBe('you');
    expect(kofi.owner).toBe('kofi');
    expect(mine.v1).toBeLessThan(-HOUSE.width / 2); // left of the house, seen from the street
    expect(kofi.v0).toBeGreaterThan(HOUSE.width / 2); // right
  });

  it('your car is in your driveway, kofi\'s in his, both facing the street', () => {
    const g = createGarage();
    const mine = g.cars.find((c) => c.owner === 'you')!, kofi = g.cars.find((c) => c.owner === 'kofi')!;
    expect(inDriveway(mine)).toBe(true);
    expect(inDriveway(kofi)).toBe(true);
    expect(toLocal(mine.x, mine.z).v).toBeLessThan(0);
    expect(toLocal(kofi.x, kofi.z).v).toBeGreaterThan(0);
    expect(Math.sin(mine.heading)).toBeCloseTo(-1); // nose toward High Street (−x)
  });

  it('no street lamp stands in the mouth of a driveway', () => {
    for (const d of DRIVEWAYS) {
      for (const l of World.lampSpots()) {
        const inMouth = l.x > ROAD.x1 && l.z > HOUSE.zc + d.v0 - 1 && l.z < HOUSE.zc + d.v1 + 1;
        expect(inMouth).toBe(false);
      }
    }
  });

  it('you can walk off the far sidewalk into a driveway', () => {
    const spot = drivewaySpot('you');
    const from = { x: FAR_WALK.x1 - 0.6, z: spot.z };
    let p = from;
    for (let i = 0; i < 40; i++) p = resolveMove(p, { x: p.x + 0.1, z: p.z }, stops, houseExtra(0, false));
    expect(p.x).toBeCloseTo(from.x + 4, 5);
  });

  it('a parked car is something you bump into, and walk around', () => {
    const g = createGarage();
    const c = g.cars[0];
    const b = footprint(c, 0.3);
    expect(b.x1 - b.x0).toBeCloseTo(c.len + 0.6, 5); // it lies along x
  });
});

describe('getting in and out', () => {
  it('reaches the car from beside it, not from across the street', () => {
    const g = createGarage();
    const c = g.cars[0];
    expect(carAt(g, { x: c.x, z: c.z - SPEC.car.halfW - 1 })?.id).toBe(c.id);
    expect(carAt(g, { x: c.x, z: c.z - SPEC.car.halfW - REACH - 0.2 })).toBeUndefined();
  });

  it('getting in your own car isn\'t stealing it; kofi\'s is', () => {
    const g = createGarage();
    expect(getIn(g, 0)!.stolen).toBe(false);
    getOut(g);
    expect(getIn(g, 1)!.stolen).toBe(true);
  });

  it('one car at a time', () => {
    const g = createGarage();
    getIn(g, 0);
    expect(getIn(g, 1)).toBeNull();
    expect(driven(g)!.id).toBe(0);
  });

  it('you step out on the driver\'s side, clear of the car', () => {
    const g = createGarage();
    getIn(g, 0);
    const c = driven(g)!;
    const at = getOut(g)!;
    expect(g.driving).toBeNull();
    expect(distToCar(c, at)).toBeGreaterThan(0.5);
    // facing −x, the driver's (left) side is +z (you face +z with −x on your right)
    expect(at.z).toBeGreaterThan(c.z);
  });
});

describe('driving', () => {
  const fresh = (): Car => ({ id: 9, kind: 'car', len: 4.4, color: 0, x: 15.5, z: -100, heading: 0, speed: 0, owner: 'you', cruise: 10, stolen: false });

  it('pushes up to top speed going straight', () => {
    const c = fresh();
    drive(c, { x: 0, z: 1 }, 6, {});
    expect(c.speed).toBeCloseTo(SPEC.car.top, 3);
    expect(c.heading).toBeCloseTo(0, 6);
    expect(c.z).toBeGreaterThan(-100 + 40);
  });

  it('a light push goes slower', () => {
    const c = fresh();
    drive(c, { x: 0, z: 0.4 }, 8, {});
    expect(c.speed).toBeCloseTo(SPEC.car.top * 0.4, 3);
  });

  it('steers toward where you push, and can\'t turn on the spot', () => {
    const c = fresh();
    stepCar(c, STEP, { x: 1, z: 0 });
    expect(Math.abs(c.heading)).toBeLessThan(0.01); // barely rolling
    for (let t = 0; t < 4; t += STEP) stepCar(c, STEP, { x: 1, z: 0 }); // open ground, no walls
    expect(c.heading).toBeCloseTo(Math.PI / 2, 2); // now heading +x
    expect(c.speed).toBeGreaterThan(5);
  });

  it('pointing behind the car brakes, then reverses', () => {
    const c = fresh();
    drive(c, { x: 0, z: 1 }, 3, {});
    const before = c.speed;
    expect(before).toBeGreaterThan(10);
    stepCar(c, STEP, { x: 0, z: -1 });
    expect(c.speed).toBeLessThan(before);
    drive(c, { x: 0, z: -1 }, 5, {});
    expect(c.speed).toBeCloseTo(-SPEC.car.reverse, 3);
    expect(Math.cos(c.heading)).toBeGreaterThan(0.99); // still facing +z, rolling backward
  });

  it('let go and it rolls to a stop', () => {
    const c = fresh();
    drive(c, { x: 0, z: 1 }, 3, {});
    drive(c, { x: 0, z: 0 }, 6, {});
    expect(c.speed).toBe(0);
  });

  it('trucks are slower', () => {
    const c = { ...fresh(), kind: 'truck' as const, len: 8 };
    drive(c, { x: 0, z: 1 }, 10, {});
    expect(c.speed).toBeCloseTo(SPEC.truck.top, 3);
  });

  it('a bogus frame changes nothing', () => {
    const c = fresh();
    expect(stepCar(c, -1, { x: 0, z: 1 })).toEqual({ x: c.x, z: c.z });
    expect(c.speed).toBe(0);
  });

  it.each([0, 1])('drives out of driveway %i onto High Street without hitting anything (lamps + trees too)', (id) => {
    const g = createGarage();
    const c = getIn(g, id)!;
    const base = houseExtra(0, true);
    const world = { ...base, solids: [...base.solids!, ...worldObstacles()] };
    const hits = drive(c, { x: -1, z: 0 }, 2.2, carExtra(world, 'car'));
    expect(hits).toBe(0);
    expect(onRoad(c)).toBe(true);
  });

  it('can\'t drive into a building on the row — the nose stops at the facade', () => {
    const north = byId(stops, 'north');
    const c: Car = { ...fresh(), x: 0, z: north.zc, heading: -Math.PI / 2 };
    const hits = drive(c, { x: -1, z: 0 }, 4, {});
    expect(hits).toBeGreaterThan(0);
    expect(c.x - c.len / 2).toBeGreaterThan(north.front);
  });

  it('can\'t drive into your house', () => {
    const g = createGarage();
    const c = getIn(g, 0)!;
    // out of the driveway, along the front yard, then hard at the front wall
    drive(c, { x: -1, z: 0 }, 1.2);
    drive(c, { x: 0, z: 1 }, 3);
    drive(c, { x: 1, z: 0 }, 5);
    const l = toLocal(c.x, c.z);
    expect(l.u < 0 || Math.abs(l.v) > HOUSE.width / 2).toBe(true);
  });
});

describe('carjacking', () => {
  let t: TrafficState;
  beforeEach(() => {
    t = emptyRoad();
    addVehicle(t, { kind: 'car', lane: 0, z: -100, cruise: 10, len: 4.4, color: 0xc8302a });
    addVehicle(t, { kind: 'bike', lane: 2, z: -60, cruise: 5, len: 1.8, color: 0 });
  });

  it('only a car that\'s stopped (or nearly) right beside you', () => {
    const beside = { x: LANES[0].x + SPEC.car.halfW + 0.8, z: -100 };
    expect(jackable(t, beside)?.kind).toBe('car');
    t.vehicles[0].speed = JACK_SPEED + 1;
    expect(jackable(t, beside)).toBeUndefined();
    t.vehicles[0].speed = 0;
    expect(jackable(t, { x: beside.x + 3, z: -100 })).toBeUndefined();
  });

  it('step out in front of one: it stops for you, and then it\'s in reach', () => {
    const tr = emptyRoad();
    const v = addVehicle(tr, { kind: 'car', lane: 0, z: -140, cruise: 10, len: 4.4, color: 0 });
    v.speed = 10;
    const you = { x: LANES[0].x, z: -100 };
    for (let i = 0; i < 60 * 15; i++) stepTraffic(tr, STEP, [you]);
    expect(v.speed).toBeLessThan(0.01);
    expect(jackable(tr, you)?.id).toBe(v.id);
  });

  it('not bikes', () => {
    expect(jackable(t, { x: LANES[2].x + 0.8, z: -60 })).toBeUndefined();
  });

  it('takes the car out of traffic, puts you in it, and the driver lands beside it on the road', () => {
    const g = createGarage();
    const id = t.vehicles[0].id;
    const r = carjack(t, g, id)!;
    expect(t.vehicles.some((v) => v.id === id)).toBe(false);
    expect(driven(g)).toBe(r.car);
    expect(r.car.owner).toBeNull();
    expect(r.car.stolen).toBe(true);
    expect(r.car.color).toBe(0xc8302a);
    expect(distToCar(r.car, r.driver)).toBeGreaterThan(0.5);
    expect(onRoad(r.driver)).toBe(true);
  });

  it('won\'t jack a bike', () => {
    const g = createGarage();
    const bike = t.vehicles.find((v) => v.kind === 'bike')!;
    expect(carjack(t, g, bike.id)).toBeNull();
    expect(t.vehicles).toContain(bike);
  });
});

describe('cars in the road', () => {
  it('traffic stops behind a car left in its lane, and never drives into it', () => {
    const t = createTraffic(crossings);
    const g = createGarage();
    const c = g.cars[0];
    Object.assign(c, { x: LANES[0].x, z: -150, heading: 0 });
    for (let i = 0; i < 60 * 40; i++) {
      stepTraffic(t, STEP, roadBlocks(g));
      for (const v of t.vehicles.filter((v) => v.lane === 0)) {
        expect(Math.abs(v.z - c.z)).toBeGreaterThan(v.len / 2 + c.len / 2);
      }
    }
    const queued = t.vehicles.filter((v) => v.lane === 0 && v.z < c.z && c.z - v.z < 12);
    expect(queued.length).toBeGreaterThan(0);
    expect(queued.every((v) => v.speed < 0.01)).toBe(true);
  });

  it('a stranger\'s car you\'ve walked away from rejoins traffic', () => {
    const t = emptyRoad();
    const g = createGarage();
    const r = carjack(t, g, addVehicle(t, { kind: 'car', lane: 1, z: -50, cruise: 11, len: 4.4, color: 1 }).id)!;
    getOut(g);
    expect(clearRoad(g, t, { x: 0, z: -50 })).toEqual([]); // you're right there
    const done = clearRoad(g, t, { x: 0, z: -50 - LEAVE_AFTER - 1 });
    expect(done[0].fate).toBe('traffic');
    expect(done[0].vehicle!.lane).toBe(1);
    expect(g.cars).not.toContain(r.car);
    expect(t.vehicles).toContain(done[0].vehicle);
  });

  it('a stranger\'s car left sideways in the road is just driven off', () => {
    const t = emptyRoad();
    const g = createGarage();
    const r = carjack(t, g, addVehicle(t, { kind: 'car', lane: 0, z: -50, cruise: 11, len: 4.4, color: 1 }).id)!;
    r.car.heading = Math.PI / 2;
    getOut(g);
    expect(laneFor(r.car)).toBeNull();
    expect(clearRoad(g, t, { x: 0, z: 100 })[0].fate).toBe('gone');
    expect(t.vehicles).toHaveLength(0);
  });

  it('your car left in the road gets towed home', () => {
    const t = emptyRoad();
    const g = createGarage();
    Object.assign(g.cars[0], { x: 15, z: -100 });
    const done = clearRoad(g, t, { x: 0, z: 0 });
    expect(done[0].fate).toBe('towed');
    expect(inDriveway(g.cars[0])).toBe(true);
  });

  it('a car you\'re driving is never moved', () => {
    const t = emptyRoad();
    const g = createGarage();
    getIn(g, 1);
    Object.assign(g.cars[1], { x: 15, z: -100 });
    expect(clearRoad(g, t, { x: 0, z: 1000 })).toEqual([]);
  });

  it('cars parked off the road don\'t block traffic', () => {
    expect(roadBlocks(createGarage())).toEqual([]);
  });
});

describe('kofi notices', () => {
  it('his car is missing once you\'ve driven it off', () => {
    const g = createGarage();
    expect(missing(g, 'kofi')).toBe(false);
    const c = getIn(g, 1)!;
    c.x = ROAD.x0 + 2;
    expect(missing(g, 'kofi')).toBe(true);
  });
});

describe('your car stays where you left it', () => {
  it('saves and loads its spot', () => {
    const g = createGarage();
    Object.assign(g.cars[0], { x: -3, z: -120, heading: 1.25 });
    const back = createGarage(loadMine(saveMine(g)));
    expect(back.cars[0].x).toBeCloseTo(-3);
    expect(back.cars[0].z).toBeCloseTo(-120);
    expect(back.cars[0].heading).toBeCloseTo(1.25);
  });

  it('nothing saved, junk, or left in the road → back in your driveway', () => {
    for (const raw of [null, '', '{', '{"x":"a"}', JSON.stringify({ x: NaN, z: 0, heading: 0 }), JSON.stringify({ x: 15, z: -100, heading: 0 })]) {
      expect(loadMine(raw)).toBeNull();
    }
    expect(inDriveway(createGarage(null).cars[0])).toBe(true);
  });
});

describe('traffic add / remove', () => {
  it('removes by id and adds with a fresh one', () => {
    const t = createTraffic(crossings);
    const n = t.vehicles.length;
    const v = removeVehicle(t, 3)!;
    expect(v.id).toBe(3);
    expect(t.vehicles).toHaveLength(n - 1);
    expect(removeVehicle(t, 3)).toBeUndefined();
    const nv = addVehicle(t, { ...v });
    expect(t.vehicles.filter((x) => x.id === nv.id)).toHaveLength(1);
    expect(nv.speed).toBe(0);
  });
});
