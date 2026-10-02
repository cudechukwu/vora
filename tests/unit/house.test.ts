import { describe, expect, it } from 'vitest';
import { resolveMove, inBox, XZ } from '../../src/row/collide';
import { houseExtra, levelAt, floorY, wallPieces } from '../../src/row/house/collide';
import {
  FRONT_DOOR, FURNITURE, HOUSE, Level, PORCH, PORCH_STEPS, ROOMMATES, SEATS, STAIRS, UPSTAIRS_Y, WALLS, inStairs, insideHouse, toLocal, toWorld,
} from '../../src/row/house/plan';
import { ENTER_AT, EXIT_AT, cameraClearance, nearDoor, portalAt } from '../../src/row/house/portal';
import { EDGES, NODES, OUT, assignments, homecoming, listNames, placeAt, route, walkTo } from '../../src/row/house/routine';
import { BOUNDS, FAR_WALK, layoutRow } from '../../src/row/layout';
import { rng } from '../../src/row/noise';

const { stops } = layoutRow();

/** Walk toward a local (u, v) target in small steps like the game, tracking your floor. */
function walk(from: [number, number, Level], to: [number, number], opts: { riding?: boolean } = {}) {
  let p: XZ = toWorld(from[0], from[1]);
  let level = from[2];
  const t = toWorld(to[0], to[1]);
  for (let i = 0; i < 4000; i++) {
    const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.05) break;
    const s = Math.min(0.1, d);
    const next = resolveMove(p, { x: p.x + (dx / d) * s, z: p.z + (dz / d) * s }, stops, houseExtra(level, !!opts.riding));
    if (next.x === p.x && next.z === p.z) break;
    p = next;
    level = levelAt(level, p.x, p.z);
  }
  const { u, v } = toLocal(p.x, p.z);
  return { u, v, level, y: floorY(level, p.x, p.z) };
}
const near = (r: { u: number; v: number }, u: number, v: number, eps = 0.15) => Math.hypot(r.u - u, r.v - v) < eps;
/** Walk a route through several points (like a player steering through doorways). */
function via(start: [number, number, Level], ...pts: [number, number][]) {
  let r = { u: start[0], v: start[1], level: start[2], y: 0 };
  for (const p of pts) r = walk([r.u, r.v, r.level as Level], p);
  return r;
}

describe('your house: layout', () => {
  it('sits across High Street, behind the far sidewalk', () => {
    expect(HOUSE.x0).toBeGreaterThan(FAR_WALK.x1);
  });

  it('has six bedrooms upstairs and five roommates', () => {
    expect(ROOMMATES).toHaveLength(5);
    expect(new Set(ROOMMATES.map((r) => r.room)).size).toBe(5);
  });

  it('keeps every piece of furniture inside the house, off the walls', () => {
    for (const f of FURNITURE) {
      expect(insideHouse(f.u0 + 0.01, f.v0 + 0.01) && insideHouse(f.u1 - 0.01, f.v1 - 0.01), f.kind).toBe(true);
    }
  });

  it('lets windows be windows: only doors and arches are gaps you can walk through', () => {
    const front = WALLS.find((w) => w.exterior && w.level === 0 && w.axis === 'v' && w.at === 0)!;
    expect(front.openings.filter((o) => o.kind === 'door')).toHaveLength(1);
    const back = WALLS.find((w) => w.exterior && w.level === 0 && w.axis === 'v' && w.at === 16)!;
    expect(wallPieces(back, 0)).toHaveLength(1); // windows don't split the solid wall
  });
});

describe('your house: walking around', () => {
  it('walk up the front path, across the porch and in the front door', () => {
    const r = walk([-6, 4, 0], [2.5, 4]);
    expect(near(r, 2.5, 4)).toBe(true);
    expect(r.level).toBe(0);
  });

  it("can't walk through the outside walls", () => {
    const r = walk([3, -1, 0], [-4, -1]); // living room → front wall
    expect(r.u).toBeGreaterThan(0);
    const s = walk([3, -1, 0], [3, -12]); // → side wall (couch in the way too)
    expect(s.v).toBeGreaterThan(-9);
  });

  it("can't ride a bike or scooter through the front door", () => {
    const r = walk([-1.5, 4, 0], [2.5, 4], { riding: true });
    expect(r.u).toBeLessThan(0);
  });

  it('can get from the hall to the living room and the kitchen', () => {
    expect(near(via([2.6, 4.3, 0], [4.1, 2.4], [4.1, 0.6], [7.1, -1.2]), 7.1, -1.2)).toBe(true); // through the arch
    expect(near(via([7.1, -1.2, 0], [7.2, -4.3], [9.0, -4.3], [9.8, -1.0], [13.8, -1.0]), 13.8, -1.0)).toBe(true); // into the kitchen
    expect(near(via([2.6, 4.3, 0], [7.4, 4.4], [9.6, 4.4], [9.6, 3.0]), 9.6, 3.0)).toBe(true); // hall → dining
  });

  it('climbs the stairs to the landing — you end up upstairs, at upstairs height', () => {
    const r = walk([1.6, 8.2, 0], [9, 8.2]);
    expect(r.level).toBe(1);
    expect(r.y).toBe(UPSTAIRS_Y);
    expect(near(r, 9, 8.2)).toBe(true);
  });

  it('gets higher smoothly as you climb (no steps in the floor)', () => {
    let prev = 0;
    for (let u = STAIRS.u0; u <= STAIRS.u1; u += 0.05) {
      const { x, z } = toWorld(u, 8.2);
      const y = floorY(levelAt(0, x, z), x, z);
      expect(y - prev).toBeLessThan(0.05);
      expect(y).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = y;
    }
  });

  it('comes back down again', () => {
    const r = walk([9, 8.2, 1], [1.0, 8.2]);
    expect(r.level).toBe(0);
    expect(r.y).toBe(0);
  });

  it("can't step onto the middle of the stairs from the side, or from the kitchen", () => {
    expect(walk([5, 6.5, 0], [5, 8.2]).v).toBeLessThan(7.4);
    expect(walk([9.2, 8.2, 0], [6, 8.2]).u).toBeGreaterThan(8);
  });

  it('upstairs: the corridor leads to your room', () => {
    const r = via([8.6, 2.75, 1], [4.3, 2.75], [4.3, 0.5], [2.5, -3], [2.5, -7.6]);
    expect(near(r, 2.5, -7.6)).toBe(true); // by your bed
    expect(r.level).toBe(1);
  });

  it("upstairs: the other bedrooms are closed, and you can't fall down the stairwell", () => {
    expect(walk([8.1, 2.75, 1], [8.1, -3]).v).toBeGreaterThan(1.5); // R2's door is shut
    expect(walk([5, 6, 1], [5, 8.6]).v).toBeLessThan(7.4); // rail round the stairwell
    expect(walk([2, 2.75, 1], [-3, 2.75]).u).toBeGreaterThan(0); // can't walk out of an upstairs wall
  });

  it('outside your lot, the world still ends at the far sidewalk', () => {
    const far = toWorld(-3, 40); // past the end of your lot
    const r = resolveMove({ x: BOUNDS.xMax - 0.5, z: far.z }, { x: BOUNDS.xMax + 5, z: far.z }, stops, houseExtra(0, false));
    expect(r.x).toBeLessThanOrEqual(BOUNDS.xMax);
  });

  it('never ends up inside a wall or furniture, on either floor (random walk)', () => {
    const solid0 = [...WALLS.filter((w) => w.level === 0).flatMap((w) => wallPieces(w, 0))];
    const solid1 = [...WALLS.filter((w) => w.level === 1).flatMap((w) => wallPieces(w, 0))];
    const furn = (l: Level) => FURNITURE.filter((f) => f.level === l).map((f) => ({ ...toWorld(f.u0, f.v0), x1: toWorld(f.u1, f.v0).x, z1: toWorld(f.u0, f.v1).z }))
      .map((b) => ({ x0: b.x, z0: b.z, x1: b.x1, z1: b.z1 }));
    let p = toWorld(2.6, 4.3);
    let level: Level = 0;
    for (let i = 0; i < 30000; i++) {
      const a = rng(i) * Math.PI * 2, len = 0.05 + rng(i + 7777) * 0.15;
      const next = resolveMove(p, { x: p.x + Math.cos(a) * len, z: p.z + Math.sin(a) * len }, stops, houseExtra(level, false));
      level = levelAt(level, next.x, next.z);
      p = next;
      const hits = (level === 0 ? [...solid0, ...furn(0)] : [...solid1, ...furn(1)]).some((b) => inBox(p, b));
      expect(hits, `step ${i}`).toBe(false);
    }
  });
});

describe('roommates', () => {
  it('always have somewhere to be, and never share a seat', () => {
    for (let h = 0; h < 24; h += 0.25) {
      const a = assignments(h);
      const seats = Object.values(a).filter((s) => s.pose !== 'hidden').map((s) => s.id);
      expect(new Set(seats).size, `at ${h}h`).toBe(seats.length);
    }
  });

  it('hang out on the couch in the evening', () => {
    const couch = Object.values(assignments(21.5)).filter((s) => s.id.startsWith('couch'));
    expect(couch.length).toBeGreaterThanOrEqual(3);
  });

  it('are mostly out at class in the early afternoon, and in bed at 4am', () => {
    expect(ROOMMATES.filter((r) => placeAt(r.id, 13) === 'out').length).toBeGreaterThanOrEqual(4);
    expect(ROOMMATES.filter((r) => placeAt(r.id, 4) === 'room').length).toBe(5);
  });

  it('someone is on the porch at golden hour', () => {
    expect(ROOMMATES.some((r) => placeAt(r.id, 17.3) === 'porch')).toBe(true);
  });

  it('can walk from anywhere to anywhere in the house', () => {
    const nodes = Object.keys(NODES);
    for (const n of nodes) expect(route('out', n).length, n).toBeGreaterThan(0);
    for (const s of [...SEATS.map((x) => x.id)]) {
      const spot = Object.values(assignments(21)).find((a) => a.id === s);
      if (spot) expect(walkTo('corr', spot).length).toBeGreaterThan(2);
    }
    expect(walkTo('stTop', OUT).at(-1)).toMatchObject({ u: OUT.u, v: OUT.v });
  });

  it("walk paths never go through a wall or furniture (only the stairs change floors)", () => {
    const blocks = (l: Level) => [
      ...WALLS.filter((w) => w.level === l).flatMap((w) => wallPieces(w, 0)),
      ...FURNITURE.filter((f) => f.level === l).map((f) => {
        const a = toWorld(f.u0, f.v0), b = toWorld(f.u1, f.v1);
        return { x0: a.x, x1: b.x, z0: a.z, z1: b.z };
      }),
    ];
    for (const [a, b] of EDGES) {
      const A = NODES[a], B = NODES[b];
      if (A.level !== B.level) { expect([a, b].sort()).toEqual(['stBot', 'stTop']); continue; }
      for (let t = 0; t <= 1; t += 0.02) {
        const p = toWorld(A.u + (B.u - A.u) * t, A.v + (B.v - A.v) * t);
        expect(blocks(A.level).some((bx) => inBox(p, bx)), `${a}→${b} at ${t.toFixed(2)}`).toBe(false);
      }
    }
  });
});

describe('the front door is a portal', () => {
  it('stepping into the doorway from the porch takes you in; from the hall, out', () => {
    const mid = (FRONT_DOOR.v0 + FRONT_DOOR.v1) / 2;
    expect(portalAt('out', -0.2, mid)).toBe('enter');
    expect(portalAt('out', -1.5, mid)).toBeNull(); // still on the porch
    expect(portalAt('out', -0.2, mid + 3)).toBeNull(); // that's wall, not door
    expect(portalAt('in', 0.4, mid)).toBe('exit');
    expect(portalAt('in', 3, mid)).toBeNull();
  });

  it("you land clear of the doorway, so you don't bounce straight back through", () => {
    expect(portalAt('in', ENTER_AT.u, ENTER_AT.v)).toBeNull();
    expect(portalAt('out', EXIT_AT.u, EXIT_AT.v)).toBeNull();
  });

  it('going out puts you at the foot of the porch steps, facing High Street', () => {
    expect(EXIT_AT.u).toBeLessThan(PORCH.u0); // off the porch
    expect(EXIT_AT.v).toBeGreaterThan(PORCH_STEPS.v0);
    expect(EXIT_AT.v).toBeLessThan(PORCH_STEPS.v1); // right in front of the steps
    expect(Math.sin(EXIT_AT.heading)).toBeLessThan(-0.99); // facing −u: the street
  });

  it('where you land is somewhere you can actually stand', () => {
    const enter = toWorld(ENTER_AT.u, ENTER_AT.v), exit = toWorld(EXIT_AT.u, EXIT_AT.v);
    expect(resolveMove(enter, enter, stops, houseExtra(0, false))).toEqual(enter);
    expect(resolveMove(exit, exit, stops, houseExtra(0, false))).toEqual(exit);
  });

  it('the door button shows on the porch by the door, and in the hall by the door', () => {
    const mid = (FRONT_DOOR.v0 + FRONT_DOOR.v1) / 2;
    expect(nearDoor('out', -1.2, mid)).toBe(true);
    expect(nearDoor('out', -1.2, -6)).toBe(false);
    expect(nearDoor('in', 1.2, mid)).toBe(true);
    expect(nearDoor('in', 6, mid)).toBe(false);
  });
});

describe('the porch', () => {
  it('you can never get stuck: from every spot on the porch you can walk back to the street', () => {
    let tried = 0;
    for (let u = PORCH.u0 + 0.05; u < -0.05; u += 0.25) {
      for (let v = PORCH.v0 + 0.05; v < PORCH.v1; v += 0.25) {
        const w = toWorld(u, v);
        // skip spots that are solid (bench, rails) — you can't be standing there
        if (resolveMove(w, w, stops, houseExtra(0, false)).x !== w.x) continue;
        if (houseExtra(0, false).solids!.some((b) => inBox(w, b))) continue;
        tried++;
        // steer like a player: along the porch to the steps, then down them and out to the sidewalk
        const r = via([u, v, 0], [-1.6, v], [-1.6, 4], [-5.5, 4]);
        expect(near(r, -5.5, 4, 0.2), `stuck from u=${u.toFixed(2)} v=${v.toFixed(2)} → ended ${r.u.toFixed(2)},${r.v.toFixed(2)}`).toBe(true);
      }
    }
    expect(tried).toBeGreaterThan(50);
  });
});

describe('the camera never ends up inside your house', () => {
  const inHouse = (p: XZ) => { const l = toLocal(p.x, p.z); return l.u > -0.3 && l.u < HOUSE.depth + 0.3 && Math.abs(l.v) < HOUSE.width / 2 + 0.3; };
  it('a clear view is left alone', () => {
    const you = toWorld(-6, 4), cam = toWorld(-14, 4); // you face the house, camera behind you over the street
    expect(cameraClearance(you, cam)).toBe(1);
  });
  it('when the house is behind you, the camera stops in front of the wall', () => {
    for (const [u, v] of [[EXIT_AT.u, EXIT_AT.v], [-1.3, -2], [-1.3, 7], [-0.6, -8]] as [number, number][]) {
      const you = toWorld(u, v);
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const want = { x: you.x + Math.cos(a) * 9, z: you.z + Math.sin(a) * 9 };
        const t = cameraClearance(you, want);
        const cam = { x: you.x + (want.x - you.x) * t * 0.92, z: you.z + (want.z - you.z) * t * 0.92 };
        expect(inHouse(cam), `from ${u},${v} angle ${a.toFixed(2)}`).toBe(false);
      }
    }
  });
});

describe('the stairs never trap you (regression: stuck in the wall halfway down)', () => {
  const okAt = (level: Level, p: XZ) => {
    const e = houseExtra(level, false);
    return !(e.solids ?? []).some((b) => inBox(p, b)) && (!e.walkable || e.walkable.some((b) => inBox(p, b)));
  };

  it('wherever the floor switches (halfway up), every spot you can stand is legal on BOTH floors', () => {
    let n = 0;
    const half = STAIRS.u0 + (STAIRS.u1 - STAIRS.u0) / 2;
    for (let u = half - 0.6; u <= half + 0.6; u += 0.02) {
      for (let v = STAIRS.v0 - 0.2; v <= STAIRS.v1 + 0.2; v += 0.02) {
        const p = toWorld(u, v);
        const up = okAt(1, p), down = okAt(0, p);
        if (!up && !down) continue;
        if (!inStairs(u, v)) continue;
        n++;
        // wherever the floor switch happens, you must be standable on the floor you switch to
        expect(up && down, `u=${u.toFixed(2)} v=${v.toFixed(2)} up=${up} down=${down}`).toBe(true);
      }
    }
    expect(n).toBeGreaterThan(100);
  });

  it('up and down the stairs 40 times, hugging either side, without ever getting stuck', () => {
    for (let i = 0; i < 40; i++) {
      const v = i % 2 ? 7.6 : 8.8; // try to hug the side wall, then the outside wall
      const up = via([1.4, 8.2, 0], [2.2, v], [7.4, v], [9, 8.2]);
      expect(up.level, `trip ${i} up`).toBe(1);
      const down = via([up.u, up.v, 1], [7.4, v], [2.2, v], [1.2, 8.2]);
      expect(down.level, `trip ${i} down`).toBe(0);
      expect(near(down, 1.2, 8.2, 0.2), `trip ${i} down ended at ${down.u.toFixed(2)},${down.v.toFixed(2)}`).toBe(true);
    }
  });

  it('random wandering on and around the stairs: you can always move somewhere', () => {
    let p = toWorld(4, 8.2);
    let level: Level = 0;
    for (let i = 0; i < 20000; i++) {
      const a = rng(i * 3) * Math.PI * 2, len = 0.05 + rng(i * 3 + 1) * 0.12;
      const nx = resolveMove(p, { x: p.x + Math.cos(a) * len, z: p.z + Math.sin(a) * len }, stops, houseExtra(level, false));
      level = levelAt(level, nx.x, nx.z);
      p = nx;
      // keep the wander near the stairs
      const l = toLocal(p.x, p.z);
      if (l.u > 10 || l.v < 4) { p = toWorld(4, 8.2); level = 0; }
      // never trapped: at least one of 8 directions is open
      const free = Array.from({ length: 8 }, (_, k) => k * Math.PI / 4).some((d) => {
        const q = resolveMove(p, { x: p.x + Math.cos(d) * 0.1, z: p.z + Math.sin(d) * 0.1 }, stops, houseExtra(level, false));
        return q.x !== p.x || q.z !== p.z;
      });
      expect(free, `trapped at step ${i}: ${l.u.toFixed(2)},${l.v.toFixed(2)} level ${level}`).toBe(true);
    }
  });
});

describe('solid things', () => {
  it("you can't walk through the dining chairs or your desk chair", () => {
    expect(walk([9.6, 3.6, 0], [12.5, 3.6]).u).toBeLessThan(10.98); // along the chairs' row
    expect(walk([2.5, -3.7, 1], [0.6, -3.7]).u).toBeGreaterThan(1.4); // into the desk chair
  });

  it('if something ever ends up on top of you, you can still walk away (never frozen)', () => {
    const p = { x: 14, z: -100 }; // out on High Street
    const car = { x0: p.x - 1, x1: p.x + 1, z0: p.z - 2, z1: p.z + 2 }; // e.g. a car that pulled up into you
    const out = resolveMove(p, { x: p.x - 0.2, z: p.z }, stops, { solids: [car] });
    expect(out.x).toBeCloseTo(p.x - 0.2, 9);
  });
});

describe('coming home', () => {
  it("knows who's home and who's out", () => {
    const night = homecoming(21.5);
    expect(night.home.length + night.out.length).toBe(5);
    expect(night.home.length).toBeGreaterThanOrEqual(4);
    const noon = homecoming(13);
    expect(noon.out.length).toBeGreaterThanOrEqual(4);
  });

  it('someone on the couch says hi in the evening; nobody greets you from class', () => {
    const night = homecoming(21.5);
    expect(night.greeter).not.toBeNull();
    expect(placeAt(night.greeter!, 21.5)).toBe('couch');
    expect(night.line.length).toBeGreaterThan(3);
    const fourAm = homecoming(4); // everyone's asleep in their rooms
    expect(fourAm.greeter).toBeNull();
    expect(fourAm.home).toHaveLength(5);
  });

  it('a cook offers food', () => {
    const h = homecoming(18.5); // jules + ines cooking, kofi + nico on the porch
    expect(['cook', 'couch', 'dine']).toContain(placeAt(h.greeter!, 18.5));
    if (placeAt(h.greeter!, 18.5) === 'cook') expect(h.line).toMatch(/food|hungry|made/);
  });

  it('writes names like a person would', () => {
    expect(listNames(['kofi'])).toBe('kofi');
    expect(listNames(['kofi', 'ines'])).toBe('kofi & ines');
    expect(listNames(['kofi', 'ines', 'nico'])).toBe('kofi, ines & nico');
  });
});
