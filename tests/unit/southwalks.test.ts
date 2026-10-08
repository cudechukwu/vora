import { describe, expect, it } from 'vitest';
import { ROUTES, inChurchRoad, pointAt, routeLength, waitToCross } from '../../src/row/southwalks';
import { CHURCH_XWALK, EXLEY_XWALK, inSouthEnd, southObstacles } from '../../src/row/southend';
import { inUsdan, layoutRow } from '../../src/row/layout';
import { resolveMove } from '../../src/row/collide';

const { stops } = layoutRow();
const solids = southObstacles(0);
const inside = (p: { x: number; z: number }, b: { x0: number; x1: number; z0: number; z1: number }) => p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1;

describe('people about the south end', () => {
  it('has professors (Olin, Exley, Casper) and students, a few of each', () => {
    const n = (w: string) => ROUTES.filter((r) => r.who === w).reduce((a, r) => a + r.n, 0);
    expect(n('prof')).toBeGreaterThanOrEqual(5);
    expect(n('student')).toBeGreaterThanOrEqual(8);
    for (const id of ['olin-exley', 'olin-casper', 'exley-casper', 'frank-olin-cut', 'clark-exley']) expect(ROUTES.map((r) => r.id)).toContain(id);
  });

  it('every route keeps out of buildings, walls, posts and benches (bar the last step into a door)', () => {
    for (const r of ROUTES) {
      const L = routeLength(r);
      for (let s = 1.2; s < L - 1.2; s += 0.4) {
        const p = pointAt(r, s);
        expect([r.id, s.toFixed(1), inSouthEnd(p, 0.15)]).toEqual([r.id, s.toFixed(1), false]);
        expect([r.id, s.toFixed(1), solids.some((b) => inside(p, b))]).toEqual([r.id, s.toFixed(1), false]);
        expect([r.id, s.toFixed(1), resolveMove(p, p, stops)]).toEqual([r.id, s.toFixed(1), { x: p.x, z: p.z }]);
        expect(inUsdan(p)).toBe(false);
      }
    }
  });

  it('crosses Church Street only at its crosswalks', () => {
    for (const r of ROUTES) {
      const L = routeLength(r);
      for (let s = 0; s < L; s += 0.3) {
        const p = pointAt(r, s);
        if (!inChurchRoad(p)) continue;
        const atXwalk = [CHURCH_XWALK, EXLEY_XWALK].some((x) => p.x >= x.x0 - 0.2 && p.x <= x.x1 + 0.2);
        expect([r.id, Math.round(p.x), atXwalk]).toEqual([r.id, Math.round(p.x), true]);
      }
    }
  });

  it('waits at the curb for a car coming, not for one far off or stopped', () => {
    const r = ROUTES.find((x) => x.id === 'olin-exley')!, L = routeLength(r);
    let s = 0;
    while (s < L && !inChurchRoad(pointAt(r, s + 1.2))) s += 0.1;
    const at = pointAt(r, s + 1.2);
    expect(waitToCross(r, s, 1, [{ x: at.x + 10, z: at.z + 1, speed: 8 }])).toBe(true);
    expect(waitToCross(r, s, 1, [{ x: at.x + 40, z: at.z + 1, speed: 8 }])).toBe(false);
    expect(waitToCross(r, s, 1, [{ x: at.x + 6, z: at.z + 1, speed: 0 }])).toBe(false);
  });
});
