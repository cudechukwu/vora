import {
  CanvasTexture, CircleGeometry, Color, CylinderGeometry, DoubleSide, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial,
  MeshPhongMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace, Shape, ShapeGeometry, SphereGeometry, TorusGeometry,
} from 'three';
import { BoxBank, lambert } from '../kit';
import { USDAN, XZ, inPoly } from '../layout';
import {
  ATRIUM_H, DOORS, Finish, ITEMS, Item, STOREY_H, WALLS, Wall, chairsAt, half,
} from './plan';

// ─── Drawing the inside of Usdan ───────────────────────────────────────
// Everything static goes into one instanced box bank (one draw call); walls
// are separate meshes so the ones between the camera and you can be hidden.

const FINISH: Record<Finish, number> = { wood: 0xc08a4c, cream: 0xf0eadc, sage: 0xa9b39b, yellow: 0xe9d68e };
const RED = 0xb4432c, ORANGE = 0xc9592e, WOODTONE = 0xb98446, BLACK = 0x1f2226, WHITE_TOP = 0xf1ede5;

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Polished terrazzo: cream, speckled black/grey/brown, with brass divider lines every few metres. */
function terrazzo() {
  const t = canvasTex(512, 512, (g) => {
    g.fillStyle = '#efe8dc'; g.fillRect(0, 0, 512, 512);
    const cols = ['#2a2724', '#5d5750', '#8a7f72', '#3d332b', '#a99a88'];
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = cols[i % cols.length];
      const s = 1 + (i % 7 === 0 ? 2 : 0) + (i % 3 === 0 ? 1 : 0);
      g.fillRect(Math.random() * 512, Math.random() * 512, s, s * (0.6 + Math.random() * 0.8));
    }
    g.strokeStyle = 'rgba(150,130,100,.45)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 1); g.lineTo(512, 1); g.moveTo(1, 0); g.lineTo(1, 512); g.stroke();
  });
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(1 / 4, 1 / 4); // one tile per 4m
  return t;
}

/** Flex Dining's carpet: soft stripes of rust, sand and sage. */
function carpet() {
  const t = canvasTex(256, 256, (g) => {
    g.fillStyle = '#8c7a66'; g.fillRect(0, 0, 256, 256);
    const cols = ['#a25a4a', '#c7b08a', '#7d8a6a', '#6e5a4c', '#b98a6a'];
    for (let y = 0; y < 256; y += 8) for (let x = 0; x < 256; x += 32) {
      g.fillStyle = cols[Math.floor(Math.random() * cols.length)];
      g.globalAlpha = 0.5 + Math.random() * 0.4;
      g.fillRect(x + Math.random() * 8, y, 18 + Math.random() * 20, 3 + Math.random() * 3);
    }
    g.globalAlpha = 1;
  });
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(1 / 3, 1 / 3);
  return t;
}

function textTex(w: number, h: number, bg: string, lines: { text: string; color: string; font: string; y: number; align?: CanvasTextAlign; x?: number }[]) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (const l of lines) {
      g.fillStyle = l.color; g.font = l.font; g.textAlign = l.align ?? 'center';
      g.fillText(l.text, l.x ?? w / 2, l.y);
    }
  });
}

/** A flat picture (sign, screen, poster) facing `heading` (0 = +z). */
function panel(parent: Group, w: number, h: number, mat: MeshBasicMaterial | MeshLambertMaterial, x: number, y: number, z: number, heading: number) {
  const m = new Mesh(new PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  m.rotation.y = heading;
  parent.add(m);
  return m;
}

interface Piece { mesh: Group; a: XZ; b: XZ }

export class UsdanView {
  readonly group = new Group();
  private bank = new BoxBank();
  private pieces: Piece[] = [];
  private windowMat = new MeshBasicMaterial({ color: 0xdfe8e4 });
  private screens: { ctx: CanvasRenderingContext2D; tex: CanvasTexture }[] = [];

  constructor() {
    this.floors();
    this.outerWalls();
    for (const w of WALLS) this.wall(w);
    for (const it of ITEMS) this.item(it);
    this.lobby();
    this.corridor();
    this.atrium();
    this.flexDining();
    this.cafe();
    this.group.add(this.bank.build());
  }

  // ── floors ──
  private floors() {
    const shape = new Shape(USDAN.map((p) => ({ x: p.x, y: -p.z }) as never));
    const geo = new ShapeGeometry(shape).rotateX(-Math.PI / 2);
    // ShapeGeometry's UVs are its (x, y) in metres, which the texture repeat turns into 4m tiles
    const floor = new Mesh(geo, new MeshPhongMaterial({ map: terrazzo(), shininess: 90, specular: 0x3a3a3a }));
    floor.receiveShadow = true;
    this.group.add(floor);
    const flex = new Shape([[-100, 190.5], [-72.5, 190.5], [-72.5, 176.75], [-80, 176], [-100, 181]].map(([x, y]) => ({ x, y }) as never));
    const c = new Mesh(new ShapeGeometry(flex).rotateX(-Math.PI / 2), new MeshLambertMaterial({ map: carpet() }));
    c.position.y = 0.01;
    this.group.add(c);
    // ceilings: one storey up everywhere, with the atrium's opening going up to its own high ceiling
    const atrium = [[-92, 214], [-70, 214], [-70, 190.5], [-92, 190.5]];
    const low = new Shape(USDAN.map((p) => ({ x: p.x, y: -p.z }) as never));
    low.holes.push(new Shape(atrium.map(([x, y]) => ({ x, y }) as never)));
    const ceil = new MeshBasicMaterial({ color: 0xe4ddcf, side: DoubleSide }); // evenly lit, like a real ceiling under downlights
    const lowCeil = new Mesh(new ShapeGeometry(low).rotateX(-Math.PI / 2), ceil);
    lowCeil.position.y = STOREY_H;
    const high = new Mesh(new ShapeGeometry(new Shape(atrium.map(([x, y]) => ({ x, y }) as never))).rotateX(-Math.PI / 2), ceil);
    high.position.y = ATRIUM_H;
    this.group.add(lowCeil, high);
    // recessed downlights in the low ceiling
    const dl = new MeshBasicMaterial({ color: 0xfffbea });
    for (let x = -100; x < -60; x += 3.5) for (let z = -236; z < -176; z += 3.5) {
      const p = { x, z };
      if (x > -92 && x < -70 && z > -214 && z < -190.5) continue;
      if (!inPoly(p, USDAN)) continue;
      const d = new Mesh(new CircleGeometry(0.13, 10).rotateX(Math.PI / 2), dl);
      d.position.set(x, STOREY_H - 0.01, z);
      this.group.add(d);
    }
  }

  /** A wall from a to b (any angle), `h` high, `t` thick, coloured per side; registered for the cut-away. */
  private segment(a: XZ, b: XZ, h: number, colors: [number, number], y0 = 0, register = true) {
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.05) return;
    const g = new Group();
    const ang = Math.atan2(b.z - a.z, b.x - a.x);
    for (const [side, color] of [[-1, colors[0]], [1, colors[1]]] as const) {
      const m = new Mesh(new PlaneGeometry(len, h), lambert(color));
      m.position.set(0, h / 2, side * 0.1);
      m.rotation.y = side > 0 ? 0 : Math.PI;
      g.add(m);
    }
    const top = new Mesh(new PlaneGeometry(len, 0.2).rotateX(-Math.PI / 2), lambert(0xd8d0c0));
    top.position.y = h;
    g.add(top);
    g.position.set((a.x + b.x) / 2, y0, (a.z + b.z) / 2);
    g.rotation.y = -ang;
    this.group.add(g);
    if (register) this.pieces.push({ mesh: g, a, b });
  }

  /** The outside walls, just inside Usdan's outline, with glass where the doors and Flex Dining's windows are. */
  private outerWalls() {
    const n = USDAN.length;
    for (let i = 0; i < n; i++) {
      const a = USDAN[i], b = USDAN[(i + 1) % n];
      const len = Math.hypot(b.x - a.x, b.z - a.z), ux = (b.x - a.x) / len, uz = (b.z - a.z) / len;
      // cut doors out of this edge
      const cuts: [number, number][] = [];
      for (const d of DOORS) {
        const t = (d.x - a.x) * ux + (d.z - a.z) * uz, off = Math.abs((d.x - a.x) * uz - (d.z - a.z) * ux);
        if (off < 0.2 && t > 0 && t < len) cuts.push([t - d.w / 2, t + d.w / 2]);
      }
      cuts.sort((p, q) => p[0] - q[0]);
      let s = 0;
      const at = (t: number) => ({ x: a.x + ux * t, z: a.z + uz * t });
      const runs: [number, number][] = [];
      for (const [c0, c1] of cuts) { runs.push([s, c0]); s = c1; }
      runs.push([s, len]);
      for (const [t0, t1] of runs) {
        // pick a finish by where along the building this run is
        const mid = at((t0 + t1) / 2);
        const inner = mid.x > -72.5 && mid.z > -192 ? FINISH.wood : mid.x > -70 ? FINISH.sage : mid.z > -190.5 ? FINISH.yellow : FINISH.cream;
        this.segment(at(t0), at(t1), STOREY_H, [0x8a5040, inner]);
        // Flex Dining's tall windows onto the field
        if (mid.z > -190.5 && mid.x < -72.5) {
          for (let t = t0 + 1.6; t < t1 - 1.2; t += 3.2) {
            const p = at(t);
            const win = new Mesh(new PlaneGeometry(2.2, 3.2), this.windowMat);
            win.position.set(p.x - uz * 0.13, 1.9, p.z + ux * 0.13);
            win.rotation.y = -Math.atan2(uz, ux); // facing in
            this.group.add(win);
            this.bank.add(p.x - uz * 0.16, 1.9, p.z + ux * 0.16, 0.12, 3.3, 0.12, WOODTONE, -Math.atan2(uz, ux)); // mullion
          }
        }
      }
    }
    // the doors themselves: glass in a dark frame, black mats either side
    for (const d of DOORS) {
      const face = Math.atan2(d.nx, d.nz);
      for (const s of [-0.75, 0.75]) {
        const px = d.x - d.nz * s - d.nx * 0.05, pz = d.z + d.nx * s - d.nz * 0.05;
        const g = new Mesh(new PlaneGeometry(1.4, 2.3), this.windowMat);
        g.position.set(px, 1.15, pz);
        g.rotation.y = face + Math.PI;
        this.group.add(g);
      }
      this.bank.add(d.x - d.nx * 1.4, 0.012, d.z - d.nz * 1.4, d.w, 0.02, 1.8, 0x1a1c1e, face); // mat
      const exit = new MeshBasicMaterial({ color: 0x35d07a });
      panel(this.group, 0.5, 0.18, exit, d.x - d.nx * 0.2, 2.75, d.z - d.nz * 0.2, face + Math.PI); // EXIT sign
    }
  }

  /** An internal wall: a piece per gap, each side its finish; tall atrium walls get wood-lined balcony boxes. */
  private wall(w: Wall) {
    let at = w.a;
    const pieces: [number, number][] = [];
    for (const [o0, o1] of [...w.openings].sort((p, q) => p[0] - q[0])) { if (o0 > at) pieces.push([at, o0]); at = o1; }
    if (at < w.b) pieces.push([at, w.b]);
    const P = (s: number): XZ => (w.axis === 'x' ? { x: s, z: w.at } : { x: w.at, z: s });
    // a segment's first colour faces right of a→b: for walls along x that's north (−z), along z it's east (+x)
    for (const [a, b] of pieces) this.segment(P(a), P(b), w.h, w.axis === 'x' ? [FINISH[w.finish[0]], FINISH[w.finish[1]]] : [FINISH[w.finish[1]], FINISH[w.finish[0]]]);
    // over the openings, the wall carries on above head height
    for (const [o0, o1] of w.openings) {
      this.segment(P(o0), P(o1), w.h - 3.2, w.axis === 'x' ? [FINISH[w.finish[0]], FINISH[w.finish[1]]] : [FINISH[w.finish[1]], FINISH[w.finish[0]]], 3.2);
    }
    if (w.h > STOREY_H + 1) { // balcony openings up high, wood-lined, some with plants
      for (let s = w.a + 2.2; s < w.b - 2; s += 5.5) {
        const p = P(s), along = w.axis === 'x';
        const sx = along ? 2.6 : 0.5, sz = along ? 0.5 : 2.6;
        this.bank.add(p.x, 6.1, p.z, sx, 1.9, sz, 0x6a5a48); // the dark opening
        this.bank.add(p.x, 5.2, p.z, along ? 2.8 : 0.6, 0.35, along ? 0.6 : 2.8, WOODTONE); // its wood sill
        if (Math.round(s) % 2 === 0) this.bank.add(p.x, 5.6, p.z, along ? 1.6 : 0.7, 0.5, along ? 0.7 : 1.6, 0x4e7a35); // plants
      }
    }
  }

  // ── furniture ──
  private chair(x: number, z: number, heading: number, seat: number, frame: number) {
    const bx = x - Math.sin(heading) * 0.22, bz = z - Math.cos(heading) * 0.22;
    this.bank.add(x, 0.46, z, 0.46, 0.06, 0.46, seat, heading);
    this.bank.add(bx, 0.74, bz, 0.46, 0.5, 0.05, seat, heading);
    this.bank.add(x, 0.23, z, 0.42, 0.46, 0.03, frame, heading);
  }

  private item(it: Item) {
    const b = this.bank, [hx, hz] = half(it);
    switch (it.kind) {
      case 'column': case 'redColumn': {
        const h = it.kind === 'redColumn' ? STOREY_H : STOREY_H;
        const c = new Mesh(new CylinderGeometry(0.42, 0.42, h, 18), lambert(it.kind === 'redColumn' ? RED : ORANGE));
        c.position.set(it.x, h / 2, it.z);
        this.group.add(c);
        b.add(it.x + 0.43, 1.6, it.z, 0.02, 0.6, 0.42, 0xf4f2ec); // a notice taped to it
        break;
      }
      case 'infoDesk':
        b.add(it.x, 0.55, it.z, hx * 2, 1.1, hz * 2, WOODTONE);
        b.add(it.x - 0.05, 1.12, it.z, hx * 2 + 0.1, 0.06, hz * 2 + 0.1, WHITE_TOP);
        b.add(it.x + 0.3, 2.0, it.z, 0.06, 1.6, hz * 2, 0xd9c79a); // the booth's back wall
        break;
      case 'deskSide': b.add(it.x, 0.9, it.z, hx * 2, 1.8, hz * 2, WOODTONE); break;
      case 'sofa': {
        const faceN = it.z > -193.2; // the two sofas face each other across the column
        b.add(it.x, 0.24, it.z, 2.0, 0.42, 0.9, BLACK);
        b.add(it.x, 0.62, it.z + (faceN ? 0.36 : -0.36), 2.0, 0.42, 0.18, BLACK); // back
        for (const e of [-0.92, 0.92]) b.add(it.x + e, 0.5, it.z, 0.18, 0.12, 0.9, WOODTONE); // wooden arm tops
        b.add(it.x, 0.015, (it.z + -193.2) / 2, 4.6, 0.02, 3.4, 0x6e4a32); // rug
        break;
      }
      case 'armchair':
        b.add(it.x, 0.24, it.z, 0.9, 0.42, 0.9, BLACK);
        b.add(it.x + 0.36, 0.62, it.z, 0.18, 0.42, 0.9, BLACK);
        break;
      case 'woodChair': this.chair(it.x, it.z, it.heading ?? 0, 0x2b2b2b, WOODTONE); break;
      case 'roundTable': {
        const top = new Mesh(new CylinderGeometry(0.5, 0.5, 0.05, 20), lambert(WHITE_TOP));
        top.position.set(it.x, 0.76, it.z);
        const edge = new Mesh(new CylinderGeometry(0.52, 0.52, 0.04, 20), lambert(WOODTONE));
        edge.position.set(it.x, 0.73, it.z);
        this.group.add(top, edge);
        b.add(it.x, 0.38, it.z, 0.08, 0.72, 0.08, BLACK);
        b.add(it.x, 0.03, it.z, 0.6, 0.06, 0.6, BLACK);
        for (const c of chairsAt(it)) this.chair(c.x, c.z, c.heading, BLACK, 0xb6babd);
        break;
      }
      case 'squareTable':
        b.add(it.x, 0.75, it.z, 0.92, 0.04, 0.92, WOODTONE);
        b.add(it.x, 0.77, it.z, 0.86, 0.02, 0.86, WHITE_TOP);
        b.add(it.x, 0.38, it.z, 0.08, 0.72, 0.08, BLACK);
        b.add(it.x, 0.03, it.z, 0.6, 0.06, 0.6, BLACK);
        b.add(it.x + 0.2, 0.84, it.z - 0.1, 0.05, 0.1, 0.05, 0xd0d4d6); // a pepper shaker
        for (const c of chairsAt(it)) this.chair(c.x, c.z, c.heading, BLACK, 0xb6babd);
        break;
      case 'case': this.displayCase(it); break;
      case 'bins':
        for (const d of [-0.6, 0, 0.6]) {
          b.add(it.x, 0.5, it.z + d, 0.62, 1.0, 0.55, 0x2456a8);
          b.add(it.x + 0.31, 0.85, it.z + d, 0.02, 0.18, 0.3, 0xf2f2f2); // label
        }
        break;
      case 'counter':
        b.add(it.x, 0.52, it.z, hx * 2, 1.04, hz * 2, 0xf3f1ea);
        b.add(it.x, 1.06, it.z, hx * 2 + 0.1, 0.05, hz * 2 + 0.1, WOODTONE);
        b.add(it.x - 1.6, 1.3, it.z - 0.15, 0.5, 0.45, 0.45, 0x2c2f33); // coffee machine
        b.add(it.x + 1.4, 1.2, it.z + 0.1, 0.4, 0.25, 0.3, 0x1f1f1f); // till
        break;
      case 'coolers':
        for (const d of [-2, 0, 2]) {
          b.add(it.x + d, 1.05, it.z, 1.0, 2.1, 0.8, 0xe9e9e6);
          for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) {
            const col = [0xc8302a, 0x2fa66a, 0xe8b33a, 0x2b6fbf, 0xf1f1ee, 0x8a3b9a][(k + r + d) % 6 < 0 ? 0 : (k + r + d + 6) % 6];
            b.add(it.x + d - 0.38 + k * 0.15, 0.55 + r * 0.42, it.z + 0.41, 0.09, 0.28, 0.04, col);
          }
        }
        break;
      case 'chips':
        for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
          b.add(it.x - 0.36 + k * 0.24, 0.3 + r * 0.32, it.z, 0.2, 0.26, 0.3, [0x2b6fbf, 0xe8b33a, 0xc8302a, 0x3d8a4a][(r + k) % 4]);
        }
        b.add(it.x, 0.7, it.z - 0.18, 1.0, 1.4, 0.05, 0x8a8f94);
        break;
      case 'stairs': this.stairs(it); break;
      case 'longTable':
        b.add(it.x, 0.74, it.z, hx * 2, 0.04, hz * 2, 0xf2f0ea);
        for (const e of [-hx + 0.3, hx - 0.3]) { b.add(it.x + e, 0.37, it.z, 0.05, 0.72, 0.05, 0xd0d4d6); b.add(it.x + e, 0.03, it.z, 0.05, 0.05, 0.7, 0xd0d4d6); }
        break;
      case 'banner': {
        const t = textTex(128, 300, '#f7f7f5', [{ text: ' iPad Pro', color: '#222', font: 'bold 22px sans-serif', y: 40 }]);
        const m = panel(this.group, 0.85, 2.0, new MeshBasicMaterial({ map: t }), it.x, 1.05, it.z, Math.PI / 2);
        void m;
        b.add(it.x - 0.05, 0.15, it.z, 0.25, 0.08, 0.9, 0x9a9ea2);
        b.add(it.x + 0.02, 1.1, it.z, 0.02, 0.5, 0.42, 0x1d1f22); // the camera bump on the poster
        break;
      }
      case 'plant':
        b.add(it.x, 0.3, it.z, 0.5, 0.6, 0.5, 0x8a6a4a);
        for (let k = 0; k < 5; k++) b.add(it.x + Math.sin(k * 2.4) * 0.25, 0.9 + (k % 3) * 0.25, it.z + Math.cos(k * 2.4) * 0.25, 0.45, 0.4, 0.45, 0x4e7a35, k);
        break;
    }
  }

  /** The Navaratri display case: wood frame, glass front, a red banner, instruments, a yellow drape. */
  private displayCase(it: Item) {
    const b = this.bank, front = it.x - 0.45;
    b.add(it.x, 0.18, it.z, 0.9, 0.36, 4.8, WOODTONE); // base
    b.add(it.x, 2.6, it.z, 0.9, 0.2, 4.8, WOODTONE); // top
    b.add(it.x + 0.4, 1.4, it.z, 0.06, 2.2, 4.8, 0xdcd8cf); // back
    const banner = textTex(512, 128, '#c8241f', [
      { text: 'Wesleyan\'s Navaratri Festival', color: '#fff', font: 'bold 34px sans-serif', y: 52 },
      { text: 'Celebrating 50 years', color: '#fff', font: 'italic bold 32px sans-serif', y: 98 },
    ]);
    panel(this.group, 2.2, 0.55, new MeshBasicMaterial({ map: banner }), it.x + 0.36, 2.1, it.z - 0.9, -Math.PI / 2);
    for (let k = 0; k < 8; k++) b.add(it.x + 0.36, 1.45 + (k % 2) * 0.32, it.z - 1.7 + k * 0.32, 0.01, 0.26, 0.2, [0xe8b33a, 0xf1ead9, 0xd9822b][k % 3]); // flyers
    // a sitar and a veena (long neck + round gourd), a red drum, tabla
    for (const [dz, r] of [[-2.0, 0.22], [0.9, 0.2], [1.9, 0.17]] as const) {
      b.add(it.x + 0.1, 1.15, it.z + dz, 0.07, 1.5, 0.07, 0x6b3a22);
      const g = new Mesh(new SphereGeometry(r, 12, 8), lambert(0x7a4428));
      g.position.set(it.x + 0.1, 0.55, it.z + dz);
      this.group.add(g);
    }
    const drum = new Mesh(new CylinderGeometry(0.2, 0.2, 0.55, 14).rotateZ(Math.PI / 2), lambert(0xc0242a));
    drum.rotation.y = Math.PI / 2;
    drum.position.set(it.x + 0.1, 1.0, it.z - 0.4);
    this.group.add(drum);
    b.add(it.x + 0.1, 0.62, it.z - 0.4, 0.45, 0.5, 0.45, 0x1d4a34); // its green-draped stand
    b.add(it.x + 0.1, 0.48, it.z - 1.2, 0.3, 0.24, 0.3, 0x6b4a2f); b.add(it.x + 0.1, 0.48, it.z - 0.9, 0.28, 0.24, 0.28, 0x8a5a2f); // tabla
    b.add(it.x + 0.2, 1.3, it.z + 1.2, 0.08, 1.4, 1.1, 0xe8c22a, 0.3); // the yellow drape
    // the glass front
    const glass = new Mesh(new PlaneGeometry(4.8, 2.2), new MeshBasicMaterial({ color: 0xcfe0e6, transparent: true, opacity: 0.18, depthWrite: false }));
    glass.position.set(front, 1.47, it.z);
    glass.rotation.y = -Math.PI / 2;
    this.group.add(glass);
  }

  /** The curved staircase: steps climbing west along the north wall behind a sweeping red wall, a lit wood rail. */
  private stairs(it: Item) {
    const [hx, hz] = half(it), x0 = it.x + hx, x1 = it.x - hx, n = 16;
    for (let i = 0; i < n; i++) {
      const x = x0 - (i + 0.5) * ((x0 - x1) / n), top = ((i + 1) / n) * STOREY_H;
      this.bank.add(x, top / 2, it.z - 0.15, (x0 - x1) / n + 0.02, top, hz * 2 - 0.4, i % 2 ? 0xe5ddd0 : 0xdad1c2);
    }
    // the red wall: rises with the stairs, along their open side
    const s = new Shape();
    s.moveTo(x0, 0); s.lineTo(x0, 1.0); s.lineTo(x1, STOREY_H + 1.0); s.lineTo(x1, 0); s.lineTo(x0, 0);
    const red = new Mesh(new ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: false }), lambert(RED));
    red.position.z = it.z + hz - 0.25;
    red.material.side = DoubleSide;
    this.group.add(red);
    // the wood rail on top of it, with little lights set in under it
    const len = Math.hypot(x0 - x1, STOREY_H), ang = Math.atan2(STOREY_H, x1 - x0);
    const rail = new Mesh(new PlaneGeometry(len, 0.3).rotateX(-Math.PI / 2), lambert(WOODTONE));
    rail.position.set((x0 + x1) / 2, 1.0 + STOREY_H / 2 + 0.05, it.z + hz - 0.12);
    rail.rotation.z = ang;
    this.group.add(rail);
    const dot = new MeshBasicMaterial({ color: 0xfff1c8 });
    for (let i = 1; i < 8; i++) {
      const t = i / 8, d = new Mesh(new SphereGeometry(0.06, 6, 4), dot);
      d.position.set(x0 + (x1 - x0) * t, 0.8 + STOREY_H * t, it.z + hz + 0.02);
      this.group.add(d);
    }
  }

  // ── rooms ──
  private lobby() {
    // the INFORMATION sign over the booth, and two screens on it
    const info = textTex(512, 80, '#e9e1cf', [{ text: 'INFORMATION', color: '#2a2724', font: 'bold 46px sans-serif', y: 58 }]);
    panel(this.group, 3.2, 0.5, new MeshBasicMaterial({ map: info }), -64.05, 3.0, -185.5, -Math.PI / 2);
    for (const dz of [-1.3, 1.3]) panel(this.group, 0.7, 0.42, this.screen('#c8241f', 'OPEN'), -63.95, 2.1, -185.5 + dz, -Math.PI / 2);
    // TV niche in the wood wall, chairs on a rug
    this.bank.add(-72.36, 1.55, -184.45, 0.08, 1.5, 2.0, 0x8a5a2e);
    panel(this.group, 1.3, 0.75, this.screen('#1d2a44', 'EVENTS'), -72.3, 1.75, -184.45, Math.PI / 2);
    this.bank.add(-72.3, 1.0, -184.45, 0.3, 0.05, 1.8, WOODTONE); // shelf
    this.bank.add(-71.2, 0.012, -184.45, 2.3, 0.02, 3.0, 0x7a5a48); // rug
    this.bank.add(-60.9, 0.3, -183.1, 0.02, 0.6, 0.02, 0x1d1f22); // (sign post of the "study materials" board)
    // a sanitizer on the wall, signs
    this.bank.add(-60.75, 1.4, -189.6, 0.12, 0.28, 0.2, 0xf2f2f2);
    const restrooms = textTex(512, 160, '#d7c89c', [
      { text: '→ Restrooms', color: '#2a2724', font: 'bold 38px sans-serif', y: 50, align: 'left', x: 30 },
      { text: '↑ Meeting Rooms', color: '#2a2724', font: 'bold 38px sans-serif', y: 98, align: 'left', x: 30 },
      { text: '← Flex Dining', color: '#2a2724', font: 'bold 38px sans-serif', y: 146, align: 'left', x: 30 },
    ]);
    this.hangingSign(panel(this.group, 2.0, 0.62, new MeshBasicMaterial({ map: restrooms, side: DoubleSide }), -66, 3.3, -189.8, 0), 2.0);
  }

  private corridor() {
    const signs = textTex(512, 160, '#d7c89c', [
      { text: '← OSI - Room 102', color: '#2a2724', font: 'bold 38px sans-serif', y: 50, align: 'left', x: 30 },
      { text: '← Meeting Room 104d', color: '#2a2724', font: 'bold 38px sans-serif', y: 98, align: 'left', x: 30 },
      { text: '↑ Meeting Rooms 108-114', color: '#2a2724', font: 'bold 38px sans-serif', y: 146, align: 'left', x: 30 },
    ]);
    this.hangingSign(panel(this.group, 2.2, 0.68, new MeshBasicMaterial({ map: signs, side: DoubleSide }), -65.5, 3.3, -201, 0), 2.2);
    // the elevator, on the corridor side of the café wall
    const steel = new MeshPhongMaterial({ color: 0xc0c4c8, shininess: 120, specular: 0x888888 });
    const doors = new Mesh(new PlaneGeometry(1.5, 2.3), steel);
    doors.position.set(-69.88, 1.15, -219.5);
    doors.rotation.y = Math.PI / 2;
    this.group.add(doors);
    this.bank.add(-69.86, 1.15, -219.5, 0.04, 2.45, 1.7, 0x9a9ea2); // frame
    this.bank.add(-69.85, 1.15, -219.5, 0.03, 2.3, 0.02, 0x6a6e72); // the split between the doors
    this.bank.add(-69.86, 1.25, -218.35, 0.03, 0.5, 0.18, 0xb8bcc0); // call buttons
    this.bank.add(-69.86, 2.6, -219.5, 0.03, 0.14, 0.35, 0x2a1a1a);
    panel(this.group, 0.08, 0.08, new MeshBasicMaterial({ color: 0xff3a2a }), -69.83, 2.6, -219.5, Math.PI / 2);
    // doors to the offices along the sage wall, a brochure rack, a screen
    for (const z of [-224.5, -217.5]) this.bank.add(-61.45, 1.2, z, 0.08, 2.4, 1.2, WOODTONE);
    this.bank.add(-61.4, 1.1, -221, 0.12, 0.9, 0.7, 0x9a6a3a);
    panel(this.group, 0.9, 0.55, this.screen('#e8d83a', 'OSI'), -61.42, 1.9, -221, -Math.PI / 2);
  }

  private atrium() {
    // globe pendants hanging high over the tables
    const glow = new MeshBasicMaterial({ color: 0xfff6e2 });
    const ring = new MeshBasicMaterial({ color: 0xe8dcc4 });
    for (const x of [-88, -82, -76]) for (const z of [-208, -202, -196]) {
      const y = 6.6 + ((x + z) % 3 === 0 ? 0.6 : 0);
      const g = new Mesh(new SphereGeometry(0.34, 14, 10), glow);
      g.position.set(x, y, z);
      this.group.add(g);
      for (const dy of [-0.15, 0, 0.15]) {
        const r = new Mesh(new TorusGeometry(0.33 - Math.abs(dy) * 0.6, 0.025, 6, 18).rotateX(Math.PI / 2), ring);
        r.position.set(x, y + dy, z);
        this.group.add(r);
      }
      this.bank.add(x, (y + ATRIUM_H) / 2, z, 0.02, ATRIUM_H - y, 0.02, 0x8a8a8a); // the cord
    }
    // the big W on the wall over the stairs
    const w = canvasTex(256, 256, (g) => {
      g.clearRect(0, 0, 256, 256);
      g.font = 'bold 230px Georgia, serif'; g.textAlign = 'center';
      g.lineWidth = 10; g.strokeStyle = '#b8241f'; g.strokeText('W', 128, 210);
      g.fillStyle = '#1d2240'; g.fillText('W', 128, 210);
      g.fillStyle = '#c8241f'; g.beginPath(); g.moveTo(150, 70); g.lineTo(196, 96); g.lineTo(150, 112); g.closePath(); g.fill(); // the cardinal's head
    });
    panel(this.group, 2.4, 2.4, new MeshBasicMaterial({ map: w, transparent: true }), -84, 6.6, -213.85, 0);
    // a screen over the café door: pumpkin carving night
    const pumpkin = canvasTex(256, 160, (g) => {
      g.fillStyle = '#1b1210'; g.fillRect(0, 0, 256, 160);
      g.fillStyle = '#ff8a1c'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center';
      g.fillText('PUMPKIN', 128, 40); g.fillText('CARVING', 128, 70);
      for (const [x, r] of [[80, 26], [128, 32], [180, 24]] as const) { g.beginPath(); g.arc(x, 120, r, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#1b1210'; for (const x of [70, 90, 118, 138, 170, 190]) g.fillRect(x - 4, 112, 8, 6);
    });
    panel(this.group, 1.8, 1.1, new MeshBasicMaterial({ map: pumpkin }), -75, 5.0, -215.36, 0);
  }

  private flexDining() {
    // wall sconces and framed pictures on the yellow wall
    for (let x = -98; x < -74; x += 4) {
      this.bank.add(x, 2.5, -190.36, 0.45, 0.16, 0.16, 0xfaf3e0);
      this.bank.add(x + 2, 1.7, -190.38, 0.6, 0.8, 0.04, 0x1d1f22);
      this.bank.add(x + 2, 1.7, -190.35, 0.5, 0.68, 0.02, [0x8a5a3a, 0x3a5a7a, 0x7a3a3a][Math.abs(x) % 3]);
    }
  }

  private cafe() {
    const menu = canvasTex(512, 160, (g) => {
      g.fillStyle = '#1a1c1e'; g.fillRect(0, 0, 512, 160);
      g.fillStyle = '#f2c14e'; g.font = 'bold 40px sans-serif'; g.fillText('CAFÉ', 24, 54);
      g.fillStyle = '#f6f1e6'; g.font = '24px sans-serif';
      ['coffee · espresso · tea', 'bagels · wraps · bowls', 'smoothies · snacks'].forEach((t, i) => g.fillText(t, 24, 92 + i * 26));
    });
    panel(this.group, 2.4, 0.75, new MeshBasicMaterial({ map: menu }), -76.5, 2.7, -223.75, 0);
  }

  /** A sign hanging across the hall (along x): hides like a wall when it'd be between the camera and you. */
  private hangingSign(m: Mesh, w: number) {
    const g = new Group();
    this.group.add(g);
    g.add(m);
    const { x, z } = m.position;
    this.pieces.push({ mesh: g, a: { x: x - w / 2 - 0.5, z }, b: { x: x + w / 2 + 0.5, z } });
  }

  /** A little screen with a heading (flickers slowly between a few colours). */
  private screen(bg: string, text: string) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 72;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 128, 72);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(text, 64, 44);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    this.screens.push({ ctx, tex });
    return new MeshBasicMaterial({ map: tex });
  }

  /** Daylight through the windows and glass doors: pale by day, deep blue at night. */
  setDaylight(sky: Color, night: number) {
    this.windowMat.color.copy(sky).lerp(new Color(0xf2f4ee), 0.55 * (1 - night)).multiplyScalar(1 - night * 0.6);
  }

  /** Hide the walls between the camera and you (both in the floor plan, x/z). */
  update(camera: XZ, you: XZ) {
    for (const p of this.pieces) p.mesh.visible = !crosses(camera, you, p.a, p.b);
  }
}

/** Do segments p1→p2 and q1→q2 cross (in x/z)? Slightly generous so a wall right beside you also hides. */
export function crosses(p1: XZ, p2: XZ, q1: XZ, q2: XZ): boolean {
  const d = (a: XZ, b: XZ, c: XZ) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  const d1 = d(q1, q2, p1), d2 = d(q1, q2, p2), d3 = d(p1, p2, q1), d4 = d(p1, p2, q2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
