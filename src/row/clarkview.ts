import {
  BoxGeometry, CanvasTexture, CylinderGeometry, Group, IcosahedronGeometry, Mesh, MeshLambertMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace, Vector3,
} from 'three';
import { BoxBank, Facing, WindowBank, hipRoof, lambert, worldUV } from './kit';
import { rng } from './noise';
import {
  CLARK, CLARK_COURT, CLARK_DOOR, CLARK_ENDS, CLARK_FLOOR, CLARK_HEDGE, CLARK_LAMPS, CLARK_LANE, CLARK_PATH, CLARK_PIERS,
  CLARK_PORCH, CLARK_STAIRS_S, CLARK_STAIRS_W, CLARK_GAP, CLARK_LOW, CLARK_UPPER, OLIN_LOW_WALL, STAIRS_C, STAIRS_C_BED, CLARK_STALLS, CLARK_TREES, DUMPSTERS, CLARK_WALK, CLARK_Y, OLIN, courtWalls, groundY,
} from './southend';

// ─── Clark Hall: draws what southend.ts lays out ───────────────────────
// From the user's photos, street views and aerial (2026-10-07). Rough-faced brownstone in irregular blocks; a basement
// and four storeys; a long body with a wider block across each end; bands over the ground floor and under the eaves;
// windows in pairs, dark six-over-six sashes, stone relieving arches over the ground floor's; low grey hip roofs with a
// deep eave; a big chimney stack. On the west, the sunken entrance court at basement level: concrete slabs with dark
// bands, low retaining walls with galvanized railings on top, stairs climbing out west and south-west, a boxwood bed,
// tall piers rising from the court to a flat dark porch roof, the doors (and a yellow side door). East, the narrow tar
// path between it and Olin's low limestone wall; south, the lane with cars along it.

type Kit = { g: Group; win: WindowBank; box: BoxBank };

const STONE_DARK = 0x6a5049, TRIM = 0x947468, SASH = 0x23282b, GALV = 0xb3b8bb, ROOF = 0x62686c, CONCRETE = 0xbcb8af;
const FLOOR_H = 3.1, FLOORS = 4;
const TOP = CLARK_FLOOR + FLOORS * FLOOR_H;

let tex: CanvasTexture | null = null;
/** Rough-faced brownstone: irregular blocks, purplish brown, each a shade different, pale mortar. One tile = 4 m. */
function brownstone(): CanvasTexture {
  if (tex) return tex;
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8a7570'; g.fillRect(0, 0, S, S); // the mortar
  let id = 8100, y = 0;
  while (y < S) {
    const h = 14 + Math.round(rng(id++) * 22); // courses of different heights (0.2–0.55 m)
    let x = -Math.round(rng(id++) * 50);
    while (x < S) {
      const w = 22 + Math.round(rng(id++) * 70), v = 0.8 + rng(id++) * 0.3, p = rng(id++) * 0.1;
      const hh = rng(id++) < 0.25 ? Math.round(h / 2) : h; // now and then two thin stones in the course
      for (let yy = 0; yy < h; yy += hh) {
        g.fillStyle = `rgb(${Math.round(124 * v * (1 + p))},${Math.round(92 * v)},${Math.round(90 * v * (1 + p * 0.6))})`;
        g.fillRect(x + 1.5, y + yy + 1.5, w - 3, Math.min(hh, h - yy) - 3);
      }
      for (let k = 0; k < 5; k++) { // the rough face
        g.fillStyle = k % 2 ? 'rgba(255,235,225,0.09)' : 'rgba(30,15,15,0.12)';
        g.fillRect(x + 2 + rng(id++) * (w - 6), y + 2 + rng(id++) * (h - 6), 3 + rng(id++) * 9, 2 + rng(id++) * 4);
      }
      x += w;
    }
    y += h;
  }
  tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
let stone: MeshLambertMaterial | null = null;
const stoneMat = () => (stone ??= new MeshLambertMaterial({ map: brownstone() }));

function mesh(g: Group, geo: BoxGeometry | CylinderGeometry | PlaneGeometry, mat: MeshLambertMaterial, x: number, y: number, z: number) {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}
/** A brownstone box from (x0, y0, z0) to (x1, y1, z1). */
function stoneBox(g: Group, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  return mesh(g, worldUV(new BoxGeometry(x1 - x0, y1 - y0, z1 - z0), 4), stoneMat(), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
}

export function buildClark(k: Kit) {
  block(k);
  windows(k);
  roof(k);
  court(k);
  grounds(k);
}

/** The long body and the two end blocks, from the court's level up to the eaves; the bands; downpipes. */
function block({ g, box }: Kit) {
  const y0 = -0.3; // (down to the field's level at its north end, where the bank falls away)
  stoneBox(g, CLARK.x0, CLARK.x1, y0, TOP, CLARK.z0, CLARK.z1);
  for (const e of CLARK_ENDS) stoneBox(g, e.x0, e.x1, y0, TOP, e.z0, e.z1);
  for (const r of [CLARK, ...CLARK_ENDS]) {
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, w = r.x1 - r.x0, d = r.z1 - r.z0;
    box.add(cx, CLARK_FLOOR - 0.05, cz, w + 0.14, 0.2, d + 0.14, STONE_DARK); // the water table over the basement
    box.add(cx, CLARK_FLOOR + FLOOR_H - 0.05, cz, w + 0.2, 0.22, d + 0.2, TRIM); // the band over the ground floor
    box.add(cx, TOP - 0.35, cz, w + 0.28, 0.32, d + 0.28, TRIM); // and under the eaves
  }
  for (const e of CLARK_ENDS) for (const x of [e.x0 - 0.1, e.x1 + 0.1]) for (const z of [e.z0 + 0.3, e.z1 - 0.3]) box.add(x, (CLARK_Y + TOP) / 2, z, 0.12, TOP - CLARK_Y, 0.12, 0x3c4a44); // downpipes
}

/** Pairs of windows (dark six-over-six sashes) all round; the ground floor's under relieving arches; basement windows. */
function windows(k: Kit) {
  const { win, box } = k;
  const ww = 1.0, wh = 1.75;
  const one = (x: number, y: number, z: number, f: Facing, arch: boolean, h = wh) => {
    const n = f === '+z' ? 1 : f === '-z' ? -1 : 0, e = f === '+x' ? 1 : f === '-x' ? -1 : 0, along = n !== 0;
    win.add('rect', x + e * 0.03, y, z + n * 0.03, ww, h, f);
    const sx = (a: number, b: number) => (along ? a : b), sz = (a: number, b: number) => (along ? b : a);
    box.add(x + e * 0.05, y, z + n * 0.05, sx(ww + 0.08, 0.04), 0.07, sz(ww + 0.08, 0.04), SASH); // meeting rail
    for (const o of [-ww / 6, ww / 6]) box.add(x + (along ? o : e * 0.05), y, z + (along ? n * 0.05 : o), 0.04, h, 0.04, SASH);
    for (const o of [-h / 4, h / 4]) box.add(x + e * 0.05, y + o, z + n * 0.05, sx(ww, 0.04), 0.04, sz(ww, 0.04), SASH);
    box.add(x + e * 0.1, y - h / 2 - 0.08, z + n * 0.1, sx(ww + 0.25, 0.22), 0.14, sz(ww + 0.25, 0.22), TRIM); // sill
    if (!arch) { box.add(x + e * 0.04, y + h / 2 + 0.12, z + n * 0.04, sx(ww + 0.2, 0.1), 0.2, sz(ww + 0.2, 0.1), STONE_DARK); return; }
    for (let i = 0; i <= 6; i++) { // a relieving arch: a ring of stones over it
      const a = (i / 6) * Math.PI, r = ww / 2 + 0.22, ox = Math.cos(a) * r, oy = Math.sin(a) * r * 0.8;
      box.add(x + (along ? ox : e * 0.06), y + h / 2 + 0.1 + oy, z + (along ? n * 0.06 : ox), sx(0.26, 0.12), 0.24, sz(0.26, 0.12), TRIM);
    }
    box.add(x + e * 0.03, y + h / 2 + 0.22, z + n * 0.03, sx(ww, 0.04), 0.3, sz(ww, 0.04), STONE_DARK);
  };
  const floorY = (i: number) => CLARK_FLOOR + i * FLOOR_H + 1.4;
  const pairs = (x: number, z: number, f: Facing, basement = false) => {
    const along = f === '+z' || f === '-z';
    for (let i = 0; i < FLOORS; i++) for (const d of [-0.7, 0.7]) one(along ? x + d : x, floorY(i), along ? z : z + d, f, i === 0);
    if (basement) for (const d of [-0.7, 0.7]) one(along ? x + d : x, CLARK_COURT.y + 1.25, along ? z : z + d, f, false, 1.4); // (the basement, seen from the court)
    else win.add('rect', x, CLARK_Y + 0.35, z, along ? 1.6 : 0.6, 0.45, f); // a little basement window at grade
  };
  const B = CLARK, C = CLARK_COURT, inCourt = (z: number) => z > C.z0 + 0.6 && z < C.z1 - 0.6;
  // the long sides, between the end blocks
  for (let z = B.z0 + 12; z < B.z1 - 10; z += 4.6) { // (fewer bays than you'd think: the user found it a prison)
    pairs(B.x1 + 0.02, z, '+x');
    if (Math.abs(z - CLARK_DOOR.z) < 3.2) continue; // the porch
    pairs(B.x0 - 0.02, z, '-x', inCourt(z));
  }
  // the end blocks: their long faces (onto the ends) and their sides
  for (const [i, e] of CLARK_ENDS.entries()) {
    const zf = i === 0 ? e.z0 - 0.02 : e.z1 + 0.02, f: Facing = i === 0 ? '-z' : '+z';
    for (const dx of [-5.2, -1.9, 1.9, 5.2]) pairs((e.x0 + e.x1) / 2 + dx, zf, f);
    for (const [x, sf] of [[e.x0 - 0.02, '-x'], [e.x1 + 0.02, '+x']] as const) pairs(x, (e.z0 + e.z1) / 2, sf);
  }
}

/** Low hip roofs: over the body and over each end block, deep eaves; the big chimney over the entrance, small ones at the ends. */
function roof({ g, box }: Kit) {
  const roofMat = lambert(ROOF);
  for (const r of [CLARK, ...CLARK_ENDS]) {
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, w = r.x1 - r.x0, d = r.z1 - r.z0;
    box.add(cx, TOP + 0.05, cz, w + 1.2, 0.22, d + 1.2, 0x4f5457); // the eave
    box.add(cx, TOP - 0.1, cz, w + 1.3, 0.14, d + 1.3, 0x3d4a45); // its gutter
    mesh(g, hipRoof(w + 1.1, 2.6, d + 1.1), roofMat, cx, TOP + 0.15, cz);
  }
  const cx = (CLARK.x0 + CLARK.x1) / 2;
  const stack = (z: number, sw: number, sd: number, h: number) => {
    stoneBox(g, cx - sw / 2, cx + sw / 2, TOP, TOP + h, z - sd / 2, z + sd / 2);
    box.add(cx, TOP + h + 0.08, z, sw + 0.25, 0.16, sd + 0.25, TRIM);
  };
  stack(CLARK_DOOR.z, 2.2, 3.6, 5.6);
  for (const s of [-1, 1]) box.add(cx + s * 1.12, TOP + 4.4, CLARK_DOOR.z, 0.04, 1.3, 1.2, 0x2a201c); // its arched opening, right through
  for (const e of CLARK_ENDS) stack((e.z0 + e.z1) / 2, 1.1, 1.4, 3.6);
}

/**
 * The sunken court: concrete slabs with dark bands, the retaining walls with railings on top, the two flights out, the
 * boxwood bed, the tall piers and flat porch roof, the doors and the yellow side door, a long bench.
 */
function court(k: Kit) {
  const { g, box } = k, C = CLARK_COURT, P = CLARK_PORCH, D = CLARK_DOOR, cy = C.y;
  const floor = new Mesh(new PlaneGeometry(C.x1 - C.x0, C.z1 - C.z0), lambert(0xc9c5bc));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((C.x0 + C.x1) / 2, cy + 0.02, (C.z0 + C.z1) / 2);
  floor.receiveShadow = true;
  g.add(floor);
  for (let z = C.z0 + 2.5; z < C.z1; z += 4) box.add((C.x0 + C.x1) / 2 - 1, cy + 0.03, z, 3, 0.01, 0.55, 0x7b746c); // the dark bands
  for (let x = C.x0 + 1.5; x < C.x1; x += 2.2) box.add(x, cy + 0.025, (C.z0 + C.z1) / 2, 0.03, 0.01, C.z1 - C.z0, 0x9e998f); // joints
  // the retaining walls up to the lawn, a coping, galvanized railings on top
  for (const w of courtWalls()) {
    const top = CLARK_Y + 0.12;
    box.add((w.x0 + w.x1) / 2, (cy + top) / 2, (w.z0 + w.z1) / 2, w.x1 - w.x0, top - cy, w.z1 - w.z0, CONCRETE);
    box.add((w.x0 + w.x1) / 2, top + 0.04, (w.z0 + w.z1) / 2, w.x1 - w.x0 + 0.06, 0.08, w.z1 - w.z0 + 0.06, 0xd0ccc4);
    const len = Math.max(w.x1 - w.x0, w.z1 - w.z0), alongX = w.x1 - w.x0 > w.z1 - w.z0;
    box.add((w.x0 + w.x1) / 2, top + 0.95, (w.z0 + w.z1) / 2, alongX ? len : 0.05, 0.05, alongX ? 0.05 : len, GALV);
    for (let t = 0; t <= len; t += 1.4) box.add(alongX ? w.x0 + t : (w.x0 + w.x1) / 2, top + 0.48, alongX ? (w.z0 + w.z1) / 2 : w.z0 + t, 0.05, 0.95, 0.05, GALV);
  }
  // the two flights out of it, with galvanized handrails both sides
  const flight = (S: { x0: number; x1: number; z0: number; z1: number; steps: number }, dir: '-x' | '+z') => {
    const run = dir === '-x' ? S.x1 - S.x0 : S.z1 - S.z0, tread = run / S.steps, rise = (CLARK_Y - cy) / S.steps;
    for (let i = 0; i < S.steps; i++) {
      const h = (i + 1) * rise, rest = run - i * tread;
      if (dir === '-x') box.add(S.x0 + rest / 2, cy + h / 2, (S.z0 + S.z1) / 2, rest, h, S.z1 - S.z0, i % 2 ? 0xc6c2b9 : 0xbdb9b0);
      else box.add((S.x0 + S.x1) / 2, cy + h / 2, S.z1 - rest / 2, S.x1 - S.x0, h, rest, i % 2 ? 0xc6c2b9 : 0xbdb9b0);
    }
    const sides = dir === '-x' ? [S.z0 + 0.06, S.z1 - 0.06] : [S.x0 + 0.06, S.x1 - 0.06];
    for (const s of sides) {
      const a = dir === '-x' ? new Vector3(S.x1, cy + 0.95, s) : new Vector3(s, cy + 0.95, S.z0);
      const b = dir === '-x' ? new Vector3(S.x0, CLARK_Y + 0.95, s) : new Vector3(s, CLARK_Y + 0.95, S.z1);
      const m = mesh(g, new CylinderGeometry(0.025, 0.025, a.distanceTo(b), 6), lambert(GALV), (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      m.lookAt(b);
      m.rotateX(Math.PI / 2);
      for (const t of [0, 0.5, 1]) box.add(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - 0.47, a.z + (b.z - a.z) * t, 0.05, 0.95, 0.05, GALV);
    }
  };
  flight(CLARK_STAIRS_W, '-x');
  flight(CLARK_STAIRS_S, '+z');
  // the boxwood bed: a low clipped hedge round a little tree
  const H = CLARK_HEDGE;
  box.add((H.x0 + H.x1) / 2, cy + 0.12, (H.z0 + H.z1) / 2, H.x1 - H.x0 + 0.2, 0.24, H.z1 - H.z0 + 0.2, CONCRETE);
  box.add((H.x0 + H.x1) / 2, cy + 0.5, (H.z0 + H.z1) / 2, H.x1 - H.x0, 0.6, H.z1 - H.z0, 0x2f5a26);
  mesh(g, new CylinderGeometry(0.06, 0.09, 3, 6), lambert(0x6b5a48), (H.x0 + H.x1) / 2, cy + 1.6, (H.z0 + H.z1) / 2);
  box.add((H.x0 + H.x1) / 2, cy + 3.4, (H.z0 + H.z1) / 2, 1.8, 1.4, 1.8, 0x7aa83f);
  // the tall piers, rising from the court to the porch roof at the second floor; the roof, flat and dark
  const ptop = CLARK_FLOOR + FLOOR_H + 0.3;
  for (const p of CLARK_PIERS) stoneBox(g, p.x - 0.35, p.x + 0.35, cy, ptop, p.z - 0.35, p.z + 0.35);
  box.add((P.x0 + P.x1) / 2 - 0.2, ptop + 0.22, (P.z0 + P.z1) / 2, P.x1 - P.x0 + 0.8, 0.44, P.z1 - P.z0 + 0.8, 0x474c51);
  box.add((P.x0 + P.x1) / 2 - 0.2, ptop - 0.02, (P.z0 + P.z1) / 2, P.x1 - P.x0 + 0.6, 0.06, P.z1 - P.z0 + 0.6, 0x5a6066);
  // the doors, at court level: a dark recess, glass doors in dark frames, the dark sign panel over them (the photo)
  box.add(D.x - 0.02, cy + 1.4, D.z, 0.06, 2.8, 3.4, 0x1f2326);
  for (const o of [-1.2, -0.42, 0.42, 1.2]) box.add(D.x - 0.06, cy + 1.3, D.z + o, 0.04, 2.6, 0.06, 0x3a3f43);
  box.add(D.x - 0.06, cy + 2.65, D.z, 0.04, 0.08, 3.2, 0x3a3f43);
  for (const o of [-0.12, 0.12]) box.add(D.x - 0.08, cy + 1.2, D.z + o, 0.04, 0.4, 0.04, GALV);
  box.add(D.x - 0.04, cy + 3.3, D.z, 0.03, 0.8, 1.6, 0x1c1f22);
  box.add(D.x - 0.06, cy + 3.3, D.z, 0.02, 0.5, 1.3, 0x6f747a);
  box.add(D.x - 0.08, ptop - 0.3, D.z + 1, 0.1, 0.2, 0.2, 0xf3e3b8); // a light under the porch
  // the yellow side door further along, with a light either side, and a long wooden bench against the wall
  const yz = P.z0 - 2.4;
  box.add(D.x - 0.05, cy + 1.2, yz, 0.08, 2.3, 1.0, 0xe2b93b);
  for (let r = 0; r < 4; r++) box.add(D.x - 0.1, cy + 1.6 - r * 0.3, yz, 0.02, 0.22, 0.7, 0xbcd0d8);
  for (const o of [-0.8, 0.8]) box.add(D.x - 0.1, cy + 2.2, yz + o, 0.1, 0.18, 0.12, 0xf3e3b8);
  box.add(D.x - 0.7, cy + 0.25, P.z1 + 3, 0.7, 0.5, 3.4, 0x6e5a4c);
}

/** East: the narrow tar path, Olin's low limestone wall; south: the lane, cars along it; lamps, the paths west, trees. */
function grounds({ g, box }: Kit) {
  const strip = (x0: number, x1: number, z0: number, z1: number, lift: number, col: number) => {
    const geo = new PlaneGeometry(x1 - x0, z1 - z0, Math.max(2, Math.round((x1 - x0) / 1.5)), Math.max(1, Math.round((z1 - z0) / 2)));
    geo.rotateX(-Math.PI / 2);
    geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) pos.setY(i, groundY(pos.getX(i), pos.getZ(i)) + lift);
    geo.computeVertexNormals();
    const m = new Mesh(geo, lambert(col));
    m.receiveShadow = true;
    g.add(m);
  };
  const L = CLARK_LANE, G = CLARK_GAP, P = CLARK_PATH, W = CLARK_WALK;
  strip(G.x0, G.x1 - 0.02, G.z0, G.z1, 0.03, 0x3e4144); // tar from Clark's wall right up to Olin's (stopping a hair short: past it is Olin's terrace)
  strip(CLARK_UPPER.x0, CLARK_UPPER.x1 + 4, CLARK_UPPER.z0 + 0.2, CLARK_UPPER.z1 + 0.05, 0.03, 0x3e4144); // up behind the wall, by the dumpsters, easing down onto the paved terrace
  lowWay(g, box);
  for (const s of CLARK_STALLS) for (const e of [-1, 1]) box.add(s.x, CLARK_Y + 0.045, s.z + (e * s.w) / 2, s.len, 0.012, 0.1, 0xeeeeea); // white stall lines
  dumpsters(g, box);
  strip(L.x0, L.x1, L.z0, L.z1, 0.031, 0x3e4144); // (the lane is the whole gap, from wall to wall, and on south)
  strip(P.x0, P.x1, P.z0, P.z1, 0.032, 0x3e4144);
  strip(W.x0, W.x1, W.z0, W.z1, 0.033, 0x3e4144);
  // red brick curbs along the lane, and the parking lines on its east side
  for (let z = OLIN.z1 + 4.5; z < L.z1 - 0.5; z += 1) for (const x of [L.x0 - 0.12, L.x1 + 0.12]) box.add(x, groundY(x, z) + 0.08, z, 0.24, 0.16, 1.02, 0x9b4a3a); // (red brick curbs, south of the walls)
  // disc-headed pole lamps
  for (const l of CLARK_LAMPS) {
    const y = groundY(l.x, l.z);
    box.add(l.x, y + 2.2, l.z, 0.12, 4.4, 0.12, 0x2e3236);
    mesh(g, new CylinderGeometry(0.5, 0.42, 0.14, 14), lambert(0x3a3e42), l.x, y + 4.45, l.z);
  }
  // young trees in mulch rings, a few shrubs along the walls
  for (const [i, t] of CLARK_TREES.entries()) {
    const y = groundY(t.x, t.z), s = 0.9 + (i % 3) * 0.15;
    box.add(t.x, y + 0.02, t.z, 1.6, 0.04, 1.6, 0x4b3324);
    mesh(g, new CylinderGeometry(0.08 * s, 0.12 * s, 3.2 * s, 6).translate(0, 1.6 * s, 0), lambert(0x6b5a48), t.x, y, t.z);
    for (const [ox, oy, oz, r] of [[0, 3.6, 0, 1.3], [0.5, 3.0, 0.3, 0.9], [-0.4, 3.2, -0.3, 0.9]]) box.add(t.x + ox * s, y + oy * s, t.z + oz * s, r * s * 1.6, r * s * 1.4, r * s * 1.6, i % 2 ? 0x7aa83f : 0x6a9a3a, i + ox);
  }
  for (const [x, z] of [[CLARK.x0 - 2.2, CLARK.z1 + 1], [CLARK.x0 - 2.2, CLARK.z0 - 1]] as const) box.add(x, groundY(x, z) + 0.45, z, 1.4, 0.9, 1.4, 0x4f7a35, x);
}

/**
 * Two green roll-off dumpsters (the user's photo): a long steel box ribbed down its sides, its back end sloped, a hinged
 * door at the front; one with its lid flung open, one shut; both overflowing — black, grey and white bags heaped over
 * the rim and spilling onto the tar, a few flattened boxes.
 */
function dumpsters(g: Group, box: BoxBank) {
  const GREEN = 0x234a32, DARK = 0x173524;
  DUMPSTERS.forEach((d, n) => {
    const y = CLARK_Y, x0 = d.x - d.w / 2, x1 = d.x + d.w / 2, z0 = d.z - d.len / 2, z1 = d.z + d.len / 2;
    box.add(d.x, y + 0.12, d.z, d.w + 0.1, 0.16, d.len + 0.2, DARK); // the rails it sits on
    box.add(d.x, y + 0.2 + d.h / 2, d.z + 0.4, d.w, d.h, d.len - 0.8, GREEN); // the body
    const slope = new Mesh(new BoxGeometry(d.w, 0.08, Math.hypot(0.8, d.h)), lambert(GREEN)); // the sloped back
    slope.position.set(d.x, y + 0.2 + d.h / 2, z0 + 0.4);
    slope.rotation.x = Math.atan2(0.8, d.h);
    slope.castShadow = true;
    g.add(slope);
    for (let z = z0 + 1.2; z < z1 - 0.2; z += 0.9) for (const x of [x0 - 0.03, x1 + 0.03]) box.add(x, y + 0.2 + d.h / 2, z, 0.08, d.h, 0.1, DARK); // the ribs
    box.add(d.x, y + 0.2 + d.h + 0.04, d.z + 0.4, d.w + 0.12, 0.08, d.len - 0.7, DARK); // the rim
    box.add(d.x, y + 0.2 + d.h / 2, z1 + 0.06, d.w - 0.1, d.h - 0.1, 0.06, GREEN); // the door at the front, its hinges and latch
    for (const yy of [0.5, 1.4]) box.add(x0 + 0.1, y + yy, z1 + 0.1, 0.12, 0.2, 0.1, 0x111);
    box.add(x1 - 0.2, y + 1.0, z1 + 0.12, 0.25, 0.08, 0.06, 0x111);
    box.add(d.x - 0.3, y + 1.2, z1 + 0.1, 1.0, 0.5, 0.02, 0xe9e9e4); // a white name panel on the door
    // the lid: shut, lying on the rim (lifted by the bags under it); or flung open, standing up off the back
    if (d.open) {
      const lid = new Mesh(new BoxGeometry(d.w + 0.1, 0.06, d.len * 0.45), lambert(DARK));
      lid.position.set(d.x, y + 0.2 + d.h + d.len * 0.2, z0 + 0.6);
      lid.rotation.x = -1.2;
      lid.castShadow = true;
      g.add(lid);
    } else {
      const lid = new Mesh(new BoxGeometry(d.w + 0.1, 0.06, d.len - 0.7), lambert(DARK));
      lid.position.set(d.x, y + 0.2 + d.h + 0.32, d.z + 0.4);
      lid.rotation.x = 0.05;
      lid.castShadow = true;
      g.add(lid);
    }
    // the bags: heaped over the rim (on top of the shut one, poking out under its lid), and spilling onto the tar
    const bag = new IcosahedronGeometry(1, 0);
    const cols = [0x1b1c1e, 0x2a2b2e, 0x4a4c50, 0xd9d9d4, 0x1b1c1e, 0x3a5a7a];
    const heap = d.open ? 26 : 12;
    for (let i = 0; i < heap; i++) {
      const r = 0.35 + rng(9100 + n * 50 + i) * 0.3;
      const bx = x0 + 0.3 + rng(9200 + n * 50 + i) * (d.w - 0.6), bz = z0 + 0.9 + rng(9300 + n * 50 + i) * (d.len - 1.5);
      const by = y + 0.2 + d.h + (d.open ? rng(9400 + n * 50 + i) * 0.9 : 0.05);
      const m = new Mesh(bag, lambert(cols[i % cols.length]));
      m.position.set(bx, by, bz);
      m.scale.set(r, r * 0.8, r);
      m.rotation.set(i, i * 2, 0);
      m.castShadow = true;
      g.add(m);
    }
    for (let i = 0; i < 6; i++) { // spilt on the ground round it
      const a = rng(9500 + n * 20 + i) * Math.PI * 2, r = 0.3 + rng(9600 + n * 20 + i) * 0.25;
      const bx = d.x + Math.cos(a) * (d.w / 2 + 0.5), bz = d.z + Math.sin(a) * (d.len / 2 + 0.3);
      const m = new Mesh(bag, lambert(cols[(i + n) % cols.length]));
      m.position.set(bx, y + r * 0.7, bz);
      m.scale.set(r, r * 0.75, r);
      m.castShadow = true;
      g.add(m);
    }
    for (let i = 0; i < 3; i++) box.add(d.x - 0.4 + i * 0.4, y + 0.2 + d.h + 0.6 + i * 0.1, d.z - 1 + i * 0.9, 0.9, 0.05, 0.7, 0xb08a5c, i); // flattened boxes
  });
}

/**
 * The way down to Andrus: the flat tar walk at the field's level between Clark and the tall limestone retaining wall, a
 * gravel strip along Clark's foot, the stairs up at its south end with galvanized rails, the planted bed beside them.
 */
function lowWay(g: Group, box: BoxBank) {
  const L = CLARK_LOW, W = OLIN_LOW_WALL, S = STAIRS_C, B = STAIRS_C_BED;
  const tar = new Mesh(new PlaneGeometry(L.x1 - (L.x0 + 1.2), L.z1 - L.z0), lambert(0x3e4144));
  tar.rotation.x = -Math.PI / 2;
  tar.position.set((L.x0 + 1.2 + L.x1) / 2, 0.03, (L.z0 + L.z1) / 2);
  tar.receiveShadow = true;
  g.add(tar);
  box.add(L.x0 + 0.6, 0.03, (L.z0 + L.z1) / 2, 1.2, 0.04, L.z1 - L.z0, 0x5e5650); // the gravel along Clark's foot
  box.add(L.x0 + 1.25, 0.06, (L.z0 + L.z1) / 2, 0.1, 0.08, L.z1 - L.z0, 0xc9c5bc); // its concrete edge
  // the retaining wall: big pale limestone blocks, its top following the ground behind it, a coping
  for (let z = W.z0; z < W.z1; z += 1) {
    const top = Math.max(0.6, groundY(W.x1 + 0.3, z + 0.5) + 0.2);
    const seg = new Mesh(worldUV(new BoxGeometry(W.x1 - W.x0, top, 1.02), 1.4), lambert(0xd8cfbf));
    seg.position.set((W.x0 + W.x1) / 2, top / 2, z + 0.5);
    seg.castShadow = true; seg.receiveShadow = true;
    g.add(seg);
    box.add((W.x0 + W.x1) / 2, top + 0.05, z + 0.5, W.x1 - W.x0 + 0.14, 0.1, 1.02, 0xe6dfd2);
  }
  // the stairs: concrete, up toward the parking, a galvanized rail each side
  const tread = (S.z1 - S.z0) / S.steps, rise = CLARK_Y / S.steps;
  for (let i = 0; i < S.steps; i++) {
    const h = (i + 1) * rise, rest = S.z1 - S.z0 - i * tread;
    box.add((S.x0 + S.x1) / 2, h / 2, S.z1 - rest / 2, S.x1 - S.x0, h, rest, i % 2 ? 0xc6c2b9 : 0xbdb9b0);
  }
  for (const x of [S.x0 + 0.08, S.x1 - 0.08]) {
    const a = new Vector3(x, 0.95, S.z0), b = new Vector3(x, CLARK_Y + 0.95, S.z1);
    const m = new Mesh(new CylinderGeometry(0.025, 0.025, a.distanceTo(b), 6), lambert(GALV));
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.lookAt(b);
    m.rotateX(Math.PI / 2);
    g.add(m);
    for (const t of [0, 0.34, 0.67, 1]) box.add(x, t * CLARK_Y + 0.47, S.z0 + t * (S.z1 - S.z0), 0.05, 0.95, 0.05, GALV);
  }
  // the bed beside them: a concrete cheek wall, earth, shrubs
  box.add((B.x0 + B.x1) / 2, CLARK_Y / 2, (B.z0 + B.z1) / 2, B.x1 - B.x0, CLARK_Y, B.z1 - B.z0, 0xbcb8af);
  box.add((B.x0 + B.x1) / 2, CLARK_Y + 0.02, (B.z0 + B.z1) / 2, B.x1 - B.x0 - 0.1, 0.04, B.z1 - B.z0 - 0.1, 0x4b3324);
  for (let i = 0; i < 6; i++) box.add(B.x0 + 0.5 + (i % 2) * 0.9, CLARK_Y + 0.45, B.z0 + 0.6 + i * 0.9, 0.9, 0.9, 0.9, i % 3 ? 0x4f7a35 : 0x3f6a2c, i);
}
