import { describe, expect, it } from 'vitest';
import {
  FAR_WALK, PATH_HALF, ROAD, ROW, ROW_END_Z, WALK_MAX_Z, WALK_MIN_Z, byId, layoutRow,
} from '../../src/row/layout';

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
