import { ALLBRITTON } from '../../src/row/southend';
import { describe, expect, it } from 'vitest';
import {
  FOOTBALL, ITEMS, PATH_ITEMS, SITTERS, chairs, fenceObstacles, fenceRuns, half, pathObstacles, plazaObstacles,
} from '../../src/row/plaza';
import { BACK_PATH, FIELD_X, PLAZA, PLAZA_GAP, USDAN, byId, inUsdan, layoutRow } from '../../src/row/layout';
import { resolveMove, Extra } from '../../src/row/collide';
import { truckSpot } from '../../src/row/foodtruck';

const { stops, crossings } = layoutRow();
const boger = byId(stops, 'boger');
const fz = FOOTBALL.z;
const all: Extra = { solids: [...plazaObstacles(), ...pathObstacles(), ...fenceObstacles(FIELD_X, fz)] };
const inBuilding = (p: { x: number; z: number }) => stops.some((s) => p.z <= s.z0 && p.z >= s.z1 && p.x <= s.front && p.x >= s.back);

function walk(from: { x: number; z: number }, to: { x: number; z: number }, extra = all) {
  let p = { ...from };
  for (let i = 0; i < 5000; i++) {
    const d = Math.hypot(to.x - p.x, to.z - p.z);
    if (d < 0.01) break;
    const s = Math.min(0.2, d);
    p = resolveMove(p, { x: p.x + ((to.x - p.x) / d) * s, z: p.z + ((to.z - p.z) / d) * s }, stops, extra);
  }
  return p;
}

describe('the plaza between Usdan and Boger', () => {
  it('is wide — Usdan stands well back from Boger, not right beside it', () => {
    const usdanEast = Math.max(...USDAN.filter((p) => p.z < boger.z0 + 2).map((p) => p.x));
    expect(boger.back - usdanEast).toBeGreaterThan(20);
    expect(PLAZA.x1 - PLAZA.x0).toBeGreaterThan(20);
  });

  it('everything on it is on it — not in Usdan, not in a building', () => {
    for (const it of ITEMS) {
      const [hx, hz] = half(it);
      for (const p of [{ x: it.x - hx, z: it.z - hz }, { x: it.x + hx, z: it.z + hz }]) {
        expect([PLAZA, PLAZA_GAP].some((b) => p.x >= b.x0 && p.x <= b.x1 && p.z >= b.z0 && p.z <= b.z1)).toBe(true);
        expect(inUsdan(p, 0.5)).toBe(false);
        expect(inBuilding(p)).toBe(false);
      }
    }
  });

  it('has trees, granite benches, the oval table, tables + chairs, planters', () => {
    const kinds = new Set(ITEMS.map((i) => i.kind));
    for (const k of ['tree', 'bench', 'oval', 'table', 'woodTable', 'planter', 'bollard', 'bin'] as const) expect(kinds.has(k)).toBe(true);
    expect(ITEMS.filter((i) => i.kind === 'tree').length).toBeGreaterThanOrEqual(5);
  });

  it('people at the tables sit on chairs, facing their table, not inside it', () => {
    for (const [t, c] of SITTERS) {
      const table = ITEMS[t], at = chairs(table)[c];
      expect(at).toBeDefined();
      const toTable = Math.atan2(table.x - at.x, table.z - at.z);
      expect(Math.cos(toTable - at.heading)).toBeGreaterThan(0.7); // facing the table (its near edge, not dead centre)
      const [hx, hz] = half(table);
      expect(Math.abs(at.x - table.x) > hx || Math.abs(at.z - table.z) > hz).toBe(true);
    }
  });

  it('you can walk off the back path into the plaza and up its whole length', () => {
    const end = walk({ x: -56, z: -170 }, { x: -56, z: PLAZA.z0 + 2 });
    expect(end.z).toBeCloseTo(PLAZA.z0 + 2, 1);
  });

  it('…and across it to the back of Boger', () => {
    const end = walk({ x: -56, z: -197 }, { x: -30, z: -197 });
    expect(end.x).toBeCloseTo(boger.back - 0.8, 1);
  });

  it('…and round Boger\'s south end, past the burrito truck, to the walk', () => {
    const t = truckSpot(crossings[crossings.length - 1]);
    const end = walk({ x: -56, z: -170 }, { x: 0, z: -170 }, { solids: [...all.solids!, t.box] });
    expect(end.x).toBeCloseTo(0, 1);
  });
});

describe('along the back path', () => {
  it('nothing sticks out into it: you can walk its whole length down the middle', () => {
    const x = (BACK_PATH.x0 + BACK_PATH.x1) / 2;
    const end = walk({ x, z: -170 }, { x, z: ALLBRITTON.z0 - 1 });
    expect(end.z).toBeCloseTo(ALLBRITTON.z0 - 1, 1); // all the way down to Allbritton
  });

  it('benches, bins and the hydrant sit on the building side of the path', () => {
    for (const b of pathObstacles(0)) expect(b.x0).toBeGreaterThanOrEqual(BACK_PATH.x1 + 0.3);
    expect(PATH_ITEMS.some((i) => i.kind === 'hydrant')).toBe(true);
  });

  it('a fence runs round the football field, between it and the path, with a gate you can walk through', () => {
    const runs = fenceRuns(FIELD_X, fz);
    const east = Math.max(...runs.flatMap(([x0, , x1]) => [x0, x1]));
    expect(east).toBeLessThan(BACK_PATH.x0 - 3);
    const cx = FIELD_X - FOOTBALL.gap - FOOTBALL.W / 2;
    expect(east).toBeGreaterThan(cx + FOOTBALL.W / 2); // outside the pitch
    // through the gate on the path side, onto the field
    const end = walk({ x: -55, z: fz }, { x: cx, z: fz });
    expect(end.x).toBeCloseTo(cx, 1);
    // but not through the fence just along from it
    const blocked = walk({ x: -55, z: fz - 20 }, { x: cx, z: fz - 20 });
    expect(blocked.x).toBeGreaterThan(east - 1);

  });
});
