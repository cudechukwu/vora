import { ALLBRITTON, FIELD_ROAD } from '../../src/row/southend';
import { describe, expect, it } from 'vitest';
import {
  BACK_PATH, FAR_WALK, FIELD_X, PATH_HALF, ROAD, ROW, ROW_END_Z, ROW_ENTRY, USDAN, USDAN_COURT, WALK_MAX_Z, WALK_MIN_Z,
  byId, inPoly, layoutRow,
} from '../../src/row/layout';
import { resolveMove } from '../../src/row/collide';
import { HOME_SPAWN, PORCH_STEPS, toLocal } from '../../src/row/house/plan';
import { houseExtra } from '../../src/row/house/collide';

const { stops, crossings } = layoutRow();

describe('College Row layout', () => {
  it('has every building once', () => {
    expect(stops.map((s) => s.id).sort()).toEqual(
      ['boger', 'chapel', 'judd', 'north', 'south', 'zelnick'],
    );
  });

  it('meets the buildings in the agreed order when walking +z from Boger', () => {
    const walking = [...stops].sort((a, b) => a.zc - b.zc).map((s) => s.name);
    expect(walking).toEqual([
      'Boger Hall', 'North College', 'South College', // (per the user's Google Maps view: North College is the long one by Boger)
      'Zelnick Pavilion', 'Memorial Chapel', 'Judd Hall', // Judd is the last on the row; Allbritton's at the end of the back path
    ]);
  });

  it('never overlaps two buildings', () => {
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].z0).toBeLessThanOrEqual(stops[i - 1].z1);
      expect(stops[i].z0).toBeGreaterThan(stops[i].z1);
    }
  });

  it('joins the chapel, Zelnick and South College with no gap (Zelnick is the link)', () => {
    expect(byId(stops, 'chapel').z1).toBe(byId(stops, 'zelnick').z0);
    expect(byId(stops, 'zelnick').z1).toBe(byId(stops, 'south').z0);
  });

  it('puts the two walkways in gaps: just south of Judd (open lawn, no building past it), and North College–Boger', () => {
    expect(crossings).toHaveLength(2);
    const between = (a: string, b: string) => (c: { z: number; w: number }) =>
      c.z + c.w / 2 < byId(stops, a as never).z1 && c.z - c.w / 2 > byId(stops, b as never).z0;
    const judd = byId(stops, 'judd');
    expect(crossings[0].z - crossings[0].w / 2).toBeGreaterThan(judd.z0);
    expect(Math.max(...stops.map((s) => s.z0))).toBe(judd.z0);
    expect(crossings.some(between('north', 'boger'))).toBe(true);
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

  it('keeps every facade flush along the walk (but Zelnick, set back behind its forecourt between the chapel and South College)', () => {
    for (const s of stops) if (s.id !== 'zelnick') expect(s.front).toBe(stops[0].front);
    const z = byId(stops, 'zelnick');
    expect(stops[0].front - z.front).toBeGreaterThan(2);
    expect(stops[0].front - z.front).toBeLessThan(5);
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

describe('behind the row', () => {
  const boger = byId(stops, 'boger'), south = byId(stops, 'south');
  const byUsdan = crossings[crossings.length - 1];

  it('Boger is the first building on the row; the walk starts just short of it', () => {
    expect(stops[stops.length - 1].id).toBe('boger');
    expect(ROW_ENTRY.z).toBeLessThan(boger.z1);
    expect(boger.z1 - ROW_ENTRY.z).toBeLessThan(15);
  });

  it('you start the game outside your house: on the far sidewalk, at the end of your front path', () => {
    expect(HOME_SPAWN.x).toBeGreaterThan(FAR_WALK.x0);
    expect(HOME_SPAWN.x).toBeLessThan(FAR_WALK.x1);
    const { u, v } = toLocal(HOME_SPAWN.x, HOME_SPAWN.z);
    expect(v).toBeGreaterThan(PORCH_STEPS.v0);
    expect(v).toBeLessThan(PORCH_STEPS.v1); // in line with the steps up to your porch
    expect(u).toBeLessThan(-4); // out on the sidewalk, not in the yard
    expect(resolveMove(HOME_SPAWN, HOME_SPAWN, stops, houseExtra(0, false))).toEqual({ x: HOME_SPAWN.x, z: HOME_SPAWN.z });
  });

  it('Usdan is behind Boger — not on the row — between it and the field, its south side on the Boger–South walkway', () => {
    for (const p of USDAN) expect(p.x).toBeLessThan(boger.back - 2); // a path's width behind Boger
    const south = Math.max(...USDAN.map((p) => p.z));
    expect(south).toBeLessThan(byUsdan.z - byUsdan.w / 2); // north of the walkway…
    expect(byUsdan.z - byUsdan.w / 2 - south).toBeLessThan(5); // …right beside it
    expect(Math.min(...USDAN.map((p) => p.x))).toBeLessThan(FIELD_X); // out past the back path
    expect(inPoly(USDAN_COURT[0], USDAN)).toBe(true); // the courtyard's inside it
  });

  it('a coal-tar path runs behind the buildings, in front of the field', () => {
    for (const s of stops) expect(s.back).toBeGreaterThan(BACK_PATH.x1 + 0.8);
    expect(BACK_PATH.x0).toBeGreaterThan(FIELD_X);
    expect(BACK_PATH.x1 - BACK_PATH.x0).toBeGreaterThan(5);
  });

  it('you can walk the back path from the Boger–South walkway, past Judd and the field road, to Allbritton at its end', () => {
    const x = (BACK_PATH.x0 + BACK_PATH.x1) / 2;
    let p = { x, z: byUsdan.z };
    for (let i = 0; i < 2000; i++) p = resolveMove(p, { x, z: p.z + 0.3 }, stops);
    expect(p.z).toBeGreaterThan(FIELD_ROAD.z1 + 20); // well past the road…
    expect(p.z).toBeLessThan(ALLBRITTON.z0); // …to Allbritton's front wall
    expect(p.z).toBeGreaterThan(ALLBRITTON.z0 - 1.5);
    expect(south.back).toBeGreaterThan(x);
  });

  it('…and from the walkway by Usdan out onto Andrus Field', () => {
    let p = { x: -20, z: byUsdan.z };
    for (let i = 0; i < 300; i++) p = resolveMove(p, { x: p.x - 0.2, z: byUsdan.z }, stops);
    expect(p.x).toBeLessThan(FIELD_X - 5);
  });
});
