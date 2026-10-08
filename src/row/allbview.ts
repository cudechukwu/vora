import { BoxGeometry, CanvasTexture, Group, Mesh, MeshLambertMaterial, PlaneGeometry, SRGBColorSpace, Vector3 } from 'three';
import { BoxBank, WindowBank, block, brickMap, lambert, stoneMap, worldUV } from './kit';
import {
  ALLB_BAY, ALLB_LANDING, ALLB_LOT, ALLB_RAMP, ALLB_REAR_DOOR, ALLB_SIGN, ALLB_STALLS, ALLB_STEPS, ALLB_TOWER, ALLB_WALL, ALLB_WING, ALLB_WING_DOOR, ALLBRITTON,
} from './southend';

// ─── Allbritton's back, onto Church Street: draws what southend.ts lays out ────
// From the user's street views (2026-10-07). A rough grey granite base with its own windows, then brick between cream
// limestone bands, every window in a cream stone surround, cream quoins up the corners, brick corbels under the cornice,
// the top windows at the east end arched. Up the middle a plain brick stair tower standing out past the roof, its grey
// metal door at the top of a landing: steps down from it, a long ramp down along the back, metal railings. In front, the
// small parking lot: asphalt, white stall lines and wheel stops, the two accessible spaces in blue at the west end by a
// low concrete wall, cars parked nose-in, the black "Allbritton Hall" sign.

type Kit = { g: Group; win: WindowBank; box: BoxBank };

const CREAM = 0xd9cdb5, GRANITE = 0x8e8a83, STEEL = 0x8f9496, ASPHALT = 0x3d4043, CONCRETE = 0xbdb8ae, BLUE = 0x2f62b8;

function mesh(g: Group, geo: BoxGeometry | PlaneGeometry, mat: MeshLambertMaterial, x: number, y: number, z: number) {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

/** A sign panel: dark ground, a red band on top, the name in white. */
function signTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 160;
  const g = c.getContext('2d')!;
  g.fillStyle = '#16191b'; g.fillRect(0, 0, 128, 160);
  g.fillStyle = '#c8102e'; g.fillRect(0, 0, 128, 26);
  g.fillStyle = '#f2f0ea'; g.font = '600 20px sans-serif'; g.textAlign = 'center';
  g.fillText('Allbritton', 64, 70); g.fillText('Hall', 64, 96);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** A metal railing from a to b (each at its walking height), rails at 0.95 m and 0.5 m, posts every metre or so. */
function railing({ g, box }: Kit, a: Vector3, b: Vector3) {
  const len = a.distanceTo(b);
  for (const top of [0.95, 0.5]) {
    const m = mesh(g, new BoxGeometry(0.05, 0.05, len), lambert(STEEL), (a.x + b.x) / 2, (a.y + b.y) / 2 + top, (a.z + b.z) / 2);
    m.lookAt(b.x, b.y + top, b.z);
  }
  const n = Math.max(1, Math.round(len / 1.1));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    box.add(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + 0.48, a.z + (b.z - a.z) * t, 0.05, 0.96, 0.05, STEEL);
  }
}

export function allbrittonRear(k: Kit) {
  facade(k);
  tower(k);
  wing(k);
  entrance(k);
  lot(k);
}

const BRICK = 0x9e4a36, BASE = 3.6, FLOORS = [5.6, 9.2, 12.8];

/** A rough granite base (big blocks) on a wall facing +z from x0 to x1, at z, and its cream band on top. */
function granite({ g, box }: Kit, x0: number, x1: number, z: number, out = 0.3) {
  mesh(g, worldUV(new BoxGeometry(x1 - x0, BASE, out), 1.4), lambert(GRANITE, stoneMap(), 'allbGranite'), (x0 + x1) / 2, BASE / 2, z + out / 2 - 0.05);
  box.add((x0 + x1) / 2, BASE + 0.2, z + out / 2, x1 - x0 + 0.2, 0.4, out + 0.25, CREAM);
}
/** A window in a cream stone surround on a wall facing +z (or arched, with a keystone). */
function window(k: Kit, x: number, y: number, z: number, ww: number, wh: number, arched = false) {
  const { win, box } = k;
  win.add(arched ? 'arch' : 'rect', x, y, z + 0.04, ww, wh, '+z');
  for (const s of [-1, 1]) box.add(x + (s * (ww + 0.36)) / 2, y + (arched ? 0.3 : 0), z + 0.1, 0.36, wh + (arched ? 1.0 : 0.5), 0.2, CREAM);
  box.add(x, y - wh / 2 - 0.14, z + 0.14, ww + 0.8, 0.22, 0.28, CREAM); // sill
  if (arched) box.add(x, y + wh / 2 + 0.25, z + 0.14, 0.42, 0.5, 0.24, CREAM); // keystone
  else box.add(x, y + wh / 2 + 0.24, z + 0.12, ww + 0.8, 0.4, 0.24, CREAM); // lintel
}
/** Quoins up a vertical corner at (x, z): long and short cream blocks in turn, from the base to `top`. */
function quoins({ box }: Kit, x: number, z: number, top: number, sx: number, sz: number) {
  for (let y = BASE + 0.4, i = 0; y < top - 0.6; y += 0.62, i++) {
    const long = i % 2 === 0;
    box.add(x + sx * (long ? 0.5 : 0.32), y + 0.29, z + 0.06, long ? 1.0 : 0.64, 0.56, 0.2, CREAM);
    box.add(x - sx * 0.1, y + 0.29, z + sz * (long ? 0.32 : 0.5), 0.2, 0.56, long ? 0.64 : 1.0, CREAM);
  }
}

/** The old block's back, west of the tower: granite, brick, cream bands, windows; its bay standing out in stone-trimmed stages. */
function facade(k: Kit) {
  const { g, box } = k, { x0, z1, h } = ALLBRITTON, B = ALLB_BAY, xe = ALLB_TOWER.x0;
  granite(k, x0, xe, z1);
  mesh(g, worldUV(new BoxGeometry(xe - x0, 7.4 - BASE, 0.14), 2), lambert(BRICK, brickMap(), 'allb'), (x0 + xe) / 2, (BASE + 7.4) / 2, z1 + 0.06);
  for (const y of [11.0, 14.6]) box.add((x0 + xe) / 2, y, z1 + 0.15, xe - x0, 0.28, 0.3, CREAM);
  for (let x = x0 + 0.3; x < xe; x += 0.55) box.add(x, h - 0.85, z1 + 0.18, 0.28, 0.22, 0.3, 0x8e4434); // brick corbels under the cornice
  quoins(k, x0, z1, h, 1, -1);
  // the windows either side of the bay: one bay's worth to the west, basement windows in the granite
  for (const x of [(x0 + B.x0) / 2]) {
    for (const y of FLOORS) window(k, x, y, z1 + 0.06, 1.6, 2.3);
    k.win.add('rect', x, 1.9, z1 + 0.26, 1.4, 1.3, '+z');
  }
  // the bay: brick between broad stone piers, three stages, each set back a little more than the last; a pair of windows a floor
  const cx = (B.x0 + B.x1) / 2, bw = B.x1 - B.x0, out = B.z1 - z1;
  granite(k, B.x0, B.x1, B.z1 - 0.3, 0.3);
  mesh(g, worldUV(new BoxGeometry(bw, h - 1.2 - BASE, out), 2), lambert(BRICK, brickMap(), 'allb'), cx, (BASE + h - 1.2) / 2, z1 + out / 2);
  for (const s of [-1, 1]) {
    const px = cx + s * (bw / 2 - 0.45);
    for (const [y0, y1, o] of [[BASE, 7.4, 0.35], [7.4, 11, 0.22], [11, h - 1.2, 0.1]]) box.add(px, (y0 + y1) / 2, B.z1 + o / 2, 0.9, y1 - y0, o, CREAM); // the piers, stepping back
  }
  for (const y of [7.4, 11.0]) box.add(cx, y, B.z1 + 0.2, bw + 0.2, 0.32, 0.4, CREAM); // the stage lines
  for (const y of FLOORS) for (const dx of [-0.95, 0.95]) window(k, cx + dx, y, B.z1, 1.3, 2.3);
  for (const dx of [-1.2, 1.2]) k.win.add('rect', cx + dx, 1.9, B.z1 + 0.26, 1.3, 1.3, '+z');
  box.add(cx, h - 1.0, B.z1 - 0.1, bw + 0.6, 0.5, out + 0.9, CREAM); // its cap under the cornice
}

/** The plain brick stair tower: wide, standing well out, up past the roof; a cream coping; its grey door and a light. */
function tower(k: Kit) {
  const { g, box } = k, T = ALLB_TOWER, D = ALLB_REAR_DOOR, cx = (T.x0 + T.x1) / 2, cz = (T.z0 + T.z1) / 2;
  mesh(g, block(T.x1 - T.x0, T.h, T.z1 - T.z0), lambert(0x9a4834, brickMap(), 'allbTower'), cx, 0, cz);
  box.add(cx, T.h + 0.1, cz, T.x1 - T.x0 + 0.3, 0.2, T.z1 - T.z0 + 0.3, CREAM);
  for (let y = 1.2; y < BASE; y += 0.5) box.add(cx, y, T.z1 + 0.01, T.x1 - T.x0, 0.04, 0.02, 0x7a3a2c); // a few darker courses low down
  const y0 = ALLB_LANDING.h;
  box.add(D.x, y0 + 1.15, D.z + 0.04, 1.1, 2.3, 0.08, 0x8b9196); // the door…
  box.add(D.x, y0 + 1.15, D.z + 0.08, 1.26, 2.42, 0.04, 0x6f757a); // …its frame
  box.add(D.x + 0.38, y0 + 1.05, D.z + 0.12, 0.04, 0.3, 0.06, 0xd0d4d6); // the handle
  box.add(D.x, y0 + 2.75, D.z + 0.12, 0.26, 0.18, 0.18, 0xf3e3b8); // the light over it
}

/**
 * The east block, come forward toward the street: granite base with its door, brick, cream bands and quoins, pairs of
 * windows, arched along the top floor; a cornice with dentils, a parapet, the little room on its flat roof.
 */
function wing(k: Kit) {
  const { g, box, win } = k, W = ALLB_WING, w = W.x1 - W.x0, cx = (W.x0 + W.x1) / 2, cz = (W.z0 + W.z1) / 2;
  mesh(g, block(w, W.h, W.z1 - W.z0), lambert(BRICK, brickMap(), 'allb'), cx, 0, cz);
  granite(k, W.x0, W.x1, W.z1);
  for (const y of [7.4, 11.0]) box.add(cx, y, W.z1 + 0.15, w + 0.2, 0.3, 0.3, CREAM);
  box.add(cx, W.h - 1.0, cz, w + 0.9, 0.5, W.z1 - W.z0 + 0.9, CREAM); // the cornice…
  for (let x = W.x0 - 0.2; x < W.x1 + 0.2; x += 0.42) box.add(x, W.h - 1.4, W.z1 + 0.3, 0.2, 0.22, 0.2, CREAM); // …its dentils
  box.add(cx, W.h - 0.35, cz, w, 0.8, W.z1 - W.z0, 0x9a4834); // the parapet…
  box.add(cx, W.h + 0.08, cz, w + 0.2, 0.16, W.z1 - W.z0 + 0.2, CREAM); // …its coping
  for (let x = W.x0 + 1; x < W.x1; x += 2.2) box.add(x, W.h - 0.35, W.z1 + 0.02, 0.5, 0.3, 0.04, 0x7a3a2c); // little drains along it
  quoins(k, W.x1, W.z1, W.h - 1.2, -1, -1);
  quoins(k, W.x0, W.z1, W.h - 1.2, 1, -1);
  // its face: two pairs of windows a floor (arched along the top), basement windows and the door in the granite
  for (const px of [W.x0 + 3.4, W.x1 - 3.4]) {
    FLOORS.forEach((y, i) => { for (const dx of [-0.85, 0.85]) window(k, px + dx, y + (i === 2 ? 0.2 : 0), W.z1, 1.2, 2.3 + (i === 2 ? 0.4 : 0), i === 2); });
  }
  for (const x of [W.x1 - 2.4, W.x1 - 4.6]) win.add('rect', x, 1.9, W.z1 + 0.26, 1.3, 1.3, '+z');
  const D = ALLB_WING_DOOR, y0 = ALLB_LANDING.h;
  box.add(D.x, y0 + 1.2, D.z + 0.27, 1.1, 2.4, 0.06, 0x3a4048); // the door, glass in its top half…
  box.add(D.x, y0 + 1.75, D.z + 0.31, 0.8, 1.0, 0.02, 0xbcd0d8);
  box.add(D.x, y0 + 2.5, D.z + 0.3, 1.4, 0.2, 0.12, CREAM); // …a stone head over it
  // the room on the roof, set back: brick, a band of windows, its own flat roof overhanging
  const R = { x0: W.x0 + 2.5, x1: W.x1 - 2.5, z0: W.z0 + 2, z1: W.z1 - 2.5 }, rcx = (R.x0 + R.x1) / 2, rcz = (R.z0 + R.z1) / 2;
  mesh(g, block(R.x1 - R.x0, 2.4, R.z1 - R.z0), lambert(0xe9e5dc), rcx, W.h, rcz);
  for (let x = R.x0 + 0.8; x < R.x1 - 0.4; x += 1.3) win.add('rect', x, W.h + 1.3, R.z1 + 0.03, 1.0, 1.1, '+z');
  box.add(rcx, W.h + 2.5, rcz, R.x1 - R.x0 + 0.8, 0.2, R.z1 - R.z0 + 0.8, 0x5d8c78);
  box.add(R.x1 - 1, W.h + 3.2, rcz, 0.06, 1.6, 0.06, 0x8f9496); // an antenna mast
}

/** The landing along the tower and the east block, steps up onto its west end, the ramp down off its east end, railings. */
function entrance(k: Kit) {
  const { g, box } = k, L = ALLB_LANDING, S = ALLB_STEPS, R = ALLB_RAMP;
  box.add((L.x0 + L.x1) / 2, L.h / 2, (L.z0 + L.z1) / 2, L.x1 - L.x0, L.h, L.z1 - L.z0, CONCRETE);
  box.add((L.x0 + L.x1) / 2, L.h / 2, L.z1 + 0.02, L.x1 - L.x0, L.h + 0.02, 0.06, 0xb1aca2); // its face, a shade darker
  const tread = (S.x1 - S.x0) / S.steps, rise = L.h / S.steps;
  for (let i = 0; i < S.steps; i++) { // rising toward the landing (+x)
    const top = (i + 1) * rise, x = S.x0 + (i + 0.5) * tread;
    box.add(x, top / 2, (S.z0 + S.z1) / 2, tread, top, S.z1 - S.z0, i % 2 ? CONCRETE : 0xc6c1b7);
  }
  // the ramp: a sloping slab down toward the street, its concrete sides
  const len = R.z1 - R.z0, slope = Math.atan2(L.h, len);
  const ramp = mesh(g, new BoxGeometry(R.x1 - R.x0, 0.12, Math.hypot(len, L.h)), lambert(CONCRETE), (R.x0 + R.x1) / 2, L.h / 2 - 0.05, (R.z0 + R.z1) / 2);
  ramp.rotation.x = slope; // (high at the landing, −z)
  for (const x of [R.x0 - 0.1, R.x1 + 0.1]) {
    const side = mesh(g, new BoxGeometry(0.2, 0.3, Math.hypot(len, L.h)), lambert(0xb1aca2), x, L.h / 2 + 0.05, (R.z0 + R.z1) / 2);
    side.rotation.x = slope;
  }
  const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
  railing(k, v(L.x0, L.h, L.z1 - 0.05), v(R.x0, L.h, L.z1 - 0.05)); // along the landing's front
  for (const z of [S.z0 + 0.05, S.z1 - 0.05]) railing(k, v(S.x0, 0, z), v(S.x1, L.h, z)); // both sides of the steps
  for (const x of [R.x0, R.x1]) railing(k, v(x, L.h, R.z0), v(x, 0, R.z1 - 0.1)); // both sides of the ramp
}

/** The lot: asphalt, white stall lines and wheel stops, blue accessible spaces with their hatched aisle and signs, the wall, the sign. */
function lot(k: Kit) {
  const { g, box } = k, P = ALLB_LOT;
  const tar = new Mesh(new PlaneGeometry(P.x1 - P.x0, P.z1 - P.z0), lambert(ASPHALT));
  tar.rotation.x = -Math.PI / 2;
  tar.position.set((P.x0 + P.x1) / 2, 0.022, (P.z0 + P.z1) / 2);
  tar.receiveShadow = true;
  g.add(tar);
  for (const s of ALLB_STALLS) {
    const col = s.accessible ? BLUE : 0xeeeeea, head = s.z - s.len / 2;
    for (const e of [-1, 1]) box.add(s.x + (e * s.w) / 2, 0.03, s.z, 0.1, 0.012, s.len, col); // the lines either side
    box.add(s.x, 0.09, head + 0.6, 1.8, 0.15, 0.22, 0xc9c5bb); // the wheel stop
    if (s.accessible) {
      box.add(s.x, 0.03, s.z + 0.6, 1.1, 0.012, 1.1, BLUE); // the painted symbol: a blue square…
      box.add(s.x, 0.033, s.z + 0.55, 0.12, 0.012, 0.5, 0xffffff); // …and a figure in white, roughly
      box.add(s.x + 0.18, 0.033, s.z + 0.85, 0.4, 0.012, 0.1, 0xffffff);
      box.add(s.x, 1.1, head - 0.1, 0.06, 2.2, 0.06, STEEL); // the sign on its post
      box.add(s.x, 1.95, head - 0.14, 0.42, 0.55, 0.03, BLUE);
      box.add(s.x, 1.95, head - 0.16, 0.2, 0.25, 0.01, 0xffffff);
    }
  }
  // the hatched aisle beside the accessible spaces
  const a = ALLB_STALLS[1], b = ALLB_STALLS[2], ax0 = a.x + a.w / 2, ax1 = b.x - b.w / 2;
  for (let z = a.z - a.len / 2 + 0.4; z < a.z + a.len / 2; z += 0.6) box.add((ax0 + ax1) / 2, 0.03, z, ax1 - ax0, 0.012, 0.1, BLUE, 0.6);
  box.add(ax0, 0.03, a.z, 0.1, 0.012, a.len, BLUE);
  // the low concrete wall at the west end (the walkway's planting on its far side)
  const W = ALLB_WALL;
  box.add((W.x0 + W.x1) / 2, 0.45, (W.z0 + W.z1) / 2, W.x1 - W.x0, 0.9, W.z1 - W.z0, CONCRETE);
  box.add((W.x0 + W.x1) / 2, 0.92, (W.z0 + W.z1) / 2, W.x1 - W.x0 + 0.1, 0.06, W.z1 - W.z0, 0xc9c5bb);
  // the black "Allbritton Hall" sign by the steps
  const G = ALLB_SIGN;
  box.add(G.x - 0.45, 0.9, G.z, 0.1, 1.8, 0.1, 0x111315);
  box.add(G.x + 0.45, 0.9, G.z, 0.1, 1.8, 0.1, 0x111315);
  const sign = new Mesh(new PlaneGeometry(0.8, 1.0), new MeshLambertMaterial({ map: signTexture() }));
  sign.position.set(G.x, 1.25, G.z + 0.06);
  g.add(sign);
  box.add(G.x, 1.25, G.z, 0.84, 1.04, 0.1, 0x111315);
}
