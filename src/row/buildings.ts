import {
  BoxGeometry, ConeGeometry, CylinderGeometry, Group, Material, Mesh, SphereGeometry,
} from 'three';
import {
  BoxBank, Facing, PAL, WindowBank, WindowKind, block, brickMap, hipRoof, lambert, prism, stoneMap,
} from './kit';
import { BuildingId, FRONT_X, layoutRow } from './layout';

// ─── College Row buildings ─────────────────────────────────────────────
// Stylized, never literal (brief R/05): each building keeps the one or two
// things a Wes student recognises it by — the chapel spire and striped
// roof, the cupolas, Zelnick's glass, Usdan's curve — and drops the rest.
// Positions come from layout.ts; this file only draws.

type Kit = { g: Group; win: WindowBank; box: BoxBank };
type Builder = (k: Kit, zc: number) => void;

const BUILDERS: Record<BuildingId, Builder> = {
  allbritton, judd, chapel, zelnick, north: northCollege, south: southCollege, boger, usdan,
};

export function buildRow(win: WindowBank, box: BoxBank) {
  const g = new Group();
  const { stops, crossings } = layoutRow();
  for (const s of stops) BUILDERS[s.id]({ g, win, box }, s.zc);
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

function southCollege(k: Kit, zc: number) {
  const w = 24;
  const h = hall(k, { zc, w, d: 16, floors: 4, floorH: 3.4, wall: 'brick', color: PAL.brickDeep, window: 'rect', roof: 'hip', roofH: 3 });
  cupola(k, h.cx, h.top + 2.2, zc, true);
}

function northCollege(k: Kit, zc: number) {
  const w = 36;
  const h = hall(k, { zc, w, d: 18, floors: 4, floorH: 3.5, wall: 'brick', color: PAL.brick, window: 'rect', roof: 'gable', roofH: 4.2 });
  cupola(k, h.cx, h.top + 3.2, zc, false);
  for (const dz of [-w / 2 + 2.5, w / 2 - 2.5]) k.box.add(h.cx, h.top + 3.2, zc + dz, 1.2, 3.2, 1.6, PAL.brickDeep); // chimneys
}

function judd(k: Kit, zc: number) {
  const w = 30;
  hall(k, { zc, w, d: 18, floors: 4, floorH: 3.8, wall: 'stone', color: 0x86604e, window: 'arch', winW: 1.1, winH: 2.3, roof: 'hip', roofH: 5.5 });
}

function allbritton(k: Kit, zc: number) {
  hall(k, { zc, w: 34, d: 18, floors: 3, floorH: 3.6, wall: 'brick', color: PAL.brick, window: 'rect', roof: 'hip', roofH: 4 });
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
function usdan(k: Kit, zc: number) {
  const { g, win } = k;
  const R = 40, bulge = 6;
  const ox = FRONT_X + bulge - R; // centre of the curve, far behind the facade
  const half = Math.asin(24 / R);
  const t0 = Math.PI / 2 - half, tl = half * 2;
  const brick = lambert(PAL.brick, brickMap(), 'brick');
  add(g, new CylinderGeometry(R, R, 4.6, 28, 1, false, t0, tl).translate(0, 2.3, 0), brick, ox, 0, zc);
  add(g, new CylinderGeometry(R - 0.4, R - 0.4, 4.2, 28, 1, false, t0, tl).translate(0, 2.1, 0), lambert(0x34444e), ox, 4.6, zc);
  add(g, new CylinderGeometry(R + 1.2, R + 1.2, 0.4, 28, 1, false, t0 - 0.02, tl + 0.04), lambert(0xa8bfa0), ox, 9.0, zc); // pale green roof
  const n = 18;
  for (let i = 0; i < n; i++) {
    const th = t0 + ((i + 0.5) / n) * tl;
    const sx = Math.sin(th), sz = Math.cos(th);
    win.add('rect', ox + sx * (R - 0.37), 6.7, zc + sz * (R - 0.37), (tl * R) / n - 0.35, 3.4, th);
    if (i % 2 === 0) win.add('rect', ox + sx * (R + 0.03), 2.4, zc + sz * (R + 0.03), 2.2, 2.6, th);
  }
}
