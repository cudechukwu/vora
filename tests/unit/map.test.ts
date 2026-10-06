import { describe, expect, it } from 'vitest';
import { PLACES, fitAll, placeAt, toMap, toWorldXZ } from '../../src/row/map';
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
});
