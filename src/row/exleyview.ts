import {
  BoxGeometry, CanvasTexture, ConeGeometry, CylinderGeometry, Group, Mesh, MeshLambertMaterial, PlaneGeometry, RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import { BoxBank, WindowBank, lambert, worldUV } from './kit';
import { rng } from './noise';
import {
  EXLEY_BENCH, EXLEY_DOOR, EXLEY_ENTRY, EXLEY_PAV, EXLEY_PINE, EXLEY_PLANTERS, EXLEY_PLAZA, EXLEY_TOWER, EXLEY_WALLS, EXLEY_WING,
  EXLEY_WING_UP, EXLEY_Y, groundY,
} from './southend';

// ─── Exley Science Center: draws what southend.ts lays out ─────────────
// From the user's photos (2026-10-08). Everything in one pinkish granite-aggregate concrete. The tower: eight storeys
// behind a deep grid — fins every bay, a ledge every floor, a solid band at the top, broad piers at the corners — with
// narrow dark windows set back in each cell. Round its foot the long one-storey pavilion: square piers, floor-to-ceiling
// dark glass, a deep plain fascia, the doors in the middle onto the plaza. On the west the wing: a glass ground floor,
// two finned storeys cantilevered out over it. The plaza: big slabs, dark bands, a low planter wall, round planters with
// red flowers, a granite bench; hedges along the lawn, a tall pine at the corner.

type Kit = { g: Group; win: WindowBank; box: BoxBank };

const CONC = 0xc29e91, CONC_DARK = 0xa3837a, GLASS_FRAME = 0x2b2a2a, Y = EXLEY_Y;

let tex: CanvasTexture | null = null;
/** Granite-aggregate concrete: pinkish brown, finely speckled, faint board lines. One tile = 3 m. */
function aggregate(): CanvasTexture {
  if (tex) return tex;
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c9a497'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 5000; i++) {
    const v = rng(9900 + i);
    g.fillStyle = v < 0.45 ? 'rgba(80,50,45,0.35)' : v < 0.8 ? 'rgba(235,215,205,0.35)' : 'rgba(60,60,60,0.3)';
    g.fillRect(rng(19900 + i) * S, rng(29900 + i) * S, 1 + rng(39900 + i) * 1.5, 1 + rng(49900 + i) * 1.5);
  }
  g.fillStyle = 'rgba(70,45,40,0.08)';
  for (let y = 0; y < S; y += 32) g.fillRect(0, y, S, 1);
  tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  return tex;
}
let mat: MeshLambertMaterial | null = null;
const concrete = () => (mat ??= new MeshLambertMaterial({ map: aggregate() }));

function cbox(g: Group, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  const m = new Mesh(worldUV(new BoxGeometry(x1 - x0, y1 - y0, z1 - z0), 3), concrete());
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

export function buildExley(k: Kit) {
  tower(k);
  pavilion(k);
  wing(k);
  plaza(k);
}

/**
 * A deep fin grid on one face of a block: the face runs from a to b along `axis` at `at` (outward `out` ±1), from y0 to
 * y1 in `floors` storeys; fins every `bay` m, a ledge each floor, a narrow window set back in each cell.
 */
function finGrid(k: Kit, axis: 'x' | 'z', at: number, out: number, a: number, b: number, y0: number, floors: number, fh: number, bay = 1.75, depth = 0.85) {
  const { box, win } = k, len = b - a, n = Math.round(len / bay), step = len / n, y1 = y0 + floors * fh;
  const pos = (u: number, d: number) => (axis === 'x' ? { x: u, z: at + out * d } : { x: at + out * d, z: u });
  const f = axis === 'x' ? (out > 0 ? '+z' : '-z') : out > 0 ? '+x' : '-x';
  for (let i = 0; i <= n; i++) { // the fins
    const p = pos(a + i * step, depth / 2);
    box.add(p.x, (y0 + y1) / 2, p.z, axis === 'x' ? 0.32 : depth, y1 - y0, axis === 'x' ? depth : 0.32, CONC);
  }
  for (let j = 0; j <= floors; j++) { // the ledges
    const p = pos((a + b) / 2, depth / 2), y = y0 + j * fh;
    box.add(p.x, y, p.z, axis === 'x' ? len : depth, 0.34, axis === 'x' ? depth : len, CONC);
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < floors; j++) { // the windows, set back, narrow, dark
    const p = pos(a + (i + 0.5) * step, 0.02), y = y0 + j * fh + fh * 0.52;
    win.add('rect', p.x, y, p.z, step * 0.42, fh * 0.62, f);
    const q = pos(a + (i + 0.5) * step, 0.04); // the concrete spandrel under it, a shade darker
    box.add(q.x, y0 + j * fh + 0.45, q.z, axis === 'x' ? step - 0.32 : 0.05, 0.6, axis === 'x' ? 0.05 : step - 0.32, CONC_DARK);
  }
}

/** The tower: a concrete core, the fin grid on all four faces above the pavilion's roof, a solid top band, corner piers. */
function tower(k: Kit) {
  const { g } = k, T = EXLEY_TOWER, base = Y + EXLEY_PAV.h + 0.6, top = base + T.floors * T.fh;
  cbox(g, T.x0 + 0.3, T.x1 - 0.3, Y, top, T.z0 + 0.3, T.z1 - 0.3); // the core
  for (const [axis, at, out, a, b] of [['x', T.z0, -1, T.x0 + 1, T.x1 - 1], ['x', T.z1, 1, T.x0 + 1, T.x1 - 1], ['z', T.x0, -1, T.z0 + 1, T.z1 - 1], ['z', T.x1, 1, T.z0 + 1, T.z1 - 1]] as const) {
    finGrid(k, axis, at - out * 0.3, out, a, b, base, T.floors, T.fh);
  }
  for (const [x, z] of [[T.x0, T.z0], [T.x1, T.z0], [T.x0, T.z1], [T.x1, T.z1]]) cbox(g, x - 1.1, x + 1.1, base - 0.3, top + 1.6, z - 1.1, z + 1.1); // the corner piers
  cbox(g, T.x0 - 0.6, T.x1 + 0.6, top, top + 1.6, T.z0 - 0.6, T.z1 + 0.6); // the solid band at the top
  k.box.add((T.x0 + T.x1) / 2, top + 1.7, (T.z0 + T.z1) / 2, T.x1 - T.x0 - 2, 0.1, T.z1 - T.z0 - 2, 0x6e6a66); // the roof
  for (const [dx, dz] of [[-5, -4], [4, 3]]) k.box.add((T.x0 + T.x1) / 2 + dx, top + 2.4, (T.z0 + T.z1) / 2 + dz, 3, 1.4, 2.2, 0x9a9590); // mechanical boxes
  // where the tower's foot shows behind the pavilion: glass between its piers
  glassRun(k, 'x', T.z1 + 0.05, 1, T.x0, T.x1, Y, EXLEY_PAV.h);
  for (const [axis, at, out] of [['z', T.x0 - 0.05, -1], ['z', T.x1 + 0.05, 1]] as const) glassRun(k, axis, at, out, EXLEY_PAV.z1, T.z1, Y, EXLEY_PAV.h);
}

/** A run of the pavilion's wall along one side: square piers every ~5.4 m, dark glass between in slim frames. */
function glassRun(k: Kit, axis: 'x' | 'z', at: number, out: number, a: number, b: number, y0: number, h: number, skip?: [number, number]) {
  const { g, win, box } = k, len = b - a, n = Math.max(1, Math.round(len / 5.4)), step = len / n;
  const f = axis === 'x' ? (out > 0 ? '+z' : '-z') : out > 0 ? '+x' : '-x';
  for (let i = 0; i <= n; i++) {
    const u = a + i * step, x = axis === 'x' ? u : at, z = axis === 'x' ? at : u;
    cbox(g, x - 0.45, x + 0.45, y0, y0 + h, z - 0.45, z + 0.45);
  }
  for (let i = 0; i < n; i++) {
    const u = a + (i + 0.5) * step;
    if (skip && u > skip[0] && u < skip[1]) continue;
    for (const s of [-1, 1]) { // two lights a bay, a slim mullion between
      const v = u + (s * (step - 0.9)) / 4, x = axis === 'x' ? v : at - out * 0.25, z = axis === 'x' ? at - out * 0.25 : v;
      win.add('rect', x, y0 + h / 2 - 0.05, z, (step - 0.9) / 2 - 0.08, h - 0.4, f);
    }
    const x = axis === 'x' ? u : at - out * 0.22, z = axis === 'x' ? at - out * 0.22 : u;
    box.add(x, y0 + h / 2, z, axis === 'x' ? 0.08 : 0.06, h - 0.3, axis === 'x' ? 0.06 : 0.08, GLASS_FRAME);
    box.add(x, y0 + 0.12, z, axis === 'x' ? step - 0.9 : 0.1, 0.2, axis === 'x' ? 0.1 : step - 0.9, GLASS_FRAME);
  }
}

/** The long glass pavilion: its walls, a deep plain fascia and flat roof, the doors in the middle of its front. */
function pavilion(k: Kit) {
  const { g, box } = k, P = EXLEY_PAV, D = EXLEY_DOOR;
  glassRun(k, 'x', P.z0, -1, P.x0, P.x1, Y, P.h, [D.x - 2.6, D.x + 2.6]);
  glassRun(k, 'z', P.x0, -1, P.z0, P.z1, Y, P.h); // (its west end; the wing is against its east)
  glassRun(k, 'x', P.z1, 1, EXLEY_TOWER.x1 + 1, P.x1, Y, P.h);
  glassRun(k, 'x', P.z1, 1, P.x0, EXLEY_TOWER.x0 - 1, Y, P.h);
  cbox(g, P.x0 + 0.5, P.x1 - 0.5, Y, Y + 0.12, P.z0 + 0.5, P.z1 - 0.5); // its floor
  cbox(g, P.x0 - 0.5, P.x1 + 0.5, Y + P.h, Y + P.h + 1.15, P.z0 - 0.5, P.z1 + 0.5); // the deep fascia and roof
  box.add((P.x0 + P.x1) / 2, Y + P.h + 1.2, (P.z0 + P.z1) / 2, P.x1 - P.x0, 0.06, P.z1 - P.z0, 0x6e6a66);
  // the doors: set back a little, two pairs of glass doors in dark frames, a light either side, the flat soffit over them
  const dz = P.z0 + 0.6;
  box.add(D.x, Y + 1.3, dz, 4.4, 2.6, 0.06, 0x23272a);
  for (const o of [-2.2, -1.1, 0, 1.1, 2.2]) box.add(D.x + o, Y + 1.3, dz - 0.04, 0.08, 2.6, 0.08, GLASS_FRAME);
  box.add(D.x, Y + 2.62, dz - 0.04, 4.4, 0.08, 0.08, GLASS_FRAME);
  for (const o of [-1.5, -0.6, 0.6, 1.5]) box.add(D.x + o, Y + 1.15, dz - 0.1, 0.04, 0.5, 0.04, 0xbfc4c6); // pulls
  k.win.add('rect', D.x, Y + 3.6, dz - 0.01, 4.4, 1.4, '-z'); // the transom over them
  for (const s of [-1, 1]) box.add(D.x + s * 2.9, Y + 2.4, P.z0 - 0.5, 0.25, 0.35, 0.18, 0xf3e3b8); // wall lights on the piers
  // bike racks along the front
  for (const x of [D.x - 9, D.x + 8]) for (let i = 0; i < 5; i++) box.add(x + i * 0.75, Y + 0.45, P.z0 - 1.6, 0.06, 0.9, 0.7, 0x9aa0a4);
}

/** The west wing: a glass ground floor, two finned storeys cantilevered out over it to the north and east. */
function wing(k: Kit) {
  const { g } = k, W = EXLEY_WING, U = EXLEY_WING_UP;
  glassRun(k, 'x', W.z0, -1, W.x0, W.x1, Y, 4.6);
  glassRun(k, 'z', W.x1, 1, W.z0, W.z1, Y, 4.6);
  glassRun(k, 'x', W.z1, 1, W.x0, W.x1, Y, 4.6);
  cbox(g, W.x0, W.x1, Y + 4.6, U.y0, W.z0, W.z1); // the slab between
  cbox(g, U.x0 + 0.3, U.x1 - 0.3, U.y0, U.y1, U.z0 + 0.3, U.z1 - 0.3); // the upper block…
  cbox(g, U.x0, U.x1, U.y0 - 0.5, U.y0, U.z0, U.z1); // …its underside, overhanging
  cbox(g, U.x0 - 0.2, U.x1 + 0.2, U.y1, U.y1 + 1.1, U.z0 - 0.2, U.z1 + 0.2); // its top band
  const fh = (U.y1 - U.y0) / 2;
  finGrid(k, 'x', U.z0 + 0.3, -1, U.x0 + 0.6, U.x1 - 0.6, U.y0, 2, fh, 1.9, 0.95);
  finGrid(k, 'z', U.x1 - 0.3, 1, U.z0 + 0.6, U.z1 - 0.6, U.y0, 2, fh, 1.9, 0.95);
  finGrid(k, 'z', U.x0 + 0.3, -1, U.z0 + 0.6, U.z1 - 0.6, U.y0, 2, fh, 1.9, 0.95);
  finGrid(k, 'x', U.z1 - 0.3, 1, U.x0 + 0.6, U.x1 - 0.6, U.y0, 2, fh, 1.9, 0.95);
}

/** The plaza, the planter wall, the round planters with red flowers, the bench, hedges, the entry walk, the pine. */
function plaza(k: Kit) {
  const { g, box } = k, P = EXLEY_PLAZA, E = EXLEY_ENTRY;
  // the slabs: big, pale, a dark band every few, joints
  const slab = new Mesh(new PlaneGeometry(P.x1 - P.x0, P.z1 - P.z0 + 0.4), lambert(0xc8c2b8));
  slab.rotation.x = -Math.PI / 2;
  slab.position.set((P.x0 + P.x1) / 2, Y + 0.025, (P.z0 + P.z1 + 0.4) / 2);
  slab.receiveShadow = true;
  g.add(slab);
  for (let x = P.x0 + 1.5; x < P.x1; x += 1.8) box.add(x, Y + 0.03, (P.z0 + P.z1) / 2, 0.03, 0.01, P.z1 - P.z0, 0xa29c92);
  for (let z = P.z0 + 1; z < P.z1; z += 1.8) box.add((P.x0 + P.x1) / 2, Y + 0.03, z, P.x1 - P.x0, 0.01, 0.03, 0xa29c92);
  for (let x = P.x0 + 6; x < P.x1; x += 9) box.add(x, Y + 0.032, (P.z0 + P.z1) / 2, 0.45, 0.01, P.z1 - P.z0, 0x6f6863); // the dark bands
  // the entry walk from the crosswalk, a smooth slope up the lawn (laid on the ground: no steps)
  const walk = new PlaneGeometry(E.x1 - E.x0, E.z1 - E.z0, 2, Math.round((E.z1 - E.z0) * 2));
  walk.rotateX(-Math.PI / 2);
  walk.translate((E.x0 + E.x1) / 2, 0, (E.z0 + E.z1) / 2);
  const wp = walk.getAttribute('position');
  for (let i = 0; i < wp.count; i++) wp.setY(i, groundY(wp.getX(i), wp.getZ(i)) + 0.03);
  walk.computeVertexNormals();
  const wm = new Mesh(walk, lambert(0xc8c2b8));
  wm.receiveShadow = true;
  g.add(wm);
  // the low planter wall along the plaza's north edge: concrete, a hedge behind it on the lawn side
  for (const w of EXLEY_WALLS) {
    cbox(g, w.x0, w.x1, Y, Y + 0.55, w.z0, w.z1);
    box.add((w.x0 + w.x1) / 2, Y + 0.45, w.z0 - 0.7, w.x1 - w.x0 - 0.6, 0.9, 1.2, 0x3f6a2c);
  }
  // round concrete planters with red flowers
  for (const p of EXLEY_PLANTERS) {
    const pot = new Mesh(new CylinderGeometry(0.75, 0.55, 0.65, 16), lambert(0xcbc5bb));
    pot.position.set(p.x, Y + 0.33, p.z);
    pot.castShadow = true;
    g.add(pot);
    box.add(p.x, Y + 0.75, p.z, 1.1, 0.35, 1.1, 0x4f7a35);
    for (let i = 0; i < 9; i++) box.add(p.x + (rng(7700 + i + p.x) - 0.5) * 1.1, Y + 0.95, p.z + (rng(7800 + i + p.x) - 0.5) * 1.1, 0.18, 0.12, 0.18, 0xd8322a);
  }
  // the granite bench
  const B = EXLEY_BENCH;
  cbox(g, B.x - B.len / 2, B.x + B.len / 2, Y + 0.2, Y + 0.48, B.z - 0.3, B.z + 0.3);
  for (const s of [-1, 1]) box.add(B.x + s * (B.len / 2 - 0.4), Y + 0.1, B.z, 0.4, 0.2, 0.5, 0x5a5552);
  // the tall pine at the lawn's east corner
  const pine = lambert(0x2f5a32), T = EXLEY_PINE, ty = groundY(T.x, T.z);
  const trunk = new Mesh(new CylinderGeometry(0.25, 0.4, 3, 6), lambert(0x5a4434));
  trunk.position.set(T.x, ty + 1.5, T.z);
  g.add(trunk);
  for (let i = 0; i < 5; i++) {
    const c = new Mesh(new ConeGeometry(3.6 - i * 0.6, 4.2, 8), pine);
    c.position.set(T.x, ty + 3.4 + i * 2.6, T.z);
    c.castShadow = true;
    g.add(c);
  }
}
