import { describe, expect, it } from 'vitest';
import { resolveMove } from '../../src/row/collide';
import { layoutRow } from '../../src/row/layout';
import {
  CDOORS, CPEOPLE, FH, FLIGHTS, FURNITURE, IN_L0, ROOMS, VOID, casperArrive, casperExtra, casperFloorY, casperLevelAt, casperPortalAt,
  flightT, insideCasper, nearCasperDoor,
} from '../../src/row/casper/plan';
import { SCI } from '../../src/row/southend';

const { stops } = layoutRow();

/** Walk toward a point inside, step by step, keeping track of the floor: returns where you got to and on which level. */
function walk(from: { x: number; z: number }, to: { x: number; z: number }, level: number, steps = 600) {
  let p = { ...from }, l = level;
  const ys: number[] = [];
  for (let i = 0; i < steps; i++) {
    const d = Math.hypot(to.x - p.x, to.z - p.z);
    if (d < 0.02) break;
    const s = Math.min(0.1, d);
    p = resolveMove(p, { x: p.x + ((to.x - p.x) / d) * s, z: p.z + ((to.z - p.z) / d) * s }, stops, casperExtra(l));
    l = casperLevelAt(l, p.x, p.z);
    ys.push(casperFloorY(l, p.x, p.z));
  }
  return { p, level: l, ys };
}

describe('Casper: the doors', () => {
  it('both doors take you in and back out; inside you land on the ground floor, clear of everything', () => {
    for (const door of CDOORS) {
      const out = casperArrive(door, 'exit'), inn = casperArrive(door, 'enter');
      expect(insideCasper(inn, 0)).toBe(true);
      expect(resolveMove(inn, inn, stops, casperExtra(0))).toEqual({ x: inn.x, z: inn.z }); // not in a wall or a table
      expect(casperPortalAt('casper', inn, 0)).toBeNull(); // (you don't bounce straight back out)
      // walking from the arrival spot back to the door takes you out
      const back = walk(inn, { x: door.x - door.nx * 0.2, z: door.z - door.nz * 0.2 }, 0);
      expect(casperPortalAt('casper', back.p, 0)?.door.id).toBe(door.id);
      expect(nearCasperDoor('out', { x: out.x - door.nx * 1.2, z: out.z - door.nz * 1.2 })?.id).toBe(door.id);
    }
  });
  it('the north door opens off Church Street\'s side, the west into the plaza; upstairs, no door takes you out', () => {
    const n = CDOORS.find((d) => d.id === 'north')!;
    expect(n.z).toBe(SCI.z0);
    expect(casperPortalAt('casper', { x: n.x, z: n.z + 0.5 }, 1)).toBeNull();
  });
});

describe('Casper: the floors and the grand stairs', () => {
  it('up the three flights from the ground floor to the top, the floor only ever rising; and back down', () => {
    const [A, B, C] = FLIGHTS;
    // ground → L1 up A (from its foot, west of it)
    let r = walk({ x: A.x0 - 1.5, z: (A.z0 + A.z1) / 2 }, { x: A.x1 + 1.2, z: (A.z0 + A.z1) / 2 }, 0);
    expect(r.level).toBe(1);
    for (let i = 1; i < r.ys.length; i++) expect(r.ys[i]).toBeGreaterThanOrEqual(r.ys[i - 1] - 1e-9);
    // along L1 round to B's foot (east of the void), up B to L2
    r = walk(r.p, { x: VOID.x1 + 1.5, z: 157 }, r.level);
    r = walk(r.p, { x: VOID.x1 + 1.5, z: (B.z0 + B.z1) / 2 }, r.level);
    r = walk(r.p, { x: B.x0 - 1.2, z: (B.z0 + B.z1) / 2 }, r.level);
    expect(r.level).toBe(2);
    // across L2 to C's foot, up C to L3
    r = walk(r.p, { x: VOID.x0 - 1.5, z: (B.z0 + B.z1) / 2 }, r.level);
    r = walk(r.p, { x: VOID.x0 - 1.5, z: (C.z0 + C.z1) / 2 }, r.level);
    r = walk(r.p, { x: C.x1 + 1.2, z: (C.z0 + C.z1) / 2 }, r.level);
    expect(r.level).toBe(3);
    expect(casperFloorY(r.level, r.p.x, r.p.z)).toBeCloseTo(3 * FH, 5);
    // and all the way back down to the ground
    r = walk(r.p, { x: C.x0 - 1.2, z: (C.z0 + C.z1) / 2 }, r.level);
    expect(r.level).toBe(2);
    r = walk(r.p, { x: VOID.x0 - 1.5, z: (B.z0 + B.z1) / 2 }, r.level);
    r = walk(r.p, { x: B.x1 + 1.5, z: (B.z0 + B.z1) / 2 }, r.level);
    expect(r.level).toBe(1);
    r = walk(r.p, { x: VOID.x1 + 1.5, z: 156 }, r.level);
    r = walk(r.p, { x: A.x0 - 1.5, z: (A.z0 + A.z1) / 2 }, r.level);
    expect(r.level).toBe(0);
    expect(casperFloorY(0, r.p.x, r.p.z)).toBe(0);
  });
  it('upstairs you can\'t step off into the atrium, and you can\'t climb the stairs\' sides or walk under them onto them', () => {
    for (const level of [1, 2, 3]) {
      const r = walk({ x: VOID.x0 - 2, z: 162 }, { x: VOID.x0 + 6, z: 162 }, level);
      expect(r.p.x).toBeLessThan(VOID.x0);
      expect(r.level).toBe(level);
    }
    const A = FLIGHTS[0];
    const side = walk({ x: (A.x0 + A.x1) / 2, z: 160 }, { x: (A.x0 + A.x1) / 2, z: 155.5 }, 0); // into the side of the first flight
    expect(side.p.z).toBeGreaterThan(A.z1);
    expect(side.level).toBe(0);
  });
  it('a flight rises a whole floor, evenly', () => {
    for (const f of FLIGHTS) {
      const z = (f.z0 + f.z1) / 2, lo = f.up === '+x' ? f.x0 + 0.01 : f.x1 - 0.01, hi = f.up === '+x' ? f.x1 - 0.01 : f.x0 + 0.01;
      expect(casperFloorY(f.base, lo, z)).toBeCloseTo(f.base * FH, 1);
      expect(casperFloorY(f.base + 1, hi, z)).toBeCloseTo((f.base + 1) * FH, 1);
      expect(flightT(f, (f.x0 + f.x1) / 2)).toBeCloseTo(0.5, 5);
    }
  });
});

describe('Casper: rooms, furniture, people', () => {
  it('the glass rooms are to look into: you can\'t walk in; the people in them are inside them', () => {
    for (const r of ROOMS) expect(insideCasper({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 }, r.level)).toBe(false);
    for (const c of CPEOPLE.filter((q) => q.inRoom)) expect(ROOMS.some((r) => r.level === c.level && c.x > r.x0 && c.x < r.x1 && c.z > r.z0 && c.z < r.z1)).toBe(true);
  });
  it('furniture stands on its floor (inside, not on a stair, not over the void upstairs); people out in the open stand where there\'s floor', () => {
    for (const f of FURNITURE) {
      expect(f.x).toBeGreaterThan(IN_L0.x0 - 3); expect(f.x).toBeLessThan(IN_L0.x1);
      expect(FLIGHTS.some((s) => (f.level === s.base || f.level === s.base + 1) && f.x > s.x0 && f.x < s.x1 && f.z > s.z0 && f.z < s.z1)).toBe(false);
      if (f.level > 0) expect(f.x > VOID.x0 && f.x < VOID.x1 && f.z > VOID.z0 && f.z < VOID.z1).toBe(false);
    }
    for (const c of CPEOPLE.filter((q) => !q.inRoom && q.level > 0)) expect(c.x > VOID.x0 && c.x < VOID.x1 && c.z > VOID.z0 && c.z < VOID.z1).toBe(false);
  });
});
