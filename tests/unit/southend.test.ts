import { describe, expect, it } from 'vitest';
import {
  ALLBRITTON, BERM, FIELD_ROAD, FRANK_ADD, FRANK_LINK, LINK_DOOR, OLIN_LINK, PLAZA_F, STAIRS_E, FRANK, FRANK_DOOR, LANDING, OLIN, OLIN_POLY, STAIRS, TERRACE_Y, groundY, inSouthEnd, offRoadForCars,
  southEndNear, southObstacles, MAIN_ENTRY, PRUZAN, PRUZAN_PIERS, PRUZAN_GLASS, PRUZAN_ENTRY, PRUZAN_DOOR, PRUZAN_COURT, POOL, POOL_BED,
  POOL_SITTERS, GALLERY, GALLERY_SOFAS, PRUZAN_BIRCH, pruzanSoffit, pruzanPaveEdge, PRUZAN_FRANK_BED, FRANK_NICHE_W,
  OLIN_LINK_POLY, NCOURT, NCOURT_TABLES, NCOURT_BED, NWALK, PRUZAN_LINK_N, PRUZAN_DOOR_N, STAIRS_W, BALUSTRADE, FLAGPOLE, FRANK_NICHE_N, ALLB_WELLS, ALLBRITTON_DOOR, LINK_DOOR_S, LINK_WALK, OLIN_WALK, OLIN_DOOR, PLAZA_TABLES,
  OLIN_Y, OLIN_RISE, OLIN_SITE, STAIRS_O, terrainY, PORTICO_O, OLIN_STEPS, OLIN_COLUMNS, OLIN_LAWN, LAWN_WALKS, OLIN_TREES, OLIN_BENCHES, lawnWalkDist,
  CHURCH, CHURCH_WALK_N, CHURCH_WALK_S, CHURCH_XWALK, WALKWAY, WALKWAY_PTS, CHAIN_POSTS, WALKWAY_LAMPS, walkwayAt, walkwayPoint, churchY,
  CLARK, CLARK_Y, CLARK_DOOR, CLARK_LANE, CLARK_STALLS, CLARK_PARKED, CLARK_ENDS, CLARK_GAP, CLARK_COURT, CLARK_STAIRS_W, CLARK_STAIRS_S, STAIRS_C, DUMPSTERS, BANK_FLIGHTS, balustradeRuns, CLARK_LOW, OLIN_LOW_WALL,
  ALLB_TOWER, ALLB_BAY, ALLB_WING, ALLB_WING_DOOR, ALLB_REAR_DOOR, ALLB_LANDING, ALLB_STEPS, ALLB_RAMP, ALLB_LOT, ALLB_DRIVE, ALLB_STALLS, ALLB_PARKED, ALLB_WALL,
} from '../../src/row/southend';
import { BACK_PATH, ROAD, FIELD_X, byId, inPoly, layoutRow } from '../../src/row/layout';
import { Extra, blockedAt, resolveMove } from '../../src/row/collide';
import { FOOTBALL, fenceObstacles, fenceRuns, pathObstacles } from '../../src/row/plaza';
import { surfaceAt } from '../../src/row/surface';
import { World } from '../../src/row/world';
import { PLACES } from '../../src/row/map';
import { createGarage } from '../../src/row/cars';
import { FRONT_LAWN, NEAR_WALK, frontBenches, frontTrees, frontWalkDist, frontWalks } from '../../src/row/frontlawn';

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

  it('the stairs up from the field road lead to the glass connector\'s doors; the east stairs, well south of the Frank Center, to the walk to Olin', () => {
    expect(LINK_DOOR.x).toBeGreaterThan(STAIRS.x0);
    expect(LINK_DOOR.x).toBeLessThan(STAIRS.x1);
    expect(STAIRS.z1).toBeLessThan(FRANK_LINK.z0);
    expect(STAIRS_E.x1).toBeLessThanOrEqual(PLAZA_F.x0 + 0.5);
    expect(STAIRS_E.z0).toBeGreaterThan(FRANK.z1 + 3); // past the Frank Center's south end…
    expect(STAIRS_E.z0).toBeGreaterThan(FRANK_ADD.z1 + 15); // …with a wide plaza between them and the addition
    for (const t of PLAZA_TABLES) expect(t.z).toBeLessThan(STAIRS_E.z0); // (the tables are in it)
    expect(ALLBRITTON.z0).toBeGreaterThan(STAIRS_E.z1 + 12); // and Allbritton well back
    expect(PLAZA_F.z1).toBeLessThanOrEqual(ALLBRITTON.z0);
    // the walk at the top runs straight on west to Olin's front door
    expect(OLIN_WALK.x1).toBe(STAIRS_E.x0);
    expect(OLIN_WALK.x0).toBe(OLIN.x1);
    expect(OLIN_DOOR.z).toBe(OLIN.z1); // Olin's door is on its south front (the user: the columns faced the wrong way)
    expect(OLIN_DOOR.x).toBe(OLIN.cx);
    expect(OLIN_WALK.z0).toBeGreaterThan(FRANK.z1); // passing the Frank Center's south end
  });

  it('Olin, a good way west, faces the field; the Pruzan\'s gallery block stands against it, short of the Frank Center', () => {
    const north = Math.min(...OLIN_POLY.map((p) => p.z));
    expect(north).toBeGreaterThan(BERM.z0 + 6); // up on top of the bank
    expect(FRANK.x0 - OLIN.x1).toBeGreaterThan(16);
    expect(inPoly({ x: OLIN.cx, z: OLIN.cz }, OLIN_POLY)).toBe(true);
    expect(OLIN_LINK.x0).toBe(OLIN.x1);
    expect(FRANK.x0 - OLIN_LINK.x1).toBeGreaterThan(6); // a courtyard between it and the Frank Center
    expect(Math.min(...OLIN_LINK_POLY.map((p) => p.z))).toBeGreaterThan(BALUSTRADE.z + 4); // a paved terrace in front of it
    expect(BALUSTRADE.x0).toBeLessThan(OLIN.x0); // the fence runs straight on along Olin's drum to the end, behind the dumpsters
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

  it('…and up the east stairs from the plaza, along the walk past the Pruzan, up the small stairs, along Olin\'s front, up its steps to the door', () => {
    const z = (OLIN_WALK.z0 + OLIN_WALK.z1) / 2;
    let p = { x: PLAZA_F.x0 + 3, z };
    let y = -1;
    const step = (to: { x: number; z: number }) => {
      const d = Math.hypot(to.x - p.x, to.z - p.z);
      p = resolveMove(p, d < 0.1 ? to : { x: p.x + ((to.x - p.x) / d) * 0.1, z: p.z + ((to.z - p.z) / d) * 0.1 }, stops, all);
      const h = groundY(p.x, p.z);
      expect(h).toBeGreaterThanOrEqual(y - 0.02); // only ever up (a centimetre's give where a bottom step meets the ground)
      y = h;
    };
    for (let i = 0; i < 900 && p.x > OLIN_DOOR.x + 0.05; i++) step({ x: OLIN_DOOR.x, z });
    expect(p.x).toBeCloseTo(OLIN_DOOR.x, 1);
    expect(y).toBeCloseTo(OLIN_Y, 5); // up on Olin's grounds
    for (let i = 0; i < 200; i++) step({ x: OLIN_DOOR.x, z: OLIN_DOOR.z - 1 }); // up the steps, across the portico
    expect(y).toBeCloseTo(PORTICO_O.y, 5);
    expect(p.z).toBeLessThan(OLIN_DOOR.z + 1); // right up to the door (your radius from it)
    expect(p.z).toBeGreaterThan(OLIN_DOOR.z);
  });

  it('Olin\'s grounds stand higher than the bank: grass slopes up to them (no wall), the small stairs set into the slope', () => {
    expect(OLIN_RISE).toBeGreaterThan(0.5);
    expect(groundY(OLIN.cx, OLIN_LAWN.z0 + 10)).toBeCloseTo(OLIN_Y, 5); // the lawn
    expect(groundY(OLIN_SITE.x1 + 1, OLIN_LAWN.z0 + 10)).toBe(TERRACE_Y); // past the foot of the slope, the bank
    expect(STAIRS_O.x1).toBe(OLIN_SITE.x1);
    expect(STAIRS_O.z0).toBe(OLIN_WALK.z0);
    // beside the stairs the grass rises just as they do, gently (1 in 5); you can walk straight up it
    for (const dz of [-1.5, 1.5]) {
      const z = dz < 0 ? STAIRS_O.z0 + dz : STAIRS_O.z1 + dz;
      for (let x = STAIRS_O.x1; x >= STAIRS_O.x0; x -= 0.5) expect(groundY(x, z)).toBeCloseTo(groundY(x, (STAIRS_O.z0 + STAIRS_O.z1) / 2), 5);
    }
    expect(OLIN_RISE / (STAIRS_O.x1 - STAIRS_O.x0)).toBeLessThan(0.25);
    const q = walk({ x: OLIN_SITE.x1 + 4, z: OLIN_LAWN.z0 + 10 }, { x: OLIN_SITE.x1 - 6, z: OLIN_LAWN.z0 + 10 });
    expect(q.x).toBeCloseTo(OLIN_SITE.x1 - 6, 1);
    // the grass is drawn under the steps, never over them (the user saw it over the small stairs)
    for (let x = STAIRS_O.x0 + 0.05; x < STAIRS_O.x1; x += 0.25) {
      const i = Math.floor((STAIRS_O.x1 - x) / ((STAIRS_O.x1 - STAIRS_O.x0) / STAIRS_O.steps)); // which step (its top: one rise more than the last)
      expect(terrainY(x, (STAIRS_O.z0 + STAIRS_O.z1) / 2)).toBeLessThanOrEqual(TERRACE_Y + (OLIN_RISE * (i + 1)) / STAIRS_O.steps + 1e-9);
    }
    for (let z = OLIN_STEPS.z0 + 0.05; z < OLIN_STEPS.z1; z += 0.25) expect(terrainY(OLIN.cx, z)).toBeLessThanOrEqual(OLIN_Y + 1e-9);
    expect(terrainY(OLIN.cx, (PORTICO_O.z0 + PORTICO_O.z1) / 2)).toBeLessThan(PORTICO_O.y - 1);
    // the slopes on its far sides are gentle grass too
    expect(groundY(OLIN_SITE.x0 - 1, 60)).toBeGreaterThan(TERRACE_Y);
    expect(groundY(OLIN_SITE.x0 - 1, 60)).toBeLessThan(OLIN_Y);
  });

  it('the portico: six columns along its front edge, the steps as wide as it, the door in the middle', () => {
    expect(OLIN_COLUMNS).toHaveLength(6);
    for (const c of OLIN_COLUMNS) { expect(c.x).toBeGreaterThan(PORTICO_O.x0); expect(c.x).toBeLessThan(PORTICO_O.x1); expect(c.z).toBeLessThan(PORTICO_O.z1); }
    expect(OLIN_STEPS.x0).toBe(PORTICO_O.x0);
    expect(OLIN_STEPS.x1).toBe(PORTICO_O.x1);
    expect(OLIN_STEPS.z0).toBe(PORTICO_O.z1);
    expect(PORTICO_O.y - OLIN_Y).toBeGreaterThan(1.5); // a proper flight
    expect((OLIN_STEPS.z1 - OLIN_STEPS.z0) / OLIN_STEPS.steps).toBeGreaterThan(0.3); // treads you can stand on
    expect((OLIN_COLUMNS[0].x + OLIN_COLUMNS[5].x) / 2).toBeCloseTo(OLIN_DOOR.x, 5);
    // you can't step off the portico's side, nor walk between the columns into them
    const p = walk({ x: OLIN.cx, z: (PORTICO_O.z0 + PORTICO_O.z1) / 2 }, { x: PORTICO_O.x1 + 4, z: (PORTICO_O.z0 + PORTICO_O.z1) / 2 });
    expect(p.x).toBeLessThan(PORTICO_O.x1);
  });

  it('the lawn: two walks straight out from the steps, an X of diagonals, trees and benches off the walks', () => {
    expect(LAWN_WALKS).toHaveLength(4);
    for (const w of LAWN_WALKS.slice(0, 2)) { expect(w.a.x).toBe(w.b.x); expect(w.a.x).toBeGreaterThan(OLIN_STEPS.x0); expect(w.a.x).toBeLessThan(OLIN_STEPS.x1); }
    const [, , d1, d2] = LAWN_WALKS; // corner to corner, crossing
    expect(Math.sign(d1.b.x - d1.a.x)).toBe(-Math.sign(d2.b.x - d2.a.x));
    expect((d1.a.x + d1.b.x) / 2).toBeCloseTo((d2.a.x + d2.b.x) / 2, 5);
    for (const t of OLIN_TREES) {
      expect(lawnWalkDist(t)).toBeGreaterThan(1.5);
      expect(t.x).toBeGreaterThan(OLIN_LAWN.x0); expect(t.x).toBeLessThan(OLIN_LAWN.x1);
      expect(t.z).toBeGreaterThan(OLIN_LAWN.z0); expect(t.z).toBeLessThan(OLIN_LAWN.z1);
    }
    for (const b of OLIN_BENCHES) { expect(lawnWalkDist(b)).toBeGreaterThan(0.6); expect(lawnWalkDist(b)).toBeLessThan(2.5); } // beside a walk
    expect(OLIN_LAWN.z1).toBeLessThanOrEqual(OLIN_SITE.z1);
    expect(OLIN_LAWN.z1).toBeLessThanOrEqual(BERM.z1 - 5); // the bank's flat top runs on under it
    expect(southEndNear({ x: OLIN.cx, z: OLIN_LAWN.z0 + 20 })).toBe('Olin Library');
  });

  it('from the top of the east stairs, north along the bank to the medallion door', () => {
    let p = { x: STAIRS_E.x0 - 0.5, z: (STAIRS_E.z0 + STAIRS_E.z1) / 2 };
    for (let i = 0; i < 40; i++) p = resolveMove(p, { x: Math.max(LINK_DOOR_S.x, p.x - 0.1), z: p.z }, stops, all);
    for (let i = 0; i < 400 && p.z > FRANK_DOOR.z; i++) p = resolveMove(p, { x: p.x, z: Math.max(FRANK_DOOR.z, p.z - 0.1) }, stops, all);
    expect(p.z).toBeCloseTo(FRANK_DOOR.z, 1);
    for (let i = 0; i < 100; i++) p = resolveMove(p, { x: p.x - 0.1, z: p.z }, stops, all);
    expect(groundY(p.x, p.z)).toBe(TERRACE_Y);
    expect(p.x).toBeLessThan(FRANK.x1 + 1);
    expect(p.x).toBeGreaterThan(FRANK.x1);
  });

  it('the grass bank slopes up gently (you can walk up it too), and is flat on top', () => {
    expect(groundY(-100, BERM.z0)).toBe(0);
    expect(groundY(-100, BERM.z0 + 3)).toBeGreaterThan(0.3);
    expect(groundY(-100, BERM.z0 + 3)).toBeLessThan(TERRACE_Y);
    expect(groundY(-100, 12)).toBe(TERRACE_Y);
    const p = walk({ x: -100, z: 0 }, { x: -100, z: 11 }); // (in front of the Frank Center: no balustrade there)
    expect(p.z).toBeCloseTo(11, 1);
  });

  it('every building down here is solid', () => {
    const mid = (b: { x0: number; x1: number; z0: number; z1: number }) => ({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 });
    for (const b of [FRANK, FRANK_LINK, FRANK_ADD, OLIN_LINK, ALLBRITTON]) expect(blockedAt(mid(b), stops)).toBe(true);
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
    expect(offRoadForCars({ x: (STAIRS_E.x0 + STAIRS_E.x1) / 2, z: (STAIRS_E.z0 + STAIRS_E.z1) / 2 })).toBe(true);
    expect(offRoadForCars({ x: -130, z: 9 })).toBe(true);
  });

  it('"now passing" names them, and they are on the map with spots on the road', () => {
    expect(southEndNear({ x: LINK_DOOR.x, z: 10 })).toBe('Frank Center');
    expect(southEndNear({ x: OLIN.cx, z: 12 })).toBe('Olin Library');
    expect(southEndNear({ x: -54, z: ALLBRITTON.z0 - 3 })).toBe('Allbritton Center');
    expect(southEndNear({ x: -150, z: -12 })).toBeNull(); // (out on the field)
    const f = PLACES.find((p) => p.id === 'frank')!.spawn; // on the road at the foot of its stairs
    expect(groundY(f.x, f.z)).toBe(0);
    expect(f.z).toBeGreaterThan(FIELD_ROAD.z0);
    expect(f.z).toBeLessThan(FIELD_ROAD.z1);
    const o = PLACES.find((p) => p.id === 'olin')!.spawn; // on its lawn, facing the portico
    expect(groundY(o.x, o.z)).toBeCloseTo(OLIN_Y, 5);
    expect(blockedAt(o, stops)).toBe(false);
    expect(o.heading).toBe(Math.PI);
  });
});

describe("the Frank Center addition's main entry", () => {
  it('faces the back path across from Judd (on its east face), not the plaza', () => {
    expect(MAIN_ENTRY.x).toBe(FRANK_ADD.x1);
    expect(MAIN_ENTRY.z).toBeGreaterThan(FRANK_ADD.z0 + MAIN_ENTRY.half);
    expect(MAIN_ENTRY.z).toBeLessThan(FRANK_ADD.z1 - MAIN_ENTRY.half);
    const judd = byId(stops, 'judd');
    expect(MAIN_ENTRY.z).toBeGreaterThan(judd.z1);
    expect(MAIN_ENTRY.z).toBeLessThan(judd.z0 + 3); // (by its south end)
    expect(BACK_PATH.x0 - (MAIN_ENTRY.x + MAIN_ENTRY.out)).toBeGreaterThan(1); // room to walk up to it
  });

  it('you can walk off the back path straight up to its doors', () => {
    let p = { x: (BACK_PATH.x0 + BACK_PATH.x1) / 2, z: MAIN_ENTRY.z };
    for (let i = 0; i < 200; i++) p = resolveMove(p, { x: p.x - 0.15, z: p.z }, stops, all);
    expect(p.x).toBeLessThan(MAIN_ENTRY.x + MAIN_ENTRY.out + 0.8);
    expect(p.x).toBeGreaterThan(MAIN_ENTRY.x + MAIN_ENTRY.out); // and no further: the bay is solid
  });
});

describe('the forecourt at the top of the stairs, and Allbritton\'s basement entrances', () => {
  it("the connector's south doors: a paver walk up on the bank from the top of the east stairs to them", () => {
    expect(LINK_DOOR_S.z).toBe(FRANK_LINK.z1);
    expect(LINK_DOOR_S.x).toBeGreaterThan(FRANK_LINK.x0 + 1.5);
    expect(LINK_DOOR_S.x).toBeLessThan(FRANK_LINK.x1 - 1.5);
    for (const z of [LINK_WALK.z0 + 0.5, (LINK_WALK.z0 + LINK_WALK.z1) / 2, LINK_WALK.z1]) expect(groundY(LINK_DOOR_S.x, z)).toBe(TERRACE_Y); // level, up top
    // from the top of the east stairs, along the walk, right up to the doors
    let p: { x: number; z: number } = { x: STAIRS_E.x0 - 1, z: (STAIRS_E.z0 + STAIRS_E.z1) / 2 };
    for (let i = 0; i < 80; i++) p = resolveMove(p, { x: Math.max(LINK_DOOR_S.x, p.x - 0.1), z: p.z }, stops, all);
    for (let i = 0; i < 600; i++) p = resolveMove(p, { x: p.x, z: p.z - 0.1 }, stops, all);
    expect(p.z).toBeLessThan(LINK_DOOR_S.z + 1); // (your radius from the glass)
    expect(p.z).toBeGreaterThan(LINK_DOOR_S.z); // the glass is solid
  });

  it('two wells, either side of the front steps, against the facade; you cannot walk into them', () => {
    expect(ALLB_WELLS).toHaveLength(2);
    const [a, b] = ALLB_WELLS;
    expect(a.x1).toBeLessThan(ALLBRITTON_DOOR.x - 2);
    expect(b.x0).toBeGreaterThan(ALLBRITTON_DOOR.x + 2);
    for (const w of ALLB_WELLS) {
      expect(w.z1).toBe(ALLBRITTON.z0);
      const mid = { x: (w.x0 + w.x1) / 2, z: w.z0 - 2 };
      let p = { ...mid };
      for (let i = 0; i < 60; i++) p = resolveMove(p, { x: p.x, z: p.z + 0.1 }, stops, all);
      expect(p.z).toBeLessThan(w.z0);
    }
    // and the way to the front door between them stays open
    let p = { x: ALLBRITTON_DOOR.x, z: ALLBRITTON.z0 - 6 };
    for (let i = 0; i < 80; i++) p = resolveMove(p, { x: p.x, z: p.z + 0.1 }, stops, all);
    expect(p.z).toBeGreaterThan(ALLBRITTON.z0 - 1);
  });
});

describe('the Pruzan Art Center, between Olin and the Frank Center', () => {
  it('fills the gap: Olin, the planted bed, the glass between its two piers, the entrance against the Frank Center', () => {
    expect(PRUZAN.x0).toBeGreaterThan(OLIN.x1); // (the bed's room)
    expect(PRUZAN_PIERS[0].x0).toBe(PRUZAN.x0);
    expect(PRUZAN_GLASS.x0).toBe(PRUZAN_PIERS[0].x1);
    expect(PRUZAN_GLASS.x1).toBe(PRUZAN_PIERS[1].x0);
    expect(PRUZAN_GLASS.x1 - PRUZAN_GLASS.x0).toBeGreaterThan(9); // a long glass front
    expect(PRUZAN_ENTRY.x0).toBe(PRUZAN.x1);
    expect(PRUZAN_ENTRY.x1).toBe(FRANK.x0);
    expect(PRUZAN_DOOR.z).toBeLessThan(PRUZAN.z1); // the doors set back from the glass
    expect(PRUZAN.z0).toBe(OLIN_LINK.z1); // in front of the tall gallery block
    expect(PRUZAN.z1).toBeLessThan(FRANK.z1); // within the gap
    expect(PRUZAN_COURT.z1).toBeCloseTo(OLIN_WALK.z0, 5); // its courtyard runs down to the walk to Olin's door
  });

  it('the walk to Olin\'s door (and its stairs) keeps well clear of the Frank Center and the Pruzan\'s doors (the user, 2026-10-07)', () => {
    expect(OLIN_WALK.z0 - FRANK.z1).toBeGreaterThan(12);
    expect(OLIN_WALK.z0 - PRUZAN_DOOR.z).toBeGreaterThan(18);
    expect(OLIN_WALK.z0 - POOL.z1).toBeGreaterThan(10); // a big courtyard
    expect(STAIRS_E.z1).toBeLessThan(BERM.z1 - 6); // still on the flat top of the bank's east side
  });

  it('its canopy sags: highest at the piers, lowest in the middle, always well over your head', () => {
    const mid = (PRUZAN.x0 + PRUZAN.x1) / 2;
    expect(pruzanSoffit(PRUZAN.x0)).toBeGreaterThan(pruzanSoffit(mid) + 0.5);
    expect(pruzanSoffit(PRUZAN.x1)).toBeCloseTo(pruzanSoffit(PRUZAN.x0), 5);
    expect(pruzanSoffit(PRUZAN.x0 + 2)).toBeGreaterThan(pruzanSoffit(PRUZAN.x0 + 4));
    expect(pruzanSoffit(mid) - TERRACE_Y).toBeGreaterThan(3.5);
  });

  it('is solid (the glass room, the piers, the entrance), and up on the bank', () => {
    const mid = (b: { x0: number; x1: number; z0: number; z1: number }) => ({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 });
    for (const b of [PRUZAN, PRUZAN_ENTRY, PRUZAN_LINK_N, ...PRUZAN_PIERS]) expect(blockedAt(mid(b), stops)).toBe(true);
    expect(blockedAt({ x: (OLIN_LINK.x0 + OLIN_LINK.x1) / 2, z: OLIN_LINK.z0 - OLIN_LINK.bulge + 0.3 }, stops)).toBe(true); // its bowed north end
    expect(groundY((PRUZAN_COURT.x0 + PRUZAN_COURT.x1) / 2, (PRUZAN_COURT.z0 + PRUZAN_COURT.z1) / 2)).toBe(TERRACE_Y);
    // the room is furnished inside its walls
    for (const s of GALLERY_SOFAS) {
      expect(s.x - s.len / 2).toBeGreaterThan(GALLERY.x0);
      expect(s.x + s.len / 2).toBeLessThan(GALLERY.x1);
      expect(s.z + 0.5 + s.arm).toBeLessThan(GALLERY.z1);
    }
  });

  it('the fountain sits on the courtyard a walk out from the glass, its bed of grasses in the water; you can\'t walk into it', () => {
    expect(POOL.z0 - PRUZAN.z1).toBeGreaterThan(1.5); // a walk's width between it and the glass
    expect(POOL.z1).toBeLessThan(PRUZAN_COURT.z1 - 1.5); // and room to pass in front
    expect(POOL.x0).toBeGreaterThan(PRUZAN_GLASS.x0);
    expect((POOL.x0 + POOL.x1) / 2).toBeLessThan((PRUZAN_GLASS.x0 + PRUZAN_GLASS.x1) / 2); // off-centre toward Olin
    expect(POOL_BED.x0).toBeGreaterThan(POOL.x0);
    expect(POOL_BED.x1).toBeLessThan(POOL.x1);
    expect(POOL_BED.z1).toBeLessThan(POOL.z1);
    const c = { x: (POOL.x0 + POOL.x1) / 2, z: (POOL.z0 + POOL.z1) / 2 };
    const p = walk({ x: c.x, z: PRUZAN_COURT.z1 + 2 }, c);
    expect(p.z).toBeGreaterThan(POOL.z1); // stopped at its rim
    for (const s of POOL_SITTERS) { expect(s.x).toBeGreaterThan(POOL.x0); expect(s.x).toBeLessThan(POOL.x1); }
  });

  it('you can walk from the walk to Olin round the fountain to the glass, along it, and up to the doors', () => {
    let p = walk({ x: POOL.x1 + 2.2, z: OLIN_WALK.z0 + 1.5 }, { x: POOL.x1 + 2.2, z: PRUZAN.z1 });
    expect(p.z).toBeLessThan(PRUZAN.z1 + 1); // right up to the glass
    p = walk(p, { x: PRUZAN_GLASS.x0 + 1.2, z: p.z }); // along it, between it and the fountain
    expect(p.x).toBeCloseTo(PRUZAN_GLASS.x0 + 1.2, 1);
    p = walk({ x: PRUZAN_DOOR.x - 1.5, z: PRUZAN_COURT.z1 - 1 }, { x: PRUZAN_DOOR.x - 1.5, z: PRUZAN_DOOR.z + 3 }); // (inside the bollards along the bed)
    p = walk(p, { x: PRUZAN_DOOR.x, z: PRUZAN_DOOR.z - 2 });
    expect(p.z).toBeGreaterThan(PRUZAN_DOOR.z); // up to the doors, not through them
    expect(p.z).toBeLessThan(PRUZAN_DOOR.z + 1); // (you keep 0.8 m off any wall)
  });

  it('the pavers sweep: their west edge clears the fountain, comes in to a waist, and flares out again at the walk', () => {
    expect(pruzanPaveEdge(PRUZAN.z1)).toBeCloseTo(PRUZAN.x0, 5);
    for (let z = POOL.z0 - 0.3; z <= POOL.z1 + 0.3; z += 0.1) expect(pruzanPaveEdge(z)).toBeLessThan(POOL.x0 - 1); // a walk round the fountain's west side
    let waist = -Infinity;
    for (let z = PRUZAN.z1; z <= PRUZAN_COURT.z1; z += 0.1) waist = Math.max(waist, pruzanPaveEdge(z));
    expect(waist).toBeGreaterThan(POOL.x0 + 2); // the lawn reaches in
    expect(pruzanPaveEdge(PRUZAN_COURT.z1)).toBeLessThan(waist - 2); // and the paving flares at the walk
    expect(FRANK.x0 - waist).toBeGreaterThan(6); // still a wide way through
    expect(PRUZAN_BIRCH.x).toBeLessThan(pruzanPaveEdge(PRUZAN_BIRCH.z)); // the birch is off the paving, by Olin
    expect(PRUZAN_BIRCH.x).toBeGreaterThan(OLIN.x1);
    expect(PRUZAN_FRANK_BED.x1).toBe(FRANK.x0);
    expect(PRUZAN_FRANK_BED.z0).toBeGreaterThan(PRUZAN_DOOR.z + 1); // not in front of the doors
  });

  it('"now passing" names it in its courtyard and on the walk in front; the Frank Center\'s niche looks onto it', () => {
    expect(southEndNear({ x: PRUZAN_DOOR.x, z: PRUZAN_DOOR.z + 3 })).toBe('Pruzan Art Center');
    expect(southEndNear({ x: (POOL.x0 + POOL.x1) / 2, z: OLIN_WALK.z0 + 1 })).toBe('Pruzan Art Center');
    expect(southEndNear({ x: (NCOURT.x0 + NCOURT.x1) / 2, z: 30 })).toBe('Pruzan Art Center');
    expect(FRANK_NICHE_W).toBeGreaterThan(PRUZAN_DOOR.z + 1);
    expect(FRANK_NICHE_W).toBeLessThan(FRANK.z1 - 1.5);
    const s = PLACES.find((p) => p.id === 'pruzan')!.spawn;
    expect(inSouthEnd(s, 0.3)).toBe(false);
    expect(blockedAt(s, stops)).toBe(false);
  });
});

describe('the back of the Pruzan, on the field side', () => {
  it('a courtyard between the gallery block and the Frank Center, from the lawn down to the glass link\'s doors', () => {
    expect(NCOURT.x0).toBe(OLIN_LINK.x1);
    expect(NCOURT.x1).toBe(FRANK.x0);
    expect(NCOURT.z1).toBe(PRUZAN_LINK_N.z0);
    expect(PRUZAN_LINK_N.x0).toBe(OLIN_LINK.x1); // the link runs the courtyard's width…
    expect(PRUZAN_LINK_N.x1).toBe(FRANK.x0);
    expect(PRUZAN_LINK_N.z1).toBe(PRUZAN_ENTRY.z0); // …and on through to the south doors
    for (const t of NCOURT_TABLES) { // the tables are in it, clear of the bed
      expect(t.x - 1.1).toBeGreaterThan(NCOURT.x0);
      expect(t.x + 1.1).toBeLessThan(NCOURT_BED.x0);
      expect(t.z - 1.1).toBeGreaterThan(NCOURT.z0);
      expect(t.z + 1.1).toBeLessThan(NCOURT.z1);
    }
    expect(FRANK_NICHE_N).toBeGreaterThan(NCOURT.z0 + 2);
    expect(FRANK_NICHE_N).toBeLessThan(NCOURT.z1 - 2);
  });

  it('up the new stairs from the field road, along the walk on the lawn, down the courtyard to the glass doors', () => {
    expect(offRoadForCars({ x: (STAIRS_W.x0 + STAIRS_W.x1) / 2, z: (STAIRS_W.z0 + STAIRS_W.z1) / 2 })).toBe(true);
    const x = (STAIRS_W.x0 + STAIRS_W.x1) / 2;
    let p = { x, z: FIELD_ROAD.z1 - 0.5 }, y = -1;
    for (let i = 0; i < 110; i++) {
      p = resolveMove(p, { x, z: p.z + 0.1 }, stops, all);
      const h = groundY(p.x, p.z);
      expect(h).toBeGreaterThanOrEqual(y - 0.02);
      y = h;
    }
    expect(y).toBe(TERRACE_Y);
    expect(p.z).toBeGreaterThan(BALUSTRADE.z); // through the gap in the balustrade
    p = walk(p, { x, z: (NWALK.z0 + NWALK.z1) / 2 });
    p = walk(p, { x: PRUZAN_DOOR_N.x, z: (NWALK.z0 + NWALK.z1) / 2 }); // along the walk (under the flagpole's nose)
    expect(p.x).toBeCloseTo(PRUZAN_DOOR_N.x, 1);
    p = walk(p, { x: PRUZAN_DOOR_N.x, z: PRUZAN_DOOR_N.z + 2 }); // down the middle of the courtyard, between the tables
    expect(p.z).toBeLessThan(PRUZAN_DOOR_N.z);
    expect(p.z).toBeGreaterThan(PRUZAN_DOOR_N.z - 1);
    expect(FLAGPOLE.z).toBeGreaterThan(NWALK.z1);
  });

  it('the balustrade along the top of the bank stops you walking off it, except at the stairs', () => {
    const p = walk({ x: STAIRS_W.x0 - 5, z: 14 }, { x: STAIRS_W.x0 - 5, z: 4 });
    expect(p.z).toBeGreaterThan(BALUSTRADE.z);
    const q = walk({ x: (STAIRS_W.x0 + STAIRS_W.x1) / 2, z: 14 }, { x: (STAIRS_W.x0 + STAIRS_W.x1) / 2, z: 2 });
    expect(q.z).toBeLessThan(STAIRS_W.z0); // down the stairs
  });
});

describe('the walkway down Allbritton\'s side to Church Street', () => {
  const top = WALKWAY_PTS[0], foot = WALKWAY_PTS[WALKWAY_PTS.length - 1];
  it('carries on from the south end of the plaza, down Allbritton\'s west side, onto Church Street\'s sidewalk (the user showed where)', () => {
    expect(top.z).toBeLessThan(PLAZA_F.z1); expect(top.x).toBeGreaterThan(PLAZA_F.x0); // it starts on the plaza
    expect(foot.z).toBeGreaterThan(CHURCH_WALK_N.z0); expect(foot.z).toBeLessThan(CHURCH_WALK_N.z1);
    expect(foot.x).toBeGreaterThan(CHURCH_XWALK.x0); expect(foot.x).toBeLessThan(CHURCH_XWALK.x1); // straight onto the crosswalk
    for (let s = 0; s < WALKWAY.len; s += 1) { // alongside Allbritton, close by, west of it
      const p = walkwayPoint(s);
      if (p.z > ALLBRITTON.z0 && p.z < ALLBRITTON.z1) { expect(p.x).toBeLessThan(ALLBRITTON.x0 - 3); expect(p.x).toBeGreaterThan(ALLBRITTON.x0 - 9); }
    }
    for (const p of WALKWAY_PTS) expect(inSouthEnd(p, 1.3)).toBe(false); // clear of every building
  });

  it('is level (like the plaza and the street), with room beside it: the bank steps back west past the plaza\'s end', () => {
    for (let s = 0; s <= WALKWAY.len; s += 0.5) { const p = walkwayPoint(s); expect(groundY(p.x, p.z)).toBe(0); }
    for (let s = 3; s <= WALKWAY.len - 2; s += 1) { // the planted bed on its west side is level too, before the bank rises
      const p = walkwayPoint(s), x = p.x - p.dz * WALKWAY.beds, z = p.z + p.dx * WALKWAY.beds;
      expect(groundY(x, z)).toBeLessThan(0.05);
    }
    expect(groundY((STAIRS_E.x0 + STAIRS_E.x1) / 2 - 3, (STAIRS_E.z0 + STAIRS_E.z1) / 2)).toBe(TERRACE_Y); // (still up by the east stairs)
    // walk it from the plaza to the street
    let p = { ...top };
    for (let s = 0.5; s <= WALKWAY.len; s += 0.5) p = resolveMove(p, walkwayPoint(s), stops, all);
    expect(Math.hypot(p.x - foot.x, p.z - foot.z)).toBeLessThan(0.6);
  });

  it('chains on posts along both edges keep you on it: step off sideways and you\'re stopped', () => {
    expect(CHAIN_POSTS.filter((p) => p.side < 0).length).toBeGreaterThan(12);
    for (const p of CHAIN_POSTS) expect(walkwayAt(p).d).toBeCloseTo(WALKWAY.chains, 1); // just off the tar
    for (const s of [12, 25, WALKWAY.len - 8]) {
      const c = walkwayPoint(s);
      for (const side of [-1, 1]) {
        const p = walk(c, { x: c.x + side * c.dz * 6, z: c.z - side * c.dx * 6 });
        expect(walkwayAt(p).d).toBeLessThan(WALKWAY.chains);
      }
    }
    for (const l of WALKWAY_LAMPS) expect(walkwayAt(l).d).toBeGreaterThan(WALKWAY.chains + 0.5); // lamps outside the chains
  });
});

describe('Church Street', () => {
  it('runs south of Olin\'s lawn and Allbritton, out to High Street, with sidewalks both sides', () => {
    expect(CHURCH.x1).toBe(ROAD.x0); // High Street's near edge
    expect(CHURCH_WALK_N.z0).toBeGreaterThanOrEqual(BERM.z1); // the bank is down by its sidewalk
    expect(CHURCH_WALK_N.z0).toBeGreaterThan(ALLBRITTON.z1);
    expect(CHURCH_WALK_N.z0).toBeGreaterThan(OLIN_LAWN.z1 + 4);
    expect(CHURCH_WALK_N.z1).toBe(CHURCH.z0);
    expect(CHURCH_WALK_S.z0).toBe(CHURCH.z1);
    for (const x of [-180, -100, -78, -40, 0]) for (const z of [CHURCH_WALK_N.z0 + 0.2, (CHURCH.z0 + CHURCH.z1) / 2, CHURCH_WALK_S.z1 - 0.2]) expect(groundY(x, z)).toBeCloseTo(churchY(x), 5); // (level across; climbing west)
    expect(southEndNear({ x: -60, z: (CHURCH.z0 + CHURCH.z1) / 2 })).toBe('Church Street');
    // you can walk across it to the far sidewalk, and cars can drive it
    const p = walk({ x: -78, z: CHURCH_WALK_N.z0 + 0.5 }, { x: -78, z: CHURCH_WALK_S.z0 + 1 });
    expect(p.z).toBeCloseTo(CHURCH_WALK_S.z0 + 1, 1);
    expect(offRoadForCars({ x: -60, z: (CHURCH.z0 + CHURCH.z1) / 2 })).toBe(false);
  });
});

describe('Allbritton\'s back, onto Church Street', () => {
  it('three parts, not a flat wall: the bay on the west, the stair tower standing well out, the east block come forward', () => {
    for (const b of [ALLB_BAY, ALLB_TOWER, ALLB_WING]) expect(b.z1).toBeGreaterThan(ALLBRITTON.z1);
    expect(ALLB_TOWER.z1).toBeGreaterThan(ALLB_WING.z1); // the tower stands out furthest…
    expect(ALLB_WING.z1).toBeGreaterThan(ALLB_BAY.z1); // …then the east block, then the bay
    expect(ALLB_BAY.x1).toBeLessThan(ALLB_TOWER.x0); // west, middle, east
    expect(ALLB_WING.x0).toBe(ALLB_TOWER.x1);
    expect(ALLB_WING.x1).toBe(ALLBRITTON.x1);
    expect(ALLB_TOWER.h).toBeGreaterThan(ALLB_WING.h); // the tower up past everything
    expect(ALLB_WING.h).toBeGreaterThan(ALLBRITTON.h);
    for (const b of [ALLB_BAY, ALLB_TOWER, ALLB_WING]) expect(blockedAt({ x: (b.x0 + b.x1) / 2, z: b.z1 - 0.3 }, stops)).toBe(true);
    expect(ALLB_REAR_DOOR.z).toBe(ALLB_TOWER.z1);
    expect(ALLB_WING_DOOR.z).toBe(ALLB_WING.z1);
    for (const d of [ALLB_REAR_DOOR, ALLB_WING_DOOR]) expect(groundY(d.x, d.z + 0.5)).toBe(ALLB_LANDING.h); // both on the landing
  });

  it('from the lot up the steps onto the landing, along it to the tower\'s door; or up the long ramp (1 in 12) from the sidewalk', () => {
    const sz = (ALLB_STEPS.z0 + ALLB_STEPS.z1) / 2;
    let p = { x: ALLB_STEPS.x0 - 1.5, z: sz }, y = 0;
    for (let i = 0; i < 60; i++) {
      p = resolveMove(p, { x: p.x + 0.1, z: p.z }, stops, all);
      const h = groundY(p.x, p.z);
      expect(h).toBeGreaterThanOrEqual(y - 0.02);
      y = h;
    }
    expect(y).toBe(ALLB_LANDING.h);
    p = walk(p, { x: ALLB_REAR_DOOR.x, z: sz });
    p = walk(p, { x: ALLB_REAR_DOOR.x, z: ALLB_REAR_DOOR.z - 1 });
    expect(p.z).toBeLessThan(ALLB_REAR_DOOR.z + 1); // right up to the door
    expect(groundY(p.x, p.z)).toBe(ALLB_LANDING.h);
    expect(ALLB_LANDING.h / (ALLB_RAMP.z1 - ALLB_RAMP.z0)).toBeCloseTo(1 / 12, 5);
    expect(ALLB_RAMP.z1).toBe(CHURCH_WALK_N.z0); // it comes down to the sidewalk
    let q = { x: (ALLB_RAMP.x0 + ALLB_RAMP.x1) / 2, z: CHURCH_WALK_N.z0 + 1 };
    for (let i = 0; i < 100; i++) q = resolveMove(q, { x: q.x, z: q.z - 0.1 }, stops, all);
    expect(groundY(q.x, q.z)).toBe(ALLB_LANDING.h); // up on the landing
    // the railing along its front: you can't step off it straight down into the lot
    const r = walk({ x: ALLB_REAR_DOOR.x, z: ALLB_LANDING.z1 - 0.8 }, { x: ALLB_REAR_DOOR.x, z: ALLB_LANDING.z1 + 3 });
    expect(r.z).toBeLessThan(ALLB_LANDING.z1);
  });

  it('the lot: stalls apart, clear of the building, the steps, ramp and drive; two accessible; cars in some', () => {
    expect(ALLB_LOT.z0).toBe(ALLBRITTON.z1);
    expect(ALLB_LOT.z1).toBe(CHURCH_WALK_N.z0);
    expect(ALLB_STALLS.filter((s) => s.accessible)).toHaveLength(2);
    const box = (s: (typeof ALLB_STALLS)[number]) => ({ x0: s.x - s.w / 2, x1: s.x + s.w / 2, z0: s.z - s.len / 2, z1: s.z + s.len / 2 });
    const overlap = (a: { x0: number; x1: number; z0: number; z1: number }, b: typeof a) => a.x0 < b.x1 - 0.01 && b.x0 < a.x1 - 0.01 && a.z0 < b.z1 - 0.01 && b.z0 < a.z1 - 0.01;
    ALLB_STALLS.forEach((s, i) => {
      const b = box(s);
      expect(b.x0).toBeGreaterThanOrEqual(ALLB_LOT.x0); expect(b.x1).toBeLessThanOrEqual(ALLB_LOT.x1);
      expect(b.z0).toBeGreaterThanOrEqual(ALLB_LOT.z0); expect(b.z1).toBeLessThan(ALLB_LOT.z1);
      for (const r of [ALLB_LANDING, ALLB_STEPS, ALLB_RAMP, ALLB_TOWER, ALLB_BAY, ALLB_WING]) expect(overlap(b, r)).toBe(false);
      ALLB_STALLS.forEach((o, j) => { if (j !== i) expect(overlap(b, box(o))).toBe(false); });
      expect(groundY(s.x, s.z)).toBe(0);
      expect(offRoadForCars(s)).toBe(false);
    });
    expect(ALLB_DRIVE.x0).toBeGreaterThan(ALLB_LOT.x0); expect(ALLB_DRIVE.x1).toBeLessThan(ALLB_LOT.x1);
    expect(ALLB_WALL.x1).toBe(ALLB_LOT.x0);
    // the parked cars are real ones (a stranger's: yours to take), in their stalls, nose to the building
    const g = createGarage();
    for (const [i, color] of ALLB_PARKED) {
      const c = g.cars.find((x) => x.color === color && Math.hypot(x.x - ALLB_STALLS[i].x, x.z - ALLB_STALLS[i].z) < 0.01)!;
      expect(c).toBeDefined();
      expect(c.owner).toBeNull();
      expect(Math.cos(c.heading)).toBeCloseTo(-1, 5);
    }
  });
});

describe('the lawn in front of College Row (frontlawn.ts)', () => {
  const walks = frontWalks(stops);
  it('is big: High Street is well out past the walk, with a sidewalk on this side', () => {
    expect(NEAR_WALK.x1).toBe(ROAD.x0);
    expect(FRONT_LAWN.x1 - FRONT_LAWN.x0).toBeGreaterThan(30);
  });
  it('its walks run from the row\'s walk to the High Street sidewalk; the walkways between the buildings carry on across it', () => {
    for (const w of walks) {
      for (const p of [w.a, w.b]) { expect(p.x).toBeGreaterThanOrEqual(FRONT_LAWN.x0 - 0.5); expect(p.x).toBeLessThanOrEqual(NEAR_WALK.x0 + 0.5); }
    }
    const north = byId(stops, 'north'), v = walks.filter((w) => w.a.z === north.doorZ && w.b.z !== north.doorZ);
    expect(v).toHaveLength(2); // the V from North College's portico, spreading
    expect(Math.sign(v[0].b.z - north.doorZ)).toBe(-Math.sign(v[1].b.z - north.doorZ));
    // you can walk any of them end to end
    for (const w of walks) {
      const p = walk({ x: w.a.x + 0.3, z: w.a.z }, w.b);
      expect(Math.hypot(p.x - w.b.x, p.z - w.b.z)).toBeLessThan(0.6);
    }
    // and straight across the lawn along a walkway between the buildings, to its crosswalk
    const c = crossings[1];
    const q = walk({ x: 0, z: c.z }, { x: NEAR_WALK.x1 - 0.5, z: c.z });
    expect(q.x).toBeCloseTo(NEAR_WALK.x1 - 0.5, 1);
  });
  it('big old trees out on the lawn, off the walks; benches beside the walks', () => {
    const trees = frontTrees(stops, crossings);
    expect(trees.length).toBeGreaterThan(10); expect(trees.length).toBeLessThan(25); // a few, not a wood (the user)
    for (const t of trees) {
      expect(frontWalkDist(t, walks, crossings)).toBeGreaterThan(2.5);
      expect(t.x).toBeGreaterThan(FRONT_LAWN.x0); expect(t.x).toBeLessThan(FRONT_LAWN.x1);
    }
    for (const b of frontBenches(stops)) { const d = frontWalkDist(b, walks, []); expect(d).toBeGreaterThan(0.3); expect(d).toBeLessThan(1.5); }
  });
});

describe('Church Street climbs west, toward Foss Hill (the user: the campus slopes up; biking it hurts)', () => {
  it('level by High Street, Allbritton and the walkway\'s foot; up to Olin\'s height in front of Olin; on up past it', () => {
    for (const x of [ROAD.x0 - 1, -40, -60, -75]) expect(churchY(x)).toBe(0);
    for (let x = OLIN_LAWN.x0; x <= OLIN.cx; x += 2) expect(Math.abs(churchY(x) - OLIN_Y)).toBeLessThan(0.1); // level with Olin from its middle west
    expect(OLIN_Y - churchY(OLIN_LAWN.x1)).toBeLessThan(1); // and only a little below its lawn's east end
    expect(churchY(-195)).toBeGreaterThan(OLIN_Y);
    for (let x = -79; x > -200; x -= 0.5) {
      expect(churchY(x)).toBeGreaterThanOrEqual(churchY(x + 0.5)); // only ever up, going west
      expect(churchY(x) - churchY(x + 0.5)).toBeLessThan(0.5 * 0.065); // a long, even climb: never steeper than 6.5% (the user)
    }
    for (const z of [CHURCH_WALK_N.z0 + 0.3, (CHURCH.z0 + CHURCH.z1) / 2, CHURCH_WALK_S.z1 - 0.3]) expect(groundY(-150, z)).toBeCloseTo(churchY(-150), 5);
  });

  it('in front of Olin, its lawn and the street are on one line (from its middle west), easing gently together further east', () => {
    for (let x = OLIN_LAWN.x0; x <= OLIN.cx; x += 3) {
      for (let z = OLIN_LAWN.z1 - 2; z <= CHURCH_WALK_N.z1; z += 0.25) expect(Math.abs(groundY(x, z) - OLIN_Y)).toBeLessThan(0.12);
    }
    for (let x = OLIN.cx; x <= OLIN_LAWN.x1; x += 3) { // further east the lawn eases down to the street, gently
      let y = groundY(x, OLIN_LAWN.z1 - 2);
      for (let z = OLIN_LAWN.z1 - 2; z <= CHURCH_WALK_N.z1; z += 0.25) { const h = groundY(x, z); expect(Math.abs(h - y)).toBeLessThan(0.1); y = h; }
    }
    // so you can walk straight off the lawn onto the sidewalk and across
    const p = walk({ x: OLIN.cx + 5, z: OLIN_LAWN.z1 - 3 }, { x: OLIN.cx + 5, z: CHURCH_WALK_S.z0 + 0.5 }); // (between the lamps)
    expect(p.z).toBeCloseTo(CHURCH_WALK_S.z0 + 0.5, 1);
  });

  it('the bank meets it smoothly wherever it\'s lower; and you can drive up it', () => {
    for (let x = -190; x < -82; x += 4) {
      let y = groundY(x, CHURCH_WALK_N.z0 - 8);
      for (let z = CHURCH_WALK_N.z0 - 8; z <= CHURCH_WALK_N.z0; z += 0.25) { const h = groundY(x, z); expect(Math.abs(h - y)).toBeLessThan(0.25); y = h; }
    }
    for (let x = -75; x > -190; x -= 5) expect(offRoadForCars({ x, z: (CHURCH.z0 + CHURCH.z1) / 2 })).toBe(false);
  });
});

describe('Clark Hall, west of Olin', () => {
  it('close to Olin, only a narrow path between them; its north end in line with Olin\'s; wider blocks at both ends; solid', () => {
    expect(OLIN.x0 - CLARK.x1).toBeLessThan(13); // (the user: much closer)
    expect(CLARK_GAP.x0).toBeGreaterThan(CLARK.x1); expect(CLARK_GAP.x1).toBe(OLIN.x0); // tar from wall to wall (no low wall, no lines: the user)
    expect(CLARK.z0).toBeLessThan(OLIN.cz - OLIN.r); // its north end runs on past Olin's drum…
    expect(CLARK.z0).toBeGreaterThan(FIELD_ROAD.z1 + 1); // …nearly to the field road (the user)
    expect(CLARK.z1).toBeLessThan(CHURCH_WALK_N.z0 - 30);
    for (const e of CLARK_ENDS) { expect(e.x0).toBeLessThan(CLARK.x0); expect(e.x1).toBeGreaterThan(CLARK.x1); }
    expect(blockedAt({ x: (CLARK.x0 + CLARK.x1) / 2, z: (CLARK.z0 + CLARK.z1) / 2 }, stops)).toBe(true);
    expect(southEndNear({ x: (CLARK_GAP.x0 + CLARK_GAP.x1) / 2, z: 40 })).toBe('Clark Hall');
  });
  it('the entrance is down in a sunken court on the west, at basement level; stairs climb out of it', () => {
    expect(CLARK_DOOR.x).toBe(CLARK.x0);
    expect(CLARK_Y - CLARK_COURT.y).toBeGreaterThan(1.5);
    expect(groundY(CLARK_DOOR.x - 1, CLARK_DOOR.z)).toBe(CLARK_COURT.y);
    // from the path, down the west stairs (only ever down), across the court to the doors
    let p = { x: CLARK_STAIRS_W.x0 - 2, z: CLARK_DOOR.z }, y = groundY(p.x, p.z);
    for (let i = 0; i < 160; i++) {
      p = resolveMove(p, { x: p.x + 0.1, z: p.z }, stops, all);
      const h = groundY(p.x, p.z);
      expect(h).toBeLessThanOrEqual(y + 0.02);
      y = h;
    }
    expect(y).toBe(CLARK_COURT.y);
    expect(p.x).toBeGreaterThan(CLARK_DOOR.x - 1.1); // right up to the doors, between the piers
    // and out the south-west stairs
    const q = walk({ x: (CLARK_STAIRS_S.x0 + CLARK_STAIRS_S.x1) / 2, z: CLARK_COURT.z1 - 1 }, { x: (CLARK_STAIRS_S.x0 + CLARK_STAIRS_S.x1) / 2, z: CLARK_STAIRS_S.z1 + 1.5 });
    expect(groundY(q.x, q.z)).toBeCloseTo(CLARK_Y, 1);
    // but you can't just step off the lawn into it: the wall stops you
    const r = walk({ x: CLARK_COURT.x0 - 3, z: CLARK_COURT.z0 + 2 }, { x: CLARK_COURT.x0 + 3, z: CLARK_COURT.z0 + 2 });
    expect(r.x).toBeLessThan(CLARK_COURT.x0);
  });
  it('from the parking, north down the stairs to a flat walk at the field\'s level, between Clark and a tall retaining wall, out to the field road', () => {
    for (let x = CLARK_GAP.x0 + 0.1; x < CLARK_GAP.x1; x += 0.5) expect(groundY(x, 45)).toBeCloseTo(CLARK_Y, 5); // flat tar, wall to wall
    for (let z = OLIN.z1 - 2; z < OLIN.z1 + 8; z += 0.25) expect(Math.abs(groundY(OLIN.x0 - 2, z + 0.25) - groundY(OLIN.x0 - 2, z))).toBeLessThan(0.15); // easing into Olin's grounds past its front
    const x = (STAIRS_C.x0 + STAIRS_C.x1) / 2;
    let p = { x, z: 40 }, y = groundY(x, 40);
    for (let i = 0; i < 450; i++) {
      p = resolveMove(p, { x, z: p.z - 0.1 }, stops, all);
      const h = groundY(p.x, p.z);
      expect(h).toBeLessThanOrEqual(y + 0.02);
      y = h;
    }
    expect(p.z).toBeLessThan(FIELD_ROAD.z1 + 0.5); // down the stairs, along the flat walk, to the field road
    for (let z = CLARK_LOW.z0 + 0.5; z < CLARK_LOW.z1; z += 1) expect(groundY(x, z)).toBe(0); // flat, the field's level, before the stairs
    expect(STAIRS_C.z0 - CLARK_LOW.z0).toBeGreaterThan(12);
    const q = walk({ x: OLIN_LOW_WALL.x1 + 1.5, z: 21.5 }, { x: OLIN_LOW_WALL.x0 - 2, z: 21.5 }); // (just past the dumpsters) // the wall stops you stepping off the upper tar
    expect(q.x).toBeGreaterThan(OLIN_LOW_WALL.x1);
    expect(y).toBe(0);
    expect(PLACES.find((q) => q.id === 'clark')).toBeDefined();
  });
  it('the lane comes up off Church Street; cars can drive it, and some are parked along it', () => {
    for (let z = CLARK_LANE.z0 + 1; z < CLARK_LANE.z1; z += 3) expect(offRoadForCars({ x: (CLARK_LANE.x0 + CLARK_LANE.x1) / 2, z })).toBe(false);
    for (let z = CLARK_GAP.z0 + 1; z < CLARK_GAP.z1; z += 3) expect(offRoadForCars({ x: (CLARK_GAP.x0 + CLARK_GAP.x1) / 2, z })).toBe(false);
    expect(CLARK_PARKED).toHaveLength(2); // only two cars, but a whole row of lined spaces
    expect(CLARK_STALLS.length).toBeGreaterThan(8);
    // the dumpsters' pad, north of the gap by Olin's drum: the same level as the tar, cars allowed; the dumpsters solid
    for (const d of DUMPSTERS) {
      expect(groundY(d.x, d.z)).toBe(CLARK_Y);
      expect(blockedAt({ x: d.x, z: d.z }, stops, all)).toBe(true);
      expect(inPoly({ x: d.x + d.w / 2, z: d.z - d.len / 2 }, OLIN_POLY)).toBe(false);
    }
    expect(DUMPSTERS.filter((d) => d.open)).toHaveLength(1);
    for (const d of DUMPSTERS) expect(Math.hypot(d.x - (STAIRS_C.x0 + STAIRS_C.x1) / 2, d.z - STAIRS_C.z1)).toBeLessThan(13); // by the top of the stairs (the user)
    for (const s of CLARK_STALLS) { // nose-in to Olin's wall, clear of Clark's end blocks, room to drive by
      expect(offRoadForCars(s)).toBe(false);
      expect(s.x + s.len / 2).toBeLessThanOrEqual(OLIN.x0); expect(OLIN.x0 - (s.x + s.len / 2)).toBeLessThan(1); // right up against Olin
      expect(s.z - s.w / 2).toBeGreaterThanOrEqual(CLARK_GAP.z0); expect(s.z + s.w / 2).toBeLessThanOrEqual(CLARK_GAP.z1);
      for (const d of DUMPSTERS) expect(Math.abs(s.z - d.z)).toBeGreaterThan(d.len / 2 + s.w / 2);
      expect(s.x - s.len / 2 - CLARK.x1).toBeGreaterThan(2.4);
    }
    const g = createGarage();
    for (const [i] of CLARK_PARKED) { const c = g.cars.find((q) => Math.hypot(q.x - CLARK_STALLS[i].x, q.z - CLARK_STALLS[i].z) < 0.01)!; expect(c).toBeDefined(); expect(Math.sin(c.heading)).toBeCloseTo(1, 5); }
    let y = groundY((CLARK_LANE.x0 + CLARK_LANE.x1) / 2, CLARK_LANE.z1);
    for (let z = CLARK_LANE.z1; z > CLARK_LANE.z0; z -= 0.5) { const h = groundY((CLARK_LANE.x0 + CLARK_LANE.x1) / 2, z); expect(Math.abs(h - y)).toBeLessThan(0.1); y = h; }
  });
});

describe('the fence along the top of the bank, and the stairs down to Andrus', () => {
  it('runs straight from the Frank Center past Olin\'s drum to the end by the dumpsters, behind them; open only at the stairs', () => {
    expect(BALUSTRADE.x0).toBe(OLIN_LOW_WALL.x1);
    for (const d of DUMPSTERS) expect(d.z - d.len / 2).toBeGreaterThan(BALUSTRADE.z); // the dumpsters are on its far side
    const runs = balustradeRuns();
    expect(runs[0][0]).toBe(BALUSTRADE.x0);
    expect(runs[runs.length - 1][1]).toBe(BALUSTRADE.x1);
    // and it's joined to the Frank Center: you can't slip round its east end
    const q = walk({ x: FRANK.x0 - 2, z: BALUSTRADE.z + 1.5 }, { x: FRANK.x0 + 2, z: BALUSTRADE.z + 1.5 });
    expect(q.x).toBeLessThan(FRANK.x0 - 0.2);
    expect(runs.length).toBe(BANK_FLIGHTS.length + 2); // (one run either side of each opening, the flights and the Pruzan's stairs)
  });
  it('stairs come down from it at intervals (and at its west end); each climbs only up, to the ground at its top', () => {
    expect(BANK_FLIGHTS.length).toBeGreaterThanOrEqual(4);
    expect(BANK_FLIGHTS[0].x0).toBeLessThan(OLIN.x0); // the one at the end, by the dumpsters
    for (const f of BANK_FLIGHTS) {
      const x = (f.x0 + f.x1) / 2;
      let p = { x, z: FIELD_ROAD.z1 - 0.5 }, y = 0;
      for (let i = 0; i < 110; i++) {
        p = resolveMove(p, { x, z: p.z + 0.1 }, stops, all);
        const h = groundY(p.x, p.z);
        expect(h).toBeGreaterThanOrEqual(y - 0.02);
        y = h;
      }
      expect(p.z).toBeGreaterThan(BALUSTRADE.z); // up through the gap in the fence
      expect(y).toBeGreaterThan(TERRACE_Y - 0.05);
      expect(offRoadForCars({ x, z: (f.z0 + f.z1) / 2 })).toBe(true);
    }
  });
});
