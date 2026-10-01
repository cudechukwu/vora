import { describe, expect, it } from 'vitest';
import { resolveMove, XZ } from '../../src/row/collide';
import { BOUNDS, byId, layoutRow } from '../../src/row/layout';
import { rng } from '../../src/noise';

const { stops, crossings } = layoutRow();
const boger = byId(stops, 'boger');
const usdan = byId(stops, 'usdan');

/** Walk from `from` toward `to` in small steps, like the game loop does. */
function walk(from: XZ, to: XZ, stepLen = 0.2, maxSteps = 5000): XZ {
  let p = { ...from };
  for (let i = 0; i < maxSteps; i++) {
    const dx = to.x - p.x, dz = to.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < stepLen) return resolveMove(p, to, stops);
    const next = resolveMove(p, { x: p.x + (dx / d) * stepLen, z: p.z + (dz / d) * stepLen }, stops);
    if (next.x === p.x && next.z === p.z) return p; // blocked
    p = next;
  }
  return p;
}

function insideBuilding(p: XZ) {
  return stops.some((s) => p.z < s.z0 && p.z > s.z1 && p.x < s.front && p.x > s.back);
}

describe('walking around College Row', () => {
  it('moves freely along the walk', () => {
    const end = walk({ x: -0.6, z: boger.z1 }, { x: -0.6, z: boger.z0 });
    expect(end.z).toBeCloseTo(boger.z0, 5);
  });

  it('stops you at a facade instead of walking into it', () => {
    const end = walk({ x: 0, z: boger.zc }, { x: -30, z: boger.zc });
    expect(end.x).toBeCloseTo(boger.front + 0.8, 5);
  });

  it("stops you at Usdan's curved front, which sticks out further", () => {
    const end = walk({ x: 0, z: usdan.zc }, { x: -30, z: usdan.zc });
    expect(end.x).toBeCloseTo(usdan.front + 0.8, 5);
    expect(usdan.front).toBeGreaterThan(boger.front);
  });

  it('lets you cut through each walkway onto Andrus Field', () => {
    for (const c of crossings) {
      const end = walk({ x: 0, z: c.z }, { x: -100, z: c.z });
      expect(end.x).toBeCloseTo(-100, 5);
    }
  });

  it('blocks you from stepping sideways out of a walkway into a building', () => {
    const c = crossings[1];
    const end = walk({ x: -30, z: c.z }, { x: -30, z: c.z + 40 });
    expect(insideBuilding(end)).toBe(false);
    expect(end.x).toBeCloseTo(-30, 5);
  });

  it('blocks you at the back wall when coming from the field', () => {
    const end = walk({ x: -100, z: boger.zc }, { x: 0, z: boger.zc });
    expect(end.x).toBeCloseTo(boger.back - 0.8, 5);
  });

  it('lets you roam the field behind the whole row', () => {
    const end = walk({ x: -90, z: stops[0].z0 }, { x: -90, z: stops[stops.length - 1].z1 });
    expect(end.z).toBeCloseTo(stops[stops.length - 1].z1, 5);
  });

  it('keeps you inside the world edges', () => {
    expect(resolveMove({ x: 0, z: 0 }, { x: 999, z: 0 }, stops).x).toBe(BOUNDS.xMax);
    expect(resolveMove({ x: 0, z: 0 }, { x: -999, z: 0 }, stops).x).toBe(BOUNDS.xMin);
    expect(resolveMove({ x: 0, z: 0 }, { x: 0, z: 9999 }, stops).z).toBe(BOUNDS.zMax);
    expect(resolveMove({ x: 0, z: 0 }, { x: 0, z: -9999 }, stops).z).toBe(BOUNDS.zMin);
  });

  it('never ends up inside a building (20k random steps)', () => {
    let p: XZ = { x: 0, z: boger.zc };
    for (let i = 0; i < 20000; i++) {
      const a = rng(i) * Math.PI * 2;
      const len = 0.05 + rng(i + 99991) * 0.4; // up to a 50ms frame at full speed
      p = resolveMove(p, { x: p.x + Math.cos(a) * len * 3, z: p.z + Math.sin(a) * len * 3 }, stops);
      expect(insideBuilding(p), `step ${i} at ${p.x.toFixed(2)},${p.z.toFixed(2)}`).toBe(false);
    }
  });
});
