import {
  BoxGeometry, BufferGeometry, CanvasTexture, CircleGeometry, Color, CylinderGeometry, Group, Material, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace, TorusGeometry, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BoxBank, Facing, WindowBank, block, brickMap, hipRoof, lambert, prism } from './kit';
import {
  FLAGPOLE, LAWN_WALKS, OLIN, OLIN_BENCHES, OLIN_COLUMNS, OLIN_DOOR, OLIN_FRONT_WALK, OLIN_LAMPS, OLIN_LINK, OLIN_RISE,
  OLIN_SIGN, OLIN_STEPS, OLIN_Y, PORTICO_O, STAIRS_O, TERRACE_Y,
} from './southend';

// ─── Olin Memorial Library: draws what southend.ts lays out ────────────
// From the user's photos (2026-10-07). The old building faces south across its lawn: a brick block on a high white
// marble base, giant marble pilasters, tall many-paned windows, a deep cornice with dentils, a balustrade, a grey-green
// hip roof with dormers; in the middle a portico of six fluted Ionic columns under a pediment with an oval window and
// OLIN MEMORIAL LIBRARY cut in the frieze, up ten broad marble steps with black iron handrails; behind the columns the
// tall arched doorway, bronze doors and a fanlight, a lantern hanging in front of it, gold medallions. Its back is the
// half drum of tall arched windows facing the field. Its grounds stand a little higher than the bank (a low marble
// retaining wall, a small flight up from the walk from the Pruzan), and the lawn in front has its walks, benches and lamps.

type Kit = { g: Group; win: WindowBank; box: BoxBank };

const Y = TERRACE_Y; // the building stands on the bank; its grounds are raised round it
const MARBLE = 0xeeebe3, MARBLE_SHADE = 0xdcd8ce, BRICK = 0x9a4636, IRON = 0x16191b;

// lit after dark: the door's glass and fanlight, the lantern in the portico, the lamps on the lawn
let glow: MeshBasicMaterial | null = null;
export function olinNight(night: number) {
  const on = Math.min(1, Math.max(0, (night - 0.25) / 0.5));
  glow?.color.copy(new Color(0x2a3036).lerp(new Color(0xffd590), on));
}

function mesh(g: Group, geo: BufferGeometry, mat: Material | Material[], x = 0, y = 0, z = 0) {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

let slabTex: CanvasTexture | null = null;
/** Square concrete slabs with dark joints, one tile a slab (the walks across the lawn). */
function slabs(w: number, l: number) {
  if (!slabTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    x.fillStyle = '#cbc5b9'; x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#a49d90'; x.fillRect(0, 0, 64, 2); x.fillRect(0, 0, 2, 64);
    slabTex = new CanvasTexture(c);
    slabTex.wrapS = slabTex.wrapT = RepeatWrapping;
    slabTex.colorSpace = SRGBColorSpace;
  }
  const t = slabTex.clone();
  t.needsUpdate = true;
  t.repeat.set(w / 1.5, l / 1.5);
  return new MeshLambertMaterial({ map: t });
}

/** The frieze's inscription: carved letters, a shade darker than the marble. */
function inscription(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#eeebe3'; g.fillRect(0, 0, 1024, 64);
  g.fillStyle = '#9d988c'; g.font = '600 34px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('O L I N   M E M O R I A L   L I B R A R Y', 512, 34);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function buildOlin(k: Kit) {
  glow = new MeshBasicMaterial({ color: 0x2a3036 });
  building(k);
  drum(k);
  portico(k);
  steps(k);
  grounds(k);
  flagpole(k);
}

/** A tall many-paned window in a white frame, a white cornice cap over it. Facing `f` (a side), centred at (x, y, z). */
function tallWindow({ win, box }: Kit, x: number, y: number, z: number, w: number, h: number, f: Facing, cols = 4, rows = 8) {
  const n = f === '+z' ? 1 : f === '-z' ? -1 : 0, e = f === '+x' ? 1 : f === '-x' ? -1 : 0;
  const along = (o: number) => ({ x: x + (n ? o : 0), z: z + (e ? o : 0) }); // a point o along the wall
  const sx = (a: number, b: number) => (n ? a : b), sz = (a: number, b: number) => (n ? b : a);
  win.add('rect', x + e * 0.03, y, z + n * 0.03, w, h, f);
  const out = (d: number) => ({ dx: e * d, dz: n * d });
  const o1 = out(0.08), o2 = out(0.14), o3 = out(0.2);
  for (const s of [-1, 1]) { const p = along((s * (w + 0.3)) / 2); box.add(p.x + o1.dx, y, p.z + o1.dz, sx(0.3, 0.16), h + 0.3, sz(0.3, 0.16), MARBLE); } // jambs
  box.add(x + o1.dx, y - h / 2 - 0.12, z + o1.dz, sx(w + 0.6, 0.3), 0.24, sz(w + 0.6, 0.3), MARBLE); // sill
  box.add(x + o2.dx, y + h / 2 + 0.3, z + o2.dz, sx(w + 0.9, 0.36), 0.3, sz(w + 0.9, 0.36), MARBLE); // the cornice cap…
  box.add(x + o3.dx, y + h / 2 + 0.5, z + o3.dz, sx(w + 1.1, 0.4), 0.12, sz(w + 1.1, 0.4), MARBLE); // …and its lip
  for (let i = 1; i < cols; i++) { const p = along(-w / 2 + (w * i) / cols); box.add(p.x + e * 0.05, y, p.z + n * 0.05, sx(0.06, 0.05), h, sz(0.06, 0.05), 0xf4f2ec); } // muntins
  for (let j = 1; j < rows; j++) box.add(x + e * 0.05, y - h / 2 + (h * j) / rows, z + n * 0.05, sx(w, 0.05), j === Math.round(rows * 0.7) ? 0.12 : 0.05, sz(w, 0.05), 0xf4f2ec);
}

/** The old building: brick on a high marble base, pilasters, the front's tall windows, cornice and dentils, balustrade, hip roof and dormers. */
function building(k: Kit) {
  const { g, win, box } = k, { cx, cz, h, x0, x1, z1 } = OLIN;
  const brick = lambert(BRICK, brickMap(), 'frank');
  const bw = x1 - x0, bd = z1 - cz, bcx = (x0 + x1) / 2, bcz = (cz + z1) / 2, base = 3.0;
  mesh(g, block(bw, h, bd), brick, bcx, Y, bcz);
  box.add(bcx, Y + base / 2, bcz, bw + 0.4, base, bd + 0.4, MARBLE); // the high marble base…
  box.add(bcx, Y + base + 0.1, bcz, bw + 0.6, 0.2, bd + 0.6, MARBLE_SHADE); // …its moulding
  for (let x = x0 + 2.5; x < x1 - 1.5; x += 3.35) { // small basement windows in it, along the front (not behind the portico)
    if (x > PORTICO_O.x0 - 0.8 && x < PORTICO_O.x1 + 0.8) continue;
    win.add('rect', x, Y + 1.9, z1 + 0.23, 1.3, 0.8, '+z');
  }
  box.add(bcx, Y + 10.3, bcz, bw + 0.3, 0.35, bd + 0.3, MARBLE); // the band under the attic
  // the deep cornice, a row of dentils under it
  box.add(bcx, Y + h - 0.35, bcz, bw + 1.4, 0.5, bd + 1.4, MARBLE);
  box.add(bcx, Y + h - 0.75, bcz, bw + 0.9, 0.3, bd + 0.9, MARBLE_SHADE);
  for (let x = x0 - 0.3; x <= x1 + 0.3; x += 0.42) box.add(x, Y + h - 0.95, z1 + 0.42, 0.2, 0.22, 0.2, MARBLE);
  // the giant pilasters (corners, and between the bays of each wing), with capitals
  const wingL = [x0, (x0 + PORTICO_O.x0) / 2, PORTICO_O.x0 + 0.5], wingR = [PORTICO_O.x1 - 0.5, (PORTICO_O.x1 + x1) / 2, x1];
  for (const px of [...wingL, ...wingR]) {
    box.add(px, Y + (base + h - 1) / 2, z1 + 0.2, 1.1, h - 1 - base, 0.4, MARBLE);
    box.add(px, Y + h - 1.25, z1 + 0.3, 1.4, 0.4, 0.6, MARBLE);
  }
  for (const [px, pz] of [[x0, cz], [x1, cz], [x0, z1], [x1, z1]]) box.add(px, Y + h / 2, pz, 1.2, h, 1.2, MARBLE);
  // the front's tall windows, one in each bay of the wings, a small attic window over each
  for (const [a, b] of [[wingL[0], wingL[1]], [wingL[1], wingL[2]], [wingR[0], wingR[1]], [wingR[1], wingR[2]]]) {
    const wx = (a + b) / 2;
    tallWindow(k, wx, Y + 6.6, z1, 2.8, 5.8, '+z', 4, 9);
    win.add('rect', wx, Y + 11.4, z1 + 0.03, 1.8, 1.0, '+z');
    box.add(wx, Y + 10.85, z1 + 0.1, 2.2, 0.12, 0.2, MARBLE);
  }
  // the sides and back: tall arched windows (the Pruzan's gallery block is against the east side's north part)
  const tall = (x: number, z: number, f: number | Facing) => win.add('arch', x, Y + 7.0, z, 2, 6.0, f);
  for (let x = x0 + 3; x < x1 - 1.5; x += 4.2) if (Math.abs(x - cx) > OLIN.r + 1.6) tall(x, cz - 0.03, '-z'); // either side of the drum
  for (let z = cz + 3; z < z1 - 1.5; z += 4.2) {
    tall(x0 - 0.03, z, '-x');
    if (z > OLIN_LINK.z1 + 2) tall(x1 + 0.03, z, '+x');
  }
  // the roof: a grey-green hip roof, three dormers on its front slope, a balustrade along the front over the portico
  const rh = 5;
  mesh(g, hipRoof(bw + 0.6, rh, bd + 0.6), lambert(0x6f7c74), bcx, Y + h, bcz);
  for (const dx of [-8, 0, 8]) {
    const dz = z1 - 3.6, dy = Y + h + (rh * 3.6) / (bd / 2 + 0.3) * 0.5;
    box.add(cx + dx, dy + 0.7, dz, 1.7, 1.6, 2.2, 0xe8e5dc); // the dormer's cheeks and face
    win.add('rect', cx + dx, dy + 0.75, dz + 1.12, 1.0, 1.1, '+z');
    const roof = mesh(g, prism(2.1, 0.9, 2.4), lambert(0x5f6b64), cx + dx, dy + 1.5, dz);
    roof.castShadow = true;
  }
  const bz = z1 - 0.9, bx0 = PORTICO_O.x0 - 1.5, bx1 = PORTICO_O.x1 + 1.5;
  box.add((bx0 + bx1) / 2, Y + h + 0.12, bz, bx1 - bx0, 0.24, 0.5, MARBLE);
  box.add((bx0 + bx1) / 2, Y + h + 1.05, bz, bx1 - bx0, 0.16, 0.5, MARBLE);
  for (let x = bx0 + 0.2; x < bx1; x += 0.34) box.add(x, Y + h + 0.6, bz, 0.14, 0.75, 0.14, MARBLE_SHADE);
  for (let x = bx0; x <= bx1 + 0.01; x += (bx1 - bx0) / 6) box.add(x, Y + h + 0.6, bz, 0.5, 1.2, 0.55, MARBLE);
}

/** The back: the half drum of tall arched windows facing the field, a row of small windows over them. */
function drum({ g, win, box }: Kit) {
  const { cx, cz, r, h } = OLIN, base = 3;
  const brick = lambert(BRICK, brickMap(), 'frank'), marble = lambert(MARBLE);
  const geo = new CylinderGeometry(r, r, h, 48, 1, true, Math.PI / 2, Math.PI);
  const pos = geo.getAttribute('position'), uv = geo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (Math.atan2(pos.getX(i), pos.getZ(i)) * r) / 2, (pos.getY(i) + h / 2) / 2);
  mesh(g, geo, brick, cx, Y + h / 2, cz);
  mesh(g, new CylinderGeometry(r + 0.15, r + 0.15, base, 48, 1, true, Math.PI / 2, Math.PI), marble, cx, Y + base / 2, cz);
  mesh(g, new CylinderGeometry(r + 0.4, r + 0.4, 0.8, 48, 1, false, Math.PI / 2, Math.PI), marble, cx, Y + h - 0.2, cz); // cornice + roof
  mesh(g, new CylinderGeometry(r + 0.2, r + 0.2, 0.25, 48, 1, false, Math.PI / 2, Math.PI), marble, cx, Y + 3.9, cz); // band
  mesh(g, new CylinderGeometry(r + 0.2, r + 0.2, 0.25, 48, 1, false, Math.PI / 2, Math.PI), marble, cx, Y + 11.0, cz); // band over the arches
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = Math.PI / 2 + 0.22 + (i / (n - 1)) * (Math.PI - 0.44);
    const at = (rr: number) => ({ x: cx + rr * Math.sin(a), z: cz + rr * Math.cos(a) });
    const p = at(r + 0.04), q = at(r + 0.2), s = at(r + 0.12), b = at(r + 0.19);
    win.add('arch', p.x, Y + 7.4, p.z, 2.2, 6.4, a);
    box.add(q.x, Y + 4.2, q.z, 2.6, 0.18, 0.35, MARBLE, a); // sill
    box.add(s.x, Y + 10.65, s.z, 0.5, 0.6, 0.2, MARBLE, a); // keystone
    win.add('rect', b.x, Y + 1.6, b.z, 1.2, 1.1, a); // small windows in the base
    if (i < n - 1) { // and small square ones high up, between the arches
      const a2 = a + (Math.PI - 0.44) / (n - 1) / 2, p2 = { x: cx + (r + 0.04) * Math.sin(a2), z: cz + (r + 0.04) * Math.cos(a2) };
      win.add('rect', p2.x, Y + 11.9, p2.z, 0.8, 0.8, a2);
    }
  }
}

/**
 * The portico: its marble floor, six fluted Ionic columns, the entablature with the inscription and dentils, the pediment
 * and its oval window; behind the columns the arched doorway (bronze doors, a fanlight), tall windows, gold medallions,
 * the lantern hanging in front of the door, iron railings at its open ends.
 */
function portico(k: Kit) {
  const { g, box } = k, P = PORTICO_O, D = OLIN_DOOR, cx = (P.x0 + P.x1) / 2, w = P.x1 - P.x0;
  const marble = lambert(MARBLE), fy = P.y; // the portico's floor
  box.add(cx, (Y + fy) / 2, (P.z0 + P.z1) / 2, w, fy - Y, P.z1 - P.z0, 0xe6e2d8); // the stylobate
  // the columns: a base, a fluted (faceted), slightly tapering shaft, an Ionic capital with its two scrolls
  const colH = 8.6, shaft = colH - 0.35 - 0.55;
  const parts = [
    new BoxGeometry(1.15, 0.16, 1.15).translate(0, 0.08, 0),
    new CylinderGeometry(0.56, 0.6, 0.12, 20).translate(0, 0.22, 0),
    new CylinderGeometry(0.5, 0.56, 0.08, 20).translate(0, 0.31, 0),
    new CylinderGeometry(0.4, 0.46, shaft, 20, 1).translate(0, 0.35 + shaft / 2, 0),
    new CylinderGeometry(0.5, 0.42, 0.2, 20).translate(0, 0.35 + shaft + 0.1, 0), // the echinus
    new CylinderGeometry(0.17, 0.17, 0.8, 12).rotateX(Math.PI / 2).translate(-0.5, 0.35 + shaft + 0.2, 0), // the scrolls
    new CylinderGeometry(0.17, 0.17, 0.8, 12).rotateX(Math.PI / 2).translate(0.5, 0.35 + shaft + 0.2, 0),
    new BoxGeometry(1.2, 0.14, 1.2).translate(0, colH - 0.07, 0), // the abacus
  ].map((p) => p.toNonIndexed());
  for (const p of parts) p.deleteAttribute('uv');
  const column = mergeGeometries(parts)!;
  const fluted = new MeshLambertMaterial({ color: MARBLE, flatShading: true });
  for (const c of OLIN_COLUMNS) mesh(g, column, fluted, c.x, fy, c.z);
  // the antae: flat pilasters on the wall behind the end columns
  for (const x of [P.x0 + 0.5, P.x1 - 0.5]) box.add(x, fy + colH / 2, P.z0 + 0.2, 1.1, colH, 0.4, MARBLE);
  // the entablature: architrave, the frieze with the inscription, the cornice and its dentils
  const ey = fy + colH, ez0 = P.z0 - 0.1, ez1 = P.z1 + 0.15, ezc = (ez0 + ez1) / 2, ed = ez1 - ez0;
  box.add(cx, ey + 0.35, ezc, w + 0.3, 0.7, ed, MARBLE);
  box.add(cx, ey + 0.72, ezc, w + 0.4, 0.06, ed + 0.06, MARBLE_SHADE);
  box.add(cx, ey + 1.15, ezc, w + 0.3, 0.8, ed, MARBLE);
  const frieze = new Mesh(new PlaneGeometry(w - 1, 0.6), new MeshLambertMaterial({ map: inscription() }));
  frieze.position.set(cx, ey + 1.15, ez1 + 0.01);
  g.add(frieze);
  for (let x = P.x0 - 0.1; x <= P.x1 + 0.1; x += 0.4) box.add(x, ey + 1.62, ez1 + 0.1, 0.2, 0.18, 0.2, MARBLE); // dentils
  box.add(cx, ey + 1.85, ezc + 0.2, w + 1.1, 0.35, ed + 0.5, MARBLE); // the cornice
  // the pediment: the tympanum, its raking cornices, the oval window in the middle
  const py = ey + 2.0, ph = 2.5, pw = w + 1.0;
  mesh(g, prism(pw - 0.4, ph - 0.15, ed), marble, cx, py, ezc);
  for (const s of [-1, 1]) {
    const len = Math.hypot(pw / 2, ph), rake = mesh(g, new BoxGeometry(len, 0.35, ed + 0.6), marble, cx + (s * pw) / 4, py + ph / 2, ezc + 0.15);
    rake.rotation.z = -s * Math.atan2(ph, pw / 2);
  }
  const ring = mesh(g, new TorusGeometry(0.6, 0.12, 6, 20), marble, cx, py + 1.0, ez1 + 0.05);
  ring.scale.x = 1.5;
  const oval = mesh(g, new CircleGeometry(0.6, 20), lambert(0x2e3438), cx, py + 1.0, ez1 + 0.02);
  oval.scale.x = 1.5;
  for (let i = 0; i < 6; i++) { // its glazing bars, like spokes
    const a = (i / 6) * Math.PI;
    const bar = mesh(g, new BoxGeometry(1.8, 0.04, 0.03), lambert(0xe8e5dc), cx, py + 1.0, ez1 + 0.04);
    bar.rotation.z = a;
    bar.scale.y = 1;
  }
  box.add(cx, ey - 0.1, (P.z0 + P.z1) / 2, w - 0.4, 0.2, P.z1 - P.z0, 0xf2efe8); // the ceiling…
  for (let x = P.x0 + 1.2; x < P.x1 - 0.8; x += 1.6) for (const z of [P.z0 + 1.2, P.z0 + 2.8]) box.add(x, ey - 0.22, z, 1.1, 0.06, 1.1, 0xdedad0); // …its coffers

  // behind the columns: the arched doorway in its marble surround, bronze doors, the fanlight
  const dz = D.z + 0.35, dw = D.half * 2, dTop = fy + 4.6, r = D.half; // (dz: proud of the marble base)
  const glass = new Mesh(new PlaneGeometry(dw, dTop - fy), glow!);
  glass.position.set(D.x, (fy + dTop) / 2, dz + 0.01);
  g.add(glass);
  const fan = new Mesh(new CircleGeometry(r, 20, 0, Math.PI), glow!);
  fan.position.set(D.x, dTop, dz + 0.01);
  g.add(fan);
  const bronze = 0x2a2620;
  for (const x of [D.x - r + 0.08, D.x - 0.04, D.x + 0.04, D.x + r - 0.08]) box.add(x, (fy + dTop) / 2, dz + 0.05, 0.14, dTop - fy, 0.08, bronze); // stiles
  for (const y of [fy + 0.4, fy + 1.4, fy + 3.0, dTop - 0.05]) box.add(D.x, y, dz + 0.05, dw, y < fy + 0.5 ? 0.8 : 0.1, 0.08, bronze); // rails (a solid kick panel)
  for (let i = 1; i < 6; i++) { // the fanlight's radiating bars
    const a = (i / 6) * Math.PI, bar = mesh(g, new BoxGeometry(r, 0.05, 0.04), lambert(bronze), D.x + (Math.cos(a) * r) / 2, dTop + (Math.sin(a) * r) / 2, dz + 0.05);
    bar.rotation.z = a;
  }
  for (const s of [-1, 1]) box.add(D.x + s * (r + 0.3), (fy + dTop) / 2, dz + 0.12, 0.6, dTop - fy, 0.24, MARBLE); // the surround's jambs…
  const arch = mesh(g, new TorusGeometry(r + 0.3, 0.3, 4, 20, Math.PI), marble, D.x, dTop, dz + 0.12); // …its arch…
  arch.scale.z = 0.8;
  box.add(D.x, dTop + r + 0.35, dz + 0.2, 0.6, 0.8, 0.3, MARBLE); // …and keystone
  // the tall windows either side, the gold medallions over them
  for (const s of [-1, 1]) {
    tallWindow(k, D.x + s * 4.95, fy + 3.0, P.z0, 1.9, 4.4, '+z', 3, 7);
    const med = mesh(g, new CylinderGeometry(0.42, 0.42, 0.06, 20), lambert(0xc9a54a), D.x + s * 4.95, fy + 6.6, P.z0 + 0.06);
    med.rotation.x = Math.PI / 2;
    const rim = mesh(g, new TorusGeometry(0.45, 0.05, 4, 20), lambert(0xa88a3c), D.x + s * 4.95, fy + 6.6, P.z0 + 0.08);
    rim.castShadow = false;
  }
  // the lantern, hung on a chain from the ceiling in front of the door
  const lz = P.z0 + 1.8, ly = fy + 5.0;
  box.add(D.x, (ey + ly + 0.6) / 2, lz, 0.04, ey - ly - 0.6, 0.04, IRON); // chain
  const core = new Mesh(new BoxGeometry(0.42, 0.7, 0.42), glow!);
  core.position.set(D.x, ly, lz);
  g.add(core);
  for (const [ox, oz] of [[-0.24, -0.24], [0.24, -0.24], [-0.24, 0.24], [0.24, 0.24]]) box.add(D.x + ox, ly, lz + oz, 0.05, 0.8, 0.05, IRON);
  box.add(D.x, ly + 0.45, lz, 0.6, 0.1, 0.6, IRON);
  box.add(D.x, ly - 0.42, lz, 0.5, 0.08, 0.5, IRON);
  const cap = mesh(g, new CylinderGeometry(0.05, 0.36, 0.3, 4), lambert(IRON), D.x, ly + 0.65, lz);
  cap.rotation.y = Math.PI / 4;
  // iron railings along the portico's open ends
  for (const x of [P.x0 + 0.15, P.x1 - 0.15]) {
    box.add(x, fy + 1.0, (P.z0 + P.z1) / 2 - 0.5, 0.05, 0.05, P.z1 - P.z0 - 1.2, IRON);
    for (let z = P.z0 + 0.6; z < P.z1 - 0.8; z += 0.15) box.add(x, fy + 0.5, z, 0.03, 1.0, 0.03, IRON);
  }
}

/** The ten broad marble steps down from the portico to the walk, marble cheeks, four black iron handrails. */
function steps({ g, box }: Kit) {
  const S = OLIN_STEPS, run = S.z1 - S.z0, tread = run / S.steps, rise = (PORTICO_O.y - OLIN_Y) / S.steps, cx = (S.x0 + S.x1) / 2, w = S.x1 - S.x0;
  for (let i = 0; i < S.steps; i++) { // step i counts down from the top
    const top = PORTICO_O.y - i * rise, z0 = S.z0 + i * tread;
    box.add(cx, (Y + top) / 2, (z0 + S.z1) / 2 - (S.z1 - z0 - tread) / 2, w, top - Y, tread, i % 2 ? MARBLE : 0xe4e0d6);
    box.add(cx, top - 0.02, z0 + tread - 0.03, w + 0.02, 0.04, 0.06, MARBLE_SHADE); // the nosing
  }
  for (const x of [S.x0 - 0.35, S.x1 + 0.35]) { // the cheeks
    box.add(x, (Y + PORTICO_O.y + 0.3) / 2, (PORTICO_O.z0 + S.z1) / 2, 0.7, PORTICO_O.y + 0.3 - Y, S.z1 - PORTICO_O.z0, MARBLE);
  }
  const rail = (x: number) => {
    const lo = new Vector3(x, OLIN_Y + 0.95, S.z1 + 0.1), hi = new Vector3(x, PORTICO_O.y + 0.95, S.z0 - 0.1);
    const m = mesh(g, new BoxGeometry(0.06, 0.06, lo.distanceTo(hi)), lambert(IRON), (lo.x + hi.x) / 2, (lo.y + hi.y) / 2, (lo.z + hi.z) / 2);
    m.lookAt(hi);
    for (let j = 0; j <= 3; j++) {
      const t = j / 3, z = S.z1 - t * run, y = OLIN_Y + t * (PORTICO_O.y - OLIN_Y);
      box.add(x, y + 0.47, z, 0.05, 0.95, 0.05, IRON);
    }
    box.add(x, OLIN_Y + 0.5, S.z1 + 0.35, 0.05, 1.0, 0.05, IRON); // the curl-over at the foot, roughly
  };
  for (const dx of [-7.2, -2.4, 2.4, 7.2]) rail(cx + dx);
}

/**
 * Olin's raised grounds: the small flight up from the walk (set into the grass slope on the Pruzan side), the walk
 * along the front, the lawn's walks, shrubs along the base, benches, lamps and the sign.
 */
function grounds(k: Kit) {
  const { g, box } = k, S = STAIRS_O, top = OLIN_Y;
  // the small flight: five granite steps up toward Olin, set into the grass slope, iron rails either side
  const tread = (S.x1 - S.x0) / S.steps, rise = OLIN_RISE / S.steps, sz = (S.z0 + S.z1) / 2;
  for (let i = 0; i < S.steps; i++) {
    const h = (i + 1) * rise, rest = S.x1 - S.x0 - i * tread;
    box.add(S.x0 + rest / 2, (Y + Y + h) / 2, sz, rest, h, S.z1 - S.z0, i % 2 ? 0xc4c2bb : 0xcac8c1);
  }
  for (const z of [S.z0 + 0.12, S.z1 - 0.12]) {
    const lo = new Vector3(S.x1 + 0.1, Y + 0.9, z), hi = new Vector3(S.x0 - 0.1, top + 0.9, z);
    const m = mesh(g, new BoxGeometry(0.05, 0.05, lo.distanceTo(hi)), lambert(IRON), (lo.x + hi.x) / 2, (lo.y + hi.y) / 2, z);
    m.lookAt(hi);
    for (const t of [0, 0.5, 1]) box.add(lo.x + (hi.x - lo.x) * t, lo.y + (hi.y - lo.y) * t - 0.45, z, 0.04, 0.9, 0.04, IRON);
  }
  // the walk along the front, and the lawn's walks
  const F = OLIN_FRONT_WALK;
  const fw = new Mesh(new PlaneGeometry(F.x1 - F.x0, F.z1 - F.z0), slabs(F.x1 - F.x0, F.z1 - F.z0));
  fw.rotation.x = -Math.PI / 2;
  fw.position.set((F.x0 + F.x1) / 2, top + 0.03, (F.z0 + F.z1) / 2);
  fw.receiveShadow = true;
  g.add(fw);
  LAWN_WALKS.forEach((wk, i) => {
    const dx = wk.b.x - wk.a.x, dz = wk.b.z - wk.a.z, len = Math.hypot(dx, dz);
    const m = new Mesh(new PlaneGeometry(wk.w, len), slabs(wk.w, len));
    m.rotation.order = 'YXZ';
    m.rotation.set(-Math.PI / 2, Math.atan2(dx, dz), 0);
    m.position.set((wk.a.x + wk.b.x) / 2, top + 0.031 + (i < 2 ? 0.002 : 0), (wk.a.z + wk.b.z) / 2);
    m.receiveShadow = true;
    g.add(m);
  });
  // clipped shrubs along the base of the front, either side of the steps
  for (let x = OLIN.x0 + 1; x < STAIRS_O.x0; x += 1.3) { // (stopping where the grass slopes down to the walk)
    if (x > PORTICO_O.x0 - 1.2 && x < PORTICO_O.x1 + 1.2) continue;
    box.add(x, top + 0.4, OLIN.z1 + 0.9, 1.1, 0.8, 0.9, x % 2.6 < 1.3 ? 0x3f6a2c : 0x4a7432);
  }
  // benches facing the walks, black lamp posts at the foot of the steps, the black sign with its red top
  for (const b of OLIN_BENCHES) { // long along the walk, facing it
    const f = b.rot > 0 ? 1 : -1;
    box.add(b.x, top + 0.46, b.z, 0.5, 0.08, 1.9, 0x6b4a2f);
    box.add(b.x - f * 0.24, top + 0.78, b.z, 0.08, 0.5, 1.9, 0x6b4a2f);
    for (const e of [-0.8, 0.8]) box.add(b.x, top + 0.22, b.z + e, 0.5, 0.44, 0.08, IRON);
  }
  for (const l of OLIN_LAMPS) {
    mesh(g, new CylinderGeometry(0.07, 0.12, 3.6, 8).translate(0, 1.8, 0), lambert(IRON), l.x, top, l.z);
    const head = new Mesh(new BoxGeometry(0.34, 0.5, 0.34), glow!);
    head.position.set(l.x, top + 3.85, l.z);
    g.add(head);
    box.add(l.x, top + 4.15, l.z, 0.46, 0.1, 0.46, IRON);
    box.add(l.x, top + 3.58, l.z, 0.3, 0.06, 0.3, IRON);
  }
  const G = OLIN_SIGN;
  box.add(G.x, top + 1.0, G.z, 0.1, 2.0, 0.1, 0x111315);
  box.add(G.x, top + 1.55, G.z, 0.06, 1.3, 0.9, IRON);
  box.add(G.x + 0.035, top + 2.12, G.z, 0.02, 0.2, 0.9, 0xc8102e);
  for (let i = 0; i < 4; i++) box.add(G.x + 0.035, top + 1.85 - i * 0.2, G.z - 0.1, 0.02, 0.05, 0.55 - (i % 2) * 0.15, 0xe8e8e2);
}

/** The flagpole on the lawn in front of the Pruzan's gallery block, toward the field. */
function flagpole({ g, box }: Kit) {
  const F = FLAGPOLE;
  mesh(g, new CylinderGeometry(0.05, 0.08, 11, 6).translate(0, 5.5, 0), lambert(0xe8e8e4), F.x, Y, F.z);
  box.add(F.x, Y + 11.05, F.z, 0.22, 0.22, 0.22, 0xd4af37); // gilt finial
  box.add(F.x, Y + 10.3, F.z - 0.8, 0.04, 0.9, 1.5, 0xb22234); // the flag, hanging still
  box.add(F.x, Y + 10.5, F.z - 0.45, 0.05, 0.45, 0.65, 0x3c3b6e);
}
