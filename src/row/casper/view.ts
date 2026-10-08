import {
  BoxGeometry, CanvasTexture, Color, CylinderGeometry, DoubleSide, Group, IcosahedronGeometry, Material, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, MeshPhongMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace, SphereGeometry, Texture, Vector3,
} from 'three';
import type { XZ } from '../collide';
import { BoxBank, worldUV } from '../kit';
import { rng } from '../noise';
import { SCI_DOOR, SCI_NDOOR } from '../southend';
import { crosses } from '../usdan/view';
import { BRIDGE, CWALLS, FH, FLIGHTS, FURNITURE, Flight, IN_L0, IN_UP, LANDING_T, ROOMS, VOID } from './plan';

// ─── Inside Casper: draws what plan.ts lays out ────────────────────────
// From the user's photos and the architects' renders. Ground floor: grey plank-tile floor, warm wood-veneer walls with a
// cove light along their tops, a dark linear-slat ceiling with downlights. Upper floors: pale oak, the same veneer, pale
// slat ceilings. The atrium: dark slab edges, glass balustrades with wood handrails, the grand stairs (charcoal treads,
// glass sides, wood rails), angled grey soffits under a wood-slat ceiling and a skylight. Glass-walled classrooms and labs.

const CEIL = 3.45; // ceiling height above each floor
const SLAB = FH - CEIL; // the slab and plenum between a ceiling and the floor above

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = true): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
/** Long narrow grey plank tiles in a staggered bond (the ground floor). One tile = 2.4 m. */
const plankTile = () => canvas(256, 256, (g) => {
  g.fillStyle = '#3c3d3f'; g.fillRect(0, 0, 256, 256);
  let id = 1200;
  for (let r = 0; r < 16; r++) {
    let x = -Math.round(rng(id++) * 90);
    while (x < 256) {
      const w = 70 + Math.round(rng(id++) * 50), v = 0.82 + rng(id++) * 0.22;
      g.fillStyle = `rgb(${Math.round(104 * v)},${Math.round(106 * v)},${Math.round(110 * v)})`;
      g.fillRect(x + 1, r * 16 + 1, w - 2, 14);
      x += w;
    }
  }
});
/** Pale white-oak planks (the upper floors). One tile = 3 m. */
const oak = () => canvas(256, 256, (g) => {
  g.fillStyle = '#b9a88e'; g.fillRect(0, 0, 256, 256);
  let id = 1500;
  for (let r = 0; r < 10; r++) {
    let x = -Math.round(rng(id++) * 120);
    while (x < 256) {
      const w = 110 + Math.round(rng(id++) * 90), v = 0.9 + rng(id++) * 0.12;
      g.fillStyle = `rgb(${Math.round(222 * v)},${Math.round(208 * v)},${Math.round(184 * v)})`;
      g.fillRect(x + 1, r * 25.6 + 1, w - 2, 23.6);
      g.fillStyle = 'rgba(150,120,90,0.12)';
      for (let k = 0; k < 4; k++) g.fillRect(x + 4, r * 25.6 + 4 + k * 5 + rng(id++) * 3, w - 8, 1);
      x += w;
    }
  }
});
/** Warm wood veneer panels, vertical seams every 1.2 m, a faint grain. One tile = 2.4 m. */
const veneer = () => canvas(256, 256, (g) => {
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#c99f6c'); grad.addColorStop(1, '#a87c4e');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(90,55,25,${0.05 + rng(1800 + i) * 0.08})`; g.fillRect(rng(1900 + i) * 256, 0, 1 + rng(2000 + i) * 2, 256); }
  g.fillStyle = 'rgba(60,35,15,0.6)'; g.fillRect(0, 0, 2, 256); g.fillRect(128, 0, 2, 256);
});
/** A linear slat ceiling: parallel slats with dark gaps. One tile = 1 m. */
const slats = (base: string, gap: string) => canvas(64, 64, (g) => {
  g.fillStyle = gap; g.fillRect(0, 0, 64, 64);
  g.fillStyle = base;
  for (let y = 0; y < 64; y += 8) g.fillRect(0, y + 1, 64, 5);
});
/** The topographic rug: pale ground, contour lines. */
const topo = (line: string, ground: string) => canvas(512, 512, (g) => {
  g.fillStyle = ground; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = line; g.lineWidth = 3;
  for (let k = 0; k < 26; k++) {
    g.beginPath();
    for (let x = -10; x <= 520; x += 8) {
      const y = k * 22 + Math.sin(x / 47 + k * 0.7) * 14 + Math.sin(x / 19 + k) * 5;
      if (x < 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
}, false);
/** Carpet: a mottled texture in a given colour. One tile = 2 m. */
const carpet = (r: number, gg: number, b: number) => canvas(128, 128, (g) => {
  g.fillStyle = `rgb(${r},${gg},${b})`; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    const v = rng(3100 + i + r) * 40 - 20;
    g.fillStyle = `rgba(${r + v},${gg + v},${b + v},0.6)`;
    g.fillRect(rng(3400 + i) * 128, rng(3700 + i) * 128, 2 + rng(4000 + i) * 6, 1 + rng(4300 + i) * 3);
  }
});
/** A sign: text on a plain ground. */
function sign(text: string, fg: string, bg: string | null, w = 256, h = 64, font = '600 34px sans-serif'): CanvasTexture {
  return canvas(w, h, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } else g.clearRect(0, 0, w, h);
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  }, false);
}

type Seg = { level: number; a: XZ; b: XZ; mesh: Mesh };

export class CasperView {
  readonly group = new Group();
  private boxes = new BoxBank(); // ordinary lit boxes
  private glow = new BoxBank(); // lights: cove strips, downlights, screens, exit signs, windows
  private pieces: Seg[] = [];
  private windowMat = new MeshBasicMaterial({ color: 0xdfe8ee });
  private mats: Record<string, Material> = {};

  constructor() {
    const T = {
      plank: plankTile(), oak: oak(), veneer: veneer(), slatDark: slats('#77706a', '#3d3934'), slatPale: slats('#e9e6e0', '#b7b2a9'),
      slatWood: slats('#b8875a', '#5a3f26'), green: carpet(70, 120, 60), grey: carpet(150, 150, 152),
    };
    const lam = (map: Texture | null, color = 0xffffff) => new MeshLambertMaterial({ map, color });
    this.mats = {
      plank: lam(T.plank), oak: lam(T.oak), veneer: lam(T.veneer), slatDark: lam(T.slatDark), slatPale: lam(T.slatPale), slatWood: lam(T.slatWood),
      green: lam(T.green), grey: lam(T.grey), edge: lam(null, 0x2b2c2e), wood: lam(null, 0xc29a6a), duct: new MeshPhongMaterial({ color: 0xc9ced2, shininess: 60, specular: 0x666666 }), white: lam(null, 0xf1efea), soffit: lam(null, 0x7d8186),
      glass: new MeshPhongMaterial({ color: 0xcfe0e6, specular: 0xffffff, shininess: 80, transparent: true, opacity: 0.16, depthWrite: false, side: DoubleSide }),
      rail: new MeshPhongMaterial({ color: 0xd8e6ea, transparent: true, opacity: 0.22, depthWrite: false, side: DoubleSide }),
    };
    this.floors();
    this.shell();
    this.walls();
    this.atrium();
    for (const f of FLIGHTS) this.flight(f);
    this.bridge();
    this.rooms();
    this.furniture();
    this.corridor();
    this.cafe();
    const b = this.boxes.build();
    b.castShadow = false;
    this.group.add(b, this.glow.build(new MeshBasicMaterial({ color: 0xffffff })));
  }

  setDaylight(sky: Color, night: number) {
    this.windowMat.color.copy(sky).lerp(new Color(0xf2f6f8), 0.5 * (1 - night)).multiplyScalar(1 - night * 0.65);
  }

  /** Hide the walls (on your floor) between the camera and you. */
  update(camera: XZ, you: XZ, level: number) {
    for (const p of this.pieces) p.mesh.visible = !(p.level === level && crosses(camera, you, p.a, p.b));
  }

  // ── helpers ──
  private box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: Material | Material[], tile = 2) {
    const geo = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const m = new Mesh(worldUV(geo, tile), mat);
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }
  /** A wall you can see through or not, on a floor, that hides when it's between the camera and you. */
  private wall(level: number, x0: number, x1: number, z0: number, z1: number, mat: Material, y0 = level * FH, y1 = level * FH + CEIL, tile = 2.4) {
    const m = this.box(x0, x1, y0, y1, z0, z1, mat, tile);
    const alongX = x1 - x0 > z1 - z0;
    this.pieces.push({ level, a: alongX ? { x: x0, z: (z0 + z1) / 2 } : { x: (x0 + x1) / 2, z: z0 }, b: alongX ? { x: x1, z: (z0 + z1) / 2 } : { x: (x0 + x1) / 2, z: z1 }, mesh: m });
    return m;
  }
  private plane(x: number, y: number, z: number, w: number, h: number, ry: number, mat: Material) {
    const m = new Mesh(new PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    this.group.add(m);
    return m;
  }
  private rug(x: number, y: number, z: number, w: number, d: number, tex: Texture, rot = 0) {
    const m = new Mesh(new PlaneGeometry(w, d), new MeshLambertMaterial({ map: tex }));
    m.rotation.set(-Math.PI / 2, 0, rot);
    m.position.set(x, y + 0.015, z);
    this.group.add(m);
  }
  /** A cove light along the top of a wall (a warm strip), and a downlight grid under a ceiling. */
  private cove(x0: number, x1: number, z0: number, z1: number, y: number) {
    this.glow.add((x0 + x1) / 2, y - 0.06, (z0 + z1) / 2, Math.max(0.05, x1 - x0), 0.05, Math.max(0.05, z1 - z0), 0xffe7c2);
  }
  private downlights(x0: number, x1: number, z0: number, z1: number, y: number, step = 2.4) {
    for (let x = x0 + step / 2; x < x1; x += step) for (let z = z0 + step / 2; z < z1; z += step) this.glow.add(x, y - 0.02, z, 0.16, 0.02, 0.16, 0xfff6e2);
  }

  // ── the floors, ceilings and slab edges ──
  private floors() {
    const I0 = IN_L0, I = IN_UP, V = VOID, M = this.mats;
    // the ground floor, its ceiling (the dark slats) except over the atrium
    this.box(I0.x0 - 0.5, I0.x1 + 0.5, -0.2, 0, I0.z0 - 0.5, I0.z1 + 0.5, [M.edge, M.edge, M.plank, M.edge, M.edge, M.edge], 2.4);
    // each upper floor: a slab whose top is the floor (oak), whose underside is the ceiling below (slats), whose edge is dark
    for (let level = 1; level < 4; level++) {
      const y = level * FH, under = level === 1 ? M.slatDark : M.slatPale, top = M.oak;
      const mat = [M.edge, M.edge, top, under, M.edge, M.edge];
      const plates = this.platesFor(level);
      for (const p of plates) this.box(p.x0, p.x1, y - SLAB, y, p.z0, p.z1, mat, level === 1 ? 1 : 3);
      for (const p of plates) this.downlights(p.x0, p.x1, p.z0, p.z1, y - SLAB, 2.6);
    }
    // the top floor's ceiling, and the roof over the atrium: wood slats, a skylight down the middle
    this.box(I.x0, I.x1, 4 * FH - SLAB, 4 * FH - SLAB + 0.1, I.z0, I.z1, [M.edge, M.edge, M.edge, M.slatPale, M.edge, M.edge], 1);
    this.box(V.x0, V.x1, 4 * FH - SLAB - 0.15, 4 * FH - SLAB - 0.05, V.z0, V.z1, [M.edge, M.edge, M.edge, M.slatWood, M.edge, M.edge], 0.6);
    this.glow.add((V.x0 + V.x1) / 2, 4 * FH - SLAB - 0.17, (V.z0 + V.z1) / 2, 10, 0.02, 2.2, 0xeef4f7); // the skylight
  }
  /** The upper floors' plates (as drawn: the stairs' own footprints left open). */
  private platesFor(level: number) {
    const I = IN_UP, V = VOID, A = FLIGHTS[0], B = FLIGHTS[1], C = FLIGHTS[2];
    const ring = [
      { x0: I.x0 - 0.45, x1: I.x1 + 0.45, z0: I.z0 - 0.45, z1: V.z0 }, { x0: I.x0 - 0.45, x1: V.x0, z0: V.z0, z1: V.z1 },
      { x0: V.x1, x1: I.x1 + 0.45, z0: V.z0, z1: V.z1 }, { x0: I.x0 - 0.45, x1: I.x1 + 0.45, z0: V.z1, z1: I.z1 + 0.45 },
    ];
    if (level === 2) return [...ring, { x0: V.x0, x1: B.x0, z0: B.z0 - 0.4, z1: V.z1 }, { x0: V.x0, x1: C.x0, z0: V.z0, z1: C.z1 + 0.4 }];
    return [...ring, { x0: (level === 1 ? A : C).x1, x1: V.x1, z0: V.z0, z1: A.z1 + 0.4 }];
  }

  // ── the outer walls, from inside: veneer below, windows where the facade has them, the big glass at the west ──
  private shell() {
    const M = this.mats;
    for (let level = 0; level < 4; level++) {
      const I = level === 0 ? IN_L0 : IN_UP, y0 = level * FH, y1 = y0 + CEIL;
      const vmat = level === 0 ? M.veneer : M.white;
      // north and south walls, the east wall
      this.wall(level, I.x0, I.x1, I.z0 - 0.15, I.z0, vmat, y0, y1);
      this.wall(level, I.x0, I.x1, I.z1, I.z1 + 0.15, vmat, y0, y1);
      this.wall(level, I.x1, I.x1 + 0.15, I.z0, I.z1, vmat, y0, y1);
      // windows in them, matching the facade: slots in the middle, big ones by the glass and on the east end
      if (level > 0) {
        for (let x = -12; x < 8; x += 1.25) for (const z of [I.z0 + 0.01, I.z1 - 0.01]) this.plane(x, y0 + 1.9, z, 0.55, 2.6, z < 160 ? 0 : Math.PI, this.windowMat);
        for (const z of [I.z0 + 0.01, I.z1 - 0.01]) this.plane(-9.8, y0 + 1.9, z, 2.2, 2.8, z < 160 ? 0 : Math.PI, this.windowMat);
        for (const z of [155, 169]) this.plane(I.x1 - 0.01, y0 + 1.9, z, 2.2, 2.8, -Math.PI / 2, this.windowMat);
        this.glow.add(8, y0 + 1.8, I.z0 + 0.02, 0.9, CEIL - 0.4, 0.02, 0xd8e4ea); // the full-height glass strip
      }
      if (level === 0) for (const x of [-9, -3.5, 2, 8, 13]) this.plane(x, 1.9, I.z1 - 0.01, 0.6, 3.2, Math.PI, this.windowMat);
      // the west: glass, floor to ceiling, mullions; the ground floor's lobby doors in it
      const wx = I.x0 - 0.02;
      this.plane(wx, y0 + CEIL / 2, (I.z0 + I.z1) / 2, I.z1 - I.z0, CEIL, Math.PI / 2, this.windowMat);
      for (let z = I.z0; z <= I.z1 + 0.01; z += (I.z1 - I.z0) / 14) this.boxes.add(wx + 0.05, y0 + CEIL / 2, z, 0.08, CEIL, 0.08, 0x2a2c2e);
      this.boxes.add(wx + 0.05, y0 + 0.05, (I.z0 + I.z1) / 2, 0.1, 0.1, I.z1 - I.z0, 0x2a2c2e);
    }
    // the lobby doors (west) and the north doors, from inside: dark frames, glass, a transom
    for (const o of [-1.2, 0, 1.2]) this.boxes.add(SCI_DOOR.x + 0.45, 1.3, SCI_DOOR.z + o, 0.08, 2.6, 0.08, 0x2a2c2e);
    this.boxes.add(SCI_DOOR.x + 0.45, 2.62, SCI_DOOR.z, 0.08, 0.1, 2.5, 0x2a2c2e);
  }

  // ── the interior walls: veneer with a cove light; glass fronts (mullions, a white door with a tall pane); dark; white ──
  private walls() {
    const M = this.mats;
    for (const w of CWALLS) {
      const y0 = w.level * FH, y1 = y0 + CEIL, alongX = w.x1 - w.x0 > w.z1 - w.z0;
      if (w.finish === 'glass') {
        const len = alongX ? w.x1 - w.x0 : w.z1 - w.z0, mx = (w.x0 + w.x1) / 2, mz = (w.z0 + w.z1) / 2;
        const g = this.plane(mx, y0 + CEIL / 2, mz, len, CEIL, alongX ? 0 : Math.PI / 2, M.glass);
        g.renderOrder = 2;
        const n = Math.max(1, Math.round(len / 1.6));
        for (let i = 0; i <= n; i++) {
          const u = (alongX ? w.x0 : w.z0) + (len * i) / n;
          this.boxes.add(alongX ? u : mx, y0 + CEIL / 2, alongX ? mz : u, 0.06, CEIL, 0.06, 0xb9bcbf);
        }
        this.boxes.add(mx, y0 + 0.04, mz, alongX ? len : 0.1, 0.08, alongX ? 0.1 : len, 0xb9bcbf);
        this.boxes.add(mx, y1 - 0.04, mz, alongX ? len : 0.1, 0.08, alongX ? 0.1 : len, 0xb9bcbf);
        for (const yy of [1.0]) this.boxes.add(mx, y0 + yy, mz, alongX ? len : 0.02, 0.06, alongX ? 0.02 : len, 0xe9ecee); // the frosted band
        if (w.door) { // a white door with a tall pane, a dark reader beside it
          const dx = alongX ? w.door.at : mx, dz = alongX ? mz : w.door.at;
          for (const s of [-1, 1]) this.boxes.add(alongX ? dx + (s * w.door.w) / 2 : dx, y0 + 1.1, alongX ? dz : dz + (s * w.door.w) / 2, alongX ? 0.1 : 0.12, 2.2, alongX ? 0.12 : 0.1, 0xf2f2ef);
          this.boxes.add(dx, y0 + 2.18, dz, alongX ? w.door.w : 0.12, 0.12, alongX ? 0.12 : w.door.w, 0xf2f2ef);
          this.boxes.add(dx, y0 + 0.15, dz, alongX ? w.door.w : 0.12, 0.3, alongX ? 0.12 : w.door.w, 0xf2f2ef);
          this.boxes.add(alongX ? dx + w.door.w / 2 + 0.15 : dx, y0 + 1.15, alongX ? dz : dz + w.door.w / 2 + 0.15, 0.05, 0.14, 0.05, 0x1c1e20);
        }
        continue;
      }
      const mat = w.finish === 'wood' ? M.veneer : w.finish === 'dark' ? M.edge : M.white;
      this.wall(w.level, w.x0, w.x1, w.z0, w.z1, mat, y0, w.finish === 'dark' ? y0 + 1.1 : y1);
      if (w.finish === 'wood') this.cove(w.x0, w.x1, w.z0, w.z1, y1);
    }
    // the room signs, stuck on the glass (A154, TEACHING LABS, C266…)
    for (const r of ROOMS) {
      const y = r.level * FH + 1.8, tex = sign(r.name, '#555a5e', null, 256, 64, '500 30px sans-serif');
      const mat = new MeshBasicMaterial({ map: tex, transparent: true });
      if (r.kind === 'classroom' && r.level === 0 && r.z0 < 160) this.plane(r.x0 - 0.04, y, r.z0 + 2, 1.2, 0.3, -Math.PI / 2, mat);
      else if (r.kind === 'lab') this.plane(r.x0 - 0.36, y + 0.6, (r.z0 + r.z1) / 2, 1.1, 0.28, -Math.PI / 2, mat);
      else this.plane((r.x0 + r.x1) / 2, y + 0.4, r.z0 - 0.42, 1.4, 0.35, Math.PI, mat);
    }
  }

  // ── the atrium: slab edges (dark bands), glass balustrades with wood handrails, the angled soffits ──
  private atrium() {
    const V = VOID, A = FLIGHTS[0], B = FLIGHTS[1], C = FLIGHTS[2], M = this.mats;
    const rail = (level: number, x0: number, z0: number, x1: number, z1: number) => {
      const y = level * FH, len = Math.hypot(x1 - x0, z1 - z0), alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      if (len < 0.2) return;
      const g = this.plane((x0 + x1) / 2, y + 0.55, (z0 + z1) / 2, len, 1.05, alongX ? 0 : Math.PI / 2, M.rail);
      g.renderOrder = 2;
      this.boxes.add((x0 + x1) / 2, y + 1.1, (z0 + z1) / 2, alongX ? len : 0.07, 0.06, alongX ? 0.07 : len, 0xc29a6a); // the wood handrail
      this.boxes.add((x0 + x1) / 2, y + 0.03, (z0 + z1) / 2, alongX ? len : 0.05, 0.06, alongX ? 0.05 : len, 0x9aa0a4); // the shoe
      for (let t = 0; t <= len; t += 1.4) this.boxes.add(x0 + ((x1 - x0) * t) / len, y + 0.55, z0 + ((z1 - z0) * t) / len, 0.03, 1.05, 0.03, 0xb9bec2);
    };
    // the balustrades round the void, floor by floor (open where a stair meets the floor)
    for (const level of [1, 3]) {
      const S = level === 1 ? A : C;
      rail(level, V.x0, V.z0, S.x1, V.z0);
      if (level === 3) { rail(3, S.x1, A.z1 + 0.4, BRIDGE.x0, A.z1 + 0.4); rail(3, BRIDGE.x1, A.z1 + 0.4, V.x1, A.z1 + 0.4); }
      else rail(level, S.x1, A.z1 + 0.4, V.x1, A.z1 + 0.4);
      rail(level, V.x0, V.z0, V.x0, V.z1);
      rail(level, V.x1, A.z1 + 0.4, V.x1, level === 1 ? B.z0 : V.z1);
      if (level === 1) rail(1, V.x1, B.z1, V.x1, V.z1);
      if (level === 3) { rail(3, V.x0, V.z1, BRIDGE.x0, V.z1); rail(3, BRIDGE.x1, V.z1, V.x1, V.z1); }
      else rail(level, V.x0, V.z1, V.x1, V.z1);
    }
    rail(2, C.x0, V.z0, V.x1, V.z0);
    rail(2, V.x0, C.z1 + 0.4, C.x0, C.z1 + 0.4);
    rail(2, V.x0, C.z1 + 0.4, V.x0, B.z0 - 0.4);
    rail(2, V.x0, B.z0 - 0.4, B.x0, B.z0 - 0.4);
    rail(2, V.x1, V.z0, V.x1, V.z1);
    rail(2, B.x0, V.z1, V.x1, V.z1);
    // the angled soffits (the photos' signature): long grey ribbons along the void's edges just under each floor, their
    // faces tilted, the ends cut on a slant; and two great folded planes crossing high up under the wood ceiling
    for (const level of [1, 2, 3]) {
      const y = level * FH - SLAB - 0.05;
      for (const [x0, z0, x1, z1, tilt] of [[V.x0, V.z0 + 0.4, V.x1, V.z0 + 0.4, 0.55], [V.x0, V.z1 - 0.4, V.x1, V.z1 - 0.4, -0.55], [V.x0 + 0.4, V.z0, V.x0 + 0.4, V.z1, 0.5]] as const) {
        const alongX = x1 - x0 > 0.5, len = alongX ? x1 - x0 : z1 - z0;
        // (built along its own axis, tilted about that axis: a face turned toward the void, not a slab end-to-end)
        const m = alongX ? this.box(-len / 2, len / 2, -0.03, 0.03, -0.42, 0.42, M.soffit) : this.box(-0.42, 0.42, -0.03, 0.03, -len / 2, len / 2, M.soffit);
        m.position.set((x0 + x1) / 2, y - 0.12, (z0 + z1) / 2);
        if (alongX) m.rotation.x = tilt; else m.rotation.z = tilt;
      }
    }
    const top = 4 * FH - SLAB;
    for (const [x, z, ry, rz, w] of [[-5, 159, 0.35, 0.5, 13], [-3, 165.5, -0.4, -0.45, 12]] as const) {
      const m = this.box(-w / 2, w / 2, -0.06, 0.06, -1.5, 1.5, M.soffit);
      m.position.set(x, top - 1.6, z);
      m.rotation.set(0, ry, rz);
    }
    // the ground floor's ceiling over the atrium edge: warm wood slats (the photos), not the corridor's dark ones
  }

  /**
   * A grand stair (the photos): two runs of charcoal-carpeted treads with a flat landing between, glass sides on dark
   * steel stringers with a wood handrail along each, the dark underside following the steps.
   */
  private flight(f: Flight) {
    const M = this.mats, n = 24, run = f.x1 - f.x0, y0 = f.base * FH, w = f.z1 - f.z0, cz = (f.z0 + f.z1) / 2, dir = f.up === '+x' ? 1 : -1;
    const xAt = (t: number) => (dir > 0 ? f.x0 + t * run : f.x1 - t * run);
    const [la, lb] = LANDING_T;
    // the steps: n/2 in each run, the landing flat between
    for (const [t0, t1, h0] of [[0, la, 0], [lb, 1, 0.5]] as const) {
      const k = n / 2, tread = ((t1 - t0) * run) / k, rise = (0.5 * FH) / k;
      for (let i = 0; i < k; i++) {
        const x = xAt(t0 + ((i + 0.5) / k) * (t1 - t0)), top = y0 + h0 * FH + (i + 1) * rise;
        this.boxes.add(x, top - 0.04, cz, tread + 0.01, 0.08, w, 0x2b2c2e);
        this.boxes.add(x - (dir * tread) / 2, top - rise / 2, cz, 0.02, rise, w, 0x1f2022); // riser
        this.boxes.add(x + dir * (tread / 2 - 0.03), top - 0.01, cz, 0.05, 0.02, w, 0x4d4f52); // nosing
      }
    }
    const lx = xAt((la + lb) / 2), lw = (lb - la) * run;
    this.boxes.add(lx, y0 + 0.5 * FH - 0.06, cz, lw + 0.02, 0.12, w, 0x2b2c2e); // the landing
    this.boxes.add(lx, y0 + 0.5 * FH - 0.3, cz, lw, 0.36, w, 0x232426);
    // sides: glass on a dark stringer, a wood handrail, following each run and the landing
    const pts = [[0, 0], [la, 0.5], [lb, 0.5], [1, 1]] as const;
    for (const z of [f.z0, f.z1]) {
      for (let s2 = 0; s2 < 3; s2++) {
        const [ta, ha] = pts[s2], [tb, hb] = pts[s2 + 1];
        const a = new Vector3(xAt(ta), y0 + ha * FH, z), b = new Vector3(xAt(tb), y0 + hb * FH, z), len = a.distanceTo(b), ang = Math.atan2(b.y - a.y, b.x - a.x);
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const g = new Mesh(new PlaneGeometry(len, 1.05), M.rail);
        g.position.set(mid.x, mid.y + 0.55, z);
        g.rotation.z = ang;
        g.renderOrder = 2;
        this.group.add(g);
        for (const [h, th, d, mat] of [[1.1, 0.06, 0.07, this.mats.wood], [-0.18, 0.42, 0.12, M.edge]] as const) {
          const m = new Mesh(new BoxGeometry(len, th, d), mat);
          m.position.set(mid.x, mid.y + h, z);
          m.rotation.z = ang;
          this.group.add(m);
        }
      }
    }
    for (let s2 = 0; s2 < 3; s2 += 2) { // the dark underside of each run
      const [ta, ha] = pts[s2], [tb, hb] = pts[s2 + 1];
      const a = new Vector3(xAt(ta), y0 + ha * FH, cz), b = new Vector3(xAt(tb), y0 + hb * FH, cz), len = a.distanceTo(b);
      const m = new Mesh(new BoxGeometry(len, 0.14, w), M.edge);
      m.position.copy(a.clone().add(b).multiplyScalar(0.5)).add(new Vector3(0, -0.3, 0));
      m.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
      this.group.add(m);
    }
  }

  /** The top floor's bridge across the atrium: a slim deck with a dark edge, glass sides with wood handrails. */
  private bridge() {
    const Bg = BRIDGE, y = Bg.level * FH, M = this.mats;
    this.box(Bg.x0, Bg.x1, y - 0.45, y, Bg.z0, Bg.z1, [M.edge, M.edge, M.oak, M.slatWood, M.edge, M.edge], 3);
    for (const x of [Bg.x0, Bg.x1]) {
      const g = this.plane(x, y + 0.55, (Bg.z0 + Bg.z1) / 2, Bg.z1 - Bg.z0, 1.05, Math.PI / 2, M.rail);
      g.renderOrder = 2;
      this.boxes.add(x, y + 1.1, (Bg.z0 + Bg.z1) / 2, 0.07, 0.06, Bg.z1 - Bg.z0, 0xc29a6a);
    }
  }

  // ── the rooms behind the glass: classrooms (green carpet), teaching labs, research labs (grey carpet), seminar rooms ──
  private rooms() {
    const M = this.mats, B = this.boxes;
    for (const r of ROOMS) {
      const y = r.level * FH, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, w = r.x1 - r.x0, d = r.z1 - r.z0;
      const carpetMat = r.kind === 'lab' || r.kind === 'teaching' ? M.grey : M.green;
      this.box(r.x0, r.x1, y, y + 0.02, r.z0, r.z1, [M.edge, M.edge, carpetMat, M.edge, M.edge, M.edge], 2);
      // a lowered ceiling of open slats in labs, lit by long linear lights; white walls with a whiteboard in classrooms
      for (let z = r.z0 + 1.2; z < r.z1 - 0.8; z += 2.2) this.glow.add(cx, y + CEIL - 0.25, z, w - 1.5, 0.04, 0.12, 0xf6f8fa);
      if (r.kind === 'classroom' || r.kind === 'seminar') {
        const longX = w > d;
        // tables in rows (white tops), blue task chairs, a TV and a whiteboard on the far wall, a clock
        const rows = Math.max(2, Math.floor((longX ? d : w) / 2.2));
        for (let i = 0; i < rows; i++) {
          const across = (longX ? r.z0 : r.x0) + 1.5 + i * 2.1;
          for (let j = 0; j < Math.floor((longX ? w : d) / 3.2); j++) {
            const along = (longX ? r.x0 : r.z0) + 1.8 + j * 3.2;
            const tx = longX ? along : across, tz = longX ? across : along;
            B.add(tx, y + 0.74, tz, longX ? 2.4 : 0.7, 0.04, longX ? 0.7 : 2.4, 0xf1f0ec);
            for (const s of [-0.7, 0.7]) {
              B.add(tx + (longX ? s : 0.55), y + 0.45, tz + (longX ? 0.55 : s), 0.48, 0.08, 0.48, 0x2f5d8a);
              B.add(tx + (longX ? s : 0.8), y + 0.75, tz + (longX ? 0.8 : s), longX ? 0.46 : 0.06, 0.5, longX ? 0.06 : 0.46, 0x2f5d8a);
            }
          }
        }
        if (longX) { B.add(cx, y + 1.5, r.z1 - 0.05, w - 2, 1.4, 0.04, 0xf7f7f5); this.glow.add(r.x0 + 1.5, y + 1.7, r.z1 - 0.08, 1.4, 0.8, 0.03, 0x203850); }
        else { B.add(r.x1 - 0.05, y + 1.5, cz, 0.04, 1.4, d - 2, 0xf7f7f5); this.glow.add(r.x1 - 0.08, y + 1.7, r.z0 + 1.6, 0.03, 0.8, 1.4, 0x203850); }
        continue;
      }
      // labs: rows of benches (white casework, a dark top), shelving over them with bottles, a fume hood, desks along the
      // glass with blue chairs and monitors, a round white table
      for (let z = r.z0 + 2.4; z < r.z1 - 1.2; z += 3.2) {
        const x0 = r.x0 + 4.5, x1 = r.x1 - 1.2, bx = (x0 + x1) / 2, bw = x1 - x0;
        B.add(bx, y + 0.45, z, bw, 0.9, 1.4, 0xe9e7e2);
        B.add(bx, y + 0.92, z, bw + 0.04, 0.05, 1.45, 0x2e3236);
        B.add(bx, y + 1.7, z, bw, 0.04, 0.4, 0xd5d5d2);
        B.add(bx, y + 2.15, z, bw, 0.04, 0.4, 0xd5d5d2);
        for (let x = x0 + 0.3; x < x1 - 0.2; x += 0.35) {
          const c = [0x7da7c9, 0xe0c24a, 0xd8d8d0, 0x9cc48a, 0xc87a5a][Math.floor(rng(x * 7 + z) * 5)];
          B.add(x, y + 1.85, z, 0.12, 0.26, 0.12, c);
        }
        for (const s of [-1, 1]) for (let x = x0 + 0.8; x < x1; x += 1.6) B.add(x, y + 0.5, z + s * 1.0, 0.45, 0.06, 0.45, 0x3a6f9e); // stools/chairs
      }
      // the open grid ceiling (the photos): grey slats both ways, exposed silver ducts and pipes over them
      for (let x = r.x0 + 0.6; x < r.x1; x += 0.6) B.add(x, y + CEIL - 0.15, cz, 0.05, 0.12, d, 0x9c9fa2);
      for (let z = r.z0 + 1.5; z < r.z1; z += 1.5) B.add(cx, y + CEIL - 0.1, z, w, 0.06, 0.05, 0x8d9093);
      for (const dz of [-d / 4, d / 4]) { const duct = new Mesh(new CylinderGeometry(0.28, 0.28, w - 1, 12), this.mats.duct); duct.rotation.z = Math.PI / 2; duct.position.set(cx, y + CEIL + 0.2, cz + dz); this.group.add(duct); }
      for (const dz of [-1, 1]) B.add(cx, y + CEIL + 0.05, cz + dz * 0.6, w - 1, 0.08, 0.08, 0x5b6a74);
      B.add(r.x1 - 0.6, y + 1.2, r.z0 + 0.6, 1.0, 2.4, 0.9, 0xeeeeea); // the fume hood…
      this.glow.add(r.x1 - 0.6, y + 1.3, r.z0 + 1.06, 0.8, 0.7, 0.02, 0xe4eef2); // …its lit sash
      for (let z = r.z0 + 1.4; z < r.z1 - 0.6; z += 2.4) { // desks along the glass: white, a monitor, a blue chair
        B.add(r.x0 + 1.6, y + 0.74, z, 1.4, 0.05, 1.8, 0xe8e5de);
        B.add(r.x0 + 1.9, y + 1.05, z, 0.06, 0.4, 0.6, 0x1b1d20);
        B.add(r.x0 + 1.0, y + 0.47, z, 0.5, 0.07, 0.5, 0x2f6aa0);
      }
      const t = new Mesh(new CylinderGeometry(0.75, 0.75, 0.04, 20), M.white); // the round table
      t.position.set(r.x0 + 3.2, y + 0.74, cz);
      this.group.add(t);
      B.add(r.x0 + 3.2, y + 0.37, cz, 0.1, 0.74, 0.1, 0xb0b4b6);
    }
  }

  // ── furniture out in the open ──
  private furniture() {
    const B = this.boxes, M = this.mats;
    const rugGrey = topo('#9aa3a6', '#e6e6e2'), rugTeal = topo('#2f6f74', '#dde3df'), rugGreen = topo('#7f9c86', '#d7ddd4');
    this.rug(-5.5, 0, 166, 8, 5.5, rugGrey, 0.1);
    for (const level of [1, 2, 3]) this.rug(-6.5, level * FH, 151.2, 7.5, 4.2, level === 2 ? rugGreen : rugTeal);
    const pebble = new SphereGeometry(1, 18, 10), tub = new CylinderGeometry(0.55, 0.45, 0.75, 18);
    for (const f of FURNITURE) {
      const y = f.level * FH;
      switch (f.kind) {
        case 'liveEdge': { // a long slab of warm wood with a wavy edge, black legs, black stools round it
          const len = f.len ?? 4;
          for (let i = 0; i < 10; i++) B.add(f.x - len / 2 + (i + 0.5) * (len / 10), y + 0.92, f.z, len / 10 + 0.01, 0.07, 1.0 + Math.sin(i * 1.3) * 0.12, 0xa8642f);
          for (const s of [-1, 1]) B.add(f.x + (s * len) / 2.6, y + 0.45, f.z, 0.08, 0.9, 0.7, 0x1c1c1e);
          for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
            const sx = f.x - len / 2 + 0.6 + i * ((len - 1.2) / 3);
            B.add(sx, y + 0.66, f.z + s * 0.95, 0.42, 0.05, 0.42, 0x1c1c1e);
            B.add(sx, y + 0.33, f.z + s * 0.95, 0.04, 0.66, 0.04, 0x1c1c1e);
            B.add(sx, y + 0.92, f.z + s * 1.15, 0.42, 0.5, 0.04, 0x1c1c1e);
          }
          break;
        }
        case 'pebble': { // the green pebble seats, a smaller lighter back-pebble on one
          const m = new Mesh(pebble, new MeshLambertMaterial({ color: 0x3f8a55 }));
          m.position.set(f.x, y + 0.24, f.z);
          m.scale.set(1.0, 0.3, 0.7);
          m.rotation.y = f.rot ?? 0;
          this.group.add(m);
          const b2 = new Mesh(pebble, new MeshLambertMaterial({ color: 0x6aa384 }));
          b2.position.set(f.x + 0.1, y + 0.62, f.z);
          b2.scale.set(0.55, 0.3, 0.45);
          this.group.add(b2);
          const tbl = new Mesh(new CylinderGeometry(0.3, 0.3, 0.03, 14), new MeshLambertMaterial({ color: 0x1c1c1e }));
          tbl.position.set(f.x + 1.3, y + 0.55, f.z + 0.4);
          this.group.add(tbl);
          B.add(f.x + 1.3, y + 0.27, f.z + 0.4, 0.04, 0.55, 0.04, 0x1c1c1e);
          break;
        }
        case 'pebbleW': {
          const m = new Mesh(pebble, new MeshLambertMaterial({ color: 0xece8de }));
          m.position.set(f.x, y + 0.18, f.z);
          m.scale.set(0.6, 0.22, 0.45);
          this.group.add(m);
          break;
        }
        case 'roundTable': {
          const t = new Mesh(new CylinderGeometry(0.6, 0.6, 0.04, 18), M.white);
          t.position.set(f.x, y + 0.74, f.z);
          this.group.add(t);
          B.add(f.x, y + 0.37, f.z, 0.08, 0.74, 0.08, 0x222224);
          for (let k = 0; k < 4; k++) { // white shell chairs on light legs
            const a = (k / 4) * Math.PI * 2 + 0.4, cx = f.x + Math.sin(a) * 0.95, cz = f.z + Math.cos(a) * 0.95;
            B.add(cx, y + 0.46, cz, 0.46, 0.06, 0.46, 0xf0eee8, a);
            B.add(cx + Math.sin(a) * 0.2, y + 0.72, cz + Math.cos(a) * 0.2, 0.46, 0.45, 0.06, 0xf0eee8, a);
            B.add(cx, y + 0.22, cz, 0.04, 0.44, 0.04, 0xc8a87a);
          }
          break;
        }
        case 'longTable': { // pale wood, green chairs both sides (the render)
          const len = f.len ?? 4;
          B.add(f.x, y + 0.74, f.z, len, 0.05, 1.0, 0xd8b98c);
          B.add(f.x, y + 0.37, f.z, len - 0.4, 0.7, 0.5, 0xc29a6a);
          for (let x = f.x - len / 2 + 0.5; x < f.x + len / 2; x += 0.85) for (const s of [-1, 1]) {
            B.add(x, y + 0.46, f.z + s * 0.75, 0.42, 0.05, 0.42, 0x5f9a68);
            B.add(x, y + 0.72, f.z + s * 0.95, 0.42, 0.45, 0.05, 0x5f9a68);
          }
          break;
        }
        case 'planter': { // a long dark planter of leafy plants, a wood bench along it, white stool-tables
          const len = f.len ?? 5;
          B.add(f.x, y + 0.35, f.z, len, 0.7, 1.6, 0x45484b);
          for (let i = 0; i < 26; i++) {
            const m = new Mesh(new IcosahedronGeometry(0.35 + rng(5100 + i) * 0.25, 0), new MeshLambertMaterial({ color: [0x3e7a3a, 0x5c9a48, 0x2f6a35, 0x86b06a][i % 4] }));
            m.position.set(f.x - len / 2 + 0.3 + rng(5200 + i) * (len - 0.6), y + 0.85 + rng(5300 + i) * 0.3, f.z + (rng(5400 + i) - 0.5) * 1.1);
            this.group.add(m);
          }
          B.add(f.x, y + 0.45, f.z + 1.0, len, 0.08, 0.5, 0xc29a6a);
          for (let i = 0; i < 4; i++) { const m = new Mesh(new CylinderGeometry(0.25, 0.25, 0.45, 14), M.white); m.position.set(f.x - len / 2 + 0.8 + i * 1.4, y + 0.22, f.z - 1.3); this.group.add(m); }
          break;
        }
        case 'cafe': break; // (in cafe())
        case 'tub': { // the teal tub chairs, a white side table
          const m = new Mesh(tub, new MeshLambertMaterial({ color: 0x1f6a74 }));
          m.position.set(f.x, y + 0.38, f.z);
          this.group.add(m);
          const seat = new Mesh(new CylinderGeometry(0.4, 0.4, 0.1, 14), new MeshLambertMaterial({ color: 0x2c8a94 }));
          seat.position.set(f.x, y + 0.6, f.z);
          this.group.add(seat);
          const st = new Mesh(new CylinderGeometry(0.22, 0.22, 0.03, 12), M.white);
          st.position.set(f.x + 0.75, y + 0.55, f.z + 0.3);
          this.group.add(st);
          break;
        }
        case 'highBack': { // a green high-backed lounge chair
          const r = f.rot ?? 0, s = Math.sin(r), c = Math.cos(r);
          B.add(f.x, y + 0.24, f.z, 0.9, 0.48, 0.85, 0x4f8a3e, r);
          B.add(f.x - s * 0.4, y + 0.85, f.z - c * 0.4, 0.95, 1.3, 0.14, 0x3f7a32, r);
          for (const e of [-0.42, 0.42]) B.add(f.x + c * e, y + 0.55, f.z - s * e, 0.12, 0.6, 0.8, 0x3f7a32, r);
          break;
        }
        case 'booth': // the green phone booth: tall, rounded top
          B.add(f.x, y + 1.1, f.z, 1.4, 2.2, 1.4, 0x5c9a3e);
          B.add(f.x, y + 1.0, f.z - 0.7, 1.0, 1.6, 0.02, 0x6e8a78);
          break;
        case 'counter': { // a long counter on the void's edge: wood front, white top, teal stools
          const len = f.len ?? 5;
          B.add(f.x, y + 0.53, f.z, len, 1.06, 0.6, 0xc29a6a);
          B.add(f.x, y + 1.08, f.z, len + 0.1, 0.05, 0.7, 0xf4f2ec);
          for (let x = f.x - len / 2 + 0.5; x < f.x + len / 2; x += 0.9) {
            B.add(x, y + 0.75, f.z + 0.65, 0.42, 0.06, 0.42, 0x1d7480);
            B.add(x, y + 0.98, f.z + 0.85, 0.42, 0.4, 0.06, 0x1d7480);
            B.add(x, y + 0.37, f.z + 0.65, 0.04, 0.74, 0.04, 0xc8ccce);
          }
          break;
        }
        case 'bench': break;
      }
    }
  }

  // ── the ground floor corridor: the water fountain niche, the elevators, the posters, exit signs; the vestibule ──
  private corridor() {
    const B = this.boxes, zf = 152.38;
    // the fountain niche: a dark blue-grey recess, two stainless fountains and a bottle filler
    B.add(9, 1.4, zf - 0.02, 1.8, 2.8, 0.04, 0x3c4650);
    for (const [x, y] of [[8.6, 0.85], [9.3, 0.95]]) B.add(x, y, zf - 0.22, 0.36, 0.08, 0.36, 0xb8bcbf);
    B.add(9.5, 1.45, zf - 0.05, 0.6, 0.7, 0.06, 0xa9adb0);
    // the elevators: a dark recess, two stainless doors, call buttons
    B.add(16.5, 1.6, zf - 0.03, 4.6, 3.2, 0.06, 0x2b3036);
    for (const x of [15.3, 17.7]) B.add(x, 1.15, zf - 0.08, 1.2, 2.3, 0.04, 0xa5aaae);
    B.add(16.5, 1.2, zf - 0.08, 0.12, 0.3, 0.03, 0xd9dcdd);
    // the posters, a corkboard on the north wall
    B.add(4.5, 1.7, IN_L0.z0 + 0.02, 2.2, 1.4, 0.03, 0xb98d5c);
    for (let i = 0; i < 14; i++) this.glow.add(3.6 + (i % 5) * 0.42, 1.25 + Math.floor(i / 5) * 0.42, IN_L0.z0 + 0.05, 0.32, 0.36, 0.01, [0xf2e6c8, 0xcfe3f0, 0xf0c9c0, 0xe8e8e8, 0xd9f0d0][i % 5]);
    // green exit signs over the corridor
    for (const x of [-10, 6, 19]) this.glow.add(x, CEIL - 0.2, (IN_L0.z0 + 152.4) / 2, 0.36, 0.16, 0.05, 0x3ee07a);
    // the vestibule at the north door: a ribbed mat, its glass doors (open), lights in the slat ceiling
    const N = SCI_NDOOR;
    B.add(N.x, 0.012, (IN_L0.z0 + 151) / 2, 4.3, 0.02, 151 - IN_L0.z0, 0x2c2e30);
    for (let z = IN_L0.z0 + 0.1; z < 151; z += 0.12) B.add(N.x, 0.024, z, 4.2, 0.008, 0.04, 0x3a3c3e);
    for (const s of [-1, 1]) B.add(N.x + s * 1.6, 1.2, 151, 0.9, 2.4, 0.05, 0x8d9396);
    this.glow.add(N.x, CEIL - 0.03, 149.8, 0.18, 0.02, 0.18, 0xfff6e2);
    // the corridor's cove lights along the north wall, and the downlights in its dark slat ceiling are the floor's own
    this.cove(-12, IN_L0.x1, IN_L0.z0, IN_L0.z0 + 0.06, CEIL);
    // the stair's foot: a warm light strip on the wall under it
    this.cove(FLIGHTS[0].x0, FLIGHTS[0].x1, 154.1, 154.15, 1.0);
    // across the atrium: the wood-panelled wall of the stair core, rising through the floors (the photos' tall veneer wall)
    for (let level = 0; level < 4; level++) this.boxes.add(VOID.x1 + 0.12, level * FH + CEIL / 2, 160, 0.06, CEIL, 2.8, 0xb68a5a);
  }

  /** The café commons under the glass: the café counter in a wood wall with its vertical CAFE sign, a menu, coffee. */
  private cafe() {
    const B = this.boxes, z = 174.6;
    this.wall(0, -21, -12, z, z + 0.4, this.mats.veneer);
    this.cove(-21, -12, z, z + 0.4, CEIL);
    B.add(-16.5, 0.55, 173.4, 5, 1.1, 0.7, 0xc29a6a);
    B.add(-16.5, 1.12, 173.4, 5.1, 0.05, 0.8, 0xf2f0ea);
    B.add(-14.6, 1.3, 173.4, 0.5, 0.3, 0.4, 0x2b2b2d); // the espresso machine
    B.add(-18.4, 1.25, 173.4, 0.6, 0.2, 0.5, 0xc0c4c6); // the register
    const signMat = new MeshBasicMaterial({ map: sign('CAFE', '#3a3d40', '#e8e2d8', 64, 256, '700 40px sans-serif') });
    const s = this.plane(-12.6, 2.2, z - 0.02, 0.5, 1.8, Math.PI, signMat);
    s.renderOrder = 1;
    this.glow.add(-16.5, 2.5, z - 0.03, 2.6, 0.9, 0.02, 0x2b2b2d); // the menu board
    for (let i = 0; i < 6; i++) this.glow.add(-17.6 + (i % 3) * 1.1, 2.75 - Math.floor(i / 3) * 0.35, z - 0.05, 0.8, 0.04, 0.01, 0xe8e2d0);
  }
}
