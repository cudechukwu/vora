import { describe, expect, it } from 'vitest';
import {
  APRON, BACK_TREES, QUAD_X, REAR_DOORS, along, aprons, onQuadX, onRearPaving, quadX, quadXAt, rearDoorZ, rearWalkAt, rearWalks,
} from '../../src/row/backlawn';
import { BACK_PATH, byId, layoutRow } from '../../src/row/layout';
import { PATH_ITEMS, pathObstacles } from '../../src/row/plaza';
import { resolveMove } from '../../src/row/collide';
import { surfaceAt } from '../../src/row/surface';
import { World } from '../../src/row/world';

const { stops, crossings } = layoutRow();
const ids = Object.keys(REAR_DOORS) as (keyof typeof REAR_DOORS)[];
const inBuilding = (p: { x: number; z: number }) => stops.some((s) => p.z <= s.z0 && p.z >= s.z1 && p.x <= s.front && p.x >= s.back);
const { z0: pathZ0, z1: pathZ1 } = World.backPathZ(crossings);

describe('the lawn behind the row', () => {
  it('North College, South College and Judd each have a rear door with a paver walk out to the back path', () => {
    expect(ids.sort()).toEqual(['judd', 'north', 'south']);
    const walks = rearWalks(stops);
    expect(walks).toHaveLength(3);
    for (const id of ids) {
      const s = byId(stops, id), z = rearDoorZ(s);
      const w = walks.find((b) => z > b.z0 && z < b.z1)!;
      expect(w, id).toBeDefined();
      expect(w.x0).toBe(BACK_PATH.x1); // starts at the path's edge…
      expect(w.x1).toBeCloseTo(s.back - APRON); // …and meets the apron along the back wall
      expect(z).toBeGreaterThan(s.z1 + 2); // the door is on the building's back, not off its end
      expect(z).toBeLessThan(s.z0 - 2);
      expect(w.z0).toBeGreaterThan(pathZ0); // and the back path runs past it
      expect(w.z1).toBeLessThan(pathZ1);
    }
  });

  it('the aprons run the length of each back wall, from the wall out', () => {
    for (const a of aprons(stops)) {
      const s = stops.find((t) => Math.abs(t.z0 - a.z1) < 1e-9 && Math.abs(t.z1 - a.z0) < 1e-9)!;
      expect(s).toBeDefined();
      expect(a.x1).toBeGreaterThanOrEqual(s.back);
      expect(a.x1 - a.x0).toBeGreaterThan(APRON);
    }
  });

  it('the walks miss the benches, bins and hydrant on the path, and no lamp stands on them', () => {
    for (const w of rearWalks(stops)) {
      for (const it of PATH_ITEMS) expect(it.z > w.z0 - 1 && it.z < w.z1 + 1, `${it.kind} at ${it.z}`).toBe(false);
    }
    for (const l of World.lampSpots()) expect(onRearPaving(l, stops, 0.4), `lamp at ${l.x},${l.z}`).toBe(false);
  });

  it('the curb and hosta bed open where each walk comes in, and nowhere else along the lawn', () => {
    for (const w of rearWalks(stops)) expect(rearWalkAt((w.z0 + w.z1) / 2, stops)).toBe(true);
    expect(rearWalkAt(-110, stops)).toBe(false);
  });

  it('you can walk from the back path up the walk to each rear door', () => {
    const solids = [...pathObstacles(), ...BACK_TREES.map((t) => ({ x0: t.x - 0.6, x1: t.x + 0.6, z0: t.z - 0.6, z1: t.z + 0.6 }))];
    for (const id of ids) {
      const s = byId(stops, id), z = rearDoorZ(s);
      let p = { x: (BACK_PATH.x0 + BACK_PATH.x1) / 2, z };
      for (let i = 0; i < 400; i++) p = resolveMove(p, { x: p.x + 0.2, z }, stops, { solids });
      expect(p.x, id).toBeGreaterThan(s.back - 1.2); // right up to the wall
      expect(Math.abs(p.z - z)).toBeLessThan(0.01);
    }
  });

  it('the pavers count as paving under your wheels; the lawn beside them is grass', () => {
    for (const w of rearWalks(stops)) {
      expect(surfaceAt({ x: (w.x0 + w.x1) / 2, z: (w.z0 + w.z1) / 2 }, crossings)).toBe('paving');
      expect(surfaceAt({ x: (w.x0 + w.x1) / 2, z: w.z1 + 3 }, crossings)).toBe('grass');
    }
    const s = byId(stops, 'north');
    expect(surfaceAt({ x: s.back - 1, z: s.zc + 20 }, crossings)).toBe('paving'); // the apron
  });

  it('a few small trees (at least two), on the lawn, clear of the walks, the path and the buildings', () => {
    expect(BACK_TREES.length).toBeGreaterThanOrEqual(2);
    expect(BACK_TREES.length).toBeLessThanOrEqual(5); // "very few": the lawn stays open
    for (const t of BACK_TREES) {
      expect(t.s, 'small').toBeLessThan(1);
      expect(onRearPaving(t, stops, 1.2), `${t.x},${t.z}`).toBe(false);
      expect(t.x).toBeGreaterThan(BACK_PATH.x1 + 2);
      expect(inBuilding({ x: t.x - 2, z: t.z }) || inBuilding({ x: t.x + 2.5, z: t.z })).toBe(false);
      for (const l of World.lampSpots()) expect(Math.hypot(l.x - t.x, l.z - t.z)).toBeGreaterThan(2);
    }
  });
});

describe('the X of walks between Judd and the chapel', () => {
  const judd = byId(stops, 'judd'), chapel = byId(stops, 'chapel');
  const segs = quadX(stops);
  const pt = (sg: (typeof segs)[0], t: number) => ({ x: sg.a.x + (sg.b.x - sg.a.x) * t, z: sg.a.z + (sg.b.z - sg.a.z) * t });

  it('two walks, corner to corner, from the College Row walk to the back path, crossing in the middle of the lawn', () => {
    expect(segs).toHaveLength(2);
    for (const sg of segs) {
      expect(sg.a.x).toBeCloseTo(-2.6); // the row's walk
      expect(sg.b.x).toBe(BACK_PATH.x1); // the back path
      for (const p of [sg.a, sg.b]) expect(p.z < judd.z1 && p.z > chapel.z0).toBe(true);
      expect(Math.abs(sg.b.z - sg.a.z)).toBeGreaterThan(25); // properly diagonal
    }
    const mid = pt(segs[0], 0.5);
    expect(along(segs[1], mid).d).toBeLessThan(0.01); // they cross at their middles
  });

  it('never runs into Judd, the chapel, or anything solid along the way', () => {
    const solids = [...pathObstacles(), ...World.lampSpots().map((l) => ({ x0: l.x - 0.45, x1: l.x + 0.45, z0: l.z - 0.45, z1: l.z + 0.45 }))];
    for (const sg of segs) {
      for (let t = 0; t <= 1; t += 0.01) {
        const p = pt(sg, t);
        expect(inBuilding(p), `${p.x},${p.z}`).toBe(false);
        for (const side of [-1, 1]) { // both edges of the walk
          const e = { x: p.x + side * QUAD_X.w / 2 * 0.6, z: p.z + side * QUAD_X.w / 2 * 0.8 };
          expect(inBuilding(e)).toBe(false);
          expect(solids.some((b) => e.x > b.x0 && e.x < b.x1 && e.z > b.z0 && e.z < b.z1), `${e.x},${e.z}`).toBe(false);
        }
      }
      // and you can walk the whole way
      let p = { ...sg.a };
      for (let i = 0; i < 600; i++) {
        const d = Math.hypot(sg.b.x - p.x, sg.b.z - p.z);
        if (d < 0.05) break;
        const st = Math.min(0.2, d);
        p = resolveMove(p, { x: p.x + ((sg.b.x - p.x) / d) * st, z: p.z + ((sg.b.z - p.z) / d) * st }, stops, { solids });
      }
      expect(Math.hypot(sg.b.x - p.x, sg.b.z - p.z)).toBeLessThan(0.1);
    }
  });

  it('is paving underfoot; the lawn in the corners of the X stays grass', () => {
    for (const sg of segs) for (const t of [0.1, 0.5, 0.9]) expect(surfaceAt(pt(sg, t), crossings)).toBe('paving');
    const mid = pt(segs[0], 0.5);
    expect(surfaceAt({ x: mid.x, z: mid.z + 8 }, crossings)).toBe('grass');
    expect(surfaceAt({ x: mid.x - 10, z: mid.z }, crossings)).toBe('grass');
  });

  it('the curb and hosta bed open where it meets the back path; no trees stand on it', () => {
    for (const sg of segs) expect(quadXAt(sg.b.z, stops)).toBe(true);
    expect(quadXAt(-60, stops)).toBe(false);
    for (const t of BACK_TREES) expect(onQuadX(t, stops, 1.5)).toBe(false);
  });
});
