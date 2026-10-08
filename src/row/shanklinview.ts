import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshLambertMaterial, PlaneGeometry, TorusGeometry, Vector3 } from 'three';
import { BoxBank, Facing, PAVER_TILE, WindowBank, WindowKind, block, brickMap, hipRoof, lambert, paverMap, stoneMap, worldUV } from './kit';
import {
  EXLEY_GAP, EXLEY_GAP_STAIRS, SHANK_SAPLINGS, SHANK_SLANT, HA_BLOCK, HALL_ATWATER, SHANK_BALCONY, SHANK_DOOR, SHANK_FENCE, SHANK_STAIR, SHANK_STEPS, SHANK_Y, SHANKLIN, groundY,
} from './southend';

// ─── Shanklin Hall and Hall-Atwater: draws what southend.ts lays out ───
// From the user's photos (2026-10-08). Shanklin: red brick on a raised basement of darker brick; giant white pilasters at
// the corners; a white water table, a white band under the second floor's windows, white tablets between the second and
// third; tall white six-over-six windows with white lintels, the ground floor's under brick arches each with a round white
// medallion; the arched white doorway with its fanlight in the middle of the west front, up steps with iron rails; a heavy
// white cornice and balustrade; a grey slate hip roof with round "eyebrow" dormers, rooftop plant behind yellow rails. On
// the street end: four bays, an arched door onto a balcony on brackets with an iron rail and a stair down, an oculus over
// it. Hall-Atwater: a rough brownstone base, two storeys of dark glass in white frames, a dark top band, a brick block at
// its east end, and rows of white exhaust stacks.

type Kit = { g: Group; win: WindowBank; box: BoxBank };

const WHITE = 0xf0ece2, BRICK = 0x8e3f30, IRON = 0x16191b, Y = SHANK_Y;

function mesh(g: Group, geo: BoxGeometry | CylinderGeometry | PlaneGeometry | TorusGeometry, color: number, x: number, y: number, z: number) {
  const m = new Mesh(geo, lambert(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

export function buildShanklin(k: Kit) {
  // the two buildings at their slight angle to the street, turned about Shanklin's middle
  const turned = new Group(), cx = (SHANKLIN.x0 + SHANKLIN.x1) / 2, cz = (SHANKLIN.z0 + SHANKLIN.z1) / 2;
  turned.position.set(cx, 0, cz);
  turned.rotation.y = SHANK_SLANT;
  const inner = new Group();
  inner.position.set(-cx, 0, -cz);
  turned.add(inner);
  k.g.add(turned);
  const bank = new BoxBank(), c = Math.cos(SHANK_SLANT), sn = Math.sin(SHANK_SLANT);
  const ANG: Record<Facing, number> = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 };
  // the world's window bank, turned the same way (its windows are lit and painted with everyone else's)
  const win = { add: (kind: WindowKind, x: number, y: number, z: number, w: number, h: number, f: Facing | number) => {
    const dx = x - cx, dz = z - cz;
    k.win.add(kind, cx + dx * c + dz * sn, y, cz - dx * sn + dz * c, w, h, (typeof f === 'number' ? f : ANG[f]) + SHANK_SLANT);
  } } as unknown as WindowBank;
  const kk = { g: inner, box: bank, win };
  shanklin(kk);
  hallAtwater(kk);
  inner.add(bank.build());
  // little trees on its bank, inside the fence
  for (const [i, t] of SHANK_SAPLINGS.entries()) {
    const y = groundY(t.x, t.z), s = 0.7 + (i % 3) * 0.15;
    k.box.add(t.x, y + 1.0 * s, t.z, 0.12, 2.0 * s, 0.12, 0x5a4434);
    k.box.add(t.x, y + 2.4 * s, t.z, 1.6 * s, 1.5 * s, 1.6 * s, i % 2 ? 0x6a9a3a : 0x5a8a35, i);
  }
  fence(k);
  gap(k);
}

/** The construction fence: posts, chain link screened in black, a gate on the street side, a couple of signs. */
function fence({ box }: Kit) {
  const F = SHANK_FENCE, h = 2.0;
  const run = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 3)), alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = groundY(x, z);
      box.add(x, y + h / 2 + 0.05, z, alongX ? len / n - 0.08 : 0.04, h, alongX ? 0.04 : len / n - 0.08, 0x141516); // the black screen
    }
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = groundY(x, z);
      box.add(x, y + (h + 0.2) / 2, z, 0.07, h + 0.2, 0.07, 0x9aa0a4); // galvanized posts
      box.add(x, y + 0.08, z, 0.5, 0.16, 0.3, 0x5a5d60); // their stands
    }
    const y = groundY((x0 + x1) / 2, (z0 + z1) / 2);
    box.add((x0 + x1) / 2, y + h + 0.12, (z0 + z1) / 2, alongX ? len : 0.05, 0.05, alongX ? 0.05 : len, 0x9aa0a4); // the top rail
  };
  run(F.x0, F.z0, F.x1, F.z0);
  run(F.x0, F.z1, F.x1, F.z1);
  run(F.x0, F.z0, F.x0, F.z1);
  run(F.x1, F.z0, F.x1, F.z1);
  for (const [x, c] of [[F.x0 + 6, 0xe9e9e4], [F.x0 + 18, 0xd8322a], [F.x1 - 8, 0xe9e9e4]] as const) { // signs on it
    box.add(x, groundY(x, F.z0) + 1.2, F.z0 - 0.06, 0.9, 0.7, 0.02, c);
    box.add(x, groundY(x, F.z0) + 1.2, F.z0 - 0.08, 0.6, 0.08, 0.01, 0x1c1c1c);
  }
}

/**
 * Between Exley and Shanklin (the user's street view): a wide concrete walk in from the sidewalk, three broad low steps, a
 * landing, three more, up to interlocking pavers at Exley's level; clipped hedges either side, no side walls.
 */
function gap({ g, box }: Kit) {
  const S = EXLEY_GAP_STAIRS, P = EXLEY_GAP, cx = (S.x0 + S.x1) / 2, w = S.x1 - S.x0;
  const at = (z: number) => groundY(cx, z);
  // the walk in and the landing: concrete slabs on the ground, joints across
  for (const [z0, z1] of [S.approach, S.landing]) { // one smooth slab each, following the ground (no false steps)
    const geo = new PlaneGeometry(w, z1 - z0, 1, 12);
    geo.rotateX(-Math.PI / 2);
    geo.translate(cx, 0, (z0 + z1) / 2);
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) pos.setY(i, at(Math.min(z1 - 0.01, Math.max(z0 + 0.01, pos.getZ(i)))) + 0.04);
    geo.computeVertexNormals();
    const m = new Mesh(geo, lambert(0xc8c3b9));
    m.receiveShadow = true;
    g.add(m);
    for (let z = z0 + 1.6; z < z1 - 0.3; z += 1.6) box.add(cx, at(z) + 0.05, z, w, 0.01, 0.04, 0x9e998f); // the joints
    box.add(cx, at(z0 + 0.3) - 0.2, (z0 + z1) / 2, w, 0.4, z1 - z0, 0xb9b4aa); // (its body, under it)
  }
  // the two flights: broad low steps, a darker nosing on each
  for (const f of [S.flight1, S.flight2]) {
    const tread = (f[1] - f[0]) / S.steps;
    for (let i = 0; i < S.steps; i++) {
      const z = f[0] + (i + 0.5) * tread, y = at(z), base = at(f[0] - 0.05);
      box.add(cx, (base + y) / 2 - 0.1, z, w, y - base + 0.4, tread + 0.01, i % 2 ? 0xc6c2b9 : 0xbdb9b0);
      box.add(cx, y + 0.03, z - tread / 2 + 0.04, w, 0.04, 0.08, 0x8f8a82);
    }
  }
  // clipped hedges either side, the length of it
  for (let z = S.z0 + 0.8; z < S.z1; z += 1.4) for (const x of [S.x0 - 0.7, S.x1 + 0.6]) box.add(x, at(z) + 0.45, z, 1.1, 0.9, 1.4, 0x3f6a2c, 0);
  const tex = paverMap().clone();
  tex.needsUpdate = true;
  tex.repeat.set((P.x1 - P.x0) / PAVER_TILE, (P.z1 - P.z0) / PAVER_TILE);
  const top = groundY((P.x0 + P.x1) / 2, P.z0 + 0.5);
  const pav = new Mesh(new PlaneGeometry(P.x1 - P.x0, P.z1 - P.z0), new MeshLambertMaterial({ map: tex }));
  pav.rotation.x = -Math.PI / 2;
  pav.position.set((P.x0 + P.x1) / 2, top + 0.035, (P.z0 + P.z1) / 2);
  pav.receiveShadow = true;
  g.add(pav);
}

/**
 * A white-framed six-over-six window on a wall facing `f` at (x, y, z), w × h, a white lintel with a keystone; or (arch)
 * under a brick arch with a round white medallion in its head.
 */
function sash(k: Kit, x: number, y: number, z: number, f: Facing, w: number, h: number, arch = false) {
  const { win, box, g } = k;
  const n = f === '+z' ? 1 : f === '-z' ? -1 : 0, e = f === '+x' ? 1 : f === '-x' ? -1 : 0, along = n !== 0;
  const sx = (a: number, b: number) => (along ? a : b), sz = (a: number, b: number) => (along ? b : a);
  win.add('rect', x + e * 0.03, y, z + n * 0.03, w, h, f);
  for (const o of [-w / 3, w / 3]) box.add(x + (along ? o : e * 0.06), y, z + (along ? n * 0.06 : o), 0.05, h, 0.05, WHITE); // muntins
  for (const o of [-h / 4, 0, h / 4]) box.add(x + e * 0.06, y + o, z + n * 0.06, sx(w, 0.05), o === 0 ? 0.09 : 0.05, sz(w, 0.05), WHITE);
  for (const s of [-1, 1]) box.add(x + (along ? (s * (w + 0.1)) / 2 : e * 0.08), y, z + (along ? n * 0.08 : (s * (w + 0.1)) / 2), sx(0.12, 0.1), h + 0.1, sz(0.12, 0.1), WHITE); // frame
  box.add(x + e * 0.1, y - h / 2 - 0.1, z + n * 0.1, sx(w + 0.4, 0.22), 0.14, sz(w + 0.4, 0.22), WHITE); // sill
  if (!arch) {
    box.add(x + e * 0.08, y + h / 2 + 0.22, z + n * 0.08, sx(w + 0.5, 0.16), 0.3, sz(w + 0.5, 0.16), WHITE); // lintel
    box.add(x + e * 0.12, y + h / 2 + 0.24, z + n * 0.12, sx(0.36, 0.2), 0.4, sz(0.36, 0.2), WHITE); // keystone
    return;
  }
  // the brick arch over it, a white keystone, the round medallion in the tympanum
  const r = w / 2 + 0.25, cy = y + h / 2 + 0.05;
  const ring = mesh(g, new TorusGeometry(r, 0.13, 4, 14, Math.PI), 0x7a3428, x + e * 0.06, cy, z + n * 0.06);
  ring.rotation.y = along ? 0 : Math.PI / 2;
  box.add(x + e * 0.04, cy + r * 0.45, z + n * 0.04, sx(w, 0.04), r * 0.9, sz(w, 0.04), 0x9a4434);
  const med = mesh(g, new CylinderGeometry(0.28, 0.28, 0.08, 16), WHITE, x + e * 0.09, cy + r * 0.45, z + n * 0.09);
  med.rotation.set(along ? Math.PI / 2 : 0, 0, along ? 0 : Math.PI / 2);
  box.add(x + e * 0.1, cy + r + 0.05, z + n * 0.1, sx(0.3, 0.2), 0.4, sz(0.3, 0.2), WHITE);
}

function shanklin(k: Kit) {
  const { g, box, win } = k, B = SHANKLIN, w = B.x1 - B.x0, d = B.z1 - B.z0, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
  const f0 = Y + B.base, top = f0 + B.floors * B.fh; // the ground floor, and the top of the walls
  const brick = lambert(BRICK, brickMap(), 'shanklin');
  const body = new Mesh(block(w, top - Y + 0.4, d), brick);
  body.position.set(cx, Y - 0.4, cz);
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  box.add(cx, Y + (B.base - 0.2) / 2, cz, w + 0.12, B.base - 0.2, d + 0.12, 0x7a3428); // the basement's darker brick
  box.add(cx, f0 - 0.1, cz, w + 0.25, 0.2, d + 0.25, WHITE); // the water table
  box.add(cx, f0 + B.fh + 0.25, cz, w + 0.2, 0.22, d + 0.2, WHITE); // the band under the second floor's windows
  // giant white pilasters at the corners, the full height, with capitals
  for (const [x, z] of [[B.x0, B.z0], [B.x1, B.z0], [B.x0, B.z1], [B.x1, B.z1]]) {
    box.add(x, (Y + top) / 2, z, 1.5, top - Y, 1.5, WHITE);
    box.add(x, top - 0.6, z, 1.8, 0.5, 1.8, WHITE);
  }
  // the heavy white cornice, its dentils, the balustrade over it
  box.add(cx, top + 0.3, cz, w + 1.6, 0.6, d + 1.6, WHITE);
  box.add(cx, top - 0.1, cz, w + 1.1, 0.3, d + 1.1, 0xe2ddd2);
  for (let z = B.z0; z <= B.z1; z += 0.5) box.add(B.x0 - 0.5, top - 0.3, z, 0.18, 0.18, 0.18, WHITE);
  const by = top + 0.6;
  box.add(cx, by + 0.12, cz, w + 1.2, 0.24, d + 1.2, WHITE);
  box.add(cx, by + 1.0, cz, w + 1.3, 0.14, d + 1.3, WHITE);
  for (let z = B.z0 - 0.6; z <= B.z1 + 0.6; z += 0.36) for (const x of [B.x0 - 0.6, B.x1 + 0.6]) box.add(x, by + 0.58, z, 0.14, 0.7, 0.14, 0xe2ddd2);
  for (let x = B.x0 - 0.6; x <= B.x1 + 0.6; x += 0.36) for (const z of [B.z0 - 0.6, B.z1 + 0.6]) box.add(x, by + 0.58, z, 0.14, 0.7, 0.14, 0xe2ddd2);
  for (let z = B.z0; z <= B.z1; z += 6.3) for (const x of [B.x0 - 0.6, B.x1 + 0.6]) box.add(x, by + 0.55, z, 0.5, 1.1, 0.5, WHITE); // piers
  // the slate hip roof, its round dormers, the plant on top behind yellow rails
  const roof = new Mesh(hipRoof(w - 0.4, 4.2, d - 0.4), lambert(0x8a8f92));
  roof.position.set(cx, by, cz);
  roof.castShadow = true;
  g.add(roof);
  for (let z = B.z0 + 4; z < B.z1 - 3; z += 5.3) {
    const x = B.x0 + 1.9, dy = by + 1.3;
    box.add(x, dy, z, 1.4, 1.2, 1.4, 0xe9e5dc);
    const hood = mesh(g, new CylinderGeometry(0.75, 0.75, 1.5, 12, 1, false, 0, Math.PI), 0x7c8285, x - 0.05, dy + 0.55, z);
    hood.rotation.set(0, 0, Math.PI / 2);
    win.add('arch', x - 0.72, dy + 0.1, z, 0.8, 0.9, '-x');
  }
  for (const [dx, dz, sx, sz] of [[0, -8, 4, 3], [1, 2, 3, 5], [-1, 12, 2.5, 2.5]]) box.add(cx + dx, by + 4.4, cz + dz, sx, 1.6, sz, 0xb8bcbe);
  for (const z of [cz - 12, cz + 16]) {
    box.add(cx, by + 5.2, z, 5, 0.06, 0.06, 0xe0c03a);
    for (const dx of [-2.5, 2.5]) box.add(cx + dx, by + 4.7, z, 0.06, 1.0, 0.06, 0xe0c03a);
  }
  for (const [dx, dz] of [[2, -14], [-2, 6], [1.5, 18]]) mesh(g, new CylinderGeometry(0.15, 0.15, 3, 8), 0xdcdcdc, cx + dx, by + 5.5, cz + dz);

  // the west front: thirteen bays, the door in the middle
  const bays = 13, pitch = (d - 3) / bays, f1 = f0 + 1.75, f2 = f0 + B.fh + 1.85, f3 = f0 + 2 * B.fh + 1.75;
  for (let i = 0; i < bays; i++) {
    const z = B.z0 + 1.5 + (i + 0.5) * pitch, mid = Math.abs(z - SHANK_DOOR.z) < pitch / 2;
    if (!mid) sash(k, B.x0 - 0.02, f1, z, '-x', 1.25, 2.3, true);
    sash(k, B.x0 - 0.02, f2, z, '-x', 1.25, 2.3);
    sash(k, B.x0 - 0.02, f3, z, '-x', 1.2, 1.9);
    if (i < bays - 1) box.add(B.x0 - 0.06, f2 + 1.65, z + pitch / 2, 0.1, 0.35, 0.8, WHITE); // the tablets between
    win.add('rect', B.x0 - 0.03, Y + 0.85, z, 1.0, 0.7, '-x'); // basement windows
    // and the same along the back
    sash(k, B.x1 + 0.02, f2, z, '+x', 1.25, 2.3);
    sash(k, B.x1 + 0.02, f3, z, '+x', 1.2, 1.9);
  }
  // the doorway: a white arched surround, its fanlight, glazed double doors, the steps up with iron rails
  const D = SHANK_DOOR, dTop = f0 + 3.0;
  box.add(B.x0 - 0.12, (f0 + dTop) / 2, D.z, 0.24, dTop - f0 + 0.2, 2.8, WHITE);
  const arch = mesh(g, new TorusGeometry(1.15, 0.22, 4, 16, Math.PI), WHITE, B.x0 - 0.18, dTop, D.z);
  arch.rotation.y = Math.PI / 2;
  win.add('arch', B.x0 - 0.2, dTop - 0.05, D.z, 1.9, 1.7, '-x');
  box.add(B.x0 - 0.25, f0 + 1.3, D.z, 0.06, 2.6, 1.7, 0xeeeae0);
  for (const o of [-0.4, 0.4]) win.add('rect', B.x0 - 0.29, f0 + 1.5, D.z + o, 0.55, 1.8, '-x');
  box.add(B.x0 - 0.3, f0 + 0.6, D.z, 0.03, 1.2, 0.05, 0xd0ccc2);
  const S = SHANK_STEPS, tread = (S.x1 - S.landing - S.x0) / S.steps, rise = B.base / S.steps;
  for (let i = 0; i < S.steps; i++) box.add(S.x0 + (i + 0.5) * tread, Y + ((i + 1) * rise) / 2, (S.z0 + S.z1) / 2, tread + 0.01, (i + 1) * rise, S.z1 - S.z0, i % 2 ? 0xc9c5bc : 0xbfbbb2);
  box.add(S.x1 - S.landing / 2, Y + B.base / 2, (S.z0 + S.z1) / 2, S.landing, B.base, S.z1 - S.z0, 0xc9c5bc); // the landing at the door
  for (const z of [S.z0 + 0.05, S.z1 - 0.05]) {
    const a = new Vector3(S.x0, Y + 0.95, z), b = new Vector3(S.x1 - S.landing, f0 + 0.95, z), r = mesh(g, new BoxGeometry(0.05, 0.05, a.distanceTo(b)), IRON, (a.x + b.x) / 2, (a.y + b.y) / 2, z);
    r.lookAt(b);
    for (const t of [0, 0.5, 1]) box.add(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - 0.47, z, 0.04, 0.95, 0.04, IRON);
  }
  // the street end (north): four bays; the middle, an arched door onto the balcony and a round window over it
  for (const [dx, arched] of [[-5.2, false], [-2.6, false], [2.6, false], [5.2, false]] as const) {
    sash(k, cx + dx, f1, B.z0 - 0.02, '-z', 1.3, 2.2, arched);
    sash(k, cx + dx, f2 + 0.2, B.z0 - 0.02, '-z', 1.3, 2.3);
    win.add('rect', cx + dx, Y + 0.85, B.z0 - 0.03, 1.1, 0.8, '-z');
  }
  win.add('arch', cx, f1 + 0.5, B.z0 - 0.03, 1.3, 3.2, '-z');
  const fan = mesh(g, new TorusGeometry(0.75, 0.12, 4, 14, Math.PI), WHITE, cx, f1 + 1.4, B.z0 - 0.08);
  fan.rotation.z = 0;
  const ocu = mesh(g, new TorusGeometry(0.55, 0.12, 6, 18), WHITE, cx, f2 + 0.6, B.z0 - 0.06);
  ocu.castShadow = false;
  win.add('rect', cx, f2 + 0.6, B.z0 - 0.04, 0.8, 0.8, '-z');
  for (const dx of [-0.7, 0.7]) box.add(cx + dx, f2 + 0.6, B.z0 - 0.1, 0.18, 0.4, 0.1, WHITE);
  for (const dx of [-4, -1.3, 1.3, 4]) box.add(cx + dx, f2 + 1.9, B.z0 - 0.06, 0.9, 0.3, 0.1, WHITE); // tablets
  // the balcony on its brackets, its iron rail, the stair down along the wall, the basement door under it
  const Bl = SHANK_BALCONY, Sr = SHANK_STAIR;
  box.add((Bl.x0 + Bl.x1) / 2, f0 - 0.1, (Bl.z0 + Bl.z1) / 2, Bl.x1 - Bl.x0, 0.2, Bl.z1 - Bl.z0, WHITE);
  for (const x of [Bl.x0 + 0.4, (Bl.x0 + Bl.x1) / 2, Bl.x1 - 0.4]) box.add(x, f0 - 0.6, Bl.z0 + 0.4, 0.2, 0.8, 0.5, WHITE); // brackets
  box.add((Bl.x0 + Bl.x1) / 2, f0 + 0.95, Bl.z0 + 0.05, Bl.x1 - Bl.x0, 0.05, 0.05, IRON);
  for (let x = Bl.x0; x <= Bl.x1; x += 0.15) box.add(x, f0 + 0.5, Bl.z0 + 0.05, 0.03, 0.9, 0.03, IRON);
  const n = 9, tr = (Sr.x1 - Sr.x0) / n;
  for (let i = 0; i < n; i++) box.add(Sr.x0 + (i + 0.5) * tr, f0 - (i + 1) * (B.base / n) + 0.1, (Sr.z0 + Sr.z1) / 2, tr, 0.12, Sr.z1 - Sr.z0, WHITE);
  const sa = new Vector3(Sr.x0, f0 + 0.95, Sr.z0 + 0.05), sb = new Vector3(Sr.x1, Y + 0.95, Sr.z0 + 0.05);
  const sr = mesh(g, new BoxGeometry(0.05, 0.05, sa.distanceTo(sb)), IRON, (sa.x + sb.x) / 2, (sa.y + sb.y) / 2, sa.z);
  sr.lookAt(sb);
  const string = mesh(g, new BoxGeometry(0.25, 0.3, sa.distanceTo(sb)), WHITE, (sa.x + sb.x) / 2, (sa.y + sb.y) / 2 - 1.1, sa.z);
  string.lookAt(sb.x, sb.y - 1.1, sb.z);
  box.add(cx, Y + 1.0, B.z0 - 0.04, 1.0, 2.0, 0.06, 0xeeeae0); // the basement door, white
  for (let x = cx - 0.6; x <= cx + 0.6; x += 0.15) box.add(x, Y + 0.45, B.z0 - 0.6, 0.03, 0.9, 0.03, IRON); // a little rail by it
  // round clipped trees in front, shrubs along the base
  for (const z of [SHANK_DOOR.z - 9, SHANK_DOOR.z + 9]) {
    const x = B.x0 - 4.5, y = groundY(x, z);
    mesh(g, new CylinderGeometry(0.1, 0.14, 1.6, 6), 0x5a4434, x, y + 0.8, z);
    const ball = mesh(g, new CylinderGeometry(1.3, 1.3, 2.2, 10), 0x5a8a35, x, y + 2.5, z);
    ball.scale.set(1, 1, 1);
  }
  for (let z = B.z0 + 3; z < B.z1 - 2; z += 2.2) if (Math.abs(z - SHANK_DOOR.z) > 3) box.add(B.x0 - 0.9, Y + 0.4, z, 1.1, 0.8, 1.6, 0x4f7a35, z);
}

/** Hall-Atwater: a brownstone base, two storeys of dark glass in white frames, a dark top band, the brick block at its east end, exhaust stacks. */
function hallAtwater(k: Kit) {
  const { g, box, win } = k, H = HALL_ATWATER, Bk = HA_BLOCK, cz = (H.z0 + H.z1) / 2;
  const base = 3.4, glassTop = base + 6.2;
  const stone = new Mesh(worldUV(new BoxGeometry(Bk.x0 - H.x0, base, H.z1 - H.z0), 1.6), lambert(0x8e6e60, stoneMap(), 'haBase'));
  stone.position.set((H.x0 + Bk.x0) / 2, Y + base / 2, cz);
  stone.castShadow = stone.receiveShadow = true;
  g.add(stone);
  const core = new Mesh(block(Bk.x0 - H.x0 - 0.6, H.h - base, H.z1 - H.z0 - 0.6), lambert(0x2c2a28));
  core.position.set((H.x0 + Bk.x0) / 2, Y + base, cz);
  g.add(core);
  box.add((H.x0 + Bk.x0) / 2, Y + glassTop + (H.h - glassTop) / 2, cz, Bk.x0 - H.x0, H.h - glassTop, H.z1 - H.z0, 0x3e3934); // the dark top band
  box.add((H.x0 + Bk.x0) / 2, Y + H.h + 0.05, cz, Bk.x0 - H.x0 + 0.2, 0.1, H.z1 - H.z0 + 0.2, 0x2a2826);
  // the curtain wall on its three open faces: dark glass, white frames (verticals every 3 m, a frame round each storey)
  const face = (axis: 'x' | 'z', at: number, out: number, a: number, b: number) => {
    const n = Math.round((b - a) / 3), step = (b - a) / n, f: Facing = axis === 'x' ? (out > 0 ? '+z' : '-z') : out > 0 ? '+x' : '-x';
    for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) {
      const u = a + (i + 0.5) * step, y = Y + base + 1.55 + j * 3.1;
      win.add('rect', axis === 'x' ? u : at + out * 0.02, y, axis === 'x' ? at + out * 0.02 : u, step - 0.25, 2.9, f);
    }
    for (let i = 0; i <= n; i++) { const u = a + i * step; box.add(axis === 'x' ? u : at + out * 0.06, Y + (base + glassTop) / 2, axis === 'x' ? at + out * 0.06 : u, 0.22, glassTop - base, 0.22, WHITE); }
    for (const y of [base, base + 3.1, glassTop]) box.add(axis === 'x' ? (a + b) / 2 : at + out * 0.06, Y + y, axis === 'x' ? at + out * 0.06 : (a + b) / 2, axis === 'x' ? b - a : 0.2, 0.2, axis === 'x' ? 0.2 : b - a, WHITE);
  };
  face('x', H.z0, -1, H.x0 + 0.5, Bk.x0);
  face('x', H.z1, 1, H.x0 + 0.5, Bk.x0);
  // the brick block at the east end, plain, taller
  const brick = new Mesh(block(Bk.x1 - Bk.x0, Bk.h, Bk.z1 - Bk.z0), lambert(0x6f3a2e, brickMap(), 'haBrick'));
  brick.position.set((Bk.x0 + Bk.x1) / 2, Y, cz);
  brick.castShadow = brick.receiveShadow = true;
  g.add(brick);
  box.add((Bk.x0 + Bk.x1) / 2, Y + Bk.h + 0.1, cz, Bk.x1 - Bk.x0 + 0.2, 0.2, Bk.z1 - Bk.z0 + 0.2, 0x5a2f26);
  // rows of white exhaust stacks on the roof, in clusters, on little frames; a yellow rail along the front
  const stack = new CylinderGeometry(0.22, 0.22, 1, 8);
  for (let x = H.x0 + 2.5; x < Bk.x0 - 1; x += 2.6) for (const zc of [H.z0 + 5, cz, H.z1 - 5]) {
    for (let s = 0; s < 3; s++) {
      const h = 3 + ((x * 7 + s * 3 + zc) % 3);
      const m = mesh(g, stack, 0xe8ebec, x + (s - 1) * 0.5, Y + H.h + h / 2, zc);
      m.scale.y = h;
    }
    box.add(x, Y + H.h + 0.4, zc, 1.8, 0.8, 0.8, 0xc8cccd);
  }
  box.add((H.x0 + Bk.x0) / 2, Y + H.h + 1.0, H.z0 + 1, Bk.x0 - H.x0 - 2, 0.06, 0.06, 0xe0c03a);
}
