import {
  AdditiveBlending, BoxGeometry, BufferGeometry, CanvasTexture, Color, CylinderGeometry, DoubleSide, ExtrudeGeometry,
  Float32BufferAttribute, Group, IcosahedronGeometry, Material, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshPhongMaterial,
  LatheGeometry, PlaneGeometry, RepeatWrapping, SRGBColorSpace, Shape, ShapeGeometry, Texture, Vector2,
} from 'three';
import { BoxBank, PAVER_TILE, WindowBank, lambert, paverMap, seeGlass, stoneMap, worldUV } from './kit';
import { rng } from './noise';
import type { XZ } from './collide';
import {
  BALUSTRADE, CHEEK, FRANK, GALLERY, GALLERY_SOFAS, LAWN_BENCH_N, LAWN_BENCH_S, LAWN_TREE, NCOURT, NCOURT_BED, NCOURT_TABLES, NCOURT_TREES,
  NWALK, OLIN, OLIN_LINK, OLIN_LINK_POLY, POOL, POOL_BED, PRUZAN, PRUZAN_BIRCH, PRUZAN_COURT, PRUZAN_DOOR, PRUZAN_DOOR_N, PRUZAN_ENTRY,
  PRUZAN_FRANK_BED, PRUZAN_GLASS, PRUZAN_LINK_N, PRUZAN_PIERS, STAIRS_W, TERRACE_Y, plazaChairs, pruzanPaveEdge, pruzanSoffit,
} from './southend';

// ─── The Pruzan Art Center: draws what southend.ts lays out ────────────
// Between Olin and the Frank Center, facing the courtyard (the user's photos, 2026-10-07). Kin to Zelnick, not a copy:
// big limestone blocks instead of grey panels, one long sag in the canopy instead of a flare, a wood soffit that runs
// on inside as the ceiling, and a fountain out front. By day the glass shows a quiet stone room; after dark the room
// glows (its walls, carpet, sofas and ceiling light themselves: `pruzanNight`), the soffit and the paving in front warm
// up, and the fountain's water picks up the glow.

type Kit = { g: Group; win: WindowBank; box: BoxBank };

const Y = TERRACE_Y;
const LIME = 0xe4dccb; // the limestone
const GRANITE_DARK = 0x2b2826; // the fountain's basin
const MULLION = 0x2a2c2e; // thin black frames
const STEEL = 0xa8adb0;

// things that change with the hour
const selfLit: { m: MeshLambertMaterial; day: number; night: number }[] = [];
let lamps: MeshBasicMaterial | null = null, glow: MeshBasicMaterial | null = null, wash: MeshBasicMaterial | null = null;
let water: MeshPhongMaterial | null = null, sheet: Texture | null = null;

/**
 * A Lambert material that can light itself: its emissive is multiplied by its own colour (map and instance colour
 * included), so a whole room of differently coloured boxes glows in its own colours as the lights come on.
 */
function lit(color: number, map: Texture | null, day: number, night: number): MeshLambertMaterial {
  const m = new MeshLambertMaterial({ color, map, emissive: 0xffdcaa, emissiveIntensity: day });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= diffuseColor.rgb;');
  };
  m.customProgramCacheKey = () => 'selfLit';
  selfLit.push({ m, day, night });
  return m;
}

/** After dark (0 = day, 1 = night): the gallery's lights come up, the soffit, the paving in front and the water pick up the glow. */
export function pruzanNight(night: number) {
  const on = Math.min(1, Math.max(0, (night - 0.2) / 0.5));
  for (const s of selfLit) s.m.emissiveIntensity = s.day + (s.night - s.day) * on;
  lamps?.color.set(0xd9d3c6).lerp(new Color(0xfff2d2), on);
  if (glow) glow.opacity = on * 0.8;
  if (wash) wash.opacity = 0.2 + on * 0.6;
  if (water) water.emissiveIntensity = on * 0.4;
}

/** The water sheeting down the fountain's sides. */
export function pruzanTick(dt: number) {
  if (sheet) sheet.offset.y = (sheet.offset.y + dt * 0.35) % 1;
}

function mesh(g: Group, geo: BufferGeometry, mat: Material | Material[], x = 0, y = 0, z = 0) {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}
/** A box from (x0, y0, z0) to (x1, y1, z1), its texture tiling in world metres (`tile` m). */
function slabBox(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, tile = 5) {
  const geo = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return worldUV(geo, tile);
}
/**
 * A vertical strip in the XY plane (facing +z) from x0 to x1, bottom and top following `lo(x)` and `hi(x)`. UVs in world
 * metres / `tile`, or 0..1 across and up when `tile` is 0.
 */
function strip(x0: number, x1: number, lo: (x: number) => number, hi: (x: number) => number, segs = 24, tile = 0) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, x = x0 + (x1 - x0) * t, a = lo(x), b = hi(x);
    pos.push(x, a, 0, x, b, 0);
    if (tile) uv.push(x / tile, a / tile, x / tile, b / tile);
    else uv.push(t, 0, t, 1);
    if (i < segs) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** The wood soffit: long narrow boards running along the glass, a few butt joints. */
const soffitTexture = () => canvas(256, 256, (g) => {
  let id = 3100;
  for (let r = 0; r < 16; r++) {
    const v = 0.88 + rng(id++) * 0.2;
    g.fillStyle = `rgb(${Math.round(196 * v)},${Math.round(138 * v)},${Math.round(82 * v)})`;
    g.fillRect(0, r * 16, 256, 16);
    g.fillStyle = 'rgba(70,40,18,0.55)';
    g.fillRect(0, r * 16 + 15, 256, 1); // the reveal between boards
    g.fillRect(Math.round(rng(id++) * 256), r * 16, 1, 15); // a joint
  }
});

/** Water sheeting down the fountain's sides: faint vertical streaks, brighter at the lip. */
const sheetTexture = () => canvas(64, 64, (g) => {
  g.fillStyle = 'rgb(120,128,130)'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 40; i++) {
    const x = rng(3200 + i) * 64, l = 150 + Math.round(rng(3300 + i) * 90);
    g.fillStyle = `rgba(${l},${l + 6},${l + 10},0.7)`;
    g.fillRect(x, rng(3400 + i) * 64, 1 + rng(3500 + i) * 2, 6 + rng(3600 + i) * 26);
  }
});

/** What the water shows at night: the lit glass reflected, warm bands between dark mullions, fading away from the building. */
const reflectionTexture = () => canvas(256, 128, (g) => {
  const grad = g.createLinearGradient(0, 0, 0, 128); // (top of the canvas = the edge nearest the building)
  grad.addColorStop(0, 'rgb(150,112,72)');
  grad.addColorStop(0.45, 'rgb(48,36,24)');
  grad.addColorStop(1, 'rgb(12,10,8)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 90; i++) { // ripples: short bright dashes, mostly near the building
    const y = Math.pow(rng(6100 + i), 1.6) * 128, x = rng(6200 + i) * 256, a = 0.5 * (1 - y / 128);
    g.fillStyle = `rgba(255,220,160,${a})`;
    g.fillRect(x, y, 6 + rng(6300 + i) * 22, 1);
  }
}, false);

/** A soft warm gradient (bright along one edge, nothing at the other) for light spilling onto a surface. */
const spillTexture = () => canvas(16, 128, (g) => {
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(255,214,160,1)');
  grad.addColorStop(1, 'rgba(255,214,160,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 16, 128);
}, false);

/** The exhibition up on the back wall (the photo of spring 2024's): big mint letters, a line of small type. */
const showTexture = () => canvas(512, 320, (g) => {
  g.clearRect(0, 0, 512, 320);
  g.fillStyle = '#9fd8c4';
  g.font = '900 230px sans-serif'; g.textBaseline = 'alphabetic';
  g.fillText('AIR', 130, 250);
  g.fillStyle = '#2f3a36';
  g.font = '600 26px sans-serif';
  g.fillText('PRESSURE', 300, 300);
  g.font = '500 20px sans-serif';
  g.fillText('Spring', 18, 70); g.fillText('Semester', 18, 94); g.fillText('2024', 18, 118);
}, false);

export function buildPruzan(k: Kit) {
  const { g } = k;
  selfLit.length = 0;
  lamps = new MeshBasicMaterial({ color: 0xd9d3c6 });
  const lampBank = new BoxBank(); // the lights themselves: downlights, the cove, the little wall lights
  const room = new BoxBank(); // what's inside, lighting itself after dark
  courtyard(k);
  fountain(k);
  galleryBlock(k, lampBank);
  front(k, lampBank);
  inside(k, room, lampBank);
  entry(k, room, lampBank);
  northLink(k, room, lampBank);
  northCourt(k);
  northLawn(k);
  const r = room.build(lit(0xffffff, null, 0.12, 0.95));
  r.userData.glass = true; // (no shadows: it's lit)
  g.add(r);
  const l = lampBank.build(lamps);
  l.userData.glass = true;
  g.add(l);
}

/** The glass front between the piers, the piers, the sagging canopy with its wood soffit, and the glow on the paving. */
function front({ g, box }: Kit, lampBank: BoxBank) {
  const P = PRUZAN, G = PRUZAN_GLASS, top = Y + P.h, zF = P.z1 + 1.3; // the canopy's front edge
  const stone = lambert(LIME, stoneMap(), 'pruzanLime');
  // the piers: plain limestone blocks, a little proud of the glass, flush with the canopy's ends
  for (const p of PRUZAN_PIERS) mesh(g, slabBox(p.x0, p.x1, Y, top + 0.12, p.z0, p.z1), stone);
  // the floor slab the room stands on, and the steel kick plate along the foot of the glass
  box.add((G.x0 + G.x1) / 2, Y + 0.08, (P.z0 + P.z1) / 2, G.x1 - G.x0, 0.16, P.z1 - P.z0, 0xcfc9bd);
  box.add((G.x0 + G.x1) / 2, Y + 0.2, G.z + 0.03, G.x1 - G.x0, 0.36, 0.05, STEEL);
  // the glass, its top following the canopy down and up again
  const glass = mesh(g, strip(G.x0, G.x1, () => Y + 0.38, (x) => pruzanSoffit(x), 30), seeGlass(), 0, 0, G.z);
  glass.userData.glass = true;
  const panes = 9, pw = (G.x1 - G.x0) / panes;
  for (let i = 0; i <= panes; i++) { // thin black mullions, each up to the soffit
    const x = G.x0 + i * pw, h = pruzanSoffit(x) - Y - 0.2;
    box.add(x, Y + 0.2 + h / 2, G.z + 0.02, 0.07, h, 0.12, MULLION);
  }
  // the canopy: a thin slab with the same sag, white fascia on its edge, wood under it all the way back inside
  const s = new Shape(), segs = 40, xa = P.x0 - 0.05, xb = P.x1 + 0.05, thick = 0.45;
  for (let i = 0; i <= segs; i++) { const x = xa + ((xb - xa) * i) / segs; i ? s.lineTo(x, pruzanSoffit(x)) : s.moveTo(x, pruzanSoffit(x)); }
  for (let i = segs; i >= 0; i--) { const x = xa + ((xb - xa) * i) / segs; s.lineTo(x, pruzanSoffit(x) + thick); }
  const slab = new ExtrudeGeometry(s, { depth: zF - P.z0, bevelEnabled: false, curveSegments: 1 });
  slab.translate(0, 0, P.z0);
  mesh(g, slab, [lambert(0xf3f1ea), lambert(0xd9d6cf)]); // (the caps are the fascia; the rest the roof)
  const soffitMap = soffitTexture(), w = G.x1 - G.x0, d = zF - P.z0;
  soffitMap.repeat.set(w / 3, d / 2);
  const soffit = new PlaneGeometry(w, d, 30, 1);
  soffit.rotateX(Math.PI / 2); // facing down
  soffit.translate((G.x0 + G.x1) / 2, 0, (P.z0 + zF) / 2);
  const sp = soffit.getAttribute('position');
  for (let i = 0; i < sp.count; i++) sp.setY(i, pruzanSoffit(sp.getX(i)) - 0.01);
  soffit.computeVertexNormals();
  const sm = mesh(g, soffit, lit(0xffffff, soffitMap, 0.08, 0.85));
  sm.userData.glass = true;
  // downlights in the soffit: a row out over the paving, a grid inside
  for (let x = G.x0 + 0.9; x < G.x1 - 0.5; x += 1.8) {
    lampBank.add(x, pruzanSoffit(x) - 0.03, P.z1 + 0.65, 0.16, 0.03, 0.16, 0xffffff);
    for (const z of [P.z0 + 2.2, P.z0 + 4.8]) lampBank.add(x, pruzanSoffit(x) - 0.03, z, 0.14, 0.03, 0.14, 0xffffff);
  }
  // the light spilling out onto the paving after dark
  glow = new MeshBasicMaterial({ map: spillTexture(), transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending });
  const spill = new Mesh(new PlaneGeometry(w + 1, 4.2), glow);
  spill.rotation.x = -Math.PI / 2;
  spill.position.set((G.x0 + G.x1) / 2, Y + 0.05, G.z + 2.1);
  spill.userData.glass = true;
  g.add(spill);
}

/** The lounge behind the glass (the night photo): limestone walls, carpet, sage sofas, lights let into the wall, the show. */
function inside({ g }: Kit, k: BoxBank, lampBank: BoxBank) {
  const R = GALLERY, y0 = R.floor, cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
  const stone = lit(0xe8e1d2, stoneMap(), 0.1, 0.85);
  // the walls: the back (under the curved ceiling), and the piers' inner faces
  const back = mesh(g, strip(R.x0, R.x1, () => y0, (x) => pruzanSoffit(x) - 0.01, 30, 5), stone, 0, 0, R.z0 + 0.02);
  back.userData.glass = true;
  for (const x of [R.x0 + 0.02, R.x1 - 0.02]) {
    const side = mesh(g, slabBox(x - 0.01, x + 0.01, y0, pruzanSoffit(x), R.z0, R.z1), stone);
    side.userData.glass = true;
  }
  // the light washing down the back wall from the cove at its top
  wash = new MeshBasicMaterial({ map: spillTexture(), transparent: true, opacity: 0.2, depthWrite: false, blending: AdditiveBlending });
  const w = mesh(g, strip(R.x0, R.x1, (x) => pruzanSoffit(x) - 1.8, (x) => pruzanSoffit(x) - 0.02, 30), wash, 0, 0, R.z0 + 0.05);
  w.userData.glass = true;
  for (let i = 0; i < 12; i++) { // the cove: a lit slot along the back wall's top
    const x = R.x0 + ((i + 0.5) * (R.x1 - R.x0)) / 12;
    lampBank.add(x, pruzanSoffit(x) - 0.06, R.z0 + 0.1, (R.x1 - R.x0) / 12 + 0.02, 0.05, 0.08, 0xffffff);
  }
  // the floor: carpet, a band of pale stone along the glass
  k.add(cx, y0 + 0.01, cz - 0.3, R.x1 - R.x0, 0.02, R.z1 - R.z0 - 0.6, 0x8c857a);
  k.add(cx, y0 + 0.01, R.z1 - 0.3, R.x1 - R.x0, 0.02, 0.6, 0xd2ccbf);
  // three little lights let into the back wall, low down
  for (const x of [R.x0 + 3.2, R.x0 + 5.0, R.x0 + 6.8]) {
    k.add(x, y0 + 0.75, R.z0 + 0.05, 0.3, 0.5, 0.04, 0x8a8478);
    lampBank.add(x, y0 + 0.75, R.z0 + 0.08, 0.16, 0.34, 0.03, 0xffffff);
  }
  // the show: big mint letters on the back wall toward the entry
  const show = new Mesh(new PlaneGeometry(4.0, 2.5), lit(0xffffff, showTexture(), 0.15, 0.9));
  (show.material as MeshLambertMaterial).transparent = true;
  show.position.set(R.x1 - 3.0, y0 + 2.0, R.z0 + 0.06);
  show.userData.glass = true;
  g.add(show);
  // white double doors in the west wall (to the galleries), glass doors at the back of the east wall (to the entry)
  k.add(R.x0 + 0.06, y0 + 1.25, R.z0 + 1.7, 0.06, 2.5, 1.9, 0xf2efe8);
  k.add(R.x0 + 0.1, y0 + 1.25, R.z0 + 1.7, 0.02, 2.5, 0.02, 0xc8c4bb);
  for (const o of [-0.12, 0.12]) k.add(R.x0 + 0.12, y0 + 1.1, R.z0 + 1.7 + o, 0.04, 0.3, 0.03, 0x9ea3a5);
  k.add(R.x1 - 0.06, y0 + 1.35, R.z0 + 1.6, 0.06, 2.7, 1.9, 0x3d2a24);
  k.add(R.x1 - 0.08, y0 + 1.3, R.z0 + 1.6, 0.03, 2.4, 1.6, 0xf3e6c8); // (the lit vestibule beyond)
  // the sofas: low sage sectionals facing the glass, one with an arm toward it
  const sage = 0x9ca592, sageDark = 0x89927f;
  for (const s of GALLERY_SOFAS) {
    k.add(s.x, y0 + 0.21, s.z, s.len, 0.42, 0.95, sage); // seat
    k.add(s.x, y0 + 0.45, s.z - 0.38, s.len, 0.9, 0.24, sageDark); // back
    if (s.arm) {
      const ax = s.x + s.len / 2 - 0.475;
      k.add(ax, y0 + 0.21, s.z + 0.47 + s.arm / 2, 0.95, 0.42, s.arm, sage); // the chaise toward the glass
      k.add(s.x - s.len / 2 - 0.12, y0 + 0.32, s.z, 0.24, 0.64, 0.95, sageDark); // the end arm
    } else {
      for (const e of [-1, 1]) k.add(s.x + e * (s.len / 2 + 0.12), y0 + 0.32, s.z - 0.05, 0.24, 0.64, 1.0, sageDark);
    }
  }
  k.add(GALLERY_SOFAS[0].x - 0.6, y0 + 0.2, GALLERY_SOFAS[0].z + 1.4, 0.9, 0.4, 0.9, sage); // an ottoman
  // a long low wood bench along the glass (the daylight photo)
  k.add(R.x0 + 2.4, y0 + 0.22, R.z1 - 0.45, 3.6, 0.44, 0.5, 0xc89a64);
}

/** The entrance: a lower glass link set back against the Frank Center, dark wood-framed glass doors, brass pulls. */
function entry({ g, box }: Kit, k: BoxBank, lampBank: BoxBank) {
  const E = PRUZAN_ENTRY, D = PRUZAN_DOOR, cx = (E.x0 + E.x1) / 2, cz = (E.z0 + E.z1) / 2, w = E.x1 - E.x0;
  const y0 = Y + 0.16, y1 = Y + E.h - 0.4;
  box.add(cx, Y + 0.08, cz, w, 0.16, E.z1 - E.z0, 0xcfc9bd); // floor slab
  box.add(cx, Y + E.h - 0.15, cz + 0.2, w + 0.3, 0.3, E.z1 - E.z0 + 0.4, 0xf3f1ea); // the thin white roof, just overhanging
  box.add(cx, Y + (E.h + y1) / 2 - 0.15, cz, w, E.h - 0.3 - (y1 - Y), E.z1 - E.z0, 0xe8e4da); // (above its ceiling)
  // inside, lit: a pale floor, the stone back wall, a wood ceiling, a light
  k.add(cx, y0 + 0.01, cz, w, 0.02, E.z1 - E.z0, 0xcfc9bd);
  k.add(cx, y1, cz, w, 0.04, E.z1 - E.z0, 0xc48c54);
  lampBank.add(cx, y1 - 0.03, cz, 0.18, 0.03, 0.18, 0xffffff);
  k.add(cx, y0 + 0.02, D.z - 0.8, 1.6, 0.02, 1.0, 0x3b3835); // the mat
  // the glass front: a transom over the doors, the doors in their dark frames
  const pane = new Mesh(new PlaneGeometry(w - 0.1, y1 - Y - 0.2), seeGlass());
  pane.position.set(cx, (Y + 0.1 + y1) / 2, D.z);
  pane.userData.glass = true;
  g.add(pane);
  const frame = 0x3d2a24, dh = 2.5, zz = D.z + 0.04;
  for (const x of [E.x0 + 0.05, cx - 0.92, cx, cx + 0.92, E.x1 - 0.05]) box.add(x, Y + (y1 - Y) / 2 + 0.08, zz, 0.1, y1 - Y, 0.12, frame); // jambs and stiles
  for (const y of [Y + 0.2, Y + dh + 0.1, y1]) box.add(cx, y, zz, w, 0.12, 0.12, frame); // sill, door head, top
  for (const e of [-1, 1]) { // the half-moon brass pulls (the photo), a bar at hand height
    const pull = mesh(g, new CylinderGeometry(0.24, 0.24, 0.04, 12, 1, false, 0, Math.PI), lambert(0xb8954a), cx + e * 0.14, Y + 1.25, zz + 0.07);
    pull.rotation.x = Math.PI / 2;
    pull.rotation.z = e > 0 ? 0 : Math.PI;
  }
}

/** A flat shape on the ground at height y, from an outline in (x, z). */
function ground(g: Group, pts: XZ[], y: number, mat: Material) {
  const s = new Shape();
  pts.forEach((p, i) => (i ? s.lineTo(p.x, -p.z) : s.moveTo(p.x, -p.z)));
  const geo = new ShapeGeometry(s);
  geo.rotateX(-Math.PI / 2);
  const m = mesh(g, geo, mat, 0, y, 0);
  m.castShadow = false;
  return m;
}
/** The pale interlocking pavers (the walks behind the row's, a shade warmer), tiling in world metres. */
function paverMat() {
  const tex = paverMap().clone();
  tex.needsUpdate = true;
  tex.repeat.set(1 / PAVER_TILE, 1 / PAVER_TILE);
  return new MeshLambertMaterial({ map: tex, color: 0xfff6e8 });
}

/** A small multi-stemmed birch: white stems with dark marks, a light crown going yellow. */
function birch({ g, box }: Kit, x: number, z: number, s = 1) {
  const bark = lambert(0xe9e6dc);
  for (const [ox, oz, lean] of [[0, 0, 0.05], [0.25, 0.15, -0.12], [-0.2, 0.2, 0.15]] as const) {
    const stem = mesh(g, new CylinderGeometry(0.05 * s, 0.08 * s, 4.2 * s, 6).translate(0, 2.1 * s, 0), bark, x + ox, Y, z + oz);
    stem.rotation.set(lean, 0, -lean);
  }
  for (let i = 0; i < 4; i++) box.add(x + (rng(4000 + i + x) - 0.5) * 0.3, Y + (0.8 + i * 0.9) * s, z, 0.12, 0.05, 0.12, 0x2d2b28);
  const crown = new IcosahedronGeometry(1, 0);
  [[0, 4.4, 0, 1.3, 0xc9b542], [0.6, 3.7, 0.3, 1.0, 0x8ea443], [-0.5, 3.9, 0.2, 0.9, 0xd6a93a]].forEach(([ox, oy, oz, r, c], i) => {
    const m = mesh(g, crown, lambert(c), x + ox * s, Y + oy * s, z + oz * s);
    m.scale.set(r * s, r * 0.9 * s, r * s);
    m.rotation.y = i + x;
  });
}

/** Shrubs and grass tufts scattered over a bed: `inBed(x, z)` says where it is, within the box given. */
function plants({ box }: Kit, x0: number, x1: number, z0: number, z1: number, n: number, seed: number, inBed: (x: number, z: number) => boolean) {
  for (let i = 0; i < n; i++) {
    const x = x0 + rng(seed + i) * (x1 - x0), z = z0 + rng(seed + 500 + i) * (z1 - z0);
    if (!inBed(x, z)) continue;
    const col = [0x5f7d3a, 0x9a9a5c, 0x8e3b2a, 0x6d8a3a, 0xa8743a, 0x7d8a4a][i % 6], sz = 0.35 + rng(seed + 900 + i) * 0.45;
    box.add(x, Y + sz / 2, z, sz, sz * 0.85, sz, col, rng(seed + i) * 3);
  }
}

/** A plain granite bench: a slab on two blocks. */
function bench({ box }: Kit, b: { x: number; z: number; len: number; rot: number }, col = 0xc9c4b8) {
  const c = Math.cos(b.rot), sn = Math.sin(b.rot);
  box.add(b.x, Y + 0.42, b.z, b.len, 0.12, 0.55, col, b.rot);
  for (const e of [-1, 1]) box.add(b.x + e * c * (b.len / 2 - 0.3), Y + 0.18, b.z - e * sn * (b.len / 2 - 0.3), 0.3, 0.36, 0.45, col, b.rot);
}

/**
 * The fountain courtyard: a big sweep of pavers from the glass down to the walk, its west edge curving in and out, a
 * band of mulch and shrubs along that edge, lawn beyond it toward Olin (with a birch and a granite bench), a planted strip
 * along the Frank Center.
 */
function courtyard(k: Kit) {
  const { box } = k, C = PRUZAN_COURT, P = PRUZAN, E = PRUZAN_ENTRY, FB = PRUZAN_FRANK_BED, mulch = lambert(0x4b3324);
  const edge: XZ[] = [];
  for (let i = 0; i <= 40; i++) { const z = P.z1 + ((C.z1 - P.z1) * i) / 40; edge.push({ x: pruzanPaveEdge(z), z }); }
  // the pavers
  ground(k.g, [
    { x: P.x0, z: P.z1 }, { x: P.x1, z: P.z1 }, { x: P.x1, z: E.z1 }, { x: FRANK.x0, z: E.z1 }, { x: FRANK.x0, z: FB.z0 },
    { x: FB.x0, z: FB.z0 }, { x: FB.x0, z: FB.z1 }, { x: FRANK.x0, z: FB.z1 }, { x: FRANK.x0, z: C.z1 }, ...edge.slice().reverse(),
  ], Y + 0.035, paverMat());
  // a granite edge along the curve
  for (let i = 0; i < edge.length - 1; i++) {
    const a = edge[i], b = edge[i + 1];
    box.add((a.x + b.x) / 2, Y + 0.06, (a.z + b.z) / 2, 0.12, 0.08, Math.hypot(b.x - a.x, b.z - a.z) + 0.04, 0xb7b2a6, Math.atan2(b.x - a.x, b.z - a.z));
  }
  // mulch: the bed between Olin and the west pier, a band along the curve, a strip along Olin's wall; the lawn is the bank's grass
  const band = (z: number) => (z < P.z1 + 9 ? 1.6 : 1.6 * Math.max(0, 1 - (z - P.z1 - 9) / 6));
  const bandEnd = P.z1 + 15;
  const bandPts = edge.filter((p) => p.z <= bandEnd);
  ground(k.g, [{ x: OLIN.x1, z: P.z0 }, { x: P.x0, z: P.z0 }, ...bandPts, ...bandPts.slice().reverse().map((p) => ({ x: p.x - band(p.z), z: p.z })),
    { x: OLIN.x1 + 1.3, z: bandEnd }, { x: OLIN.x1 + 1.3, z: C.z1 - 0.5 }, { x: OLIN.x1, z: C.z1 - 0.5 }], Y + 0.03, mulch);
  plants(k, OLIN.x1, P.x0 + 2, P.z0, bandEnd, 46, 3700, (x, z) =>
    Math.hypot(x - PRUZAN_BIRCH.x, z - PRUZAN_BIRCH.z) > 0.6 && x > OLIN.x1 + 0.3 && x < pruzanPaveEdge(z) - 0.3 && (x < OLIN.x1 + 1.1 || z < P.z1 || x > pruzanPaveEdge(z) - band(z) + 0.2));
  plants(k, OLIN.x1, OLIN.x1 + 1.2, bandEnd, C.z1 - 0.8, 12, 4300, () => true);
  // the strip along the Frank Center: mulch, tall grasses, low shrubs
  ground(k.g, [{ x: FB.x0, z: FB.z0 }, { x: FB.x1, z: FB.z0 }, { x: FB.x1, z: FB.z1 }, { x: FB.x0, z: FB.z1 }], Y + 0.03, mulch);
  k.g.add(grasses(FB.x0 + 0.2, FB.x1 - 0.2, FB.z0 + 0.5, FB.z1 - 0.5, Y + 0.03, 160));
  plants(k, FB.x0 + 0.2, FB.x1 - 0.2, FB.z0, FB.z1, 12, 4600, () => true);
  birch(k, PRUZAN_BIRCH.x, PRUZAN_BIRCH.z);
  bench(k, LAWN_BENCH_S);
}

/**
 * The gallery block: big limestone blocks, a plain coping; its north end bowed out toward the field with deep slot
 * windows; little lights let into the foot of its east wall along the courtyard, a deep window high up, a dark plaque.
 */
function galleryBlock(k: Kit, lampBank: BoxBank) {
  const { g, box } = k, L = OLIN_LINK, poly = OLIN_LINK_POLY;
  const s = new Shape();
  poly.forEach((p, i) => (i ? s.lineTo(p.x, -p.z) : s.moveTo(p.x, -p.z)));
  const geo = new ExtrudeGeometry(s, { depth: L.h, bevelEnabled: false, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  mesh(g, worldUV(geo, 5), lambert(0xe0d8c6, stoneMap(), 'pruzanBlock'), 0, Y, 0);
  const cap = new ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: false, curveSegments: 1 });
  cap.rotateX(-Math.PI / 2);
  mesh(g, cap, lambert(0xd3ccbb), 0, Y + L.h, 0);
  // the slots in the curved end: deep, narrow, tall, dark glass at the back
  const w = L.x1 - L.x0;
  for (const t of [0.22, 0.4, 0.6, 0.78]) {
    const x = L.x0 + w * t, z = L.z0 - L.bulge * Math.sin(Math.PI * t), slope = (-L.bulge * Math.PI * Math.cos(Math.PI * t)) / w;
    const rot = -Math.atan(slope), c = Math.cos(rot), sn = Math.sin(rot);
    const nx = slope * c, nz = -c; // (the outward normal, toward the field)
    box.add(x + nx * 0.01, Y + 3.6, z + nz * 0.01, 0.7, 5.2, 0.06, 0x1c2226, rot); // the dark glass, set deep
    for (const e of [-1, 1]) box.add(x + e * c * 0.5 + nx * 0.25, Y + 3.6, z - e * sn * 0.5 + nz * 0.25, 0.3, 5.4, 0.5, 0xe4dccb, rot); // the stone either side, standing out
    box.add(x + nx * 0.25, Y + 6.35, z + nz * 0.25, 1.3, 0.3, 0.5, 0xe4dccb, rot); // and over it
  }
  // the east wall, along the courtyard: lights at its foot, a deep window high up, a dark plaque
  const ex = L.x1;
  for (let z = NCOURT.z0 + 4; z < NCOURT.z1 - 1; z += 3) {
    box.add(ex + 0.03, Y + 0.45, z, 0.06, 0.5, 0.32, 0x8a8478);
    lampBank.add(ex + 0.06, Y + 0.45, z, 0.03, 0.36, 0.18, 0xffffff);
  }
  box.add(ex + 0.02, Y + 5.6, 27, 0.06, 1.6, 2.6, 0x1c2226); // the deep window…
  box.add(ex + 0.2, Y + 4.75, 27, 0.4, 0.12, 2.9, 0xe4dccb); // …its sill
  box.add(ex + 0.04, Y + 0.8, 33, 0.06, 0.7, 2.2, 0x2a2c2e); // the plaque
}

/** The glass link's north face onto the courtyard (the night photo): tall glass, light-framed double doors, a wood ceiling inside, lit. */
function northLink({ g, box }: Kit, k: BoxBank, lampBank: BoxBank) {
  const N = PRUZAN_LINK_N, D = PRUZAN_DOOR_N, cx = (N.x0 + N.x1) / 2, cz = (N.z0 + N.z1) / 2, w = N.x1 - N.x0;
  const y0 = Y + 0.16, y1 = Y + N.h - 0.5;
  box.add(cx, Y + 0.08, cz, w, 0.16, N.z1 - N.z0, 0xcfc9bd); // floor slab
  box.add(cx, Y + N.h - 0.15, cz - 0.3, w + 0.3, 0.3, N.z1 - N.z0 + 0.6, 0xf3f1ea); // thin white roof, overhanging the glass
  box.add(cx, Y + (N.h - 0.3 + y1 - Y) / 2, cz, w, N.h - 0.3 - (y1 - Y), N.z1 - N.z0, 0xe8e4da);
  // inside: floor, the wood ceiling (you see it through the glass, the band of warm wood), the stone back wall behind the
  // gallery's glass room, open where the corridor runs on to the south doors
  k.add(cx, y0 + 0.01, cz, w, 0.02, N.z1 - N.z0, 0xcfc9bd);
  k.add(cx, y1, cz, w, 0.04, N.z1 - N.z0, 0xc48c54);
  k.add((N.x0 + PRUZAN_ENTRY.x0) / 2, (y0 + y1) / 2, N.z1 - 0.05, PRUZAN_ENTRY.x0 - N.x0, y1 - y0, 0.06, 0xe8e1d2);
  k.add(N.x0 + 0.05, (y0 + y1) / 2, cz, 0.06, y1 - y0, N.z1 - N.z0, 0xe8e1d2);
  k.add(N.x0 + 1.4, y0 + 0.22, N.z1 - 0.5, 2.0, 0.44, 0.5, 0xc89a64); // a wood bench
  for (const x of [cx - 2, cx, cx + 2]) lampBank.add(x, y1 - 0.03, cz, 0.16, 0.03, 0.16, 0xffffff);
  // the glass, the light frames, the doors
  const pane = new Mesh(new PlaneGeometry(w - 0.1, y1 - Y - 0.1), seeGlass());
  pane.position.set(cx, (Y + y1) / 2, D.z);
  pane.rotation.y = Math.PI;
  pane.userData.glass = true;
  g.add(pane);
  const frame = 0x2e3236, door = 0xb9bec2, zz = D.z - 0.04;
  for (let i = 0; i <= 6; i++) { const x = N.x0 + (i * w) / 6; if (Math.abs(x - cx) > 0.2) box.add(x, (Y + y1) / 2, zz, 0.08, y1 - Y, 0.1, frame); }
  box.add(cx, Y + 2.7, zz, w, 0.1, 0.1, frame); // transom
  box.add(cx, y1, zz, w, 0.12, 0.12, frame);
  for (const e of [-1, 1]) { // the two glass doors in silver frames
    const dx = cx + e * 0.47;
    for (const o of [-0.43, 0.43]) box.add(dx + o, Y + 1.3, zz - 0.02, 0.08, 2.5, 0.08, door);
    for (const y of [Y + 0.15, Y + 2.55]) box.add(dx, y, zz - 0.02, 0.94, 0.12, 0.08, door);
    box.add(cx + e * 0.1, Y + 1.15, zz - 0.08, 0.04, 0.9, 0.04, door); // the pulls
  }
  k.add(cx, y0 + 0.02, D.z + 0.8, 1.6, 0.02, 1.0, 0x3b3835); // the mat
}

/** The courtyard on the field side: pavers, round teak tables and chairs, a bed of shrubs and small birches along the Frank Center. */
function northCourt(k: Kit) {
  const { box } = k, C = NCOURT, B = NCOURT_BED, W = NWALK;
  ground(k.g, [{ x: C.x0, z: C.z0 }, { x: C.x1, z: C.z0 }, { x: C.x1, z: B.z0 }, { x: B.x0, z: B.z0 }, { x: B.x0, z: B.z1 }, { x: C.x1, z: B.z1 },
    { x: C.x1, z: C.z1 }, { x: C.x0, z: C.z1 }], Y + 0.035, paverMat());
  ground(k.g, [{ x: W.x0, z: W.z0 }, { x: W.x1, z: W.z0 }, { x: W.x1, z: W.z1 }, { x: W.x0, z: W.z1 }], Y + 0.034, paverMat()); // the walk from the stairs
  ground(k.g, [{ x: B.x0, z: B.z0 }, { x: B.x1, z: B.z0 }, { x: B.x1, z: B.z1 }, { x: B.x0, z: B.z1 }], Y + 0.03, lambert(0x4b3324));
  plants(k, B.x0 + 0.15, B.x1 - 0.15, B.z0, B.z1, 26, 5100, (x, z) => NCOURT_TREES.every((t) => Math.hypot(x - t.x, z - t.z) > 0.5));
  for (const t of NCOURT_TREES) birch(k, t.x, t.z, 1.25);
  for (const z of [C.z0 + 6, C.z0 + 17]) for (let i = 0; i < 6; i++) box.add((C.x0 + B.x0) / 2 - 0.25 + i * 0.1, Y + 0.045, z, 0.05, 0.01, 0.5, 0x2a2b2c); // drain grates
  // the round teak tables and their chairs (as on the plaza by the Frank Center)
  const teak = 0xa69478, teakDark = 0x8a7a62;
  for (const t of NCOURT_TABLES) {
    mesh(k.g, new CylinderGeometry(0.6, 0.6, 0.06, 16), lambert(teak), t.x, Y + 0.74, t.z);
    box.add(t.x, Y + 0.37, t.z, 0.12, 0.74, 0.12, teakDark);
    for (const c of plazaChairs(t)) {
      const bx = c.x - Math.sin(c.heading) * 0.22, bz = c.z - Math.cos(c.heading) * 0.22;
      box.add(c.x, Y + 0.46, c.z, 0.46, 0.05, 0.46, teak, c.heading);
      box.add(bx, Y + 0.72, bz, 0.46, 0.46, 0.04, teakDark, c.heading);
      box.add(c.x, Y + 0.23, c.z, 0.42, 0.46, 0.04, teakDark, c.heading);
    }
  }
}

/** The lawn at the top of the bank on the field side: the white balustrade with urns on its piers, a stone bench, a small tree. */
function northLawn(k: Kit) {
  const { g, box } = k, B = BALUSTRADE, marble = 0xeeece6;
  const run = (x0: number, x1: number) => {
    const len = x1 - x0, cx = (x0 + x1) / 2;
    box.add(cx, Y + 0.12, B.z, len, 0.24, 0.42, marble); // plinth
    box.add(cx, Y + 0.9, B.z, len, 0.12, 0.4, marble); // rail
    for (let x = x0 + 0.2; x < x1 - 0.1; x += 0.28) box.add(x, Y + 0.56, B.z, 0.12, 0.56, 0.12, 0xe2dfd6); // balusters
    const piers = Math.max(1, Math.round(len / 6));
    for (let i = 0; i <= piers; i++) {
      const x = x0 + (len * i) / piers;
      box.add(x, Y + 0.55, B.z, 0.5, 1.1, 0.5, marble);
      if (i % 2 === 0) urn(k, x, Y + 1.1, B.z);
    }
  };
  run(B.x0, STAIRS_W.x0 - CHEEK);
  run(STAIRS_W.x1 + CHEEK, B.x1);
  bench(k, LAWN_BENCH_N, 0xe6e3dc);
  const T = LAWN_TREE;
  mesh(g, new CylinderGeometry(0.1, 0.14, 2.6, 6).translate(0, 1.3, 0), lambert(0x6b5a48), T.x, Y, T.z);
  const crown = new IcosahedronGeometry(1, 0);
  [[0, 3.2, 0, 1.3, 0x86a744], [0.5, 2.7, 0.4, 0.9, 0x9cb84e]].forEach(([ox, oy, oz, r, c]) => {
    const m = mesh(g, crown, lambert(c), T.x + ox, Y + oy, T.z + oz);
    m.scale.set(r, r * 0.85, r);
  });
}

/** A marble urn on a pier, a clipped box shrub in it (the photo). */
function urn({ g }: Kit, x: number, y: number, z: number) {
  const profile = [[0, 0], [0.16, 0], [0.12, 0.08], [0.1, 0.18], [0.28, 0.35], [0.32, 0.55], [0.3, 0.6], [0, 0.6]].map(([r, h]) => new Vector2(r, h));
  mesh(g, new LatheGeometry(profile, 12), lambert(0xeeece6), x, y, z);
  const ball = mesh(g, new IcosahedronGeometry(0.32, 1), lambert(0x3f6a2c), x, y + 0.82, z);
  ball.scale.y = 0.9;
}

/** The fountain: a square basin of dark granite, water brimming over all four sides into a drain, a raised bed of grasses in it. */
function fountain({ g, box }: Kit) {
  const F = POOL, B = POOL_BED, cx = (F.x0 + F.x1) / 2, cz = (F.z0 + F.z1) / 2, w = F.x1 - F.x0, d = F.z1 - F.z0, top = Y + F.h;
  // the drain all round its foot: a dark slot with a steel edge
  for (const [x, z, sx, sz] of [[cx, F.z0 - 0.15, w + 0.6, 0.3], [cx, F.z1 + 0.15, w + 0.6, 0.3], [F.x0 - 0.15, cz, 0.3, d], [F.x1 + 0.15, cz, 0.3, d]] as const) {
    box.add(x, Y + 0.025, z, sx, 0.03, sz, 0x161514);
  }
  box.add(cx, Y + 0.03, F.z0 - 0.31, w + 0.62, 0.03, 0.03, STEEL);
  box.add(cx, Y + 0.03, F.z1 + 0.31, w + 0.62, 0.03, 0.03, STEEL);
  // the basin (polished dark granite)
  mesh(g, slabBox(F.x0, F.x1, Y, top - 0.01, F.z0, F.z1), new MeshPhongMaterial({ color: GRANITE_DARK, specular: 0x555555, shininess: 60 }));
  // the water: dark and glossy by day; at night it carries the glow of the glass
  water = new MeshPhongMaterial({ color: 0x24211e, specular: 0xcfd8e0, shininess: 140, emissive: 0xffffff, emissiveMap: reflectionTexture(), emissiveIntensity: 0 });
  const wg = new PlaneGeometry(w + 0.02, d + 0.02);
  wg.rotateX(-Math.PI / 2);
  const wm = mesh(g, wg, water, cx, top + 0.004, cz);
  wm.castShadow = false;
  // the sheet of water running down each side
  sheet = sheetTexture();
  const sheetMat = new MeshPhongMaterial({ color: 0xb8c2c4, map: sheet, transparent: true, opacity: 0.4, shininess: 90, specular: 0xffffff, depthWrite: false, side: DoubleSide });
  for (const [x, z, len, ry] of [[cx, F.z0 - 0.012, w, Math.PI], [cx, F.z1 + 0.012, w, 0], [F.x0 - 0.012, cz, d, -Math.PI / 2], [F.x1 + 0.012, cz, d, Math.PI / 2]] as const) {
    const m = new Mesh(new PlaneGeometry(len, F.h), sheetMat);
    m.position.set(x, Y + F.h / 2, z);
    m.rotation.y = ry;
    m.userData.glass = true;
    g.add(m);
  }
  sheet.repeat.set(w / 1.2, 1);
  // the raised bed in the water, its granite rim, earth, and tall grasses
  const bx = (B.x0 + B.x1) / 2, bz = (B.z0 + B.z1) / 2;
  box.add(bx, top + 0.03, bz, B.x1 - B.x0, 0.24, B.z1 - B.z0, 0x5f5b55);
  box.add(bx, top + 0.15, bz, B.x1 - B.x0 - 0.3, 0.02, B.z1 - B.z0 - 0.3, 0x2f2620);
  g.add(grasses(B.x0 + 0.2, B.x1 - 0.2, B.z0 + 0.2, B.z1 - 0.2, top + 0.15));
}

/** A clump of ornamental grass: thin blades, green at the root going straw at the tips, leaning out. One mesh. */
function grasses(x0: number, x1: number, z0: number, z1: number, y: number, n = 260) {
  const pos: number[] = [], col: number[] = [];
  const root = new Color(0x4f6b2e), tip = new Color(0xcdbb7c), mid = new Color(0x8c9a52);
  for (let i = 0; i < n; i++) {
    const x = x0 + rng(4100 + i) * (x1 - x0), z = z0 + rng(4400 + i) * (z1 - z0);
    const h = 0.8 + rng(4700 + i) * 0.6, a = rng(5000 + i) * Math.PI * 2, lean = 0.15 + rng(5300 + i) * 0.35;
    const tx = x + Math.cos(a) * lean, tz = z + Math.sin(a) * lean, wdt = 0.035;
    const px = -Math.sin(a) * wdt, pz = Math.cos(a) * wdt;
    pos.push(x - px, y, z - pz, x + px, y, z + pz, tx, y + h, tz);
    const t = i % 3 ? tip : mid;
    col.push(root.r, root.g, root.b, root.r, root.g, root.b, t.r, t.g, t.b);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new Mesh(geo, new MeshLambertMaterial({ vertexColors: true, side: DoubleSide }));
  m.castShadow = true;
  return m;
}
