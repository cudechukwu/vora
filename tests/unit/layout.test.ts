import { describe, expect, it } from 'vitest';
import {
  BACK_FAR_WALK, BACK_ROAD, BACK_WALK, FAR_WALK, FIELD_X, PATH_HALF, ROAD, ROW, ROW_END_Z, WALK_MAX_Z, WALK_MIN_Z,
  byId, layoutRow,
} from '../../src/row/layout';
import { resolveMove } from '../../src/row/collide';
import { backRoadParking } from '../../src/row/cars';

const { stops, crossings } = layoutRow();

describe('College Row layout', () => {
  it('has every building once', () => {
    expect(stops.map((s) => s.id).sort()).toEqual(
      ['allbritton', 'boger', 'chapel', 'judd', 'north', 'south', 'usdan', 'zelnick'],
    );
  });

  it('meets the buildings in the agreed order when walking +z from Usdan', () => {
    const walking = [...stops].sort((a, b) => a.zc - b.zc).map((s) => s.name);
    expect(walking).toEqual([
      'Usdan University Center', 'Boger Hall', 'South College', 'North College',
      'Zelnick Pavilion', 'Memorial Chapel', 'Judd Hall', 'Allbritton Center',
    ]);
  });

  it('never overlaps two buildings', () => {
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].z0).toBeLessThanOrEqual(stops[i - 1].z1);
      expect(stops[i].z0).toBeGreaterThan(stops[i].z1);
    }
  });

  it('joins the chapel, Zelnick and North College with no gap (Zelnick is the link)', () => {
    expect(byId(stops, 'chapel').z1).toBe(byId(stops, 'zelnick').z0);
    expect(byId(stops, 'zelnick').z1).toBe(byId(stops, 'north').z0);
  });

  it('puts the two walkways in gaps: Allbritton–Judd and South–Boger', () => {
    expect(crossings).toHaveLength(2);
    const between = (a: string, b: string) => (c: { z: number; w: number }) =>
      c.z + c.w / 2 < byId(stops, a as never).z1 && c.z - c.w / 2 > byId(stops, b as never).z0;
    expect(crossings.some(between('allbritton', 'judd'))).toBe(true);
    expect(crossings.some(between('south', 'boger'))).toBe(true);
    for (const c of crossings) {
      for (const s of stops) {
        const overlaps = c.z + c.w / 2 > s.z1 && c.z - c.w / 2 < s.z0;
        expect(overlaps, `${s.name} blocks a walkway`).toBe(false);
      }
    }
  });

  it('keeps every door on its own building', () => {
    for (const s of stops) {
      expect(s.doorZ).toBeLessThan(s.z0);
      expect(s.doorZ).toBeGreaterThan(s.z1);
    }
  });

  it('makes Usdan bulge out toward the walk, everything else flush', () => {
    for (const s of stops) expect(s.front).toBe(s.id === 'usdan' ? stops[0].front + 6 : stops[0].front);
  });

  it('walk runs past both ends of the row', () => {
    expect(WALK_MIN_Z).toBeGreaterThan(stops[0].z0);
    expect(WALK_MAX_Z).toBeLessThan(stops[stops.length - 1].z1);
    expect(ROW_END_Z).toBe(stops[stops.length - 1].z1 - ROW[ROW.length - 1].gap);
  });

  it('keeps walk, road and far sidewalk side by side without overlapping', () => {
    expect(PATH_HALF).toBeLessThan(ROAD.x0);
    expect(ROAD.x1).toBeLessThanOrEqual(FAR_WALK.x0);
    for (const s of stops) expect(s.front).toBeLessThan(-PATH_HALF);
  });
});

describe('behind the row: sidewalk, road, sidewalk, then Andrus Field', () => {
  it('runs in that order, edge to edge, going back from the buildings', () => {
    expect(BACK_WALK.x0).toBe(BACK_ROAD.x1);
    expect(BACK_ROAD.x0).toBe(BACK_FAR_WALK.x1);
    expect(BACK_FAR_WALK.x0).toBeGreaterThan(FIELD_X);
    expect(BACK_ROAD.x1 - BACK_ROAD.x0).toBeGreaterThanOrEqual(6.5); // two lanes
  });

  it('every building ends before the back sidewalk (with room to walk behind it)', () => {
    for (const s of stops) expect(s.back).toBeGreaterThan(BACK_WALK.x1 + 0.8);
  });

  it('you can walk the whole length of the back sidewalk, and come out of a walkway onto it', () => {
    const x = (BACK_WALK.x0 + BACK_WALK.x1) / 2;
    let p = { x, z: stops[0].z0 + 5 };
    for (let i = 0; i < 2000 && p.z > stops[stops.length - 1].z1 - 5; i++) p = resolveMove(p, { x, z: p.z - 0.3 }, stops);
    expect(p.z).toBeLessThan(stops[stops.length - 1].z1 - 4);
    const c = crossings[0];
    p = { x: -20, z: c.z };
    for (let i = 0; i < 300; i++) p = resolveMove(p, { x: p.x - 0.2, z: c.z }, stops);
    expect(p.x).toBeLessThan(BACK_FAR_WALK.x0); // straight across the road and onto the field
  });

  it('the cars parked on the back road sit in it, by the row-side curb, clear of the walkways', () => {
    for (const c of backRoadParking()) {
      expect(c.x).toBeGreaterThan(BACK_ROAD.x0 + 1);
      expect(c.x).toBeLessThan(BACK_ROAD.x1 - 0.9);
      for (const k of crossings) expect(Math.abs(c.z - k.z)).toBeGreaterThan(k.w / 2 + 3);
    }
  });
});
