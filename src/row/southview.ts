import {
  BoxGeometry, BufferGeometry, CanvasTexture, Color, CylinderGeometry, Float32BufferAttribute, Group, IcosahedronGeometry,
  Material, Mesh, MeshLambertMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace,
} from 'three';
import { BoxBank, Facing, WindowBank, block, brickMap, hipRoof, lambert, prism, stoneMap } from './kit';
import { BACK_PATH } from './layout';
import { noise2, rng } from './noise';
import {
  ALLBRITTON, ALLBRITTON_DOOR, BERM, BOLLARDS, CHEEK, FIELD_ROAD, FLAGPOLE, FRANK, FRANK_ADD, FRANK_DOOR, FRANK_LINK, LANDING,
  LINK_DOOR, MAIN_ENTRY, MULCH, OLIN, OLIN_LINK, PAVILION, PLAZA_BENCHES, PLAZA_BIN, PLAZA_F, PLAZA_TABLES, SIGN, STAIRS,
  STAIRS_E, SYCAMORE, SYCAMORE2, TERRACE_Y, UTILITY_BOX, groundY, plazaChairs,
} from './southend';

// ─── The south end of Andrus Field: draws what southend.ts lays out ────
// The field road, the grass bank with its two stairs, the sycamores, the
// Frank Center (historic block, glass connector, new addition, the plaza
// with its tables), Olin Library with its limestone connector and glass
// pavilion, and Allbritton at the south end of the back path.

type Kit = { g: Group; win: WindowBank; box: BoxBank };

const LIME = 0xebe5d6; // white limestone trim
const CREAM = 0xdcd5c3; // the addition's cast-stone window frames
const GRANITE = 0xc4c2bb;
const TAR = 0x3b3e41;
const IRON = 0x16191b;
const MULCH_C = 0x4b3324;

function mesh(g: Group, geo: BufferGeometry, mat: Material, x: number, y: number, z: number) {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

function flat(g: Group, x0: number, x1: number, z0: number, z1: number, y: number, mat: Material) {
  const m = new Mesh(new PlaneGeometry(x1 - x0, z1 - z0), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  m.receiveShadow = true;
  g.add(m);
  return m;
}

/** Tan brick pavers, running bond (from the landing at the foot of the stairs). */
function paverTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8f8270'; g.fillRect(0, 0, 128, 128);
  let id = 70;
  for (let r = 0; r < 8; r++) {
    for (let k = -1; k < 4; k++) {
      const x = k * 32 + (r % 2) * 16, l = 196 + Math.round(rng(id++) * 22);
      g.fillStyle = `rgb(${l},${l - 14},${l - 40})`;
      g.fillRect(x + 1, r * 16 + 1, 30, 14);
    }
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** A sign panel with lettering (dark ground, light letters). */
function signTexture(text: string, w = 512, h = 64): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#4a4f54'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#f2f0ea'; g.font = `600 ${Math.round(h * 0.55)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function buildSouthEnd(k: Kit) {
  road(k);
  bank(k);
  stairs(k);
  sycamore(k, SYCAMORE.x, SYCAMORE.z, 1);
  sycamore(k, SYCAMORE2.x, SYCAMORE2.z, 0.9);
  frankHistoric(k);
  frankLink(k);
  frankAddition(k);
  plaza(k);
  olin(k);
  olinLink(k);
  allbritton(k);
}

/** Coal-tar road between the field and the bank, granite curbs, a storm grate at the corner. */
function road({ g, box }: Kit) {
  const { x0, x1, z0, z1 } = FIELD_ROAD;
  flat(g, x0, x1, z0, z1, 0.027, lambert(TAR));
  for (let i = 0; i < 10; i++) { // patched, like the back path
    const x = x0 + 6 + rng(i * 5 + 800) * (x1 - x0 - 12), z = z0 + 1 + rng(i * 5 + 801) * (z1 - z0 - 2), w = 0.8 + rng(i * 5 + 802) * 1.8;
    flat(g, x - w, x + w, z - w * 0.4, z + w * 0.4, 0.029, lambert(i % 2 ? 0x46494c : 0x333638));
  }
  box.add((x0 + BACK_PATH.x0 - 6) / 2, 0.07, z0 - 0.15, BACK_PATH.x0 - 6 - x0, 0.14, 0.3, 0xb9b8b1); // north curb (fence side)
  box.add((x0 + LANDING.x0) / 2, 0.07, z1 + 0.15, LANDING.x0 - x0, 0.14, 0.3, 0xb9b8b1); // south curb, up to the landing…
  box.add((LANDING.x1 + BACK_PATH.x0) / 2, 0.07, z1 + 0.15, BACK_PATH.x0 - LANDING.x1, 0.14, 0.3, 0xb9b8b1); // …and on to the back path
  box.add(-61, 0.032, -0.6, 1.7, 0.02, 1.0, 0xb3ada0); // the grate's concrete pad
  for (let i = 0; i < 7; i++) box.add(-61.6 + i * 0.2, 0.036, -0.6, 0.07, 0.02, 0.6, 0x5c6066);
}

/** The grass bank the buildings sit up on: a terrain mesh, mulch round the stairs and down the slope to the plaza. */
function bank({ g, box }: Kit) {
  const w = BERM.x1 - BERM.x0, d = BERM.z1 - BERM.z0;
  const geo = new PlaneGeometry(w, d, Math.round(w), Math.round(d));
  geo.rotateX(-Math.PI / 2);
  geo.translate((BERM.x0 + BERM.x1) / 2, 0, (BERM.z0 + BERM.z1) / 2);
  const pos = geo.getAttribute('position');
  const cols: number[] = [];
  const a = new Color(0x5a9834), b = new Color(0x7cb247), mulch = new Color(MULCH_C), c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, groundY(x, z) + 0.012);
    const n = noise2(x / 9, z / 9);
    const bed = (x > MULCH.x0 && z < 10.5) // round the sycamore, east of the stairs
      || (x > FRANK.x1 + 1 && z > FRANK_LINK.z1 && z < FRANK.z1 + 4); // down the slope to the plaza
    if (bed) c.copy(mulch).multiplyScalar(0.85 + n * 0.3);
    else c.copy(a).lerp(b, n);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const m = new Mesh(geo, new MeshLambertMaterial({ vertexColors: true }));
  m.receiveShadow = true;
  g.add(m);
  // and at ground level past the bank: the rest of the mulch bed, and a strip along the addition by the back path
  flat(g, BERM.x1, MULCH.x1, LANDING.z1, MULCH.z1, 0.02, lambert(MULCH_C));
  flat(g, FRANK_ADD.x1, BACK_PATH.x0 - 0.3, FRANK_ADD.z0, FRANK_ADD.z1, 0.02, lambert(MULCH_C));
  for (let i = 0; i < 26; i++) { // ornamental grasses and low shrubs in the beds
    const onSlope = i % 2 === 0;
    const bx = onSlope ? FRANK.x1 + 1.5 + rng(i + 970) * 5 : MULCH.x0 + 1 + rng(i + 970) * (MULCH.x1 - MULCH.x0 - 2);
    const bz = onSlope ? FRANK_LINK.z1 + 1 + rng(i + 980) * (FRANK.z1 - FRANK_LINK.z1) : 4 + rng(i + 980) * 6;
    if (Math.abs(bz - FRANK_DOOR.z) < 3.2 && onSlope) continue; // not on the east stairs
    if (!onSlope && Math.hypot(bx - SYCAMORE.x, bz - SYCAMORE.z) < 1.6) continue;
    box.add(bx, groundY(bx, bz) + 0.22, bz, 0.5, 0.45, 0.5, i % 3 ? 0x9a9a5c : 0x5f7d3a, rng(i) * 3);
  }
}

type Flight = { x0: number; x1: number; z0: number; z1: number; steps: number };

/** Granite steps with cheek walls and black rails. `up` is the way they climb. */
function flight({ g, box }: Kit, f: Flight, up: '+z' | '-x') {
  const alongZ = up === '+z';
  const run = alongZ ? f.z1 - f.z0 : f.x1 - f.x0;
  const tread = run / f.steps, rise = TERRACE_Y / f.steps;
  const cx = (f.x0 + f.x1) / 2, cz = (f.z0 + f.z1) / 2, wide = alongZ ? f.x1 - f.x0 : f.z1 - f.z0;
  for (let i = 0; i < f.steps; i++) {
    const h = (i + 1) * rise, rest = run - i * tread; // this step and everything above it
    const col = i % 2 ? GRANITE : 0xcac8c1;
    if (alongZ) {
      box.add(cx, h / 2, f.z1 - rest / 2, wide, h, rest, col);
      for (const x of [f.x0 - CHEEK / 2, f.x1 + CHEEK / 2]) box.add(x, (h + 0.35) / 2, f.z0 + (i + 0.5) * tread, CHEEK, h + 0.35, tread, 0xb4b2ab);
    } else {
      box.add(f.x0 + rest / 2, h / 2, cz, rest, h, wide, col);
      for (const z of [f.z0 - CHEEK / 2, f.z1 + CHEEK / 2]) box.add(f.x1 - (i + 0.5) * tread, (h + 0.35) / 2, z, tread, h + 0.35, CHEEK, 0xb4b2ab);
    }
  }
  const slope = Math.atan2(TERRACE_Y, run), len = Math.hypot(run, TERRACE_Y) + 0.6;
  const sides = alongZ ? [f.x0 - CHEEK / 2, f.x1 + CHEEK / 2] : [f.z0 - CHEEK / 2, f.z1 + CHEEK / 2];
  for (const s of sides) {
    const rail = mesh(g, new BoxGeometry(0.06, 0.06, len), lambert(IRON), alongZ ? s : cx, TERRACE_Y / 2 + 1.3, alongZ ? cz : s);
    if (alongZ) rail.rotation.x = -slope;
    else rail.rotation.set(-slope, Math.PI / 2, 0, 'YXZ'); // runs along x, high end at −x
    for (let k = 0; k <= 3; k++) {
      const t = 0.3 + (k / 3) * (run - 0.6);
      const px = alongZ ? s : f.x1 - t, pz = alongZ ? f.z0 + t : s;
      const y = (alongZ ? groundY(cx, pz) : groundY(px, cz)) + 0.35;
      box.add(px, y + 0.48, pz, 0.05, 0.95, 0.05, IRON);
    }
  }
}

/** Tan pavers at the foot, the two flights up the bank, a paved walk at the top of each; bollard lights and the sign. */
function stairs(k: Kit) {
  const { g, box } = k;
  const tex = paverTexture();
  const pavers = (x0: number, x1: number, z0: number, z1: number, y: number) => {
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set((x1 - x0) / 1.6, (z1 - z0) / 1.6);
    flat(g, x0, x1, z0, z1, y, new MeshLambertMaterial({ map: t }));
  };
  pavers(LANDING.x0, LANDING.x1, LANDING.z0, LANDING.z1, 0.035);
  pavers(STAIRS.x0 - 0.5, STAIRS.x1 + 0.5, STAIRS.z1, FRANK_LINK.z0, TERRACE_Y + 0.03); // up to the glass connector's doors
  pavers(FRANK.x1, STAIRS_E.x0, STAIRS_E.z0 - 0.5, STAIRS_E.z1 + 0.5, TERRACE_Y + 0.03); // up to the medallion door
  flight(k, STAIRS, '+z');
  flight(k, STAIRS_E, '-x');
  const brown = lambert(0x553a2a);
  for (const p of BOLLARDS) {
    const y = groundY(p.x, p.z);
    mesh(g, new CylinderGeometry(0.12, 0.13, 1.0, 10).translate(0, 0.5, 0), brown, p.x, y, p.z);
    box.add(p.x, y + 0.86, p.z, 0.2, 0.08, 0.2, 0xf3e3b8); // the lamp slot
  }
  // the black wayfinding sign, Wesleyan red on top, facing the road
  box.add(SIGN.x, 1.0, SIGN.z, 0.1, 2.0, 0.1, 0x111315);
  box.add(SIGN.x, 1.55, SIGN.z, 0.9, 1.3, 0.06, IRON);
  box.add(SIGN.x, 2.12, SIGN.z - 0.035, 0.9, 0.2, 0.02, 0xc8102e);
  for (let i = 0; i < 4; i++) box.add(SIGN.x - 0.1, 1.85 - i * 0.2, SIGN.z - 0.035, 0.55 - (i % 2) * 0.15, 0.05, 0.02, 0xe8e8e2);
}

/** A big sycamore: pale, peeling bark and long low limbs. */
function sycamore({ g, box }: Kit, x: number, z: number, s: number) {
  const y = groundY(x, z);
  const bark = lambert(0xb8ad96);
  mesh(g, new CylinderGeometry(0.5 * s, 0.8 * s, 6 * s, 8).translate(0, 3 * s, 0), bark, x, y, z);
  for (let i = 0; i < 14; i++) { // the mottled patches
    const a = rng(i + 950 + x) * Math.PI * 2, h = (0.6 + rng(i + 960) * 5) * s, r = (0.8 - h * 0.05) * s;
    box.add(x + Math.sin(a) * r, y + h, z + Math.cos(a) * r, 0.3, 0.45, 0.3, i % 2 ? 0x8f8770 : 0xd8d2be, a);
  }
  for (const [ry, tilt, len] of [[-2.2, 1.1, 7.5], [0.5, 1.0, 6.5], [2.4, 0.9, 6]] as const) { // long limbs
    const limb = new Mesh(new CylinderGeometry(0.22 * s, 0.38 * s, len * s, 6).translate(0, (len * s) / 2, 0), bark);
    limb.position.set(x, y + 4.6 * s, z);
    limb.rotation.set(0, ry + x, tilt, 'YXZ');
    limb.castShadow = true;
    g.add(limb);
  }
  const geo = new IcosahedronGeometry(1, 0);
  const blobs: [number, number, number, number][] = [[0, 9.5, 0, 4.6], [-4, 8, -2, 3.6], [-6.5, 7, -1, 3], [2.5, 8.3, -3, 3.4], [3, 8.6, 2.5, 3.2], [-2, 10.6, 2, 3]];
  blobs.forEach(([ox, oy, oz, r], i) => {
    const m = mesh(g, geo, lambert(i % 2 ? 0x7c9440 : 0x6d8a3a), x + ox * s, y + oy * s, z + oz * s);
    m.scale.set(r * s, r * 0.75 * s, r * s);
    m.rotation.y = i;
  });
}

/** White-framed sash window with a limestone sill and lintel. */
function sash(win: WindowBank, box: BoxBank, x: number, y: number, z: number, f: Facing, ww = 1.3, wh = 2.2) {
  const n = f === '-z' ? -1 : f === '+z' ? 1 : 0, e = f === '+x' ? 1 : f === '-x' ? -1 : 0;
  win.add('rect', x + e * 0.03, y, z + n * 0.03, ww, wh, f);
  const sx = e ? 0.2 : ww + 0.35, sz = e ? ww + 0.35 : 0.2;
  box.add(x + e * 0.08, y - wh / 2 - 0.08, z + n * 0.08, sx, 0.16, sz, LIME); // sill
  box.add(x + e * 0.06, y + wh / 2 + 0.12, z + n * 0.06, sx, 0.24, sz, LIME); // lintel
}

/**
 * The Frank Center's historic block: red brick, giant white corner pilasters, a white band under the top floor, a deep
 * white cornice with panelled parapet, a low grey metal hip roof. North end (to the field): five bays, an arched niche
 * with a little iron balcony in the middle. East side (to the plaza): a medallion in an arched niche over the door.
 */
function frankHistoric({ g, win, box }: Kit) {
  const Y = TERRACE_Y, { x0, x1, z0, z1, h } = FRANK;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
  const brick = lambert(0x9a4636, brickMap(), 'frank');
  const lime = lambert(LIME);
  mesh(g, block(w, h, d), brick, cx, Y, cz);
  box.add(cx, Y + 0.6, cz, w + 0.3, 1.2, d + 0.3, LIME); // base
  box.add(cx, Y + 11.2, cz, w + 0.2, 0.35, d + 0.2, LIME); // band under the top floor
  box.add(cx, Y + h - 0.6, cz, w + 1.0, 1.2, d + 1.0, LIME); // the deep cornice
  box.add(cx, Y + h + 0.5, cz, w + 0.4, 1.0, d + 0.4, LIME); // parapet
  for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) box.add(px, Y + h / 2, pz, 1.5, h, 1.5, LIME); // giant corner pilasters
  // little groups of balusters let into the parapet
  for (let i = 0; i < 4; i++) {
    const t = (i + 0.5) / 4;
    for (let b = -2; b <= 2; b++) {
      box.add(x0 + 1 + t * (w - 2) + b * 0.22, Y + h + 0.5, z0 - 0.22, 0.1, 0.55, 0.06, 0xc9c2b2);
      box.add(x1 + 0.22, Y + h + 0.5, z0 + 1 + t * (d - 2) + b * 0.22, 0.06, 0.55, 0.1, 0xc9c2b2);
    }
  }
  mesh(g, hipRoof(w - 1, 2.2, d - 1), lambert(0xb4babd), cx, Y + h + 1.0, cz); // low standing-seam metal roof
  box.add(cx, Y + h + 2.6, cz + d / 4, 2.4, 1.6, 1.6, 0x8e9497); // a vent box on it

  const floors = [Y + 2.3, Y + 5.9, Y + 9.2, Y + 12.9];
  const N = [-8, -4, 0, 4, 8]; // the five bays on the north end
  for (const dx of N) {
    floors.forEach((y, i) => {
      if (dx === 0 && i === 2) return; // the niche
      if (dx === 0 && i === 0) return; // the door
      sash(win, box, cx + dx, y, z0, '-z', 1.3, i === 3 ? 1.6 : 2.2);
    });
  }
  // north end, middle bay: door with a white surround, and the arched niche with its balcony above
  box.add(cx, Y + 1.6, z0 - 0.1, 2.2, 3.2, 0.2, LIME);
  box.add(cx, Y + 1.35, z0 - 0.22, 1.3, 2.5, 0.06, 0x2a2420);
  box.add(cx, Y + 9.2, z0 - 0.05, 2.6, 3.4, 0.1, 0xb35a45); // the niche's recessed brick
  const arch = mesh(g, new CylinderGeometry(1.4, 1.4, 0.14, 16, 1, false, Math.PI / 2, Math.PI), lime, cx, Y + 10.9, z0 - 0.08);
  arch.rotation.x = Math.PI / 2; // (the upper half of a disc, flat against the wall)
  win.add('arch', cx, Y + 9.4, z0 - 0.12, 1.3, 2.9, '-z');
  box.add(cx, Y + 12.35, z0 - 0.16, 0.5, 0.6, 0.2, LIME); // keystone
  box.add(cx, Y + 8.0, z0 - 0.45, 1.8, 0.1, 0.7, IRON); // balcony floor…
  box.add(cx, Y + 8.45, z0 - 0.78, 1.8, 0.8, 0.04, IRON); // …and railing

  // the east side (the plaza's): windows south of the glass connector, the medallion door in the middle
  for (let z = FRANK_LINK.z1 + 2.4; z < z1 - 1.5; z += 3.4) {
    if (Math.abs(z - FRANK_DOOR.z) < 1.8) continue;
    floors.forEach((y, i) => sash(win, box, x1, y, z, '+x', 1.25, i === 3 ? 1.6 : 2.1));
  }
  const dz = FRANK_DOOR.z, fx = x1 + 0.06;
  box.add(fx + 0.06, Y + 1.7, dz, 0.24, 3.4, 2.8, LIME); // door surround
  box.add(fx + 0.2, Y + 1.35, dz, 0.08, 2.6, 1.7, 0xf0ede4); // white double doors
  box.add(fx + 0.14, Y + 3.55, dz, 0.4, 0.35, 3.3, LIME); // little cornice over it
  box.add(fx + 0.04, Y + 5.6, dz, 0.16, 2.4, 2.6, LIME); // the niche, square part…
  const top = mesh(g, new CylinderGeometry(1.3, 1.3, 0.16, 16, 1, false, 0, Math.PI), lime, fx + 0.04, Y + 6.8, dz);
  top.rotation.z = Math.PI / 2; // …its round head (the upper half of a disc, flat against the wall)
  const disc = mesh(g, new CylinderGeometry(0.85, 0.85, 0.12, 20), lambert(0xd9d2c2), fx + 0.16, Y + 6.2, dz);
  disc.rotation.z = Math.PI / 2; // the medallion
  const relief = mesh(g, new CylinderGeometry(0.55, 0.55, 0.1, 16), lambert(0xc8c0ae), fx + 0.24, Y + 6.2, dz);
  relief.rotation.z = Math.PI / 2;
  box.add(fx + 0.04, Y + 8.2, dz, 0.12, 0.7, 3.4, 0xdcd5c5); // the name plaque
  // the west side (above Olin's connector) and the south end
  for (let z = z0 + 2.6; z < z1 - 1.5; z += 3.4) {
    floors.forEach((y, i) => {
      if (i < 2 && z > 22 && z < 48) return; // the limestone connector to Olin is against it here
      sash(win, box, x0, y, z, '-x', 1.25, i === 3 ? 1.6 : 2.1);
    });
  }
  for (const dx of N) floors.forEach((y, i) => sash(win, box, cx + dx, y, z1, '+z', 1.3, i === 3 ? 1.6 : 2.2));
}

/** The tall glass connector between the old block and the addition; its doors face the stairs up from the field road. */
function frankLink({ g, win, box }: Kit) {
  const { x0, x1, z0, z1, h } = FRANK_LINK;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  mesh(g, block(x1 - x0 - 0.3, h, z1 - z0 - 0.3), lambert(0x27323b), cx, 0, cz); // the dark inside, seen through the glass
  box.add(cx, h + 0.25, cz, x1 - x0 + 0.6, 0.5, z1 - z0 + 0.6, 0xf1efe8); // white roof edge
  const panes = 4, pw = (x1 - x0) / panes;
  for (const [z, f] of [[z0 - 0.05, '-z'], [z1 + 0.05, '+z']] as const) {
    for (let i = 0; i < panes; i++) {
      const x = x0 + (i + 0.5) * pw;
      win.add('rect', x, (TERRACE_Y + h) / 2, z, pw - 0.12, h - TERRACE_Y - 0.4, f);
      box.add(x0 + i * pw, (TERRACE_Y + h) / 2, z, 0.1, h - TERRACE_Y, 0.1, 0xd9dcdc); // mullions
    }
    box.add(cx, TERRACE_Y + 5.6, z, x1 - x0, 0.12, 0.12, 0xd9dcdc); // transom
  }
  // the doors at the top of the stairs: dark frames, a little canopy
  const dx = LINK_DOOR.x;
  for (const ox of [-1, 0, 1]) box.add(dx + ox, TERRACE_Y + 1.25, z0 - 0.1, 0.08, 2.5, 0.08, 0x2b2f33);
  box.add(dx, TERRACE_Y + 2.55, z0 - 0.1, 2.1, 0.1, 0.1, 0x2b2f33);
  box.add(dx, TERRACE_Y + 3.0, z0 - 0.8, 3.4, 0.16, 1.6, 0xf1efe8);
}

/**
 * The new addition at the foot of the bank: two tall storeys of brick under a deep white edge, a top floor set back with
 * a band of windows and its own white edge, tall cast-stone-framed windows, and the glass main entry onto the plaza.
 */
function frankAddition({ g, win, box }: Kit) {
  const { x0, x1, z0, z1, h } = FRANK_ADD;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
  const brick = lambert(0x9c4a38, brickMap(), 'frankAdd');
  const low = 8.4, back = 1.6; // the top floor steps back this much on the plaza and path sides
  mesh(g, block(w, low, d), brick, cx, 0, cz);
  box.add(cx, low + 0.25, cz, w + 1.2, 0.5, d + 1.2, 0xf1efe8); // deep white edge
  box.add(cx, 0.3, cz, w + 0.15, 0.6, d + 0.15, CREAM); // stone base
  const ux1 = x1 - back, uz1 = z1 - back;
  mesh(g, block(ux1 - x0, h - low - 0.5, uz1 - z0), brick, (x0 + ux1) / 2, low + 0.5, (z0 + uz1) / 2);
  box.add((x0 + ux1) / 2, h + 0.2, (z0 + uz1) / 2, ux1 - x0 + 1, 0.4, uz1 - z0 + 1, 0xf1efe8);
  // the top floor's band of windows
  for (let z = z0 + 1.6; z < uz1 - 0.8; z += 2.2) win.add('rect', ux1 + 0.03, low + 2.3, z, 1.6, 1.5, '+x');
  for (let x = x0 + 1.6; x < ux1 - 0.8; x += 2.2) { win.add('rect', x, low + 2.3, uz1 + 0.03, 1.6, 1.5, '+z'); win.add('rect', x, low + 2.3, z0 - 0.03, 1.6, 1.5, '-z'); }
  // tall windows in cast-stone frames
  const tall = (x: number, z: number, f: Facing) => {
    const e = f === '+x' ? 1 : 0, n = f === '-z' ? -1 : f === '+z' ? 1 : 0;
    const along = e !== 0;
    box.add(x + e * 0.12, 3.9, z + n * 0.12, along ? 0.24 : 3.2, 7.0, along ? 3.2 : 0.24, CREAM);
    for (const o of [-0.7, 0.7]) win.add('rect', x + e * 0.26 + (along ? 0 : o), 3.9, z + n * 0.26 + (along ? o : 0), 1.15, 6.3, f);
  };
  for (const z of [z0 + 5, cz, z1 - 5]) tall(x1, z, '+x');
  tall(cx, z0, '-z');
  tall(x1 - 3, z1, '+z');
  // the main entry onto the plaza: a tall glass bay in a stone frame, glass doors, "FRANK CENTER" over them
  const ex = MAIN_ENTRY.x;
  box.add(ex, 4.2, z1 + 0.14, 4.0, 8.0, 0.28, CREAM);
  win.add('rect', ex, 5.4, z1 + 0.3, 3.2, 4.6, '+z');
  win.add('rect', ex, 1.5, z1 + 0.3, 3.0, 2.8, '+z');
  for (const ox of [-1.5, 0, 1.5]) box.add(ex + ox, 1.5, z1 + 0.34, 0.08, 2.9, 0.06, 0x2b2f33);
  box.add(ex, 3.05, z1 + 0.9, 4.6, 0.14, 1.4, CREAM); // canopy
  const sign = new Mesh(new PlaneGeometry(3.0, 0.38), new MeshLambertMaterial({ map: signTexture('FRANK CENTER') }));
  sign.position.set(ex, 3.35, z1 + 1.61);
  g.add(sign);
}

/** The tar plaza at the foot of the bank: round wooden tables and chairs, teak benches, a green utility box, a bin. */
function plaza({ g, box }: Kit) {
  const { x0, x1, z0, z1 } = PLAZA_F;
  flat(g, x0, x1, z0, z1, 0.028, lambert(TAR));
  box.add(x0 - 0.1, 0.07, (z0 + z1) / 2, 0.25, 0.14, z1 - z0, 0xb9b8b1); // granite curb along the foot of the bank
  const teak = 0xa69478, teakDark = 0x8a7a62;
  for (const t of PLAZA_TABLES) {
    const top = mesh(g, new CylinderGeometry(0.6, 0.6, 0.06, 16), lambert(teak), t.x, 0.74, t.z);
    top.castShadow = true;
    box.add(t.x, 0.37, t.z, 0.12, 0.74, 0.12, teakDark);
    for (const c of plazaChairs(t)) {
      const bx = c.x - Math.sin(c.heading) * 0.22, bz = c.z - Math.cos(c.heading) * 0.22;
      box.add(c.x, 0.46, c.z, 0.46, 0.05, 0.46, teak, c.heading);
      box.add(bx, 0.72, bz, 0.46, 0.46, 0.04, teakDark, c.heading);
      box.add(c.x, 0.23, c.z, 0.42, 0.46, 0.04, teakDark, c.heading);
    }
  }
  for (const b of PLAZA_BENCHES) { // facing east, onto the plaza
    box.add(b.x, 0.44, b.z, 0.5, 0.06, 1.8, teak);
    box.add(b.x - 0.24, 0.72, b.z, 0.06, 0.5, 1.8, teak);
    for (const dz of [-0.8, 0.8]) box.add(b.x, 0.22, b.z + dz, 0.5, 0.44, 0.06, teakDark);
  }
  box.add(UTILITY_BOX.x, 0.75, UTILITY_BOX.z, 1.6, 1.5, 1.2, 0x3f5b45);
  box.add(PLAZA_BIN.x, 0.55, PLAZA_BIN.z, 0.7, 1.1, 0.7, 0x1c1e20);
}

/** Olin Library: a brick block on a limestone base, its north side bowed out into a drum of tall arched windows facing the field. */
function olin({ g, win, box }: Kit) {
  const Y = TERRACE_Y, { cx, cz, r, h, x0, x1, z1 } = OLIN;
  const brick = lambert(0x9a4636, brickMap(), 'frank');
  const lime = lambert(LIME);
  const base = 3; // limestone ground floor
  const bw = x1 - x0, bd = z1 - cz, bcx = (x0 + x1) / 2, bcz = (cz + z1) / 2;
  mesh(g, block(bw, h, bd), brick, bcx, Y, bcz);
  box.add(bcx, Y + base / 2, bcz, bw + 0.3, base, bd + 0.3, LIME);
  box.add(bcx, Y + 3.9, bcz, bw + 0.4, 0.25, bd + 0.4, LIME); // band
  box.add(bcx, Y + h - 0.2, bcz, bw + 0.8, 0.8, bd + 0.8, LIME); // cornice
  for (let x = x0 + 1; x < x1 - 0.5; x += 0.5) box.add(x, Y + h + 0.45, cz - 0.1, 0.12, 0.5, 0.12, 0xd8d2c4); // balustrade along the top
  box.add(bcx, Y + h + 0.75, cz - 0.1, bw - 0.6, 0.12, 0.25, LIME);
  box.add(bcx, Y + h + 0.25, bcz, bw - 0.4, 0.1, bd - 0.4, 0x55595c);
  for (const [px, pz] of [[x0, cz], [x1, cz], [x0, z1], [x1, z1]]) box.add(px, Y + h / 2, pz, 1.2, h, 1.2, LIME); // corners
  const tall = (x: number, z: number, f: number | Facing) => win.add('arch', x, Y + 7.6, z, 2, 6.6, f);
  for (let x = x0 + 3; x < x1 - 1.5; x += 4.2) {
    if (Math.abs(x - cx) > r + 1.6) tall(x, cz - 0.03, '-z'); // either side of the drum
    tall(x, z1 + 0.03, '+z');
  }
  for (let z = cz + 3; z < z1 - 1.5; z += 4.2) {
    tall(x0 - 0.03, z, '-x');
    if (z > OLIN_LINK.z1 + 2) tall(x1 + 0.03, z, '+x'); // (the connector to the Frank Center is against the rest)
  }
  // the drum: half a cylinder, bricks wrapped round it
  const drum = new CylinderGeometry(r, r, h, 48, 1, true, Math.PI / 2, Math.PI);
  const pos = drum.getAttribute('position'), uv = drum.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (Math.atan2(pos.getX(i), pos.getZ(i)) * r) / 2, (pos.getY(i) + h / 2) / 2);
  mesh(g, drum, brick, cx, Y + h / 2, cz);
  mesh(g, new CylinderGeometry(r + 0.15, r + 0.15, base, 48, 1, true, Math.PI / 2, Math.PI), lime, cx, Y + base / 2, cz);
  mesh(g, new CylinderGeometry(r + 0.4, r + 0.4, 0.8, 48, 1, false, Math.PI / 2, Math.PI), lime, cx, Y + h - 0.2, cz); // cornice + roof
  mesh(g, new CylinderGeometry(r + 0.2, r + 0.2, 0.25, 48, 1, false, Math.PI / 2, Math.PI), lime, cx, Y + 3.9, cz); // band
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = Math.PI / 2 + 0.22 + (i / (n - 1)) * (Math.PI - 0.44);
    const at = (rr: number) => ({ x: cx + rr * Math.sin(a), z: cz + rr * Math.cos(a) });
    const p = at(r + 0.04), q = at(r + 0.2), s = at(r + 0.12), b = at(r + 0.19);
    win.add('arch', p.x, Y + 7.6, p.z, 2.0, 6.6, a);
    box.add(q.x, Y + 4.2, q.z, 2.4, 0.18, 0.35, LIME, a); // sill
    box.add(s.x, Y + 11.05, s.z, 0.5, 0.6, 0.2, LIME, a); // keystone
    win.add('rect', b.x, Y + 1.6, b.z, 1.2, 1.1, a); // small windows in the base
  }
  // the flagpole, out front between Olin and the Frank Center
  const F = FLAGPOLE;
  mesh(g, new CylinderGeometry(0.05, 0.08, 11, 6).translate(0, 5.5, 0), lambert(0xe8e8e4), F.x, Y, F.z);
  box.add(F.x, Y + 11.05, F.z, 0.22, 0.22, 0.22, 0xd4af37); // gilt finial
  box.add(F.x, Y + 10.3, F.z - 0.8, 0.04, 0.9, 1.5, 0xb22234); // the flag, hanging still
  box.add(F.x, Y + 10.5, F.z - 0.45, 0.05, 0.45, 0.65, 0x3c3b6e);
}

/** Between Olin and the Frank Center: a pale limestone connector, and a glass entrance pavilion under a thin flat roof in front of it. */
function olinLink({ g, win, box }: Kit) {
  const Y = TERRACE_Y, L = OLIN_LINK, P = PAVILION;
  const lcx = (L.x0 + L.x1) / 2, lcz = (L.z0 + L.z1) / 2;
  mesh(g, block(L.x1 - L.x0, L.h, L.z1 - L.z0), lambert(0xd8d1c1, stoneMap(), 'limeLink'), lcx, Y, lcz);
  box.add(lcx, Y + L.h + 0.15, lcz, L.x1 - L.x0 + 0.2, 0.3, L.z1 - L.z0 + 0.3, 0xc9c2b2);
  for (const z of [L.z0 + 6, L.z1 - 5]) win.add('rect', lcx, Y + 4.6, z, 0.9, 1.4, '-z'); // (a few narrow slots, high up)
  const pcx = (P.x0 + P.x1) / 2, pcz = (P.z0 + P.z1) / 2;
  mesh(g, block(P.x1 - P.x0 - 0.3, P.h, P.z1 - P.z0 - 0.3), lambert(0x2a333a), pcx, Y, pcz);
  const panes = 4, pw = (P.x1 - P.x0) / panes;
  for (let i = 0; i < panes; i++) {
    const x = P.x0 + (i + 0.5) * pw;
    win.add('rect', x, Y + P.h / 2, P.z0 - 0.05, pw - 0.1, P.h - 0.3, '-z');
    box.add(P.x0 + i * pw, Y + P.h / 2, P.z0 - 0.06, 0.08, P.h, 0.08, 0x3a3027);
  }
  for (const [x, f] of [[P.x0 - 0.05, '-x'], [P.x1 + 0.05, '+x']] as const) win.add('rect', x, Y + P.h / 2, pcz, P.z1 - P.z0 - 0.4, P.h - 0.3, f);
  // the thin dark roof, overhanging all round (like Zelnick's)
  const roof = mesh(g, new BoxGeometry(P.x1 - P.x0 + 2.4, 0.25, P.z1 - P.z0 + 2.4), lambert(0x5a4632), pcx, Y + P.h + 0.12, pcz - 0.4);
  roof.rotation.x = 0.03;
  for (const ox of [-0.8, 0.8]) box.add(pcx + ox, Y + 1.2, P.z0 - 0.1, 0.06, 2.4, 0.06, 0x2b2f33); // the doors
  box.add(pcx, Y + 0.04, P.z0 - 1.6, 4, 0.08, 3, 0xbdb7a8); // a pale apron in front
}

/**
 * Allbritton Center (from the user's photos): two floors of pale limestone, two of red brick between stone pilasters,
 * a deep cornice, a red tiled hip roof with an ornate brick gable over the middle and two chimneys; an arched entrance
 * and a tall arched window over it, where the back path runs up to it.
 */
function allbritton({ g, win, box }: Kit) {
  const { x0, x1, z0, z1, h } = ALLBRITTON;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
  const stoneH = 7.4;
  mesh(g, block(w, stoneH, d), lambert(0xd9cfbb, stoneMap(), 'allbStone'), cx, 0, cz);
  mesh(g, block(w, h - stoneH, d), lambert(0x9e4a36, brickMap(), 'allb'), cx, stoneH, cz);
  box.add(cx, stoneH + 0.15, cz, w + 0.3, 0.3, d + 0.3, 0xd9cfbb); // band
  box.add(cx, h - 0.3, cz, w + 1.2, 0.8, d + 1.2, 0xe2d9c6); // cornice
  mesh(g, hipRoof(w + 1, 4.2, d + 1), lambert(0x8a3a2c), cx, h + 0.1, cz);
  // the gable over the middle of the front, and two chimneys
  const gab = mesh(g, prism(10, 4.6, 3.2), lambert(0x9e4a36, brickMap(), 'allb'), cx, h + 0.1, z0 + 1.2);
  gab.castShadow = true;
  box.add(cx, h + 2.2, z0 - 0.42, 1.6, 1.6, 0.16, 0xe2d9c6); // its stone cartouche
  for (const dx of [-w / 2 + 4, w / 2 - 4]) box.add(cx + dx, h + 3.6, cz, 1.4, 3.6, 1.8, 0x8e4434);
  // windows: tall pairs in each bay, stone pilasters up the brick floors
  const bays = 9, pitch = w / bays, ys = [2.2, 5.6, 9.2, 12.8];
  for (let b = 0; b < bays; b++) {
    const x = x0 + (b + 0.5) * pitch, mid = b === (bays - 1) / 2;
    ys.forEach((y, i) => {
      if (mid && i < 2) return; // the entrance
      if (mid && i === 2) { win.add('arch', x, y + 0.6, z0 - 0.03, 1.8, 3.6, '-z'); return; }
      win.add('rect', x, y, z0 - 0.03, 1.9, 2.3, '-z');
      win.add('rect', x, y, z1 + 0.03, 1.9, 2.3, '+z');
    });
    box.add(x0 + b * pitch, (stoneH + h) / 2, z0 - 0.12, 0.6, h - stoneH, 0.24, 0xe2d9c6);
  }
  for (let z = z0 + 2.2; z < z1 - 1; z += 3.3) for (const y of ys) { win.add('rect', x0 - 0.03, y, z, 1.8, 2.3, '-x'); win.add('rect', x1 + 0.03, y, z, 1.8, 2.3, '+x'); }
  // the arched entrance and its steps, where the back path arrives
  const dx = ALLBRITTON_DOOR.x;
  box.add(dx, 2.4, z0 - 0.2, 3.6, 4.8, 0.4, 0xe2d9c6);
  win.add('arch', dx, 2.2, z0 - 0.42, 2.2, 3.6, '-z');
  box.add(dx, 1.4, z0 - 0.45, 1.8, 2.8, 0.05, 0x2a2420);
  for (let s = 0; s < 3; s++) box.add(dx, 0.1 + s * 0.15, z0 - 1.6 + s * 0.4, 5 - s * 0.6, 0.15 + s * 0.15, 1.2, 0xc9c2b2);
}
