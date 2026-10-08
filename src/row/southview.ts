import {
  BoxGeometry, BufferGeometry, CanvasTexture, Color, CylinderGeometry, Float32BufferAttribute, Group, IcosahedronGeometry,
  Material, Mesh, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace, Vector3,
} from 'three';
import { BoxBank, Facing, WindowBank, block, brickMap, hipRoof, lambert, prism, seeGlass, stoneMap } from './kit';
import { buildPruzan } from './pruzanview';
import { buildOlin } from './olinview';
import { buildClark } from './clarkview';
import { buildChurch } from './churchview';
import { allbrittonRear } from './allbview';
import { BACK_PATH } from './layout';
import { noise2, rng } from './noise';
import {
  ALLB_FORECOURT, ALLB_WELLS, ALLBRITTON, ALLBRITTON_DOOR, BERM, BOLLARDS, CHEEK, FIELD_ROAD, FRANK, FRANK_ADD, FRANK_DOOR, FRANK_LINK, LANDING,
  CLASS_TAKEN, FRANK_ROOMS, FRANK_WINDOWS, GRAND_STAIR, LINK_DOOR, LOUNGE, LOUNGE_SEATS, LOUNGE_TABLES, LINK_DOOR_S, LINK_WALK, MAIN_ENTRY, MULCH, classroom, PLAZA_BENCHES, PLAZA_BIN, PLAZA_F, PLAZA_TABLES, SIGN, STAIRS,
  STAIRS_E, OLIN_WALK, OLIN_LAWN, OLIN_SITE, CLARK_SITE, BANK_FLIGHTS, FRANK_NICHE_W, FRANK_NICHE_N, PRUZAN_LINK_N, PRUZAN_ENTRY, STAIRS_W, SYCAMORE, SYCAMORE2, TERRACE_Y, UTILITY_BOX, groundY, plazaChairs, terrainY,
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

/**
 * Groups that only need drawing when you're near enough to see them: the fog is solid by 330 m, so past `FAR` m from
 * their outline they're hidden (`southLOD`). From your house, up High Street, that saves a couple of hundred draw calls.
 */
const FAR = 300;
const LODS: { g: Group; x0: number; x1: number; z0: number; z1: number }[] = [];
function far(k: Kit, r: { x0: number; x1: number; z0: number; z1: number }, build: (k: Kit) => void) {
  const g = new Group();
  k.g.add(g);
  build({ ...k, g });
  LODS.push({ g, ...r });
}
/** Show or hide the far groups for a camera at (x, z). Cheap: call every few frames. */
export function southLOD(x: number, z: number) {
  for (const l of LODS) l.g.visible = Math.hypot(Math.max(l.x0 - x, 0, x - l.x1), Math.max(l.z0 - z, 0, z - l.z1)) < FAR;
}

export function buildSouthEnd(k: Kit) {
  LODS.length = 0;
  road(k);
  bank(k);
  stairs(k);
  sycamore(k, SYCAMORE.x, SYCAMORE.z, 1);
  sycamore(k, SYCAMORE2.x, SYCAMORE2.z, 0.9);
  frankHistoric(k);
  frankLink(k);
  frankAddition(k);
  plaza(k);
  far(k, { x0: OLIN_SITE.x0 - 2, x1: OLIN_SITE.x1 + 1, z0: 0, z1: OLIN_SITE.z1 + 2 }, buildOlin); // Olin Library, its portico, steps and lawn (olinview.ts)
  far(k, { x0: OLIN_SITE.x1, x1: FRANK.x0, z0: 9, z1: OLIN_WALK.z0 }, buildPruzan); // the art center in the gap between them (its gallery block, against Olin, is in there too)
  allbritton(k);
  allbrittonRear(k); // its back onto Church Street, the rear door, the lot (allbview.ts)
  far(k, { x0: CLARK_SITE.x0, x1: CLARK_SITE.x1, z0: CLARK_SITE.z0, z1: CLARK_SITE.z1 }, buildClark); // Clark Hall, west of Olin (clarkview.ts)
  buildChurch(k); // Church Street, and the walkway down the bank to it (churchview.ts)
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
    pos.setY(i, terrainY(x, z) + 0.012); // (under Olin's steps, the grass stays at the lawn's height)
    const n = noise2(x / 9, z / 9);
    const bed = (x > MULCH.x0 && z < 10.5) // round the sycamore, east of the stairs
      || (x > FRANK.x1 + 1 && z > FRANK_LINK.z1 && z < STAIRS_E.z0 - 1.5); // down the slope to the plaza
    if (bed) c.copy(mulch).multiplyScalar(0.85 + n * 0.3);
    else c.copy(a).lerp(b, n);
    if (!bed && x > OLIN_LAWN.x0 && x < OLIN_LAWN.x1 && z > OLIN_LAWN.z0 && z < OLIN_LAWN.z1) c.multiplyScalar(Math.floor((x - OLIN_LAWN.x0) / 3) % 2 ? 1.06 : 0.95); // Olin's lawn, mown in stripes
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
    const bz = onSlope ? FRANK_LINK.z1 + 1 + rng(i + 980) * (STAIRS_E.z0 - 3 - FRANK_LINK.z1) : 4 + rng(i + 980) * 6;
    if (Math.abs(bz - FRANK_DOOR.z) < 2.2 && onSlope && bx < LINK_WALK.x0) continue; // not on the way to the medallion door
    if (!onSlope && Math.hypot(bx - SYCAMORE.x, bz - SYCAMORE.z) < 1.6) continue;
    if (bx > LINK_WALK.x0 - 0.5 && bx < LINK_WALK.x1 + 0.5 && bz > LINK_WALK.z0 && bz < LINK_WALK.z1 + 1.5) continue; // nor on the walk to the south doors
    box.add(bx, groundY(bx, bz) + 0.22, bz, 0.5, 0.45, 0.5, i % 3 ? 0x9a9a5c : 0x5f7d3a, rng(i) * 3);
  }
}

type Flight = { x0: number; x1: number; z0: number; z1: number; steps: number };

/** Granite steps with cheek walls and black rails. `up` is the way they climb. */
function flight({ g, box }: Kit, f: Flight, up: '+z' | '-x', top = TERRACE_Y, rails = true) {
  const alongZ = up === '+z';
  const run = alongZ ? f.z1 - f.z0 : f.x1 - f.x0;
  const tread = run / f.steps, rise = top / f.steps;
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
  const sides = !rails ? [] : alongZ ? [f.x0 - CHEEK / 2, f.x1 + CHEEK / 2] : [f.z0 - CHEEK / 2, f.z1 + CHEEK / 2];
  for (const s of sides) {
    // the handrail: from just past the bottom step to just past the top, 1.3 m over the cheek wall all the way, so it
    // follows the flight whichever way it climbs (+z for the north stairs, −x for the east ones)
    const at = (t: number) => { // t: metres up the run from the bottom
      const x = alongZ ? s : f.x1 - t, z = alongZ ? f.z0 + t : s;
      return new Vector3(x, (top * Math.min(1, Math.max(0, t / run))) + 1.3, z);
    };
    const lo = at(0.15), hi = at(run - 0.15);
    const rail = mesh(g, new BoxGeometry(0.06, 0.06, lo.distanceTo(hi)), lambert(IRON), (lo.x + hi.x) / 2, (lo.y + hi.y) / 2, (lo.z + hi.z) / 2);
    rail.lookAt(hi);
    for (let k = 0; k <= 3; k++) {
      const t = 0.3 + (k / 3) * (run - 0.6);
      const px = alongZ ? s : f.x1 - t, pz = alongZ ? f.z0 + t : s;
      const y = at(t).y - 1.3 + 0.35; // the cheek's top here
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
  pavers(LINK_WALK.x0, LINK_WALK.x1, LINK_WALK.z0, LINK_WALK.z1, TERRACE_Y + 0.031); // from the walk to Olin north to the connector's south doors…
  pavers(FRANK.x1, LINK_WALK.x0, FRANK_DOOR.z - 1.4, FRANK_DOOR.z + 1.4, TERRACE_Y + 0.031); // …with a turn to the medallion door
  // the concrete walk from the top of the east stairs west to Olin's front door
  const W = OLIN_WALK, slabs = slabTexture();
  slabs.repeat.set((W.x1 - W.x0) / 1.5, (W.z1 - W.z0) / 1.5);
  flat(g, W.x0, W.x1, W.z0, W.z1, TERRACE_Y + 0.03, new MeshLambertMaterial({ map: slabs }));
  flight(k, STAIRS, '+z');
  flight(k, STAIRS_E, '-x');
  flight(k, STAIRS_W, '+z', TERRACE_Y, false); // down the bank in front of the Pruzan's gallery block (no rails)
  for (const f of BANK_FLIGHTS) flight(k, f, '+z', groundY((f.x0 + f.x1) / 2, f.z1 + 0.05), false); // and along Olin's drum, and at the fence's west end (no rails: Olin's steps have none)
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
      if (i < 2 && z > PRUZAN_LINK_N.z0 - 0.8 && z < PRUZAN_ENTRY.z1 + 0.8) return; // the Pruzan's glass link is against it here
      if (i < 2 && Math.abs(z - FRANK_NICHE_W) < 2) return; // the niches
      if (i < 3 && Math.abs(z - FRANK_NICHE_N) < 2) return;
      sash(win, box, x0, y, z, '-x', 1.25, i === 3 ? 1.6 : 2.1);
    });
  }
  // looking onto the Pruzan's courtyard, another medallion in an arched niche over a blind stone panel (the photos)
  {
    const nz = FRANK_NICHE_W, nx = x0 - 0.06;
    box.add(nx - 0.04, Y + 2.0, nz, 0.16, 2.6, 2.0, LIME); // the blind panel…
    box.add(nx - 0.1, Y + 3.4, nz, 0.3, 0.25, 2.4, LIME); // …its cornice
    box.add(nx - 0.04, Y + 5.6, nz, 0.16, 2.4, 2.6, LIME); // the niche, square part…
    const head = mesh(g, new CylinderGeometry(1.3, 1.3, 0.16, 16, 1, false, 0, Math.PI), lime, nx - 0.04, Y + 6.8, nz);
    head.rotation.z = Math.PI / 2; // …its round head
    const md = mesh(g, new CylinderGeometry(0.85, 0.85, 0.12, 20), lambert(0xd9d2c2), nx - 0.16, Y + 6.2, nz);
    md.rotation.z = Math.PI / 2;
    const rl = mesh(g, new CylinderGeometry(0.55, 0.55, 0.1, 16), lambert(0xc8c0ae), nx - 0.24, Y + 6.2, nz);
    rl.rotation.z = Math.PI / 2;
  }
  // and onto the tables further north, a tall arched niche in a white surround, a pale panel let into it (the photo)
  {
    const nz = FRANK_NICHE_N, nx = x0 - 0.06;
    box.add(nx + 0.02, Y + 4.2, nz, 0.1, 8.4, 2.8, 0x8a3e30); // the recess, darker brick
    box.add(nx - 0.04, Y + 4.0, nz, 0.14, 7.2, 1.6, 0xe9e3d4); // the pale panel
    for (const e of [-1, 1]) box.add(nx - 0.06, Y + 4.2, nz + e * 1.5, 0.2, 8.4, 0.3, LIME); // the white surround
    const head = mesh(g, new CylinderGeometry(1.6, 1.6, 0.2, 16, 1, false, 0, Math.PI), lime, nx - 0.06, Y + 8.4, nz);
    head.rotation.z = Math.PI / 2;
    const inner = mesh(g, new CylinderGeometry(1.35, 1.35, 0.22, 16, 1, false, 0, Math.PI), lambert(0x8a3e30), nx - 0.05, Y + 8.4, nz);
    inner.rotation.z = Math.PI / 2;
    box.add(nx - 0.16, Y + 10.0, nz, 0.3, 0.55, 0.5, LIME); // keystone
  }
  for (const dx of N) floors.forEach((y, i) => sash(win, box, cx + dx, y, z1, '+z', 1.3, i === 3 ? 1.6 : 2.2));
}

/** The tall glass connector between the old block and the addition; its doors face the stairs up from the field road. */
function frankLink({ g, box }: Kit) {
  const { x0, x1, z0, z1, h } = FRANK_LINK;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  lounge(g); // the lounge inside, seen through the glass
  mesh(g, block(x1 - x0, TERRACE_Y, z1 - z0), lambert(0xb8b2a8), cx, 0, cz); // its floor stands on the bank
  box.add(cx, LOUNGE.ceil + (h - LOUNGE.ceil) / 2, cz, x1 - x0 - 0.2, h - LOUNGE.ceil, z1 - z0 - 0.2, 0xc9cbcc); // above the ceiling
  box.add(cx, h + 0.25, cz, x1 - x0 + 0.6, 0.5, z1 - z0 + 0.6, 0xf1efe8); // white roof edge
  const panes = 4, pw = (x1 - x0) / panes;
  for (const z of [z0 - 0.05, z1 + 0.05]) {
    for (let i = 0; i < panes; i++) {
      const x = x0 + (i + 0.5) * pw;
      const glass = new Mesh(new PlaneGeometry(pw - 0.12, h - TERRACE_Y - 0.4), seeGlass());
      glass.position.set(x, (TERRACE_Y + h) / 2, z);
      glass.userData.glass = true;
      g.add(glass);
      box.add(x0 + i * pw, (TERRACE_Y + h) / 2, z, 0.1, h - TERRACE_Y, 0.1, 0xd9dcdc); // mullions
    }
    box.add(cx, TERRACE_Y + 5.6, z, x1 - x0, 0.12, 0.12, 0xd9dcdc); // transom
  }
  // the doors at the top of the stairs: dark frames, a little canopy
  const dx = LINK_DOOR.x;
  for (const ox of [-1, 0, 1]) box.add(dx + ox, TERRACE_Y + 1.25, z0 - 0.1, 0.08, 2.5, 0.08, 0x2b2f33);
  box.add(dx, TERRACE_Y + 2.55, z0 - 0.1, 2.1, 0.1, 0.1, 0x2b2f33);
  box.add(dx, TERRACE_Y + 3.0, z0 - 0.8, 3.4, 0.16, 1.6, 0xf1efe8);
  // and its other doors, in the south face, at the end of the paver walk from the east stairs
  const ds = LINK_DOOR_S.x, sz = z1 + 0.1;
  for (const ox of [-1, 0, 1]) box.add(ds + ox, TERRACE_Y + 1.25, sz, 0.08, 2.5, 0.08, 0x2b2f33);
  box.add(ds, TERRACE_Y + 2.55, sz, 2.1, 0.1, 0.1, 0x2b2f33);
  for (const ox of [-0.25, 0.25]) box.add(ds + ox, TERRACE_Y + 1.2, sz + 0.06, 0.04, 0.45, 0.04, 0xd0d4d6); // pulls
  box.add(ds, TERRACE_Y + 3.0, z1 + 0.8, 3.0, 0.16, 1.6, 0xf1efe8); // canopy
}

/**
 * The new addition at the foot of the bank: two tall storeys of brick under a deep white edge, a top floor set back with
 * a band of windows and its own white edge, tall cast-stone-framed see-through windows, and the glass main entry.
 */
function frankAddition({ g, win, box }: Kit) {
  const { x0, x1, z0, z1, h } = FRANK_ADD;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
  const brick = lambert(0x9c4a38, brickMap(), 'frankAdd');
  const low = 8.4, back = 1.6; // the top floor steps back this much on the plaza and path sides
  const F = FRANK_ROOMS, E = MAIN_ENTRY, wall = 0.4;
  // the two tall storeys, hollowed at the front (by the back path) for the classroom and the lobby: the block behind it, the ends beside
  // it, and the slab over it
  mesh(g, block(F.x0 - x0, low, d), brick, (x0 + F.x0) / 2, 0, cz);
  mesh(g, block(x1 - F.x0, low, F.z0 - z0), brick, (F.x0 + x1) / 2, 0, (z0 + F.z0) / 2);
  mesh(g, block(x1 - F.x0, low, z1 - F.z1), brick, (F.x0 + x1) / 2, 0, (F.z1 + z1) / 2);
  mesh(g, block(x1 - F.x0, low - F.ceil, F.z1 - F.z0), brick, (F.x0 + x1) / 2, F.ceil, (F.z0 + F.z1) / 2);
  box.add(cx, low + 0.25, cz, w + 1.2, 0.5, d + 1.2, 0xf1efe8); // deep white edge
  box.add(cx, 0.3, cz, w + 0.15, 0.6, d + 0.15, CREAM); // stone base (the rooms' floor stands on it)
  const ux1 = x1 - back, uz1 = z1 - back;
  mesh(g, block(ux1 - x0, h - low - 0.5, uz1 - z0), brick, (x0 + ux1) / 2, low + 0.5, (z0 + uz1) / 2);
  box.add((x0 + ux1) / 2, h + 0.2, (z0 + uz1) / 2, ux1 - x0 + 1, 0.4, uz1 - z0 + 1, 0xf1efe8);
  // the top floor's band of windows
  for (let z = z0 + 1.6; z < uz1 - 0.8; z += 2.2) win.add('rect', ux1 + 0.03, low + 2.3, z, 1.6, 1.5, '+x');
  for (let x = x0 + 1.6; x < ux1 - 0.8; x += 2.2) { win.add('rect', x, low + 2.3, uz1 + 0.03, 1.6, 1.5, '+z'); win.add('rect', x, low + 2.3, z0 - 0.03, 1.6, 1.5, '-z'); }
  // the front wall: brick piers between real openings (the tall windows, and the entry bay up to the ceiling)
  const openings = [
    ...FRANK_WINDOWS.map((z) => ({ z0: z - 1.3, z1: z + 1.3, y0: 0.75, y1: 7.05 })),
    { z0: E.z - E.half + 0.15, z1: E.z + E.half - 0.15, y0: F.floor, y1: F.ceil },
  ].sort((a, b) => a.z0 - b.z0);
  const fw = (za: number, zb: number, ya: number, yb: number) => {
    if (zb - za > 0.01 && yb - ya > 0.01) mesh(g, block(wall, yb - ya, zb - za), brick, x1 - wall / 2, ya, (za + zb) / 2);
  };
  let zPrev = F.z0;
  for (const o of openings) {
    fw(zPrev, o.z0, 0, F.ceil); // the pier before it
    fw(o.z0, o.z1, 0, o.y0); // under it
    fw(o.z0, o.z1, o.y1, F.ceil); // over it
    zPrev = o.z1;
  }
  fw(zPrev, F.z1, 0, F.ceil);
  // the tall windows: a cast-stone frame round real glass, a mullion, a transom
  const pane = (x: number, y: number, z: number, pw: number, ph: number, f: Facing) => {
    const m = new Mesh(new PlaneGeometry(pw, ph), seeGlass());
    m.position.set(x, y, z);
    m.rotation.y = f === '+x' ? Math.PI / 2 : f === '-x' ? -Math.PI / 2 : f === '-z' ? Math.PI : 0;
    m.userData.glass = true;
    g.add(m);
  };
  for (const z of FRANK_WINDOWS) {
    pane(x1 + 0.02, 3.9, z, 2.6, 6.3, '+x');
    for (const o of [-1.45, 1.45]) box.add(x1 + 0.12, 3.9, z + o, 0.3, 7.0, 0.3, CREAM); // jambs
    for (const y of [0.68, 7.12]) box.add(x1 + 0.12, y, z, 0.3, 0.16, 3.2, CREAM); // sill and head
    box.add(x1 + 0.06, 3.9, z, 0.1, 6.3, 0.1, 0x8f9496); // mullion
    box.add(x1 + 0.06, 3.9, z, 0.1, 0.12, 2.6, 0x8f9496); // transom
  }
  // the other tall windows (the plaza and field sides) are dark glass: nothing to see in there
  const darkTall = (x: number, z: number, f: Facing) => {
    const n = f === '+z' ? 1 : -1;
    win.add('rect', x, 3.9, z + n * 0.26, 2.6, 6.3, f);
    box.add(x, 3.9, z + n * 0.12, 3.2, 7.0, 0.24, CREAM);
    box.add(x, 3.9, z + n * 0.34, 0.1, 6.3, 0.12, 0x8f9496);
  };
  darkTall(cx, z0, '-z');
  darkTall(x1 - 3, z1, '+z');
  darkTall(E.x - 7.5, z1, '+z');
  frankRooms(g);

  // the main entry, onto the back path across from Judd (the user's photo): a tall glass bay standing out from the
  // east face in a cast-stone frame, glass doors at its foot under a canopy, "FRANK CENTER" on the canopy's edge
  const bx = x1 + E.out, ez = E.z, bw = E.half * 2;
  box.add(x1 + E.out / 2, 4.2, ez - E.half, E.out, 8.4, 0.3, CREAM); // the frame's sides…
  box.add(x1 + E.out / 2, 4.2, ez + E.half, E.out, 8.4, 0.3, CREAM);
  box.add(x1 + E.out / 2, 8.25, ez, E.out + 0.2, 0.5, bw + 0.5, CREAM); // …and head
  box.add(x1 + E.out / 2, 0.15, ez, E.out, 0.3, bw, 0xc9c5bd); // floor
  pane(bx - 0.05, 4.1, ez, bw - 0.3, 8.0, '+x'); // all glass: you see straight in to the grand stair
  for (const side of [-1, 1]) pane(x1 + E.out / 2, 4.1, ez + side * (E.half - 0.15), E.out - 0.1, 8.0, side > 0 ? '+z' : '-z');
  for (const o of [-1.4, -0.7, 0, 0.7, 1.4]) box.add(bx + 0.02, 4.2, ez + o, 0.08, 7.8, 0.08, 0x8f9496); // mullions
  box.add(bx + 0.02, 2.8, ez, 0.12, 0.14, bw, 0x8f9496); // the transom over the doors
  for (const o of [-0.35, 0.35]) box.add(bx + 0.08, 1.2, ez + o, 0.04, 0.5, 0.04, 0xd0d4d6); // door pulls
  box.add(bx + 0.7, 3.1, ez, 1.6, 0.16, bw + 0.6, CREAM); // canopy
  const sign = new Mesh(new PlaneGeometry(3.0, 0.38), new MeshLambertMaterial({ map: signTexture('FRANK CENTER') }));
  sign.position.set(bx + 1.51, 3.35, ez);
  sign.rotation.y = Math.PI / 2;
  g.add(sign);
  flat(g, bx, BACK_PATH.x0 + 0.05, ez - 1.6, ez + 1.6, 0.025, lambert(0xc9c5bd)); // a paved walk across the bed to the path
}

/**
 * The rooms behind the addition's east glass (the architects' photos), unlit (they're lit rooms) and in one batch: the
 * classroom behind the windows across from Judd, and the lobby with its grand stair behind the entry bay.
 */
function frankRooms(g: Group) {
  const R = FRANK_ROOMS, k = new BoxBank();
  const x0 = R.x0, x1 = R.x1 - 0.4, y0 = R.floor, y1 = R.ceil, cx = (x0 + x1) / 2;
  // ── the classroom ──
  const cz0 = R.z0, cz1 = R.split, clen = cz1 - cz0;
  k.add(cx, y0 + 0.01, (cz0 + cz1) / 2, x1 - x0, 0.02, clen, 0x8a8580); // carpet
  k.add(cx, 4.6, (cz0 + cz1) / 2, x1 - x0, 0.04, clen, 0xeeeeec); // its own ceiling, lower than the lobby's
  for (const dx of [-1.6, 0, 1.6]) k.add(cx + dx, 4.57, (cz0 + cz1) / 2 + 1, 0.12, 0.03, clen - 5, 0xffffff); // light strips
  k.add(x0 + 0.03, 2.6, (cz0 + cz1) / 2, 0.06, 4.0, clen, 0x6f6a1f); // the olive acoustic wall at the back
  k.add(cx, 2.6, cz0 + 0.03, x1 - x0, 4.0, 0.06, 0xeeeeea); // the north wall…
  for (const dx of [-1.55, 1.55]) { // …with its two big whiteboards, scrawled on
    k.add(cx + dx, 2.1, cz0 + 0.08, 2.9, 2.0, 0.04, 0xfafbfa);
    k.add(cx + dx, 1.05, cz0 + 0.12, 2.9, 0.06, 0.12, 0xb6b9bb);
    for (const yy of [2.5, 2.2, 1.9]) k.add(cx + dx - 0.3, yy, cz0 + 0.11, 1.6, 0.03, 0.01, 0x6a85a8);
  }
  k.add(x0 + 0.12, 3.6, cz0 + 4.5, 0.1, 0.9, 2.6, 0x1f2326); // two big screens on the back wall
  k.add(x0 + 0.12, 3.6, cz0 + 7.3, 0.1, 0.9, 2.6, 0x1f2326);
  k.add(cx, 4.4, cz0 + 4, 0.4, 0.2, 0.3, 0xe9e9e6); // the projector
  k.add(cx + 1.2, y0 + 0.5, cz0 + 1.3, 0.8, 1.0, 0.6, 0x9a9da0); // the lectern
  const cls = classroom();
  for (const d of cls.desks) { // curved desks (pale wood) on their tiers, chairs behind
    const along = d.rot + Math.PI / 2;
    k.add(d.x, d.y - 0.02, d.z + 0.3, 1.4, 0.04, 1.4, 0x8a8580); // the tier's step
    k.add(d.x, d.y + 0.74, d.z, 1.3, 0.05, 0.42, 0xd8b98a, along - Math.PI / 2);
    k.add(d.x, d.y + 0.37, d.z, 1.2, 0.72, 0.06, 0x9fa3a6, along - Math.PI / 2);
  }
  cls.seats.forEach((s, i) => {
    if (CLASS_TAKEN.includes(i)) return; // (people sit in those)
    k.add(s.x, s.y + 0.46, s.z, 0.46, 0.06, 0.46, 0x2c2f33, s.heading);
    k.add(s.x - Math.sin(s.heading) * 0.22, s.y + 0.78, s.z - Math.cos(s.heading) * 0.22, 0.46, 0.6, 0.06, 0x2c2f33, s.heading);
  });
  k.add(cx, 2.3, cz1 - 0.03, x1 - x0, 4.6, 0.06, 0xeeeeea); // the wall between the classroom and the lobby
  k.add(cx, 6.1, cz1 - 0.03, x1 - x0, 3.0, 0.06, 0xe8e3d6);

  // ── the lobby and its grand stair ──
  const lz0 = R.split, lz1 = R.z1, G = GRAND_STAIR, cream = 0xe8e3d6;
  k.add(cx, y0 + 0.01, (lz0 + lz1) / 2, x1 - x0, 0.02, lz1 - lz0, 0x6f6c69); // dark carpet
  k.add(x0 + 0.03, (y0 + y1) / 2, (lz0 + lz1) / 2, 0.06, y1 - y0, lz1 - lz0, cream); // the back wall
  k.add(cx, (y0 + y1) / 2, lz1 - 0.03, x1 - x0, y1 - y0, 0.06, cream); // the south wall…
  k.add(cx + 0.5, 5.2, lz1 - 0.07, 1.6, 3.4, 0.04, 0xbfd3e0); // …and its tall window
  k.add(cx, y1 - 0.02, (lz0 + lz1) / 2, x1 - x0, 0.04, lz1 - lz0, 0xf1efe8); // the high ceiling
  for (const z of [lz0 + 1.5, lz0 + 3.5, lz0 + 5.5]) for (const dx of [-1.5, 1]) k.add(cx + dx, y1 - 0.05, z, 0.3, 0.03, 0.3, 0xfff6d8); // downlights
  // the stair: steps rising toward the landing, wood cladding under it, a steel railing on its open side
  const run = G.zBottom - G.zTop, tread = run / G.steps, rise = G.rise / G.steps, sw = G.x1 - G.x0, sxm = (G.x0 + G.x1) / 2;
  for (let i = 0; i < G.steps; i++) {
    const z = G.zBottom - (i + 0.5) * tread, top = y0 + (i + 1) * rise;
    k.add(sxm, top - 0.06, z, sw, 0.12, tread + 0.02, 0x8f8c88); // tread
    k.add(sxm, (y0 + top) / 2 - 0.06, z, sw - 0.04, top - y0 - 0.12, tread, 0xc89c68); // the wood-clad mass under it
  }
  for (let i = 0; i <= G.steps; i += 2) {
    const z = G.zBottom - i * tread, top = y0 + i * rise;
    k.add(G.x1 - 0.05, top + 0.5, z, 0.04, 1.0, 0.04, 0xb9bec2); // balusters
  }
  const rl = Math.hypot(run, G.rise);
  // the landing across the room, its white band with FRANK CENTER, a glass rail on top
  const ly = y0 + G.rise, L = G.landing;
  k.add(cx, ly - 0.25, (L.z0 + L.z1) / 2, x1 - x0, 0.5, L.z1 - L.z0, 0xdedbd2);
  k.add(cx, ly - 0.6, L.z1 + 0.02, x1 - x0, 0.9, 0.06, 0xd9d6cf);
  k.add(cx, ly + 0.55, L.z1 - 0.05, x1 - x0, 1.0, 0.04, 0x9fb3bd);
  k.add(cx, ly + 1.05, L.z1 - 0.05, x1 - x0, 0.05, 0.08, 0xb9bec2);
  k.add(cx - 1, y0 + 0.24, G.zBottom - 0.2, 1.6, 0.48, 0.5, 0xc49a68); // the wood bench at the stair's foot
  const m = k.build(new MeshBasicMaterial({ color: 0xffffff }));
  m.castShadow = false;
  m.receiveShadow = false;
  m.userData.glass = true;
  g.add(m);
  // the stair rail, sloped with the flight
  const rail = new Mesh(new BoxGeometry(0.06, 0.06, rl), new MeshBasicMaterial({ color: 0xb9bec2 }));
  rail.position.set(G.x1 - 0.05, y0 + G.rise / 2 + 1.0, (G.zBottom + G.zTop) / 2);
  rail.rotation.x = Math.atan2(G.rise, run);
  rail.userData.glass = true;
  g.add(rail);
  const sign = new Mesh(new PlaneGeometry(2.2, 0.32), new MeshBasicMaterial({ map: signTexture('FRANK CENTER') }));
  sign.position.set(cx + 0.6, ly - 0.6, L.z1 + 0.06);
  g.add(sign);
}

/**
 * The lounge in the glass connector (the architects' Forum photos): carpet, a ceiling of round lights, grey steel
 * columns against the brick of the buildings either side, lounge chairs round a low table, a white bench, a long table.
 */
function lounge(g: Group) {
  const L = LOUNGE, k = new BoxBank(), y0 = L.floor, y1 = L.ceil, cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
  k.add(cx, y0 + 0.01, cz, L.x1 - L.x0, 0.02, L.z1 - L.z0, 0x7a7671); // carpet
  k.add(cx, y1, cz, L.x1 - L.x0, 0.06, L.z1 - L.z0, 0xc9cbcc); // the tiled ceiling…
  for (let x = L.x0 + 1.5; x < L.x1 - 1; x += 3) for (let z = L.z0 + 1.5; z < L.z1 - 1; z += 2.8) k.add(x, y1 - 0.04, z, 0.4, 0.03, 0.4, 0xfffbe8); // …and its lights
  for (let z = L.z0 + 1; z < L.z1; z += 4) for (const x of [L.x0 + 0.25, L.x1 - 0.25]) k.add(x, (y0 + y1) / 2, z, 0.4, y1 - y0, 0.4, 0x5d6266); // steel columns
  const chair = (x: number, z: number, heading: number, kind: 'lounge' | 'bench' | 'stool', n: number) => {
    const s = Math.sin(heading), c = Math.cos(heading);
    if (kind === 'lounge') {
      const col = n % 2 ? 0x3d5f8a : 0xa9c3d2;
      k.add(x, y0 + 0.22, z, 0.8, 0.44, 0.8, col, heading);
      k.add(x - s * 0.36, y0 + 0.62, z - c * 0.36, 0.8, 0.8, 0.14, col, heading);
    } else if (kind === 'bench') {
      k.add(x, y0 + 0.22, z, 2.4, 0.44, 0.9, 0xeceae3);
      k.add(x, y0 + 0.05, z, 2.3, 0.1, 0.85, 0xb48b5c);
    } else {
      k.add(x, y0 + 0.36, z, 0.1, 0.72, 0.1, 0x2f3236);
      k.add(x, y0 + 0.74, z, 0.42, 0.06, 0.42, 0x2f3236);
    }
  };
  LOUNGE_SEATS.forEach((p, n) => chair(p.x, p.z, p.heading, p.chair, n));
  chair(-82, 17.8, 0, 'lounge', 1); // an empty one
  for (const t of LOUNGE_TABLES.round) {
    k.add(t.x, y0 + 0.24, t.z, 0.08, 0.48, 0.08, 0x8d8f91);
    k.add(t.x, y0 + 0.5, t.z, 0.8, 0.05, 0.8, 0xd8c19a);
  }
  const T = LOUNGE_TABLES.long;
  k.add(T.x, y0 + 0.74, T.z, 1.0, 0.06, T.len, 0xeeece6);
  for (const dz of [-T.len / 2 + 0.2, T.len / 2 - 0.2]) k.add(T.x, y0 + 0.37, T.z + dz, 0.8, 0.74, 0.08, 0x8d8f91);
  k.add(L.x1 - 0.8, y0 + 0.24, cz - 2, 0.55, 0.48, 4, 0xc49a68); // a long wood window seat along the addition's wall
  const m = k.build(new MeshBasicMaterial({ color: 0xffffff }));
  m.castShadow = false;
  m.receiveShadow = false;
  m.userData.glass = true;
  g.add(m);
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
  box.add(cx, h + 0.16, cz, w + 1.5, 0.14, d + 1.5, 0x5d8c78); // its green copper eaves (the user's street views)
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
      win.add('rect', x, y, z0 - 0.03, 1.9, 2.3, '-z'); // (the back, onto Church Street, is allbview.ts's)
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
  // the square concrete slabs out front
  const F = ALLB_FORECOURT, slabs = slabTexture();
  slabs.repeat.set((F.x1 - F.x0) / 1.5, (F.z1 - F.z0) / 1.5);
  flat(g, F.x0, F.x1, F.z0, F.z1, 0.032, new MeshLambertMaterial({ map: slabs }));
  // the rusticated granite base the basement doors are cut into
  box.add(cx, 0.6, z0 - 0.06, w, 1.2, 0.14, 0x8f8c86);
  // the two basement entrances: a sunken well, stairs down along the facade, a door below ground, wall and railing
  const steel = 0x8f9496;
  for (const W of ALLB_WELLS) {
    const wx = (W.x0 + W.x1) / 2, wz = (W.z0 + W.z1) / 2, len = W.x1 - W.x0, dir = Math.sign(W.inner - W.outer);
    flat(g, W.x0, W.x1, W.z0, W.z1, 0.04, new MeshBasicMaterial({ color: 0x24221f })); // the shadowed hole
    const n = 7;
    // (the ground is one flat sheet, so the well can't really be cut into it: the treads are drawn at ground level,
    // each a shade darker than the last, so the flight reads as going down into the dark toward the door)
    const lit = new Color(0xb4afa6), dark = new Color(0x3a3734);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = W.outer + dir * len * 0.75 * t;
      box.add(x, 0.05, wz, (len * 0.75) / n - 0.06, 0.02, W.z1 - W.z0 - 0.2, lit.clone().lerp(dark, i / (n - 1)).getHex());
    }
    const doorX = W.inner - dir * 0.6; // at the bottom, in the wall
    box.add(doorX, -0.05, z0 - 0.08, 1.2, 2.2, 0.08, 0x1d1f21);
    box.add(doorX, 0.55, z0 - 0.12, 1.0, 0.7, 0.04, 0xffe6b0); // its lit glass
    box.add(W.outer - dir * 0.0, 0.3, wz, 0.3, 0.6, W.z1 - W.z0, 0xb8b2a8); // low wall at the top end…
    box.add(wx, 0.3, W.z0 - 0.15, len + 0.3, 0.6, 0.3, 0xb8b2a8); // …and along the front
    box.add(wx, 1.15, W.z0 - 0.15, len, 0.05, 0.05, steel); // railing
    for (let x = W.x0 + 0.1; x <= W.x1; x += 1.1) box.add(x, 0.85, W.z0 - 0.15, 0.05, 0.6, 0.05, steel);
  }
}

let slabTex: CanvasTexture | null = null;
/** Big square concrete slabs with dark joints (Allbritton's forecourt). One tile = one slab. */
function slabTexture(): CanvasTexture {
  if (!slabTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    x.fillStyle = '#c8bfb1'; x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#a39a8c'; x.fillRect(0, 0, 64, 2); x.fillRect(0, 0, 2, 64);
    slabTex = new CanvasTexture(c);
    slabTex.wrapS = slabTex.wrapT = RepeatWrapping;
    slabTex.colorSpace = SRGBColorSpace;
  }
  const t = slabTex.clone();
  t.needsUpdate = true;
  return t;
}
