import { describe, expect, it } from 'vitest';
import { FORECOURT, REAR_ENTRY, ZEL, ZEL_BENCH, ZEL_LAMP, ZEL_PARTS, zelnickSolids, zelnickY } from '../../src/row/zelnick';
import { BACK_PATH, PATH_HALF, byId, layoutRow } from '../../src/row/layout';
import { BED } from '../../src/row/plaza';
import { groundY } from '../../src/row/southend';
import { resolveMove } from '../../src/row/collide';
import { World } from '../../src/row/world';

const { stops } = layoutRow();
const solids = zelnickSolids();
const walk = (from: { x: number; z: number }, to: { x: number; z: number }) => {
  let p = { ...from };
  const ys: number[] = [];
  for (let i = 0; i < 2000; i++) {
    const d = Math.hypot(to.x - p.x, to.z - p.z);
    if (d < 0.02) break;
    const s = Math.min(0.15, d);
    p = resolveMove(p, { x: p.x + ((to.x - p.x) / d) * s, z: p.z + ((to.z - p.z) / d) * s }, stops, { solids });
    ys.push(groundY(p.x, p.z));
  }
  return { p, ys };
};

describe('Zelnick Pavilion', () => {
  it('is wide (22 m); the chapel sits close by Judd, and the lawn between South and North College is wide (for the X)', () => {
    const z = byId(stops, 'zelnick'), judd = byId(stops, 'judd'), chapel = byId(stops, 'chapel');
    expect(z.z0 - z.z1).toBe(22);
    expect(judd.z1 - chapel.z0).toBe(10);
    expect(byId(stops, 'south').z1 - byId(stops, 'north').z0).toBe(26);
    expect(byId(stops, 'north').z0).toBe(-100); // North College, Boger, Usdan and the plaza haven't moved
    expect(chapel.z1).toBe(z.z0);
  });

  it('every part sits inside its footprint (which is what is solid)', () => {
    for (const [name, r] of Object.entries(ZEL_PARTS)) {
      if (!('z0' in r)) continue;
      expect(r.x0, name).toBeGreaterThanOrEqual(ZEL.back - 1e-9);
      expect(r.x1, name).toBeLessThanOrEqual(ZEL.front + 1e-9);
      expect(r.z0, name).toBeGreaterThanOrEqual(ZEL.z1 - 1e-9);
      expect(r.z1, name).toBeLessThanOrEqual(ZEL.z0 + 1e-9);
    }
    expect(FORECOURT.x0).toBe(ZEL.front); // the forecourt runs from the front doors out to the row's facade line
  });

  it('the back entrance: from the back path, up the steps to the landing, and down the ramp to the lawn', () => {
    const R = REAR_ENTRY;
    const onLanding = { x: (R.landing.x0 + R.landing.x1) / 2, z: R.doorZ };
    const up = walk({ x: (BACK_PATH.x0 + BACK_PATH.x1) / 2, z: R.doorZ }, onLanding);
    expect(Math.hypot(up.p.x - onLanding.x, up.p.z - onLanding.z)).toBeLessThan(0.05);
    expect(groundY(up.p.x, up.p.z)).toBeCloseTo(R.H); // you're up on it
    for (let i = 1; i < up.ys.length; i++) expect(up.ys[i]).toBeGreaterThanOrEqual(up.ys[i - 1] - 1e-9); // only ever up
    // then down the ramp (along the wall, +z) to the lawn at its foot
    const foot = { x: (R.ramp.x0 + R.ramp.x1) / 2, z: R.ramp.z1 + 1.5 };
    const down = walk(onLanding, { x: foot.x, z: R.landing.z1 - 0.2 });
    const out = walk(down.p, foot);
    expect(Math.hypot(out.p.x - foot.x, out.p.z - foot.z)).toBeLessThan(0.05);
    expect(groundY(out.p.x, out.p.z)).toBe(0);
    for (let i = 1; i < out.ys.length; i++) expect(Math.abs(out.ys[i] - out.ys[i - 1])).toBeLessThan(0.05); // a gentle ramp, no jumps
  });

  it('the ramp is no steeper than 1:12, and the railings keep you off its open side', () => {
    const R = REAR_ENTRY;
    expect(R.H / (R.ramp.z1 - R.ramp.z0)).toBeLessThanOrEqual(1 / 12 + 1e-9);
    const mid = (R.ramp.z0 + R.ramp.z1) / 2;
    const tried = walk({ x: R.ramp.x0 - 1.5, z: mid }, { x: (R.ramp.x0 + R.ramp.x1) / 2, z: mid }); // in from the side
    expect(tried.p.x).toBeLessThan(R.ramp.x0);
    expect(zelnickY(R.ramp.x0 - 1, mid)).toBe(0);
  });

  it('the steps stop short of the hosta bed along the back path', () => {
    expect(REAR_ENTRY.steps.x0).toBeGreaterThan(BED.x1 + 0.5);
  });

  it('out front: the bench and lamp keep clear of the walk up to the doors and of the row walk', () => {
    const spur = { x0: ZEL.front, x1: -PATH_HALF, z0: ZEL.zc - 1.3, z1: ZEL.zc + 1.3 };
    for (const b of [...ZEL_BENCH, { x0: ZEL_LAMP.x, x1: ZEL_LAMP.x, z0: ZEL_LAMP.z, z1: ZEL_LAMP.z }]) {
      expect(b.z1 < spur.z0 - 0.6 || b.z0 > spur.z1 + 0.6).toBe(true);
      expect(b.x1).toBeLessThan(-PATH_HALF - 2);
    }
    for (const l of World.lampSpots()) expect(solids.some((r) => l.x > r.x0 - 0.5 && l.x < r.x1 + 0.5 && l.z > r.z0 - 0.5 && l.z < r.z1 + 0.5)).toBe(false);
    // and you can walk from the row up the spur to the front doors
    const at = walk({ x: -1, z: ZEL.zc }, { x: ZEL.front + 0.5, z: ZEL.zc }).p;
    expect(at.x).toBeLessThan(ZEL.front + 1); // right up to the glass
  });
});
