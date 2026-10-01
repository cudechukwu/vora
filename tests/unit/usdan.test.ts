import { describe, expect, it } from 'vitest';
import {
  AT_DESK, DOORS, ITEMS, ROOMS, SITTERS, SOFA_SITTERS, STAFF, WALK_LANES, WALLS, arriveAt, chairsAt, doorFrame, half,
  insideUsdan, nearUsdanDoor, roomAt, usdanExtra, usdanPortalAt, usdanSolids, wallBoxes,
} from '../../src/row/usdan/plan';
import { USDAN, distToPoly, inPoly, inUsdan, layoutRow } from '../../src/row/layout';
import { inBox, resolveMove } from '../../src/row/collide';
import { plazaObstacles } from '../../src/row/plaza';

const { stops } = layoutRow();
const solids = usdanSolids();
const free = (p: { x: number; z: number }) => insideUsdan(p) && !solids.some((b) => inBox(p, b));

/** Every spot you can walk to from `from` inside (0.4m grid flood fill). */
function reachable(from: { x: number; z: number }) {
  const S = 0.4, key = (i: number, j: number) => `${i},${j}`;
  const x0 = -116, z0 = -240;
  const seen = new Set<string>();
  const q: [number, number][] = [[Math.round((from.x - x0) / S), Math.round((from.z - z0) / S)]];
  while (q.length) {
    const [i, j] = q.pop()!;
    const k = key(i, j);
    if (seen.has(k)) continue;
    const p = { x: x0 + i * S, z: z0 + j * S };
    if (!free(p)) continue;
    seen.add(k);
    q.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
  }
  return (p: { x: number; z: number }) => seen.has(key(Math.round((p.x - x0) / S), Math.round((p.z - z0) / S)));
}

describe('Usdan\'s doors', () => {
  it('sit on its outline: one onto the walkway (south), one onto the plaza (east)', () => {
    for (const d of DOORS) expect(distToPoly(d, USDAN)).toBeLessThan(0.05);
    expect(DOORS.find((d) => d.id === 'south')!.nz).toBeGreaterThan(0.9); // faces south (+z)
    expect(DOORS.find((d) => d.id === 'east')!.nx).toBeGreaterThan(0.9); // faces east (+x)
  });

  it('walking up to one from outside takes you in; you arrive inside, clear of everything, facing in', () => {
    for (const d of DOORS) {
      const outside = { x: d.x + d.nx * 1.0, z: d.z + d.nz * 1.0 };
      expect(inUsdan(outside, 0.8)).toBe(false); // you can stand there (Usdan's walls stop you 0.8m out)
      expect(usdanPortalAt('out', outside)?.kind).toBe('enter');
      const a = arriveAt(d, 'enter');
      expect(free(a)).toBe(true);
      expect(usdanPortalAt('usdan', a)).toBeNull(); // not straight back out
      expect(Math.cos(a.heading - Math.atan2(-d.nx, -d.nz))).toBeGreaterThan(0.99);
    }
  });

  it('…and out again: you land outside, clear of Usdan (and the plaza furniture), facing away', () => {
    const extra = { solids: plazaObstacles() };
    for (const d of DOORS) {
      const inside = { x: d.x - d.nx * 0.7, z: d.z - d.nz * 0.7 };
      expect(free(inside)).toBe(true); // you can get that close from inside
      expect(usdanPortalAt('usdan', inside)?.kind).toBe('exit');
      const a = arriveAt(d, 'exit');
      expect(resolveMove(a, a, stops, extra)).toEqual({ x: a.x, z: a.z });
      expect(usdanPortalAt('out', a)).toBeNull();
    }
  });

  it('the button shows when you\'re close, on the right side', () => {
    const d = DOORS[0];
    expect(nearUsdanDoor('out', { x: d.x + d.nx * 2, z: d.z + d.nz * 2 })).toBe(d);
    expect(nearUsdanDoor('usdan', { x: d.x - d.nx * 2, z: d.z - d.nz * 2 })).toBe(d);
    expect(nearUsdanDoor('out', { x: d.x - d.nx * 2, z: d.z - d.nz * 2 })).toBeNull();
  });

  it('only on wheels-free feet: a door far along the wall isn\'t a door', () => {
    const d = DOORS[1];
    const along = { x: d.x + d.nx * 0.5 + -d.nz * 4, z: d.z + d.nz * 0.5 + d.nx * 4 };
    expect(doorFrame(d, along).lat).toBeCloseTo(4, 3);
    expect(usdanPortalAt('out', along)).toBeNull();
  });
});

describe('inside Usdan', () => {
  const inSouth = arriveAt(DOORS[0], 'enter'), inEast = arriveAt(DOORS[1], 'enter');
  const canReach = reachable(inSouth);

  it('every room is inside the building', () => {
    for (const r of ROOMS) {
      const c = { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
      expect(inPoly(c, USDAN)).toBe(true);
    }
  });

  it('from the south doors you can get everywhere that matters — and out the east doors', () => {
    const spots = {
      eastDoor: inEast,
      infoWindow: AT_DESK[0],
      lounge: { x: -64.4, z: -195.6 },
      corridorNorth: { x: -64.5, z: -226 },
      atrium: { x: -80.5, z: -203 },
      flexDining: { x: -88.5, z: -183 },
      cafeCounter: { x: -76.5, z: -218.4 },
      elevator: { x: -69.2, z: -219.5 },
    };
    for (const [name, p] of Object.entries(spots)) expect([name, canReach(p)]).toEqual([name, true]);
  });

  it('but not into the closed-off west wing or behind the café counter', () => {
    expect(canReach({ x: -105, z: -200 })).toBe(false);
    expect(canReach({ x: -76.5, z: -221.6 })).toBe(false); // staff side
  });

  it('nothing is placed inside a wall, and all of it is indoors', () => {
    const walls = WALLS.flatMap((w) => wallBoxes(w, 0));
    for (const it of ITEMS) {
      expect([it.kind, inPoly(it, USDAN)]).toEqual([it.kind, true]);
      const [hx, hz] = half(it);
      const fp = { x0: it.x - hx, x1: it.x + hx, z0: it.z - hz, z1: it.z + hz };
      const hit = walls.some((w) => w.x0 < fp.x1 && w.x1 > fp.x0 && w.z0 < fp.z1 && w.z1 > fp.z0);
      expect([it.kind, it.x, it.z, hit]).toEqual([it.kind, it.x, it.z, false]);
    }
  });

  it('people sit on chairs next to their table (not in it), and the staff are behind their counters', () => {
    for (const [t, c] of SITTERS) {
      const at = chairsAt(ITEMS[t])[c];
      expect(at).toBeDefined();
      const [hx, hz] = half(ITEMS[t]);
      expect(Math.abs(at.x - ITEMS[t].x) > hx || Math.abs(at.z - ITEMS[t].z) > hz).toBe(true);
      expect(insideUsdan(at)).toBe(true);
    }
    for (const p of [...SOFA_SITTERS, ...STAFF, ...AT_DESK]) expect(inPoly(p, USDAN)).toBe(true);
    expect(canReach(STAFF[0])).toBe(false); // you can't get behind the desk
  });

  it('the lanes people walk are clear the whole way', () => {
    for (const [x, za, zb] of WALK_LANES) {
      for (let z = za; z <= zb; z += 0.5) expect([x, z, free({ x, z })]).toEqual([x, z, true]);
    }
  });

  it('walking inside never takes you out through a wall (random walk)', () => {
    let seed = 3;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let p = { x: inSouth.x, z: inSouth.z };
    for (let i = 0; i < 20000; i++) {
      const a = rand() * Math.PI * 2;
      p = resolveMove(p, { x: p.x + Math.sin(a) * 0.3, z: p.z + Math.cos(a) * 0.3 }, stops, usdanExtra());
      expect(insideUsdan(p)).toBe(true);
    }
  });

  it('knows which room you\'re in', () => {
    expect(roomAt(inSouth)?.id).toBe('lobby');
    expect(roomAt({ x: -80, z: -203 })?.id).toBe('atrium');
    expect(roomAt({ x: -88, z: -184 })?.id).toBe('flex');
  });
});
