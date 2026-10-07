import { describe, expect, it } from 'vitest';
import {
  ALLBRITTON, BERM, FIELD_ROAD, FRANK_ADD, FRANK_LINK, LINK_DOOR, OLIN_LINK, PLAZA_F, STAIRS_E, FRANK, FRANK_DOOR, LANDING, OLIN, OLIN_POLY, STAIRS, TERRACE_Y, groundY, inSouthEnd, offRoadForCars,
  southEndNear, southObstacles, MAIN_ENTRY, PRUZAN, PRUZAN_PIERS, PRUZAN_GLASS, PRUZAN_ENTRY, PRUZAN_DOOR, PRUZAN_COURT, POOL, POOL_BED,
  POOL_SITTERS, GALLERY, GALLERY_SOFAS, PRUZAN_BIRCH, pruzanSoffit, pruzanPaveEdge, PRUZAN_FRANK_BED, FRANK_NICHE_W,
  OLIN_LINK_POLY, NCOURT, NCOURT_TABLES, NCOURT_BED, NWALK, PRUZAN_LINK_N, PRUZAN_DOOR_N, STAIRS_W, BALUSTRADE, FLAGPOLE, FRANK_NICHE_N, ALLB_WELLS, ALLBRITTON_DOOR, LINK_DOOR_S, LINK_WALK, OLIN_WALK, OLIN_DOOR, PLAZA_TABLES,
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
    expect(OLIN_DOOR.x).toBe(OLIN.x1);
    expect(OLIN_DOOR.z).toBeGreaterThan(OLIN_WALK.z0);
    expect(OLIN_DOOR.z).toBeLessThan(OLIN_WALK.z1);
    expect(OLIN_DOOR.z + OLIN_DOOR.half).toBeLessThan(OLIN.z1); // on Olin's east face
    expect(OLIN_WALK.z0).toBeGreaterThan(FRANK.z1); // passing the Frank Center's south end
  });

  it('Olin, a good way west, faces the field; the Pruzan\'s gallery block stands against it, short of the Frank Center', () => {
    const north = Math.min(...OLIN_POLY.map((p) => p.z));
    expect(north).toBeGreaterThan(BERM.z0 + 6); // up on top of the bank
    expect(FRANK.x0 - OLIN.x1).toBeGreaterThan(16);
    expect(inPoly({ x: OLIN.cx, z: OLIN.cz }, OLIN_POLY)).toBe(true);
    expect(OLIN_LINK.x0).toBe(OLIN.x1);
    expect(FRANK.x0 - OLIN_LINK.x1).toBeGreaterThan(6); // a courtyard between it and the Frank Center
    expect(Math.min(...OLIN_LINK_POLY.map((p) => p.z))).toBeGreaterThan(BALUSTRADE.z + 4); // a lawn in front of it
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

  it('…and up the east stairs from the plaza, along the walk on top, under the portico to Olin\'s front door', () => {
    const z = OLIN_DOOR.z;
    let p = { x: PLAZA_F.x0 + 3, z };
    let y = -1;
    for (let i = 0; i < 700; i++) {
      p = resolveMove(p, { x: p.x - 0.1, z: p.z }, stops, all);
      const h = groundY(p.x, p.z);
      expect(h).toBeGreaterThanOrEqual(y - 0.02); // (a centimetre's give where the bottom step meets the bank)
      y = h;
    }
    expect(y).toBeCloseTo(TERRACE_Y, 5);
    expect(p.x).toBeLessThan(OLIN_DOOR.x + 1); // right up to the door (your radius from it)
    expect(p.x).toBeGreaterThan(OLIN_DOOR.x);
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
    expect(southEndNear({ x: -186, z: 0 })).toBeNull();
    for (const id of ['frank', 'olin']) {
      const s = PLACES.find((p) => p.id === id)!.spawn;
      expect(groundY(s.x, s.z)).toBe(0);
      expect(s.z).toBeGreaterThan(FIELD_ROAD.z0);
      expect(s.z).toBeLessThan(FIELD_ROAD.z1);
    }
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
    expect(OLIN_DOOR.z + OLIN_DOOR.half).toBeLessThan(OLIN.z1);
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
