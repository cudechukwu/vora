import { describe, expect, it } from 'vitest';
import { PLACES, cardinalUp, fitAll, headingUp, placeAt, placeLabels, toMap, toWorldXZ, upIs } from '../../src/row/map';
import { campusShapes, streetHouses } from '../../src/row/mapshapes';
import { inPoly } from '../../src/row/layout';
import { OLIN, CLARK, FRANK } from '../../src/row/southend';
import { layoutRow, inUsdan } from '../../src/row/layout';
import { resolveMove } from '../../src/row/collide';
import { houseExtra } from '../../src/row/house/collide';
import { insideHouse, toLocal } from '../../src/row/house/plan';
import { FOOTBALL, plazaObstacles, pathObstacles, fenceObstacles } from '../../src/row/plaza';
import { FIELD_X } from '../../src/row/layout';

const { stops } = layoutRow();
const solids = [...plazaObstacles(), ...pathObstacles(), ...fenceObstacles(FIELD_X, FOOTBALL.z)];

describe('the campus map', () => {
  it('has your house, Usdan, the row and the field, each once', () => {
    const ids = PLACES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['home', 'usdan', 'boger', 'chapel', 'field', 'plaza']) expect(ids).toContain(id);
  });

  it('every place you can jump to is somewhere you can actually stand, outside', () => {
    const extra = { ...houseExtra(0, false), solids: [...(houseExtra(0, false).solids ?? []), ...solids] };
    for (const p of PLACES) {
      const s = p.spawn;
      expect([p.id, resolveMove(s, s, stops, extra)]).toEqual([p.id, { x: s.x, z: s.z }]);
      expect([p.id, inUsdan(s, 0.8)]).toEqual([p.id, false]);
      expect([p.id, insideHouse(toLocal(s.x, s.z).u, toLocal(s.x, s.z).v)]).toEqual([p.id, false]);
    }
  });

  it('north is up: Usdan (north) is above Allbritton (south) on the map; High Street (east) is right of the row', () => {
    const v = fitAll(360, 640);
    const usdan = toMap(v, PLACES.find((p) => p.id === 'usdan')!.pin), allb = toMap(v, PLACES.find((p) => p.id === 'allbritton')!.pin);
    expect(usdan.y).toBeLessThan(allb.y);
    expect(toMap(v, PLACES.find((p) => p.id === 'home')!.pin).x).toBeGreaterThan(toMap(v, PLACES.find((p) => p.id === 'boger')!.pin).x);
  });

  it('the whole campus fits on screen', () => {
    const v = fitAll(360, 640);
    for (const p of PLACES) {
      const m = toMap(v, p.pin);
      expect(m.x).toBeGreaterThanOrEqual(0); expect(m.x).toBeLessThanOrEqual(360);
      expect(m.y).toBeGreaterThanOrEqual(0); expect(m.y).toBeLessThanOrEqual(640);
    }
  });

  it('map ↔ world round-trips, and tapping a pin finds its place', () => {
    const v = fitAll(360, 640);
    const w = toWorldXZ(v, toMap(v, { x: -40, z: -120 }));
    expect(w.x).toBeCloseTo(-40, 6); expect(w.z).toBeCloseTo(-120, 6);
    for (const p of PLACES) expect(placeAt(v, toMap(v, p.pin))?.id).toBe(p.id);
    expect(placeAt(v, { x: -100, y: -100 })).toBeNull();
  });

  it('turns: heading-up puts the way you face at the top, and round-trips at any angle', () => {
    for (const h of [0, 0.7, Math.PI / 2, 2.4, Math.PI, -1.1]) {
      const v = { cx: 0, cz: 0, scale: 2, w: 200, h: 200, rot: headingUp(h) };
      const ahead = toMap(v, { x: Math.sin(h) * 10, z: Math.cos(h) * 10 });
      expect(ahead.x).toBeCloseTo(100, 6); expect(ahead.y).toBeLessThan(100); // straight up from the middle
      const w = toWorldXZ(v, toMap(v, { x: 13, z: -7 }));
      expect(w.x).toBeCloseTo(13, 6); expect(w.z).toBeCloseTo(-7, 6);
    }
  });

  it('the full map snaps to N/E/S/W: facing north (−z) is north up, facing west is west up, and so on', () => {
    const face = { N: Math.PI, S: 0, E: Math.PI / 2, W: -Math.PI / 2 } as const;
    for (const [dir, h] of Object.entries(face)) {
      expect(upIs(cardinalUp(h))).toBe(dir);
      expect(upIs(cardinalUp(h + 0.6))).toBe(dir); // (near enough snaps)
    }
  });

  it('turned any of the four ways, the whole campus still fits on screen', () => {
    for (const rot of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const v = fitAll(360, 640, 20, rot);
      for (const p of PLACES) {
        const m = toMap(v, p.pin);
        expect(m.x).toBeGreaterThanOrEqual(0); expect(m.x).toBeLessThanOrEqual(360);
        expect(m.y).toBeGreaterThanOrEqual(0); expect(m.y).toBeLessThanOrEqual(640);
      }
    }
  });

  it('names never land on each other (one that would is left off), and the chosen one always shows', () => {
    for (const rot of [0, Math.PI / 2, Math.PI]) {
      const v = fitAll(360, 640, 20, rot), wd = (n: string) => n.length * 6.6;
      const ls = placeLabels(v, wd, 13, 8, 'pruzan');
      expect(ls.find((l) => l.id === 'pruzan')!.shown).toBe(true);
      const boxes = ls.filter((l) => l.shown).map((l) => {
        const w = wd(PLACES.find((p) => p.id === l.id)!.name), x0 = l.align === 'center' ? l.x - w / 2 : l.align === 'left' ? l.x : l.x - w;
        return { x0, x1: x0 + w, y0: l.y - 6.5, y1: l.y + 6.5 };
      });
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        expect(a.x0 < b.x1 - 0.01 && a.x1 > b.x0 + 0.01 && a.y0 < b.y1 - 0.01 && a.y1 > b.y0 + 0.01).toBe(false);
      }
      expect(ls.filter((l) => l.shown).length).toBeGreaterThan(PLACES.length * 0.6);
    }
  });

  it('draws buildings in their real outlines: Olin with its drum, Usdan its triangle, the row as built', () => {
    const { shapes } = campusShapes(stops);
    const built = shapes.filter((s) => s.building);
    const covered = (p: { x: number; z: number }) => built.some((s) => inPoly(p, s.pts));
    for (const s of stops) expect([s.id, covered({ x: (s.front + s.back) / 2, z: s.zc })]).toEqual([s.id, true]);
    expect(covered({ x: OLIN.cx, z: OLIN.cz - OLIN.r + 1 })).toBe(true); // the drum's far side
    expect(covered({ x: OLIN.x0 + 1, z: OLIN.cz - OLIN.r + 1 })).toBe(false); // (rounded, not a box)
    expect(covered({ x: (CLARK.x0 + CLARK.x1) / 2, z: (CLARK.z0 + CLARK.z1) / 2 })).toBe(true);
    expect(covered({ x: (FRANK.x0 + FRANK.x1) / 2, z: (FRANK.z0 + FRANK.z1) / 2 })).toBe(true);
    expect(covered({ x: PLACES.find((p) => p.id === 'usdan')!.pin.x, z: PLACES.find((p) => p.id === 'usdan')!.pin.z })).toBe(true);
    const north = stops.find((s) => s.id === 'north')!;
    expect(covered({ x: north.front + 1.5, z: north.doorZ })).toBe(true); // its portico, out front
    expect(covered({ x: north.front + 1.5, z: north.z1 + 3 })).toBe(false);
    expect(streetHouses().length).toBeGreaterThan(5);
    for (const s of shapes) expect(s.pts.length).toBeGreaterThanOrEqual(3);
  });
});
