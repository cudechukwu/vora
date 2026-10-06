import {
  BoxGeometry, CanvasTexture, ConeGeometry, CylinderGeometry, DoubleSide, ExtrudeGeometry, Group, Material, Mesh, MeshBasicMaterial,
  MeshPhongMaterial, Path, PlaneGeometry, SRGBColorSpace, Shape, SphereGeometry,
} from 'three';
import {
  BoxBank, Facing, PAL, WindowBank, WindowKind, block, brickMap, hipRoof, lambert, prism, stoneMap,
} from './kit';
import { BuildingId, FRONT_X, PORTICO, ROW, SOUTH_TOWER, USDAN, USDAN_COURT, XZ, layoutRow } from './layout';
import { DOORS, Door, VESTIBULE } from './usdan/plan';
import { buildSouthEnd } from './southview';

// ─── College Row buildings ─────────────────────────────────────────────
// Stylized, never literal (brief R/05): each building keeps the one or two
// things a Wes student recognises it by — the chapel spire and striped
// roof, the cupolas, Zelnick's glass, Usdan's big glass-banded triangle — and drops the rest.
// Positions come from layout.ts; this file only draws.

type Kit = { g: Group; win: WindowBank; box: BoxBank };
type Builder = (k: Kit, zc: number) => void;

const BUILDERS: Record<BuildingId, Builder> = {
  judd, chapel, zelnick, north: northCollege, south: southCollege, boger,
};

export function buildRow(win: WindowBank, box: BoxBank) {
  const g = new Group();
  const { stops, crossings } = layoutRow();
  for (const s of stops) BUILDERS[s.id]({ g, win, box }, s.zc);
  usdan({ g, win, box });
  buildSouthEnd({ g, win, box }); // the field road, the Frank Center and Olin, up on their bank
  g.traverse((o) => {
    if ((o as Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  return { group: g, stops, crossings };
}

// ── shared pieces ──────────────────────────────────────────────────────

function add(g: Group, geo: BoxGeometry | ConeGeometry | CylinderGeometry | SphereGeometry | ReturnType<typeof prism>,
  mat: Material, x: number, y: number, z: number) {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  g.add(m);
  return m;
}

/** Pitched roof: wall-coloured gable triangles + two slate slabs. Ridge runs along z. */
function gable(g: Group, cx: number, y: number, cz: number, width: number, h: number, len: number,
  wall: Material, alongX = false, stripes: number | null = null) {
  const r = new Group();
  r.add(new Mesh(prism(width, h, len), wall));
  const half = width / 2;
  const slope = Math.atan2(h, half);
  const slabW = Math.hypot(half, h) + 0.5;
  for (const side of [-1, 1]) {
    const s = new Mesh(new BoxGeometry(slabW, 0.3, len + 0.9), lambert(PAL.slate));
    s.position.set((side * half) / 2, h / 2 + 0.1, 0);
    s.rotation.z = -side * slope;
    if (stripes !== null) {
      for (const f of [-0.28, 0.08]) {
        const band = new Mesh(new BoxGeometry(0.8, 0.06, len + 0.9), lambert(stripes));
        band.position.set(f * slabW, 0.17, 0);
        s.add(band);
      }
    }
    r.add(s);
  }
  if (alongX) r.rotation.y = Math.PI / 2;
  r.position.set(cx, y, cz);
  g.add(r);
}

interface HallOpts {
  zc: number; w: number; d: number;
  floors: number; floorH: number;
  wall: 'brick' | 'stone'; color: number;
  window: WindowKind; winW?: number; winH?: number;
  roof: 'hip' | 'gable'; roofH: number;
  skipDoor?: boolean;
}

/** A rectangular hall: plinth, walls, windows on the front and ends, cornice, roof, door. */
function hall(k: Kit, o: HallOpts) {
  const { g, win, box } = k;
  const cx = FRONT_X - o.d / 2;
  const base = 1.0;
  const wallH = o.floors * o.floorH;
  const top = base + wallH;
  const wallMat = lambert(o.color, o.wall === 'brick' ? brickMap() : stoneMap(), o.wall);

  add(g, block(o.d + 0.4, base, o.w + 0.4), lambert(PAL.brownstone, stoneMap(), 'stone'), cx, 0, o.zc);
  add(g, block(o.d, wallH, o.w), wallMat, cx, base, o.zc);
  box.add(cx, top + 0.22, o.zc, o.d + 0.7, 0.45, o.w + 0.7, PAL.trim); // cornice
  box.add(cx, base + 0.08, o.zc, o.d + 0.1, 0.16, o.w + 0.1, PAL.trim); // water table

  const ww = o.winW ?? 1.15;
  const wh = o.winH ?? o.floorH * 0.55;
  const cols = Math.max(3, Math.floor(o.w / 3.4)) | 1; // odd → a centre bay for the door
  const pitch = o.w / cols;
  const doorCol = (cols - 1) / 2;

  const face = (x: number, z: number, facing: Facing, y: number) => {
    win.add(o.window, x, y, z, ww, wh, facing);
    const out = facing === '+x' ? [0.12, 0] : facing === '-z' ? [0, -0.12] : [0, 0.12];
    const along = facing === '+x';
    box.add(x + out[0], y - wh / 2 - 0.08, z + out[1], along ? 0.22 : ww + 0.3, 0.14, along ? ww + 0.3 : 0.22, PAL.trim);
    if (o.window === 'rect') {
      box.add(x + out[0], y + wh / 2 + 0.12, z + out[1], along ? 0.18 : ww + 0.24, 0.22, along ? ww + 0.24 : 0.18, PAL.trim);
    }
  };

  for (let f = 0; f < o.floors; f++) {
    const y = base + o.floorH * f + o.floorH * 0.52;
    for (let c = 0; c < cols; c++) {
      if (f === 0 && c === doorCol && !o.skipDoor) continue;
      face(FRONT_X + 0.02, o.zc + o.w / 2 - pitch * (c + 0.5), '+x', y);
    }
    const endCols = Math.max(2, Math.floor(o.d / 3.6));
    const ep = o.d / endCols;
    for (let c = 0; c < endCols; c++) {
      const x = FRONT_X - ep * (c + 0.5);
      face(x, o.zc + o.w / 2 + 0.02, '+z', y);
      face(x, o.zc - o.w / 2 - 0.02, '-z', y);
    }
  }

  const doorZ = o.zc + o.w / 2 - pitch * (doorCol + 0.5); // = o.zc (cols is odd)
  if (!o.skipDoor) {
    box.add(FRONT_X + 0.06, base + 1.35, doorZ, 0.12, 2.7, 1.9, 0x2b1d17); // door
    box.add(FRONT_X + 0.12, base + 2.9, doorZ, 0.24, 0.35, 2.6, PAL.trim); // lintel
    for (let s = 0; s < 3; s++) {
      const t = base * (1 - s / 3);
      box.add(FRONT_X + 0.25 + s * 0.5, t / 2, doorZ, 0.5, t, 3.2 + s * 0.4, PAL.curb);
    }
  }

  if (o.roof === 'hip') add(g, hipRoof(o.d + 0.9, o.roofH, o.w + 0.9), lambert(PAL.slate), cx, top + 0.45, o.zc);
  else gable(g, cx, top + 0.45, o.zc, o.d + 0.2, o.roofH, o.w, wallMat);

  return { cx, top: top + 0.45 };
}

/** White cupola with a patina dome (North College) or a taller belfry (South College). */
function cupola(k: Kit, x: number, y: number, z: number, belfry: boolean) {
  const { g, win } = k;
  const white = lambert(PAL.trim);
  let yy = y;
  add(g, block(4.4, 1.6, 4.4), white, x, yy, z); yy += 1.6;
  if (belfry) {
    add(g, block(3.4, 3.4, 3.4), white, x, yy, z);
    for (const f of ['+x', '-x', '+z', '-z'] as Facing[]) {
      const dx = f === '+x' ? 1.72 : f === '-x' ? -1.72 : 0;
      const dz = f === '+z' ? 1.72 : f === '-z' ? -1.72 : 0;
      win.add('arch', x + dx, yy + 1.7, z + dz, 1.5, 2.3, f);
    }
    yy += 3.4;
  }
  add(g, new CylinderGeometry(1.25, 1.35, 2.2, 8).translate(0, 1.1, 0), white, x, yy, z); yy += 2.2;
  add(g, new SphereGeometry(1.45, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), lambert(PAL.patina), x, yy, z);
  add(g, new ConeGeometry(0.18, 2.2, 6).translate(0, 1.1, 0), lambert(0xc9b27a), x, yy + 1.2, z);
}

// ── the row ────────────────────────────────────────────────────────────

function chapel(k: Kit, zRow: number) {
  const { g, win, box } = k;
  const zc = zRow + 3.2; // nave at the Judd end, tower on the Zelnick (−z) end
  const W = 16, D = 32, H = 10;
  const cx = FRONT_X - D / 2;
  const stone = lambert(PAL.brownstone, stoneMap(), 'stone');
  add(g, block(D, H, W), stone, cx, 0, zc);
  gable(g, cx, H, zc, W, 8, D, stone, true, 0x9a3a2e);
  // great west window on the gable end + a door under it
  win.add('gothic', FRONT_X + 0.03, 9.5, zc, 4.6, 7.2, '+x');
  box.add(FRONT_X + 0.08, 1.7, zc, 0.14, 3.4, 2.4, 0x2b1d17);
  for (let x = FRONT_X - 8.5; x > FRONT_X - D + 2; x -= 4.2) {
    win.add('gothic', x, 5.4, zc + W / 2 + 0.03, 1.5, 4.8, '+z');
    win.add('gothic', x, 5.4, zc - W / 2 - 0.03, 1.5, 4.8, '-z');
    box.add(x + 2.1, 4, zc + W / 2 + 0.4, 0.9, 8, 0.8, PAL.brownstone); // buttresses
    box.add(x + 2.1, 4, zc - W / 2 - 0.4, 0.9, 8, 0.8, PAL.brownstone);
  }
  // tower + spire on the front corner toward Zelnick — the bit you see from the field
  const tx = FRONT_X - 3.2, tz = zc - W / 2 - 3.2, T = 21;
  add(g, block(6.4, T, 6.4), stone, tx, 0, tz);
  for (const f of ['+x', '-x', '+z', '-z'] as Facing[]) {
    const dx = f === '+x' ? 3.23 : f === '-x' ? -3.23 : 0;
    const dz = f === '+z' ? 3.23 : f === '-z' ? -3.23 : 0;
    win.add('gothic', tx + dx, T - 3.4, tz + dz, 1.7, 4.2, f);
  }
  for (const [ox, oz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) box.add(tx + ox, T + 1.2, tz + oz, 0.7, 2.4, 0.7, PAL.brownstone);
  const spire = add(g, new ConeGeometry(3.6, 15, 4).translate(0, 7.5, 0), lambert(PAL.slate), tx, T, tz);
  spire.rotation.y = Math.PI / 4;
}

/**
 * South College (the user's photos): the old brownstone one, four storeys of rubble stone under a slate gable, with a
 * square tower standing out from the middle of its front: an arched door with a fanlight up granite steps between
 * brownstone cheeks, three windows above, a white cornice and balustrade, and the white belfry with its green dome.
 * A black fire escape down one end, and a glass bridge across the gap to North College.
 */
function southCollege(k: Kit, zc: number) {
  const { g, win, box } = k;
  const w = 24, d = 16;
  const h = hall(k, { zc, w, d, floors: 4, floorH: 3.4, wall: 'stone', color: PAL.brownstone, window: 'rect', roof: 'gable', roofH: 4, skipDoor: true });
  const stone = lambert(PAL.brownstone, stoneMap(), 'stone');
  const T = SOUTH_TOWER, tx = FRONT_X + T.out / 2 - 0.5, tw = T.half * 2, top = h.top + 4.2;
  add(g, block(T.out + 1, top, tw), stone, tx, 0, zc);
  box.add(tx, top + 0.25, zc, T.out + 1.8, 0.5, tw + 0.8, PAL.trim); // white cornice
  box.add(tx, top + 0.75, zc, T.out + 1.4, 0.5, tw + 0.4, PAL.trim); // balustrade…
  for (let i = -2; i <= 2; i++) box.add(FRONT_X + T.out + 0.2, top + 0.75, zc + i * 0.9, 0.12, 0.5, 0.12, 0xd8d2c4);
  cupola(k, tx, top + 1.0, zc, true);
  const fx = FRONT_X + T.out;
  for (const y of [7.6, 11.0, 14.4]) {
    win.add('rect', fx + 0.02, y, zc, 1.15, 1.9, '+x');
    box.add(fx + 0.08, y - 1.05, zc, 0.2, 0.14, 1.4, 0x9a7a66);
  }
  // the arched door with its fanlight, up granite steps between brownstone cheek walls
  win.add('arch', fx + 0.02, 4.3, zc, 2.0, 1.2, '+x');
  box.add(fx + 0.04, 2.3, zc, 0.1, 2.6, 1.9, 0x23262a);
  for (const o of [-0.95, 0.95]) box.add(fx + 0.06, 2.3, zc + o, 0.12, 2.6, 0.12, 0x23262a);
  for (let s = 0; s < 5; s++) box.add(fx + 0.4 + s * 0.42, 1.0 - s * 0.2, zc, 0.42, 1.0 - s * 0.2 + 0.001, 2.4, 0xc4c2bb);
  for (const o of [-1.45, 1.45]) box.add(fx + 1.1, 0.75, zc + o, 2.2, 1.5, 0.5, PAL.brownstone);
  // a black steel fire escape down the end toward the chapel
  const ez = zc + w / 2 + 1.0;
  for (let f = 1; f < 4; f++) {
    const y = 1 + f * 3.4;
    box.add(FRONT_X - 4, y, ez, 3.2, 0.08, 1.8, 0x1b1d1f);
    box.add(FRONT_X - 4, y + 0.55, ez + 0.9, 3.2, 0.06, 0.04, 0x1b1d1f);
    const flightM = add(g, new BoxGeometry(0.9, 0.08, 3.9), lambert(0x1b1d1f), FRONT_X - 4, y - 1.7, ez);
    flightM.rotation.z = f % 2 ? 0.9 : -0.9;
    flightM.rotation.y = Math.PI / 2;
  }
  for (const x of [FRONT_X - 5.6, FRONT_X - 2.4]) box.add(x, 6.4, ez + 0.9, 0.08, 12.8, 0.08, 0x1b1d1f);
  // the glass bridge over the gap to North College (you can walk under it)
  const z0 = zc - w / 2, gap = ROW.find((s) => s.id === 'south')!.gap, bz = z0 - gap / 2, bx = FRONT_X - 9;
  add(g, block(9, 3.6, gap + 0.2), lambert(0x2a333a), bx, 3.6, bz);
  box.add(bx, 7.35, bz, 9.6, 0.3, gap + 0.4, 0x1d2226);
  box.add(bx, 3.5, bz, 9.6, 0.25, gap + 0.4, 0x1d2226);
  for (let i = 0; i < 4; i++) win.add('rect', FRONT_X - 4.47, 5.4, bz - gap / 2 + (i + 0.5) * (gap / 4), gap / 4 - 0.15, 3.3, '+x');
  for (const z of [bz - gap / 2 + 0.3, bz + gap / 2 - 0.3]) box.add(FRONT_X - 4.6, 1.75, z, 0.25, 3.5, 0.25, 0x1d2226);
}

/**
 * North College (the user's photos): long, four storeys of smooth brownstone ashlar, giant pilasters at the corners, a
 * heavy cornice with an attic storey above it, and in the middle a portico of four giant columns under a pediment with
 * a half-round window, up a wide flight of granite steps.
 */
function northCollege(k: Kit, zc: number) {
  const { g, win, box } = k;
  const w = 60, d = 18;
  const cx = FRONT_X - d / 2;
  const ash = lambert(0x7e5a4a, stoneMap(), 'ashlar');
  const trimC = 0x6e4d40;
  const base = 1.2, main = 12, attic = 3.6;
  add(g, block(d + 0.4, base, w + 0.4), lambert(0x6a4a3e, stoneMap(), 'stone2'), cx, 0, zc);
  add(g, block(d, main - base + attic, w), ash, cx, base, zc);
  box.add(cx, main + 0.35, zc, d + 1.4, 0.7, w + 1.4, trimC); // the main cornice
  box.add(cx, main + attic + 0.25, zc, d + 0.6, 0.5, w + 0.6, trimC); // the top one
  box.add(cx, main + attic + 0.6, zc, d - 0.6, 0.1, w - 0.6, 0x55595c); // flat roof
  for (const z of [zc - w / 2, zc + w / 2]) box.add(FRONT_X + 0.25, (base + main) / 2, z + (z > zc ? -0.9 : 0.9), 0.5, main - base, 1.8, trimC); // corner pilasters
  // windows: sixteen bays, four rows (the top one in the attic)
  const bays = 16, pitch = w / bays;
  const rows: [number, number][] = [[3.0, 2.4], [6.6, 2.2], [9.9, 2.0], [main + 1.8, 1.5]];
  for (let b = 0; b < bays; b++) {
    const z = zc - w / 2 + (b + 0.5) * pitch;
    rows.forEach(([y, wh], r) => {
      if (r === 0 && Math.abs(z - zc) < pitch * 0.6) return; // the door
      win.add('rect', FRONT_X + 0.02, y, z, 1.25, wh, '+x');
      box.add(FRONT_X + 0.1, y - wh / 2 - 0.07, z, 0.2, 0.14, 1.5, trimC);
    });
  }
  const endBays = 5;
  for (let b = 0; b < endBays; b++) {
    const x = FRONT_X - (b + 0.5) * (d / endBays);
    for (const [y, wh] of rows) { win.add('rect', x, y, zc + w / 2 + 0.02, 1.2, wh, '+z'); win.add('rect', x, y, zc - w / 2 - 0.02, 1.2, wh, '-z'); }
  }
  // the portico: four giant columns, an entablature, a pediment with a half-round window
  const P = PORTICO, px = FRONT_X + P.out;
  const col = lambert(0x86604f);
  for (const o of P.at) {
    add(g, new CylinderGeometry(P.r * 0.88, P.r, main - base - 0.6, 14).translate(0, (main - base - 0.6) / 2, 0), col, px, base, zc + o);
    box.add(px, base + 0.15, zc + o, P.r * 2.4, 0.3, P.r * 2.4, trimC); // base
    box.add(px, main - 0.3, zc + o, P.r * 2.4, 0.3, P.r * 2.4, trimC); // capital
  }
  const span = P.at[P.at.length - 1] - P.at[0] + 2.4;
  box.add(FRONT_X + P.out / 2 + 0.3, main + 0.4, zc, P.out + 1.4, 0.8, span, trimC); // entablature
  const ped = add(g, prism(span, 2.8, P.out + 1.2), lambert(0x7e5a4a, stoneMap(), 'ashlar'), FRONT_X + P.out / 2 + 0.3, main + 0.8, zc);
  ped.rotation.y = Math.PI / 2;
  box.add(FRONT_X + P.out + 0.95, main + 1.0, zc, 0.12, 0.2, span, trimC);
  win.add('arch', FRONT_X + P.out + 0.97, main + 1.75, zc, 1.6, 0.9, '+x');
  // the door, and the wide flight of granite steps up to it
  box.add(FRONT_X + 0.06, base + 1.5, zc, 0.12, 3.0, 2.0, 0x2b1d17);
  box.add(FRONT_X + 0.12, base + 3.2, zc, 0.24, 0.4, 2.8, trimC);
  for (let s = 0; s < 4; s++) {
    const t = base * (1 - s / 4);
    box.add(FRONT_X + 0.5 + P.out / 2 + s * 0.55, t / 2, zc, P.out + 1 - s * 0.55 + 0.001, t, span + 1 - s * 0.6, 0xc4c2bb);
  }
}

function judd(k: Kit, zc: number) {
  const w = 30;
  hall(k, { zc, w, d: 18, floors: 4, floorH: 3.8, wall: 'stone', color: 0x86604e, window: 'arch', winW: 1.1, winH: 2.3, roof: 'hip', roofH: 5.5 });
}

/** Zelnick Pavilion: the glass link between the chapel and North College. */
function zelnick(k: Kit, zc: number) {
  const { g, win, box } = k;
  const w = 14, d = 12, H = 5.6;
  const x0 = FRONT_X - 3; // set back from the row
  const cx = x0 - d / 2;
  add(g, block(d, H, w), lambert(0x2f3d46), cx, 0, zc);
  const n = 5;
  for (let i = 0; i < n; i++) {
    win.add('rect', x0 + 0.03, H / 2, zc - w / 2 + (i + 0.5) * (w / n), w / n - 0.15, H - 0.5, '+x');
    box.add(x0 + 0.08, H / 2, zc - w / 2 + i * (w / n), 0.12, H, 0.12, 0x9a9486); // mullions
  }
  // the thin, flared roof that overhangs the front
  const roof = new Mesh(new BoxGeometry(d + 4.5, 0.3, w + 1.4), lambert(0xd8d0c0));
  roof.position.set(cx + 2.2, H + 0.35, zc);
  roof.rotation.z = 0.07;
  g.add(roof);
  box.add(x0 + 2.2, 0.5, zc + w / 2 - 1, 4.4, 1, 0.5, 0xb8b2a4); // low granite wall
}

/** Boger Hall: two storeys of brick, a grey metal top floor, a tall end block with an arched window. */
function boger(k: Kit, zc: number) {
  const { g, win, box } = k;
  const W = 44, d = 18;
  const cx = FRONT_X - d / 2;
  const brick = lambert(PAL.brick, brickMap(), 'brick');
  const metal = lambert(0x6c757b);
  const trimDark = 0x4a5258;

  // main block
  const L = W - 10, zm = zc - 5;
  add(g, block(d, 7.6, L), brick, cx, 0, zm);
  add(g, block(d - 0.6, 3.6, L), metal, cx - 0.3, 7.6, zm);
  box.add(cx + 0.9, 11.35, zm, d + 2.4, 0.3, L + 1, trimDark); // flat roof, overhanging
  const bays = 10, pitch = L / bays;
  for (let i = 0; i < bays; i++) {
    const z = zm + L / 2 - (i + 0.5) * pitch;
    win.add('rect', FRONT_X + 0.02, 2.0, z, pitch - 1.1, 3.2, '+x');
    win.add('rect', FRONT_X + 0.02, 5.6, z, pitch - 1.1, 2.1, '+x');
    win.add('rect', FRONT_X - 0.28, 9.4, z, pitch - 0.4, 1.5, '+x'); // ribbon window
    box.add(FRONT_X + 0.25, 3.8, zm + L / 2 - i * pitch, 0.5, 7.6, 0.55, PAL.brickDeep); // piers
  }
  // tall end block on the South College side — the arched window you see walking up
  const zt = zc + W / 2 - 5;
  add(g, block(d + 1, 13, 10), brick, cx + 0.5, 0, zt);
  box.add(cx + 0.5, 13.3, zt, d + 1.8, 0.6, 10.8, trimDark);
  win.add('arch', FRONT_X + 1.03, 6.8, zt, 3.2, 8.4, '+x');
  win.add('arch', cx + 0.5, 6.8, zt + 5.03, 3.4, 9, '+z');
  for (const dz of [-4.7, 4.7]) box.add(FRONT_X + 1.2, 6.5, zt + dz, 0.4, 13, 0.6, PAL.brickDeep); // pilasters
}

/** Usdan: a curved front that bows out toward the field, brick below, glass above. */
/** A slab in the shape of a polygon (x, z), from y0 up h, grown outward by `grow`. Optional hole. */
function slab(poly: XZ[], y0: number, h: number, grow = 0, hole?: XZ[]) {
  const c = poly.reduce((a, p) => ({ x: a.x + p.x / poly.length, z: a.z + p.z / poly.length }), { x: 0, z: 0 });
  const out = (p: XZ) => {
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz) || 1;
    return { x: p.x + (dx / d) * grow, z: p.z + (dz / d) * grow };
  };
  // shape lives in (x, −z); extruded up along its own z, then stood upright
  const shape = new Shape(poly.map(out).map((p) => ({ x: p.x, y: -p.z }) as never));
  if (hole) shape.holes.push(new Path(hole.map((p) => ({ x: p.x, y: -p.z }) as never)));
  const geo = new ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y0, 0);
  return geo;
}

/** The raised glass clerestories on Usdan's roof: one along the east wing (over the plaza), one over the west. */
const USDAN_LANTERNS: XZ[][] = [
  [{ x: -68, z: -229 }, { x: -64.5, z: -229 }, { x: -63, z: -186 }, { x: -67, z: -186 }],
  [{ x: -106, z: -197 }, { x: -93, z: -197 }, { x: -93, z: -187 }, { x: -102, z: -187 }],
];

/** Usdan: a big low triangle behind Boger — brick ground floor, a band of glass above, pale green roof, courtyard in the middle. */
function usdan(k: Kit) {
  const { g, win, box } = k;
  const brick = lambert(PAL.brick, brickMap(), 'brick');
  g.add(new Mesh(slab(USDAN, 0, 9.0, 0, USDAN_COURT), brick)); // brick, two tall storeys
  g.add(new Mesh(slab(USDAN, 4.5, 0.25, 0.12, USDAN_COURT), lambert(PAL.brickDeep))); // a darker band between them
  // deep dark eaves all round, then raised glass clerestories with their own overhanging roofs (the pagoda look)
  const roof = lambert(0x50575d);
  g.add(new Mesh(slab(USDAN, 9.0, 0.4, 1.8, USDAN_COURT), roof));
  for (const lantern of USDAN_LANTERNS) {
    g.add(new Mesh(slab(lantern, 9.4, 1.9, -0.2), lambert(0x8fa6b2)));
    g.add(new Mesh(slab(lantern, 11.3, 0.35, 1.1), roof));
    for (let i = 0; i < lantern.length; i++) { // mullions
      const a = lantern[i], b = lantern[(i + 1) % lantern.length];
      const n = Math.max(2, Math.floor(Math.hypot(b.x - a.x, b.z - a.z) / 2.2));
      for (let j = 0; j <= n; j++) box.add(a.x + (b.x - a.x) * (j / n), 10.35, a.z + (b.z - a.z) * (j / n), 0.12, 1.9, 0.12, 0x3c4348);
    }
  }
  // windows all the way round: tall glass above, a few big ones below
  const area = USDAN.reduce((a, p, i) => { const q = USDAN[(i + 1) % USDAN.length]; return a + p.x * q.z - q.x * p.z; }, 0);
  const sign = area > 0 ? 1 : -1; // which side of each edge is outside
  USDAN.forEach((a, i) => {
    const b = USDAN[(i + 1) % USDAN.length];
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    const nx = (sign * dz) / len, nz = (-sign * dx) / len; // outward normal
    const face = Math.atan2(nx, nz);
    const n = Math.max(2, Math.floor(len / 3.2));
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n, x = a.x + dx * t, z = a.z + dz * t;
      win.add('rect', x + nx * 0.03, 6.7, z + nz * 0.03, Math.min(2.4, len / n - 0.8), 2.8, face);
      const byDoor = DOORS.some((d) => Math.hypot(d.x - x, d.z - z) < d.w / 2 + (d.main ? VESTIBULE.extra : 0) + 1.6);
      if (j % 2 === 0 && !byDoor) win.add('rect', x + nx * 0.03, 2.4, z + nz * 0.03, 2.2, 2.6, face);
    }
  });
  for (const d of DOORS) usdanDoor(k, d);
}

// ── Usdan's doors, from outside ──
const GLASS = new MeshPhongMaterial({ color: 0xa9cad6, transparent: true, opacity: 0.32, shininess: 120, specular: 0xffffff, depthWrite: false, side: DoubleSide });
const LIT = new MeshBasicMaterial({ color: 0xf3e2bd }); // warm light from inside, through the doors
const FRAME = 0x2a3036;

function usdanSign(): MeshBasicMaterial {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2a3036'; g.fillRect(0, 0, 512, 64);
  g.fillStyle = '#f2ede2'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center';
  g.fillText('USDAN UNIVERSITY CENTER', 256, 43);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return new MeshBasicMaterial({ map: t });
}
let SIGN: MeshBasicMaterial | null = null;

/**
 * A door from outside: lit glass double doors in a dark frame, a mat, and a path leading out to it.
 * The main doors sit at the back of a glass vestibule that sticks out from the wall, with a canopy and the sign.
 */
function usdanDoor(k: Kit, d: Door) {
  const { g, box } = k;
  const face = Math.atan2(d.nx, d.nz), tx = -d.nz, tz = d.nx;
  const at = (out: number, along: number, y: number) => [d.x + d.nx * out + tx * along, y, d.z + d.nz * out + tz * along] as const;
  const plane = (w: number, h: number, mat: Material, out: number, along: number, y: number, rot = face) => {
    const m = new Mesh(new PlaneGeometry(w, h), mat);
    m.position.set(...at(out, along, y));
    m.rotation.y = rot;
    g.add(m);
    return m;
  };
  // the doors: two lit panes in a dark frame, set just proud of the wall
  for (const s of [-1, 1]) plane(d.w / 2 - 0.12, 2.4, LIT, 0.06, (s * d.w) / 4, 1.22);
  box.add(...at(0.05, 0, 2.5), d.w + 0.3, 0.16, 0.14, FRAME, face); // head
  for (const s of [-1, 0, 1]) box.add(...at(0.05, (s * d.w) / 2, 1.25), 0.1, 2.5, 0.14, FRAME, face); // jambs + centre
  for (const s of [-0.18, 0.18]) box.add(...at(0.1, s, 1.15), 0.04, 0.4, 0.06, 0xc0c4c8, face); // pull handles
  // a path out to it, and a mat
  const pathLen = d.main ? 11 : 8;
  box.add(...at(pathLen / 2 + (d.main ? VESTIBULE.depth : 0), 0, 0.03), d.w + 1.2, 0.03, pathLen, 0xcfc4ab, face);
  box.add(...at(d.main ? VESTIBULE.depth / 2 : 0.8, 0, 0.05), d.w, 0.02, d.main ? VESTIBULE.depth - 0.2 : 1.4, 0x1a1c1e, face);
  if (!d.main) {
    box.add(...at(0.8, 0, 3.1), d.w + 1.2, 0.2, 1.6, 0x3a4046, face); // a small canopy
    box.add(...at(0.12, d.w / 2 + 0.5, 2.6), 0.22, 0.3, 0.16, 0xf6efd8, face); // a lamp beside it
    return;
  }
  // the vestibule: glass front and sides on dark mullions, a flat roof, the sign on top
  const half = (d.w + VESTIBULE.extra) / 2, D = VESTIBULE.depth, H = VESTIBULE.h;
  for (const side of [-1, 1]) {
    plane(D, H - 0.2, GLASS, D / 2, side * half, (H - 0.2) / 2, face + Math.PI / 2); // side glass
    plane(half - d.w / 2, H - 0.2, GLASS, D, side * (d.w / 2 + (half - d.w / 2) / 2), (H - 0.2) / 2); // front glass beside the opening
    box.add(...at(D, side * half, H / 2), 0.12, H, 0.12, FRAME, face); // corner posts
    box.add(...at(0.05, side * half, H / 2), 0.12, H, 0.12, FRAME, face);
    box.add(...at(D, side * d.w / 2, H / 2), 0.1, H, 0.1, FRAME, face); // either side of the opening
    box.add(...at(D / 2, side * half, 1.1), 0.06, 0.06, D, FRAME, face); // rails across the side glass
  }
  plane(d.w, H - 2.6, GLASS, D, 0, 2.6 + (H - 2.6) / 2); // transom over the opening
  box.add(...at(D / 2 + 0.2, 0, H + 0.12), d.w + VESTIBULE.extra + 0.6, 0.24, D + 0.7, 0x3a4046, face); // roof / canopy
  box.add(...at(D, 0, 2.62), d.w + 0.1, 0.08, 0.1, FRAME, face); // head of the opening
  SIGN ??= usdanSign();
  plane(4.2, 0.52, SIGN, D + 0.56, 0, H + 0.12); // the sign, on the canopy's edge
}
