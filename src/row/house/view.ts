import {
  AdditiveBlending, BoxGeometry, CanvasTexture, Color, Group, Material, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, Object3D, PointLight, RepeatWrapping, SphereGeometry, Sprite, SpriteMaterial, SRGBColorSpace,
} from 'three';
import { WindowBank, lambert, prism, PAL, worldUV } from '../kit';
import { FAR_WALK } from '../layout';
import {
  DRIVEWAYS, FRONT_DOOR, FURNITURE, Furniture, HOUSE, Level, PORCH, PORCH_STEPS, ROOM_DOORS, STAIRS, STAIRWELL, TV,
  UPSTAIRS_Y, WALLS, WALL_H, Wall, toWorld,
} from './plan';

// ─── Drawing your house ────────────────────────────────────────────────
// Built from plan.ts, as two separate things:
//   • `exterior` — a closed building for the street: siding, porch, roof,
//     windows that glow at night. You never see inside it from outside.
//   • `interior` — the house as its own little world (rendered in its own
//     scene once you're through the front door): floors, rooms, furniture,
//     the TV, lamps. A cut-away hides whatever wall is between the camera
//     and you, and the upstairs while you're downstairs.

const SIDING = 0xf1ece0;
const TRIM = 0xfbf8f0;
const SHUTTER = 0x2f4a3f;
const PAINT: Record<Level, number> = { 0: 0xe9e1d3, 1: 0xe6dfd2 };
const WOOD = 0xa8794e;

function clapboard(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, 8, 64);
  for (let y = 0; y < 64; y += 16) {
    const grd = g.createLinearGradient(0, y, 0, y + 16);
    grd.addColorStop(0, '#d9d4c8'); grd.addColorStop(0.18, '#ffffff'); grd.addColorStop(1, '#f1ede4');
    g.fillStyle = grd; g.fillRect(0, y, 8, 16);
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}

function planks(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 4; i++) {
    const l = 210 + ((i * 37) % 30);
    g.fillStyle = `rgb(${l},${l - 6},${l - 14})`;
    g.fillRect(0, i * 16, 64, 15);
    g.fillStyle = 'rgba(0,0,0,.18)';
    g.fillRect(((i * 23) % 48) + 8, i * 16, 1, 15);
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** A box in house-local coords: u0..u1, v0..v1, y0..y1. */
function lbox(u0: number, u1: number, v0: number, v1: number, y0: number, y1: number, mat: Material | Material[]) {
  const m = new Mesh(new BoxGeometry(Math.max(0.01, u1 - u0), Math.max(0.01, y1 - y0), Math.max(0.01, v1 - v0)), mat);
  const c = toWorld((u0 + u1) / 2, (v0 + v1) / 2);
  m.position.set(c.x, (y0 + y1) / 2, c.z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

interface WallView { w: Wall; g: Group }

export class HouseView {
  readonly exterior = new Group();
  readonly interior = new Group();
  readonly ground = new Group();
  readonly upstairs = new Group();
  readonly roof = new Group();
  private porchRoof!: Mesh;
  private paneMat = new MeshBasicMaterial({ color: 0xcfe3ef });
  private walls: WallView[] = [];
  private frontDoor = new Group();
  private doorOpen = 0;
  private tvMat: MeshBasicMaterial;
  private tvTex: CanvasTexture;
  private tvCtx: CanvasRenderingContext2D;
  private tvT = 0;
  private tvLight = new PointLight(0x9fc4ff, 0, 7, 1.6);
  private lampLight = new PointLight(0xffc98a, 0, 9, 1.5);
  private kitchenLight = new PointLight(0xffe2b8, 0, 9, 1.5);
  private glowMats: MeshBasicMaterial[] = [];
  private porchGlow: SpriteMaterial;
  private night = 0;

  constructor(win: WindowBank) {
    const siding = clapboard();
    const extMat = new MeshLambertMaterial({ color: SIDING, map: siding });
    siding.repeat.set(1, 3.3 / 1.2);
    const trim = lambert(TRIM);
    const floorTex = planks(); // one tile = 0.8 m = four 20 cm boards (world-space UVs below)
    const floorMat = new MeshLambertMaterial({ color: WOOD, map: floorTex });

    this.interior.add(this.ground, this.upstairs);
    this.exterior.add(this.roof);

    // ── floors ──
    const floorBox = (m: Mesh) => { worldUV(m.geometry, 0.8); return m; };
    this.ground.add(floorBox(lbox(0, HOUSE.depth, -9, 9, 0, 0.04, floorMat)));
    const fy0 = UPSTAIRS_Y - 0.3, fy1 = UPSTAIRS_Y;
    // upstairs floor, with the stairwell cut out
    this.upstairs.add(
      floorBox(lbox(0, HOUSE.depth, -9, STAIRWELL.v0, fy0, fy1, [trim, trim, floorMat, trim, trim, trim])),
      floorBox(lbox(0, STAIRWELL.u0, STAIRWELL.v0, 9, fy0, fy1, [trim, trim, floorMat, trim, trim, trim])),
      floorBox(lbox(STAIRWELL.u1, HOUSE.depth, STAIRWELL.v0, 9, fy0, fy1, [trim, trim, floorMat, trim, trim, trim])),
    );

    // ── walls ──
    for (const w of WALLS) {
      const g = this.wall(w, 'in', lambert(PAINT[w.level]), trim, win);
      (w.level === 0 ? this.ground : this.upstairs).add(g);
      this.walls.push({ w, g });
      if (w.exterior) this.exterior.add(this.wall(w, 'out', extMat, trim, win)); // the closed shell outside
    }
    // closed bedrooms get a ceiling cap, so from above they read as rooms, not empty boxes
    const capY = UPSTAIRS_Y + WALL_H;
    const cap = lambert(0xd8d0c2);
    for (const [u0, u1, v0, v1] of [[16 / 3, 32 / 3, -9, 1.5], [32 / 3, 16, -9, 1.5], [10, 13, 4, 9], [13, 16, 4, 9], [0, 3.5, 4, 9]]) {
      this.upstairs.add(lbox(u0, u1, v0, v1, capY - 0.08, capY, cap));
    }

    this.stairs(floorMat, trim);
    this.porch(trim);
    this.frontPath();
    this.roofAndGable(extMat);
    this.furniture();
    this.doors();

    // lights (off by day)
    const at = (l: PointLight, u: number, v: number, y: number) => { const p = toWorld(u, v); l.position.set(p.x, y, p.z); this.ground.add(l); };
    at(this.tvLight, TV.u, TV.v + 1.2, 1.4);
    at(this.lampLight, 1.2, -7.6, 2.0);
    at(this.kitchenLight, 11.8, 0, 2.6);

    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const gg = cv.getContext('2d')!;
    const grd = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,220,160,1)'); grd.addColorStop(1, 'rgba(255,200,130,0)');
    gg.fillStyle = grd; gg.fillRect(0, 0, 64, 64);
    this.porchGlow = new SpriteMaterial({ map: new CanvasTexture(cv), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
    const glow = new Sprite(this.porchGlow);
    const gp = toWorld(-0.15, FRONT_DOOR.v1 + 0.6);
    glow.position.set(gp.x, 2.5, gp.z);
    glow.scale.setScalar(1.6);
    this.exterior.add(glow);

    // the TV: a little canvas that keeps changing
    const tc = document.createElement('canvas');
    tc.width = 64; tc.height = 36;
    this.tvCtx = tc.getContext('2d')!;
    this.tvTex = new CanvasTexture(tc);
    this.tvTex.colorSpace = SRGBColorSpace;
    this.tvMat = new MeshBasicMaterial({ map: this.tvTex, color: 0x333333 });
    const screen = lbox(TV.u - TV.w / 2, TV.u + TV.w / 2, TV.v + 0.07, TV.v + 0.09, TV.y - TV.h / 2, TV.y + TV.h / 2, this.tvMat);
    screen.castShadow = false;
    this.ground.add(lbox(TV.u - TV.w / 2 - 0.05, TV.u + TV.w / 2 + 0.05, TV.v - 0.02, TV.v + 0.07, TV.y - TV.h / 2 - 0.05, TV.y + TV.h / 2 + 0.05, lambert(0x111214)), screen);
  }

  /**
   * One wall: solid pieces, with windows (sill + head + glass) and doors/arches (head only).
   * 'out' builds the street-facing shell (siding, glowing glass, shutters); 'in' the painted room side.
   */
  private wall(w: Wall, side: 'in' | 'out', mats: Material, trim: Material, win: WindowBank): Group {
    const g = new Group();
    const y0 = w.level === 0 ? 0 : UPSTAIRS_Y;
    const H = w.level === 0 ? UPSTAIRS_Y : WALL_H;
    const t = HOUSE.wallT / 2;
    const piece = (a: number, b: number, ya: number, yb: number) =>
      g.add(w.axis === 'v' ? lbox(w.at - t, w.at + t, a, b, y0 + ya, y0 + yb, mats) : lbox(a, b, w.at - t, w.at + t, y0 + ya, y0 + yb, mats));
    const ops = [...w.openings].sort((p, q) => p.a - q.a);
    let at = w.a;
    for (const o of ops) {
      if (o.a > at) piece(at, o.a, 0, H);
      const head = o.kind === 'window' ? 2.25 : o.kind === 'door' ? 2.2 : 2.45;
      piece(o.a, o.b, head, H);
      if (o.kind === 'window') {
        piece(o.a, o.b, 0, 0.95);
        const mid = (o.a + o.b) / 2, wd = o.b - o.a - 0.12;
        const out = w.axis === 'v' ? (w.at === 0 ? -1 : 1) : (w.at < 0 ? -1 : 1); // which side is outdoors
        if (side === 'in' && w.exterior) {
          // from inside: a pane of daylight (or night) — you can't see the street from in here
          const p = w.axis === 'v' ? toWorld(w.at - out * (t + 0.01), mid) : toWorld(mid, w.at - out * (t + 0.01));
          const pane = new Mesh(new BoxGeometry(w.axis === 'v' ? 0.01 : wd, 1.25, w.axis === 'v' ? wd : 0.01), this.paneMat);
          pane.position.set(p.x, y0 + 1.6, p.z);
          g.add(pane);
        }
        if (side === 'out') {
          // glass (outward-facing, lit at night like every window on the row) + shutters
          const p = w.axis === 'v' ? toWorld(w.at + out * (t + 0.02), mid) : toWorld(mid, w.at + out * (t + 0.02));
          const facing = w.axis === 'v' ? (out < 0 ? '-x' : '+x') : (out < 0 ? '-z' : '+z');
          win.add('rect', p.x, y0 + 1.6, p.z, wd, 1.25, facing);
          if (w.axis === 'v' && w.at === 0) {
            for (const s of [o.a - 0.35, o.b + 0.35]) g.add(lbox(w.at - t - 0.06, w.at - t - 0.02, s - 0.22, s + 0.22, y0 + 0.95, y0 + 2.25, lambert(SHUTTER)));
          }
        }
        g.add(w.axis === 'v' ? lbox(w.at - t - 0.05, w.at + t + 0.05, o.a, o.b, y0 + 0.9, y0 + 0.97, trim) : lbox(o.a, o.b, w.at - t - 0.05, w.at + t + 0.05, y0 + 0.9, y0 + 0.97, trim));
      }
      at = Math.max(at, o.b);
    }
    if (at < w.b) piece(at, w.b, 0, H);
    return g;
  }

  private stairs(floorMat: Material, trim: Material) {
    const n = 14, run = (STAIRS.u1 - STAIRS.u0) / n;
    for (let i = 0; i < n; i++) {
      const top = ((i + 1) / n) * UPSTAIRS_Y;
      this.ground.add(lbox(STAIRS.u0 + i * run, STAIRS.u0 + (i + 1) * run, STAIRS.v0, STAIRS.v1, top - 0.24, top, [trim, trim, floorMat, trim, trim, trim]));
    }
    // railing round the stairwell upstairs
    const rail = lambert(0x3a2e24);
    this.upstairs.add(
      lbox(STAIRWELL.u0, STAIRWELL.u1, STAIRWELL.v0 - 0.04, STAIRWELL.v0 + 0.04, UPSTAIRS_Y, UPSTAIRS_Y + 0.95, rail),
      lbox(STAIRWELL.u0 - 0.04, STAIRWELL.u0 + 0.04, STAIRWELL.v0, 9, UPSTAIRS_Y, UPSTAIRS_Y + 0.95, rail),
    );
    for (let u = STAIRWELL.u0; u <= STAIRWELL.u1; u += 0.5) {
      this.upstairs.add(lbox(u - 0.02, u + 0.02, STAIRWELL.v0 - 0.02, STAIRWELL.v0 + 0.02, UPSTAIRS_Y, UPSTAIRS_Y + 0.95, trim));
    }
  }

  private porch(trim: Material) {
    const deck = lambert(0x8a8f8c);
    const ex = this.exterior;
    ex.add(lbox(PORCH.u0, 0, PORCH.v0, PORCH.v1, 0, 0.2, deck));
    for (let i = 0; i < 2; i++) ex.add(lbox(PORCH.u0 - 0.35 * (i + 1), PORCH.u0 - 0.35 * i, PORCH_STEPS.v0, PORCH_STEPS.v1, 0, 0.2 - 0.07 * (i + 1), deck));
    // columns + porch roof (the porch roof hides while you're on the porch, so it never covers you)
    for (const v of [-8.7, -4.3, 0, 8.7]) ex.add(lbox(PORCH.u0 + 0.05, PORCH.u0 + 0.3, v - 0.12, v + 0.12, 0.2, 2.95, trim));
    for (const v of [PORCH_STEPS.v0 - 0.12, PORCH_STEPS.v1 + 0.12]) ex.add(lbox(PORCH.u0 + 0.05, PORCH.u0 + 0.3, v - 0.12, v + 0.12, 0.2, 2.95, trim));
    this.porchRoof = lbox(PORCH.u0 - 0.3, 0, PORCH.v0 - 0.3, PORCH.v1 + 0.3, 2.95, 3.15, lambert(PAL.slate));
    ex.add(this.porchRoof);
    // railings (open at the steps)
    const railY = 0.95;
    const rails: [number, number, number, number][] = [
      [PORCH.u0, PORCH.u0 + 0.08, PORCH.v0, PORCH_STEPS.v0], [PORCH.u0, PORCH.u0 + 0.08, PORCH_STEPS.v1, PORCH.v1],
      [PORCH.u0, 0, PORCH.v0, PORCH.v0 + 0.08], [PORCH.u0, 0, PORCH.v1 - 0.08, PORCH.v1],
    ];
    for (const [u0, u1, v0, v1] of rails) {
      ex.add(lbox(u0, u1, v0, v1, railY - 0.06, railY, trim), lbox(u0, u1, v0, v1, 0.25, 0.3, trim));
      const along = v1 - v0 > u1 - u0;
      for (let s = 0; s <= 1.0001; s += along ? 0.12 / (v1 - v0) : 0.12 / (u1 - u0)) {
        const u = along ? (u0 + u1) / 2 : u0 + s * (u1 - u0), v = along ? v0 + s * (v1 - v0) : (v0 + v1) / 2;
        ex.add(lbox(u - 0.02, u + 0.02, v - 0.02, v + 0.02, 0.3, railY - 0.06, trim));
      }
    }
    // porch bench
    ex.add(lbox(-1.45, -0.95, -7.2, -4.8, 0.42, 0.5, lambert(0x5b6e62)), lbox(-1.45, -1.37, -7.2, -4.8, 0.5, 1.0, lambert(0x5b6e62)));
    // a sign by the door
    ex.add(lbox(-0.16, -0.12, FRONT_DOOR.v1 + 0.3, FRONT_DOOR.v1 + 0.9, 1.4, 1.75, lambert(0x2f4a3f)));
  }

  /** A walk from the far sidewalk up to the porch steps. */
  private frontPath() {
    const start = FAR_WALK.x1 - HOUSE.x0; // local u of the sidewalk's edge
    const p = lbox(start, PORCH.u0 - 0.6, PORCH_STEPS.v0 + 0.3, PORCH_STEPS.v1 - 0.3, 0, 0.035, lambert(PAL.path));
    p.castShadow = false;
    this.exterior.add(p);
    // a driveway each side of the house: concrete, with a dropped apron across the sidewalk
    const concrete = lambert(0xbab4a7), apron = lambert(0xa9a397);
    for (const d of DRIVEWAYS) {
      const slab = lbox(d.u0, d.u1, d.v0, d.v1, 0, 0.045, concrete);
      const lip = lbox(FAR_WALK.x0 - HOUSE.x0, d.u0, d.v0 - 0.4, d.v1 + 0.4, 0, 0.04, apron);
      slab.castShadow = lip.castShadow = false;
      this.exterior.add(slab, lip);
      // expansion joints
      for (let u = d.u0 + 3; u < d.u1 - 0.5; u += 3) {
        const j = lbox(u - 0.03, u + 0.03, d.v0, d.v1, 0.045, 0.05, lambert(0x8f897d));
        j.castShadow = false;
        this.exterior.add(j);
      }
    }
  }

  private roofAndGable(ext: Material) {
    const D = HOUSE.depth, Wd = HOUSE.width, base = UPSTAIRS_Y + WALL_H, h = 4.6;
    const c = toWorld(D / 2, 0);
    // gable ends face the street (and the back): siding triangle the length of the house…
    const gable = new Mesh(prism(Wd, h, D), ext);
    gable.rotation.y = Math.PI / 2;
    gable.position.set(c.x, base, c.z);
    gable.castShadow = true;
    // …covered by two slate slabs
    const slope = Math.atan2(h, Wd / 2), slabW = Math.hypot(Wd / 2, h) + 0.5;
    for (const side of [-1, 1]) {
      const s = new Mesh(new BoxGeometry(D + 1.0, 0.25, slabW), lambert(PAL.slate));
      s.position.set(c.x, base + h / 2 + 0.1, c.z + (side * Wd) / 4);
      s.rotation.x = side * slope;
      s.castShadow = true;
      this.roof.add(s);
    }
    this.roof.add(gable);
    // chimney
    const ch = toWorld(11, 5.5);
    const chim = new Mesh(new BoxGeometry(1.0, 3.2, 1.0), lambert(0x8a4a3a));
    chim.position.set(ch.x, base + h - 0.6, ch.z);
    chim.castShadow = true;
    this.roof.add(chim);
  }

  private furniture() {
    const byKind = (k: string) => FURNITURE.find((f) => f.kind === k)!;
    const add = (lvl: Level, m: Object3D) => (lvl === 0 ? this.ground : this.upstairs).add(m);
    const y0 = (f: Furniture) => (f.level === 1 ? UPSTAIRS_Y : 0.04);
    const solid = (f: Furniture, color: number, h = f.h, inset = 0) => add(f.level, lbox(f.u0 + inset, f.u1 - inset, f.v0 + inset, f.v1 - inset, y0(f), y0(f) + h, lambert(color)));

    // living room
    const sofaC = 0x4a5f78, cushion = 0x5a7190;
    for (const k of ['sofa', 'sofa-end']) {
      const f = byKind(k);
      solid(f, sofaC, 0.45);
      add(0, lbox(f.u0 + 0.08, f.u1 - 0.08, f.v0 + 0.08, f.v1 - 0.08, 0.45, 0.6, lambert(cushion)));
    }
    const sofa = byKind('sofa');
    add(0, lbox(sofa.u0, sofa.u1, sofa.v1 - 0.28, sofa.v1, 0.45, 0.95, lambert(sofaC))); // back
    const end = byKind('sofa-end');
    add(0, lbox(end.u0, end.u0 + 0.28, end.v0, end.v1, 0.45, 0.95, lambert(sofaC)));
    for (const [u, c] of [[2.4, 0xe8b33a], [5.2, 0xc8302a]] as const) add(0, lbox(u, u + 0.45, -2.95, -2.8, 0.6, 0.95, lambert(c))); // throw pillows
    const ct = byKind('coffee-table');
    add(0, lbox(ct.u0, ct.u1, ct.v0, ct.v1, 0.36, 0.42, lambert(0x6b4a2f)));
    for (const [u, v] of [[ct.u0 + 0.1, ct.v0 + 0.1], [ct.u1 - 0.1, ct.v0 + 0.1], [ct.u0 + 0.1, ct.v1 - 0.1], [ct.u1 - 0.1, ct.v1 - 0.1]]) add(0, lbox(u - 0.04, u + 0.04, v - 0.04, v + 0.04, 0.04, 0.36, lambert(0x3a2a1c)));
    add(0, lbox(3.7, 3.95, -5.75, -5.45, 0.42, 0.55, lambert(0xd84a3a))); // a can
    add(0, lbox(4.4, 4.9, -5.8, -5.4, 0.42, 0.46, lambert(0x1e1e22))); // controller
    solid(byKind('tv-stand'), 0x3a2e24);
    solid(byKind('armchair'), 0x9a6b4a, 0.85, 0);
    add(0, lbox(1.4, 6.9, -7.6, -3.95, 0.04, 0.05, lambert(0xa0503f))); // rug
    // floor lamp in the corner
    add(0, lbox(1.15, 1.25, -7.65, -7.55, 0.04, 1.75, lambert(0x2a2622)));
    const shade = new MeshBasicMaterial({ color: 0xd9c9a8 });
    this.glowMats.push(shade);
    add(0, lbox(0.95, 1.45, -7.85, -7.35, 1.75, 2.1, shade));

    // lived-in: bookshelf, plants, coat rack, shoes, mats, art, a hall runner
    const shelf = byKind('bookshelf');
    solid(shelf, 0x5a3a22);
    const spines = [0xc8302a, 0x2b3a66, 0xe8b33a, 0x3d6b4f, 0xf1ead9, 0x9a5fa0, 0x1e1e22];
    for (let row = 0; row < 4; row++) {
      let v = shelf.v0 + 0.08;
      for (let i = 0; v < shelf.v1 - 0.1; i++) {
        const w = 0.06 + ((row * 7 + i * 3) % 5) * 0.015, h = 0.26 + ((row + i) % 3) * 0.04;
        add(0, lbox(shelf.u1 - 0.02, shelf.u1 + 0.02, v, v + w, 0.12 + row * 0.45, 0.12 + row * 0.45 + h, lambert(spines[(row * 3 + i) % spines.length])));
        v += w + 0.012;
      }
    }
    for (const f of FURNITURE.filter((x) => x.kind === 'plant')) {
      const cu = (f.u0 + f.u1) / 2, cv = (f.v0 + f.v1) / 2;
      add(0, lbox(cu - 0.2, cu + 0.2, cv - 0.2, cv + 0.2, 0.04, 0.42, lambert(0xb5603a))); // pot
      const leaves = new Mesh(new SphereGeometry(0.42, 6, 4), lambert(0x4a8a3a));
      const lp = toWorld(cu, cv);
      leaves.position.set(lp.x, 0.95, lp.z);
      leaves.scale.set(1, 1.3, 1);
      leaves.castShadow = true;
      this.ground.add(leaves);
    }
    add(0, lbox(0.36, 0.44, 2.11, 2.19, 0.04, 1.8, lambert(0x3a2a1c)));
    add(0, lbox(0.25, 0.55, 2.0, 2.3, 1.15, 1.6, lambert(0x2b3a66))); // a jacket
    add(0, lbox(0.3, 0.5, 2.05, 2.25, 1.3, 1.62, lambert(0xc8302a))); // a Wes-red hoodie
    for (const [v, c] of [[5.0, 0xf1ead9], [5.35, 0x1e1e22], [5.7, 0xc8302a], [6.05, 0x3a5a8a]] as const) {
      add(0, lbox(0.35, 0.7, v, v + 0.12, 0.04, 0.14, lambert(c))); // shoes by the door
    }
    add(0, lbox(0.25, 1.15, FRONT_DOOR.v0 + 0.05, FRONT_DOOR.v1 - 0.05, 0.04, 0.055, lambert(0x6b5a3a))); // doormat
    add(0, lbox(1.3, 7.2, 3.6, 4.8, 0.04, 0.05, lambert(0x8a3a2e))); // hall runner
    // art: a big print over the sofa, a couple of frames in the hall
    add(0, lbox(2.6, 5.8, 1.38, 1.42, 1.35, 2.25, lambert(0x2a3a52)));
    add(0, lbox(2.8, 5.6, 1.36, 1.38, 1.5, 2.1, lambert(0xe8b33a)));
    add(0, lbox(5.6, 6.5, 1.58, 1.62, 1.5, 2.1, lambert(0x3d6b4f)));
    add(0, lbox(6.7, 7.4, 1.58, 1.62, 1.6, 2.0, lambert(0xc8302a)));
    // a stairs handrail along the outside wall
    const run = STAIRS.u1 - STAIRS.u0;
    const rail = new Mesh(new BoxGeometry(Math.hypot(run, UPSTAIRS_Y), 0.06, 0.06), lambert(0x3a2e24));
    const rm = toWorld((STAIRS.u0 + STAIRS.u1) / 2, 8.82);
    rail.position.set(rm.x, 0.9 + UPSTAIRS_Y / 2, rm.z);
    rail.rotation.z = Math.atan2(UPSTAIRS_Y, run);
    this.ground.add(rail);
    // console under the TV
    add(0, lbox(3.6, 4.1, -8.85, -8.55, 0.55, 0.62, lambert(0xe9eaea)));

    // kitchen
    const cab = 0x5e7a6a, top = 0xe8e4da;
    const counter = byKind('counter');
    solid(counter, cab, 0.88);
    add(0, lbox(counter.u0 - 0.05, counter.u1, counter.v0, counter.v1, 0.88, 0.95, lambert(top)));
    add(0, lbox(15.85, 15.9, counter.v0, counter.v1, 1.4, 2.2, lambert(cab))); // upper cabinets (thin, against the wall)
    solid(byKind('fridge'), 0xe9eaea);
    add(0, lbox(15.86, 15.9, counter.v0, counter.v1, 0.95, 1.4, lambert(0xd9e4e2))); // backsplash
    for (let i = 0; i < 3; i++) add(0, lbox(15.3, 15.8, 0.4, 0.9, 0.95 + i * 0.05, 0.99 + i * 0.05, lambert(i === 1 ? 0xf1ead9 : 0xe0b88a))); // pizza boxes
    add(0, lbox(15.4, 15.75, -6.5, -6.1, 0.95, 1.25, lambert(0x2a2f33))); // kettle
    const isl = byKind('island');
    solid(isl, 0x3e4a52, 0.88);
    add(0, lbox(isl.u0 - 0.1, isl.u1 + 0.1, isl.v0 - 0.1, isl.v1 + 0.1, 0.88, 0.95, lambert(top)));
    for (const [u, v, c] of [[11.4, -4.6, 0xe0a030], [12.1, -3.4, 0xc8302a], [11.6, -3.0, 0xf1ead9]] as const) add(0, lbox(u - 0.1, u + 0.1, v - 0.1, v + 0.1, 0.95, 1.15, lambert(c)));
    const dt = byKind('dining-table');
    add(0, lbox(dt.u0, dt.u1, dt.v0, dt.v1, 0.7, 0.76, lambert(0x8a5a36)));
    for (const [u, v] of [[dt.u0 + 0.1, dt.v0 + 0.1], [dt.u1 - 0.1, dt.v0 + 0.1], [dt.u0 + 0.1, dt.v1 - 0.1], [dt.u1 - 0.1, dt.v1 - 0.1]]) add(0, lbox(u - 0.04, u + 0.04, v - 0.04, v + 0.04, 0.04, 0.7, lambert(0x5a3a22)));
    for (const [u, v] of [[11.2, 3.6], [12.4, 3.6], [11.2, 5.8], [12.4, 5.8]]) {
      add(0, lbox(u - 0.22, u + 0.22, v - 0.22, v + 0.22, 0.42, 0.47, lambert(0x6b4a2f)));
      const back = v < 4.7 ? v - 0.22 : v + 0.18;
      add(0, lbox(u - 0.22, u + 0.22, back, back + 0.04, 0.47, 0.95, lambert(0x6b4a2f)));
    }
    const pendant = new MeshBasicMaterial({ color: 0xd9c9a8 });
    this.glowMats.push(pendant);
    add(0, lbox(11.6, 12.0, 4.5, 4.9, 2.4, 2.6, pendant));

    // your room
    const bed = byKind('bed'), Y = UPSTAIRS_Y;
    add(1, lbox(bed.u0, bed.u1, bed.v0, bed.v1, Y, Y + 0.35, lambert(0x6b4a2f)));
    add(1, lbox(bed.u0 + 0.05, bed.u1 - 0.05, bed.v0 + 0.05, bed.v1 - 0.05, Y + 0.35, Y + 0.55, lambert(0xf1ead9)));
    add(1, lbox(bed.u0 + 0.05, bed.u1 - 0.05, bed.v0 + 0.6, bed.v1 - 0.02, Y + 0.55, Y + 0.6, lambert(0xc8302a))); // duvet
    add(1, lbox(bed.u0 + 0.3, bed.u1 - 0.3, bed.v0 + 0.08, bed.v0 + 0.45, Y + 0.55, Y + 0.68, lambert(0xffffff))); // pillow
    add(1, lbox(bed.u0, bed.u1, bed.v0 - 0.02, bed.v0 + 0.06, Y, Y + 1.05, lambert(0x5a3a22))); // headboard
    const desk = byKind('desk');
    add(1, lbox(desk.u0, desk.u1, desk.v0, desk.v1, Y + 0.7, Y + 0.76, lambert(0xd8c9a8)));
    for (const v of [desk.v0 + 0.05, desk.v1 - 0.05]) add(1, lbox(desk.u0 + 0.05, desk.u1 - 0.05, v - 0.03, v + 0.03, Y, Y + 0.7, lambert(0x3a3a3e)));
    const screenMat = new MeshBasicMaterial({ color: 0x9fd0ff });
    this.glowMats.push(screenMat);
    add(1, lbox(0.25, 0.3, -4.0, -3.4, Y + 0.76, Y + 1.12, screenMat)); // laptop screen
    add(1, lbox(0.3, 0.7, -4.0, -3.4, Y + 0.76, Y + 0.79, lambert(0x8a8f94)));
    add(1, lbox(1.0, 1.4, -3.9, -3.5, Y + 0.45, Y + 0.5, lambert(0x1e1e22))); // chair
    add(1, lbox(1.35, 1.4, -3.9, -3.5, Y + 0.5, Y + 1.0, lambert(0x1e1e22)));
    const cl = byKind('closet');
    solid(cl, 0xe8e2d4);
    add(1, lbox(cl.u0 - 0.02, cl.u0, cl.v0 + 0.1, (cl.v0 + cl.v1) / 2 - 0.02, Y + 0.1, Y + 2.0, lambert(0xd8d0c2)));
    add(1, lbox(cl.u0 - 0.02, cl.u0, (cl.v0 + cl.v1) / 2 + 0.02, cl.v1 - 0.1, Y + 0.1, Y + 2.0, lambert(0xd8d0c2)));
    add(1, lbox(0.9, 3.9, -6.2, -2.2, Y + 0.01, Y + 0.02, lambert(0x2b3a66))); // rug
    // a cardinal pennant and a poster
    add(1, lbox(1.2, 3.2, -8.88, -8.86, Y + 1.9, Y + 2.35, lambert(0xc8302a)));
    add(1, lbox(5.2, 5.22, -6.0, -4.6, Y + 1.2, Y + 2.2, lambert(0x2a3a52)));
    // string lights along the top of the walls
    const bulbs = new MeshBasicMaterial({ color: 0xffe2a8 });
    this.glowMats.push(bulbs);
    const bulb = new SphereGeometry(0.05, 6, 4);
    for (let v = -8.6; v < 1.2; v += 0.45) {
      const p = toWorld(0.2, v);
      const m = new Mesh(bulb, bulbs);
      m.position.set(p.x, Y + 2.7 - Math.abs(Math.sin(v * 2)) * 0.12, p.z);
      this.upstairs.add(m);
    }
  }

  private doors() {
    // the front door: hinged at v0, swings in as people come near
    const leaf = new Mesh(new BoxGeometry(0.06, 2.15, FRONT_DOOR.v1 - FRONT_DOOR.v0), lambert(0x6b1f1a));
    leaf.position.set(0, 1.08, (FRONT_DOOR.v1 - FRONT_DOOR.v0) / 2);
    leaf.castShadow = true;
    const knob = new Mesh(new SphereGeometry(0.05, 6, 4), lambert(0xc9b27a));
    knob.position.set(-0.06, 1.0, FRONT_DOOR.v1 - FRONT_DOOR.v0 - 0.15);
    this.frontDoor.add(leaf, knob);
    const hinge = toWorld(0, FRONT_DOOR.v0);
    this.frontDoor.position.set(hinge.x, 0.04, hinge.z);
    this.exterior.add(this.frontDoor);
    // from inside, the doorway shows a closed door (walk into it to go out)
    this.ground.add(lbox(0.06, 0.12, FRONT_DOOR.v0, FRONT_DOOR.v1, 0.04, 2.2, lambert(0x6b1f1a)));
    // bedroom doors upstairs: closed for everyone else, yours stands open
    for (const [room, [u, v]] of Object.entries(ROOM_DOORS)) {
      if (room === 'R1') continue;
      const along = v === 1.5 || v === 4; // all on corridor walls (axis u)
      if (!along) continue;
      this.upstairs.add(lbox(u - 0.5, u + 0.5, v - 0.04, v + 0.04, UPSTAIRS_Y, UPSTAIRS_Y + 2.15, lambert(0x8a6a4a)));
    }
  }

  /** People near the front door (you, roommates) — it opens for them. */
  update(dt: number, camera: { x: number; z: number }, you: { x: number; z: number; level: Level; inside: boolean }, nearDoor: boolean) {
    // door (outside)
    this.doorOpen += ((nearDoor ? 1 : 0) - this.doorOpen) * Math.min(1, dt * 6);
    this.frontDoor.rotation.y = -this.doorOpen * 1.6;
    const lu = you.x - HOUSE.x0, lv = you.z - HOUSE.zc;
    // the porch roof hides whenever it could get between the camera and you
    const overPorch = (u: number, v: number) => u > PORCH.u0 - 1.5 && u < 0.6 && v > PORCH.v0 - 1 && v < PORCH.v1 + 1;
    this.porchRoof.visible = !overPorch(lu, lv) && !overPorch(camera.x - HOUSE.x0, camera.z - HOUSE.zc);

    // cut-away (inside)
    const indoors = you.inside;
    this.upstairs.visible = !(indoors && you.level === 0);
    const cu = camera.x - HOUSE.x0, cv = camera.z - HOUSE.zc;
    const pu = you.x - HOUSE.x0, pv = you.z - HOUSE.zc;
    for (const { w, g } of this.walls) {
      let hide = false;
      if (indoors && w.level <= you.level) {
        const [c1, c2, p1, p2] = w.axis === 'v' ? [cu, cv, pu, pv] : [cv, cu, pv, pu];
        if ((c1 - w.at) * (p1 - w.at) < 0) {
          const t = (w.at - c1) / (p1 - c1);
          const cross = c2 + t * (p2 - c2);
          hide = cross > w.a - 1 && cross < w.b + 1;
        }
        // upstairs, the ground floor walls under you are irrelevant; keep them
        if (w.level < you.level) hide = false;
      }
      g.visible = !hide;
    }

    // TV + lamps
    this.tvT += dt;
    if (this.tvT > 0.35) {
      this.tvT = 0;
      const g = this.tvCtx;
      const hue = Math.floor(Math.random() * 360);
      g.fillStyle = `hsl(${hue},45%,${30 + Math.random() * 25}%)`;
      g.fillRect(0, 0, 64, 36);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = `hsl(${(hue + 40 + i * 70) % 360},60%,${45 + Math.random() * 30}%)`;
        g.fillRect(Math.random() * 50, Math.random() * 26, 8 + Math.random() * 20, 6 + Math.random() * 12);
      }
      this.tvTex.needsUpdate = true;
      this.tvLight.color.setHSL(hue / 360, 0.35, 0.7);
    }
    const flicker = 0.85 + Math.random() * 0.3;
    this.tvLight.intensity = (1.5 + this.night * 5) * flicker;
  }

  setNight(night: number) {
    this.night = night;
    const on = Math.min(1, Math.max(0, (night - 0.15) / 0.5));
    this.lampLight.intensity = on * 7;
    this.paneMat.color.set(0xd6e8f2).lerp(new Color(0x141c33), Math.min(1, night * 1.2));
    this.kitchenLight.intensity = on * 6;
    this.porchGlow.opacity = on * 0.9;
    this.tvMat.color.set(0x333333).lerp(new Color(0xffffff), 0.6 + on * 0.4);
    for (const m of this.glowMats) m.color.set(0x8a8478).lerp(new Color(0xfff0cc), on);
  }
}

