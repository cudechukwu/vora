import {
  BoxGeometry, BufferGeometry, CanvasTexture, Color, CylinderGeometry, Float32BufferAttribute, Group, IcosahedronGeometry, Matrix4, Mesh,
  MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry, Quaternion, RepeatWrapping, SRGBColorSpace, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BoxBank, PAL, WindowBank, lambert } from './kit';
import { noise2, rng } from './noise';
import {
  ALLB_DRIVE, BERM, CHAIN_POSTS, CHURCH, CHURCH_CLIMB, churchY, CHURCH_LAMPS, CHURCH_WALK_N, CHURCH_WALK_S, CHURCH_XWALK, HYDRANT, WALKWAY, WALKWAY_LAMPS, WALKWAY_PTS,
  XING_SIGN, groundY, walkwayPoint,
} from './southend';

// ─── Church Street, and the walkway down to it: draws what southend.ts lays out ────
// From the user's street views (2026-10-07). The walkway: coal tar, slimmer than the back path, in a gentle S down
// Allbritton's west side between planted beds (the bank rising beyond the west one), short bronze posts along both edges
// with chains slung between them in a W, bronze lamp posts; at the foot a hydrant, the yellow-green crossing sign, red
// pads at the curb and a crosswalk. The street: two
// lanes and a double yellow line, curbs, concrete sidewalks both sides, lamps, meeting High Street at a T.

type Kit = { g: Group; win: WindowBank; box: BoxBank };

const BRONZE = 0x3b3029, TAR = 0x3b3e41;

let glow: MeshBasicMaterial | null = null;
/** The lamps light up after dark. */
export function churchNight(night: number) {
  const on = Math.min(1, Math.max(0, (night - 0.25) / 0.5));
  glow?.color.copy(new Color(0x9aa0a0).lerp(new Color(0xffe2a8), on));
}

let slabTex: CanvasTexture | null = null;
function slabMat(w: number, l: number, tile = 1.5) {
  if (!slabTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    x.fillStyle = '#cfc9bd'; x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#a8a194'; x.fillRect(0, 0, 64, 2); x.fillRect(0, 0, 2, 64);
    slabTex = new CanvasTexture(c);
    slabTex.wrapS = slabTex.wrapT = RepeatWrapping;
    slabTex.colorSpace = SRGBColorSpace;
  }
  const t = slabTex.clone();
  t.needsUpdate = true;
  t.repeat.set(w / tile, l / tile);
  return new MeshLambertMaterial({ map: t });
}

function flat(g: Group, x0: number, x1: number, z0: number, z1: number, y: number, mat: MeshLambertMaterial) {
  const m = new Mesh(new PlaneGeometry(x1 - x0, z1 - z0), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  m.receiveShadow = true;
  g.add(m);
  return m;
}

export function buildChurch(k: Kit) {
  glow = new MeshBasicMaterial({ color: 0x9aa0a0 });
  const heads: BufferGeometry[] = [];
  street(k, heads);
  walkway(k, heads);
  const m = new Mesh(mergeGeometries(heads)!, glow);
  m.userData.glass = true;
  k.g.add(m);
}

/** A bronze lamp post (an octagonal base, a slim post, a lantern): the post into the box bank, its glass into `heads`. */
function lamp(box: BoxBank, heads: BufferGeometry[], x: number, z: number) {
  const y = groundY(x, z);
  box.add(x, y + 0.35, z, 0.42, 0.7, 0.42, BRONZE); // the base
  box.add(x, y + 2.1, z, 0.14, 2.9, 0.14, BRONZE); // the post
  box.add(x, y + 3.6, z, 0.36, 0.08, 0.36, BRONZE);
  box.add(x, y + 4.42, z, 0.5, 0.1, 0.5, BRONZE); // the cap
  heads.push(new CylinderGeometry(0.18, 0.13, 0.7, 6).translate(x, y + 4.0, z).toNonIndexed());
}

/** Church Street: the road, its double yellow line, curbs, sidewalks both sides, the crosswalk at the walkway's foot, lamps. */
function street({ g, box }: Kit, heads: BufferGeometry[]) {
  const C = CHURCH, N = CHURCH_WALK_N, S = CHURCH_WALK_S, X = CHURCH_XWALK;
  // (it climbs to the west: everything on it follows `churchY`, long pieces cut short where it slopes)
  const along = (x0: number, x1: number, each: (a: number, b: number, y: number) => void) => {
    for (let a = x0; a < x1 - 1e-6;) {
      const step = a + 0.5 < CHURCH_CLIMB.x0 ? 0.5 : x1 - a, b = Math.min(x1, a + step);
      each(a, b, churchY((a + b) / 2));
      a = b;
    }
  };
  sloped(g, C.x0, C.x1, C.z0, C.z1, 0.026, lambert(0x44484c));
  const mid = (C.z0 + C.z1) / 2;
  for (const dz of [-0.12, 0.12]) along(C.x0, C.x1, (a, b, y) => box.add((a + b) / 2, y + 0.034, mid + dz, b - a + 0.02, 0.02, 0.1, 0xe8c14a)); // the double yellow line
  // curbs (lowered at the crosswalk and the lot's driveway)
  for (const z of [C.z0, C.z1]) {
    const gaps = z === C.z0 ? [X, ALLB_DRIVE].sort((a, b) => a.x0 - b.x0) : [X];
    let from: number = C.x0;
    for (const gp of gaps) {
      along(from, gp.x0, (a, b, y) => box.add((a + b) / 2, y + 0.08, z, b - a + 0.02, 0.16, 0.25, PAL.curb));
      box.add((gp.x0 + gp.x1) / 2, 0.03, z, gp.x1 - gp.x0, 0.04, 0.25, PAL.curb);
      from = gp.x1;
    }
    along(from, C.x1, (a, b, y) => box.add((a + b) / 2, y + 0.08, z, b - a + 0.02, 0.16, 0.25, PAL.curb));
  }
  flat(g, ALLB_DRIVE.x0, ALLB_DRIVE.x1, N.z0, N.z1, 0.034, lambert(0x3d4043)); // the lot's driveway across the sidewalk
  for (const dx of [-4, 4]) box.add((dx < 0 ? X.x0 : X.x1) + dx / 2, 0.165, C.z0, 4, 0.01, 0.26, 0xd9b23c);
  // the crosswalk: wide white bars along the road, across it
  for (let z = C.z0 + 0.6; z < C.z1 - 0.3; z += 1.1) box.add((X.x0 + X.x1) / 2, 0.036, z, X.x1 - X.x0, 0.02, 0.55, 0xf2f0ea);
  for (const z of [C.z0 - 0.7, C.z1 + 0.7]) box.add((X.x0 + X.x1) / 2, 0.045, z, 1.6, 0.02, 0.9, 0xa8473a); // the red pads at the curb ramps
  // the sidewalks
  sloped(g, N.x0, N.x1, N.z0, N.z1, 0.03, slabMat(N.x1 - N.x0, N.z1 - N.z0));
  sloped(g, S.x0, S.x1, S.z0, S.z1, 0.03, slabMat(S.x1 - S.x0, S.z1 - S.z0));
  for (const l of CHURCH_LAMPS) lamp(box, heads, l.x, l.z);
  // and the ground south of it, coming back down from the street's height (the bank is the north side's)
  const x0 = BERM.x0, x1 = CHURCH_CLIMB.x0 + 4, z0 = S.z1, z1 = S.z1 + 21;
  const geo = new PlaneGeometry(x1 - x0, z1 - z0, Math.round((x1 - x0) / 2), 14);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const pos = geo.getAttribute('position'), cols: number[] = [], a = new Color(0x5f9a3a), b = new Color(0x7aae48), c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, groundY(x, z) + 0.01);
    c.copy(a).lerp(b, noise2(x / 22, z / 22));
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const m = new Mesh(geo, new MeshLambertMaterial({ vertexColors: true }));
  m.receiveShadow = true;
  g.add(m);
}

/** A flat strip (x0..x1 by z0..z1) laid on Church Street's climb, `lift` above it. */
function sloped(g: Group, x0: number, x1: number, z0: number, z1: number, lift: number, mat: MeshLambertMaterial) {
  const geo = new PlaneGeometry(x1 - x0, z1 - z0, Math.max(1, Math.round((x1 - x0) / 1.5)), 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setY(i, churchY(pos.getX(i)) + lift);
  geo.computeVertexNormals();
  const m = new Mesh(geo, mat);
  m.receiveShadow = true;
  g.add(m);
  return m;
}

/**
 * The walkway: a ribbon of tar following its centre line and its height; the planting on its banks (in the bank's
 * mulch); short posts along both edges and the chains slung between them; lamps; the hydrant and crossing sign at its foot.
 */
function walkway({ g, box }: Kit, heads: BufferGeometry[]) {
  // the tar, and the mulch beds either side (narrower on Allbritton's side): ribbons along the centre line, laid on the ground
  const ribbon = (from: number, to: number, mat: MeshLambertMaterial, lift: number) => {
    const pos: number[] = [], idx: number[] = [];
    WALKWAY_PTS.forEach((p, i) => {
      const a = WALKWAY_PTS[Math.max(0, i - 1)], b = WALKWAY_PTS[Math.min(WALKWAY_PTS.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const nx = (b.z - a.z) / l, nz = -(b.x - a.x) / l; // (pointing east of the way it runs)
      for (const o of [from, to]) { const x = p.x + nx * o, z = p.z + nz * o; pos.push(x, groundY(x, z) + lift, z); }
      if (i) { const q = (i - 1) * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
    });
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new Mesh(geo, mat);
    m.receiveShadow = true;
    g.add(m);
  };
  const hw = WALKWAY.w / 2, mulch = lambert(0x4b3324);
  ribbon(-hw, hw, lambert(TAR), 0.035);
  ribbon(-WALKWAY.beds, -hw - 0.15, mulch, 0.025);
  ribbon(hw + 0.15, hw + 2.0, mulch, 0.025); // (narrower: Allbritton's wall is close)
  // in the beds: shrubs, young plants, tufts of grass; a few big bushes toward the street
  for (let t = 3; t < WALKWAY.len - 1; t += 0.8) {
    const p = walkwayPoint(t);
    for (const side of [-1, 1]) {
      const off = hw + 0.5 + rng(t * 7 + side) * (side < 0 ? WALKWAY.beds - hw - 0.8 : 1.2), x = p.x + side * p.dz * off, z = p.z - side * p.dx * off;
      if (z > CHURCH_WALK_N.z0 - 0.4) continue;
      const sz = 0.3 + rng(t * 13 + side) * 0.5, col = [0x4f7a35, 0x6a8f3e, 0x8a9a52, 0x9a4a2e, 0x5f7d3a][Math.floor(rng(t * 3 + side) * 5)];
      box.add(x, groundY(x, z) + sz * 0.4, z, sz, sz * 0.8, sz, col, rng(t) * 3);
    }
  }
  const bush = new IcosahedronGeometry(1, 0);
  for (const [o, side, r] of [[WALKWAY.len - 7, -1, 1.6], [WALKWAY.len - 4, -1, 1.4], [WALKWAY.len - 12, -1, 1.2], [WALKWAY.len - 9, 1, 0.9]] as const) {
    const p = walkwayPoint(o), off = side < 0 ? 4.4 + r * 0.6 : 3.2, x = p.x + side * p.dz * off, z = p.z - side * p.dx * off;
    const m = new Mesh(bush, lambert(side < 0 ? 0x557f34 : 0x648c3a));
    m.position.set(x, groundY(x, z) + r * 0.55, z);
    m.scale.set(r, r * 0.8, r);
    m.castShadow = true;
    g.add(m);
  }
  // the posts, and the chains slung between them: each span sags to its middle, so the run of them makes a W
  const chain: BufferGeometry[] = [], m4 = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 0, 1);
  const seg = (a: Vector3, b: Vector3) => {
    const d = b.clone().sub(a), len = d.length();
    q.setFromUnitVectors(up, d.normalize());
    m4.compose(a.clone().add(b).multiplyScalar(0.5), q, new Vector3(1, 1, 1));
    chain.push(new BoxGeometry(0.035, 0.035, len).applyMatrix4(m4).toNonIndexed());
  };
  for (const side of [-1, 1]) {
    const posts = CHAIN_POSTS.filter((p) => p.side === side);
    posts.forEach((p, i) => {
      const y = groundY(p.x, p.z);
      box.add(p.x, y + 0.45, p.z, 0.09, 0.9, 0.09, BRONZE);
      box.add(p.x, y + 0.92, p.z, 0.13, 0.05, 0.13, BRONZE);
      if (!i) return;
      const a = posts[i - 1], ya = groundY(a.x, a.z) + 0.82, yb = y + 0.82;
      const mx = (a.x + p.x) / 2, mz = (a.z + p.z) / 2, my = groundY(mx, mz) + 0.5; // (the middle hangs lowest)
      const A = new Vector3(a.x, ya, a.z), M = new Vector3(mx, my, mz), B = new Vector3(p.x, yb, p.z);
      const qa = A.clone().lerp(M, 0.5).setY((ya + my) / 2 - 0.05), qb = M.clone().lerp(B, 0.5).setY((my + yb) / 2 - 0.05);
      seg(A, qa); seg(qa, M); seg(M, qb); seg(qb, B);
    });
  }
  const chains = new Mesh(mergeGeometries(chain.map((c) => { c.deleteAttribute('uv'); return c; }))!, lambert(0x2a2522));
  chains.castShadow = true;
  g.add(chains);
  for (const l of WALKWAY_LAMPS) lamp(box, heads, l.x, l.z);
  // at the foot: the hydrant (green, a yellow bonnet), the crossing sign (fluorescent yellow-green, an arrow under it)
  const H = HYDRANT, hy = groundY(H.x, H.z);
  box.add(H.x, hy + 0.3, H.z, 0.26, 0.6, 0.26, 0x3f7f48);
  box.add(H.x, hy + 0.66, H.z, 0.3, 0.14, 0.3, 0xe0c23c);
  box.add(H.x, hy + 0.4, H.z, 0.46, 0.1, 0.12, 0x3f7f48);
  const X = XING_SIGN, xy = groundY(X.x, X.z);
  box.add(X.x, xy + 1.3, X.z, 0.07, 2.6, 0.07, 0x8f9496);
  const d = new Mesh(new BoxGeometry(0.62, 0.62, 0.04), lambert(0xc6e636)); // the diamond…
  d.position.set(X.x, xy + 2.55, X.z - 0.03);
  d.rotation.z = Math.PI / 4;
  g.add(d);
  box.add(X.x, xy + 2.55, X.z - 0.06, 0.12, 0.5, 0.01, 0x1c1e20); // (a walking figure, roughly)
  box.add(X.x, xy + 1.95, X.z - 0.03, 0.42, 0.3, 0.04, 0xc6e636); // …and the arrow plate
  box.add(X.x, xy + 1.95, X.z - 0.06, 0.26, 0.05, 0.01, 0x1c1e20);
}
