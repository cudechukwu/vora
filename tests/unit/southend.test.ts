import { describe, expect, it } from 'vitest';
import {
  ALLBRITTON, BERM, FIELD_ROAD, FRANK_ADD, FRANK_LINK, LINK_DOOR, OLIN_LINK, PAVILION, PLAZA_F, STAIRS_E, FRANK, FRANK_DOOR, LANDING, OLIN, OLIN_POLY, STAIRS, TERRACE_Y, groundY, inSouthEnd, offRoadForCars,
  southEndNear, southObstacles,
} from '../../src/row/southend';
import { BACK_PATH, FIELD_X, byId, inPoly, layoutRow } from '../../src/row/layout';
import { Extra, blockedAt, resolveMove } from '../../src/row/collide';
import { FOOTBALL, fenceObstacles, fenceRuns, pathObstacles } from '../../src/row/plaza';
import { surfaceAt } from '../../src/row/surface';
import { World } from '../../src/row/world';
import { PLACES } from '../../src/row/map';

const { stops, crossings } = layoutRow();
const fz = FOOTBALL.z;
const all: Extra = { solids: [...pathObstacles(), ...fenceObstacles(FIELD_X, fz), ...southObstacles()] };
const southOfJudd = crossings[0];

function walk(from: { x: number; z: number }, to: { x: number; z: number }, extra = all) {
  let p = { ...from };
  for (let i = 0; i < 8000; i++) {
    const d = Math.hypot(to.x - p.x, to.z - p.z);
    if (d < 0.01) break;
    const s = Math.min(0.2, d);
    p = resolveMove(p, { x: p.x + ((to.x - p.x) / d) * s, z: p.z + ((to.z - p.z) / d) * s }, stops, extra);
  }
  return p;
}

describe('the field road (south end of Andrus Field)', () => {
  it('carries straight on from the walkway south of Judd, across the back path, and on west', () => {
    expect(southOfJudd.z + southOfJudd.w / 2).toBeGreaterThan(FIELD_ROAD.z0); // the walkway lines up with it
    expect(FIELD_ROAD.x1).toBe(BACK_PATH.x0); // it starts where the back path is
    const mid = (FIELD_ROAD.z0 + FIELD_ROAD.z1) / 2;
    const at = walk({ x: -20, z: southOfJudd.z }, { x: BACK_PATH.x0, z: mid });
    expect(at.x).toBeCloseTo(BACK_PATH.x0, 1);
    const end = walk(at, { x: FIELD_ROAD.x0 + 10, z: mid });
    expect(end.x).toBeCloseTo(FIELD_ROAD.x0 + 10, 1);
  });

  it('runs between the football field (its fence to the north) and the bank (to the south), flat', () => {
    const fenceSouth = Math.max(...fenceRuns(FIELD_X, fz).flatMap(([, z0, , z1]) => [z0, z1]));
    expect(fenceSouth).toBeLessThan(FIELD_ROAD.z0);
    expect(BERM.z0).toBeGreaterThanOrEqual(FIELD_ROAD.z1);
    for (let x = FIELD_ROAD.x0; x < FIELD_ROAD.x1; x += 5) expect(groundY(x, (FIELD_ROAD.z0 + FIELD_ROAD.z1) / 2)).toBe(0);
  });

  it('is tar; the landing at the foot of the stairs is paving', () => {
    expect(surfaceAt({ x: -120, z: 0 }, crossings)).toBe('tar');
    expect(surfaceAt({ x: (LANDING.x0 + LANDING.x1) / 2, z: (LANDING.z0 + LANDING.z1) / 2 }, crossings)).toBe('paving');
  });

  it('the back path carries on south across it, to Allbritton; lamps stay off the road and the bank', () => {
    expect(World.backPathZ(crossings).z1).toBe(ALLBRITTON.z0);
    for (const l of World.lampSpots()) {
      expect([l, groundY(l.x, l.z)]).toEqual([l, 0]);
      const onRoad = l.x > FIELD_ROAD.x0 && l.x < FIELD_ROAD.x1 && l.z > FIELD_ROAD.z0 && l.z < FIELD_ROAD.z1;
      expect([l, onRoad]).toEqual([l, false]);
    }
  });
});

describe('Allbritton, at the end of the back path', () => {
  it('stands across the line of the back path, south of Judd and the field road (usdan ──> allbritton)', () => {
    const mid = (BACK_PATH.x0 + BACK_PATH.x1) / 2, judd = byId(stops, 'judd');
    expect(ALLBRITTON.x0).toBeLessThan(mid);
    expect(ALLBRITTON.x1).toBeGreaterThan(mid);
    expect(ALLBRITTON.z0).toBeGreaterThan(judd.z0 + 20);
    expect(ALLBRITTON.z0).toBeGreaterThan(FIELD_ROAD.z1 + 20);
    expect(ALLBRITTON.x0).toBeGreaterThan(BERM.x1); // not on the bank
  });
});

describe('the Frank Center and Olin, up on their bank', () => {
  it('the Frank Center: old block up on the bank (long north–south), the addition down by the back path, a glass connector between', () => {
    expect(BERM.x1).toBeLessThan(BACK_PATH.x0); // the bank stops short of the back path
    expect(FRANK.z1 - FRANK.z0).toBeGreaterThan(1.8 * (FRANK.x1 - FRANK.x0));
    expect(groundY((FRANK.x0 + FRANK.x1) / 2, FRANK.z0 - 1)).toBe(TERRACE_Y);
    expect(groundY(FRANK_ADD.x1 + 0.5, (FRANK_ADD.z0 + FRANK_ADD.z1) / 2)).toBe(0); // the addition's at ground level
    expect(FRANK_LINK.x0).toBe(FRANK.x1);
    expect(FRANK_LINK.x1).toBe(FRANK_ADD.x0);
    expect(BACK_PATH.x0 - FRANK_ADD.x1).toBeLessThan(4); // right by the path, across from Judd
    const judd = byId(stops, 'judd');
    expect(judd.z0).toBeGreaterThan(FRANK_ADD.z0);
    expect(judd.z1).toBeLessThan(FRANK_ADD.z1);
  });

  it('the stairs up from the field road lead to the glass connector\'s doors; the east stairs from the plaza to the medallion door', () => {
    expect(LINK_DOOR.x).toBeGreaterThan(STAIRS.x0);
    expect(LINK_DOOR.x).toBeLessThan(STAIRS.x1);
    expect(STAIRS.z1).toBeLessThan(FRANK_LINK.z0);
    expect(FRANK_DOOR.z).toBeGreaterThan(STAIRS_E.z0);
    expect(FRANK_DOOR.z).toBeLessThan(STAIRS_E.z1);
    expect(STAIRS_E.x1).toBeLessThanOrEqual(PLAZA_F.x0 + 0.5);
  });

  it('Olin, a good way west, faces the field; a limestone connector and a glass pavilion fill the gap to the Frank Center', () => {
    const north = Math.min(...OLIN_POLY.map((p) => p.z));
    expect(north).toBeGreaterThan(BERM.z0 + 6); // up on top of the bank
    expect(FRANK.x0 - OLIN.x1).toBeGreaterThan(8);
    expect(inPoly({ x: OLIN.cx, z: OLIN.cz }, OLIN_POLY)).toBe(true);
    expect(OLIN_LINK.x0).toBe(OLIN.x1);
    expect(OLIN_LINK.x1).toBe(FRANK.x0);
    expect(PAVILION.z1).toBe(OLIN_LINK.z0); // in front of it, toward the field
    expect(PAVILION.z0).toBeGreaterThan(BERM.z0 + 6);
  });

  it('walk up the stairs from the road: the ground rises step by step to the top of the bank, then the connector\'s doors stop you', () => {
    let y = -1;
    let p = { x: +LINK_DOOR.x, z: 0 };
    for (let i = 0; i < 200; i++) {
      p = resolveMove(p, { x: p.x, z: p.z + 0.1 }, stops, all);
      const h = groundY(p.x, p.z);
      expect(h).toBeGreaterThanOrEqual(y - 1e-9);
      y = h;
    }
    expect(y).toBeCloseTo(TERRACE_Y, 5);
    expect(p.z).toBeLessThan(FRANK_LINK.z0);
    expect(p.z).toBeGreaterThan(STAIRS.z1);
  });

  it('…and up the east stairs from the plaza to the medallion door', () => {
    let p = { x: PLAZA_F.x0 + 3, z: +FRANK_DOOR.z };
    for (let i = 0; i < 300; i++) p = resolveMove(p, { x: p.x - 0.1, z: p.z }, stops, all);
    expect(groundY(p.x, p.z)).toBeCloseTo(TERRACE_Y, 5);
    expect(p.x).toBeGreaterThan(FRANK.x1);
    expect(p.x).toBeLessThan(STAIRS_E.x0);
  });

  it('the grass bank slopes up gently (you can walk up it too), and is flat on top', () => {
    expect(groundY(-128, BERM.z0)).toBe(0);
    expect(groundY(-128, BERM.z0 + 3)).toBeGreaterThan(0.3);
    expect(groundY(-128, BERM.z0 + 3)).toBeLessThan(TERRACE_Y);
    expect(groundY(-128, 12)).toBe(TERRACE_Y);
    const p = walk({ x: -128, z: 0 }, { x: -128, z: 11 });
    expect(p.z).toBeCloseTo(11, 1);
  });

  it('every building down here is solid', () => {
    const mid = (b: { x0: number; x1: number; z0: number; z1: number }) => ({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 });
    for (const b of [FRANK, FRANK_LINK, FRANK_ADD, OLIN_LINK, PAVILION, ALLBRITTON]) expect(blockedAt(mid(b), stops)).toBe(true);
    expect(blockedAt({ x: OLIN.cx, z: OLIN.cz - OLIN.r + 1 }, stops)).toBe(true);
    const p = walk({ x: OLIN.cx, z: 10 }, { x: OLIN.cx, z: 30 });
    expect(p.z).toBeLessThan(OLIN.cz - OLIN.r);
    expect(inSouthEnd(p)).toBe(false);
  });

  it('cars can use the road, the landing, the plaza and the back path, but can\'t climb the bank or either stairs', () => {
    expect(offRoadForCars({ x: -100, z: 0 })).toBe(false);
    expect(offRoadForCars({ x: LINK_DOOR.x, z: 3.5 })).toBe(false); // the landing
    expect(offRoadForCars({ x: LINK_DOOR.x, z: 6 })).toBe(true); // the stairs
    expect(offRoadForCars({ x: -54, z: 30 })).toBe(false); // the back path, down to Allbritton
    expect(offRoadForCars({ x: -66, z: 50 })).toBe(false); // the plaza
    expect(offRoadForCars({ x: (STAIRS_E.x0 + STAIRS_E.x1) / 2, z: FRANK_DOOR.z })).toBe(true);
    expect(offRoadForCars({ x: -130, z: 9 })).toBe(true);
  });

  it('"now passing" names them, and they are on the map with spots on the road', () => {
    expect(southEndNear({ x: LINK_DOOR.x, z: 10 })).toBe('Frank Center');
    expect(southEndNear({ x: OLIN.cx, z: 12 })).toBe('Olin Library');
    expect(southEndNear({ x: -54, z: ALLBRITTON.z0 - 3 })).toBe('Allbritton Center');
    expect(southEndNear({ x: -180, z: 0 })).toBeNull();
    for (const id of ['frank', 'olin']) {
      const s = PLACES.find((p) => p.id === id)!.spawn;
      expect(groundY(s.x, s.z)).toBe(0);
      expect(s.z).toBeGreaterThan(FIELD_ROAD.z0);
      expect(s.z).toBeLessThan(FIELD_ROAD.z1);
    }
  });
});
