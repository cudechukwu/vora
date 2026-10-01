import {
  BoxGeometry, BufferGeometry, CanvasTexture, Color, ConeGeometry, DynamicDrawUsage,
  ExtrudeGeometry, InstancedMesh, Material, Matrix4, MeshBasicMaterial, MeshLambertMaterial,
  PlaneGeometry, Quaternion, RepeatWrapping, Shape, ShapeGeometry, SRGBColorSpace, Texture, Vector3,
} from 'three';
import { rng } from '../noise';

// ─── Low-poly kit ──────────────────────────────────────────────────────
// Everything on College Row is built from boxes, prisms and a few cones,
// so the whole scene is code and ships in one small bundle. Anything that
// repeats (windows, sills, benches, trees) goes through an instanced bank
// so it's one draw call no matter how many there are.

export const PAL = {
  brick: 0xa4543f,
  brickDeep: 0x8a4232,
  brownstone: 0x7a5243,
  trim: 0xf1ead9,
  slate: 0x3e4a52,
  patina: 0x6f9e8a,
  path: 0xcfc4ab,
  curb: 0xa89f8a,
  iron: 0x1d2226,
  wood: 0x6b4a2f,
  dirt: 0xb07a4e,
} as const;

const matCache = new Map<string, MeshLambertMaterial>();
/** Shared flat-shaded Lambert material, cached by colour (+ optional texture key). */
export function lambert(color: number, map?: Texture, key = ''): MeshLambertMaterial {
  const k = `${color}:${key}`;
  let m = matCache.get(k);
  if (!m) {
    m = new MeshLambertMaterial({ color, flatShading: true, map: map ?? null });
    matCache.set(k, m);
  }
  return m;
}

// ── procedural masonry textures (world-space: one tile = 2m × 2m) ──
function masonry(kind: 'brick' | 'stone'): CanvasTexture {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, S, S);
  const courseH = kind === 'brick' ? 10 : 32;
  const unitW = kind === 'brick' ? 28 : 58;
  let id = 1;
  for (let y = 0, row = 0; y < S; y += courseH, row++) {
    const off = row % 2 ? unitW / 2 : 0;
    for (let x = -off; x < S; x += unitW) {
      const v = 0.86 + rng(id++) * 0.16; // per-unit shade jitter
      const l = Math.round(v * 255);
      g.fillStyle = `rgb(${l},${l},${l})`;
      g.fillRect(x + 1, y + 1, unitW - 2, courseH - 2);
    }
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
let brickTex: CanvasTexture | null = null;
let stoneTex: CanvasTexture | null = null;
export const brickMap = () => (brickTex ??= masonry('brick'));
export const stoneMap = () => (stoneTex ??= masonry('stone'));

/** Rewrite a geometry's UVs so textures tile in world metres (tile = `size` m). */
export function worldUV<T extends BufferGeometry>(geo: T, size = 2): T {
  const pos = geo.getAttribute('position');
  const nrm = geo.getAttribute('normal');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
    let u: number, v: number;
    if (ny > 0.5) { u = x; v = z; } else if (nx > 0.5) { u = z; v = y; } else { u = x; v = y; }
    uv.setXY(i, u / size, v / size);
  }
  uv.needsUpdate = true;
  return geo;
}

/** Box sitting on y=0 at its local origin, with world-space UVs. */
export function block(w: number, h: number, d: number): BoxGeometry {
  const g = new BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  return worldUV(g);
}

/** Triangular prism: triangle (width × height) in the XY plane, extruded `len` along Z, base at y=0. */
export function prism(width: number, height: number, len: number): ExtrudeGeometry {
  const s = new Shape();
  s.moveTo(-width / 2, 0);
  s.lineTo(width / 2, 0);
  s.lineTo(0, height);
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  return g;
}

/** Four-sided hip roof covering an (sx × sz) footprint, base at y=0. */
export function hipRoof(sx: number, h: number, sz: number): ConeGeometry {
  const g = new ConeGeometry(Math.SQRT1_2, 1, 4, 1);
  g.rotateY(Math.PI / 4);
  g.translate(0, 0.5, 0);
  g.scale(sx, h, sz);
  return g;
}

// ── window shapes (unit size, centred) ──
function archShape() {
  const s = new Shape();
  s.moveTo(-0.5, -0.5);
  s.lineTo(0.5, -0.5);
  s.lineTo(0.5, 0.1);
  s.absarc(0, 0.1, 0.5, 0, Math.PI, false);
  s.lineTo(-0.5, -0.5);
  return new ShapeGeometry(s, 6);
}
function gothicShape() {
  const s = new Shape();
  s.moveTo(-0.5, -0.5);
  s.lineTo(0.5, -0.5);
  s.lineTo(0.5, 0.12);
  s.quadraticCurveTo(0.45, 0.4, 0, 0.5);
  s.quadraticCurveTo(-0.45, 0.4, -0.5, 0.12);
  s.closePath();
  return new ShapeGeometry(s, 4);
}

export type WindowKind = 'rect' | 'arch' | 'gothic';
export type Facing = '+x' | '-x' | '+z' | '-z';

const FACING_Q: Record<Facing, Quaternion> = {
  '+z': new Quaternion(),
  '-z': new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI),
  '+x': new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2),
  '-x': new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2),
};

/**
 * Every window on the row, in three instanced meshes. Windows are unlit
 * (MeshBasic) so we can recolour them per time of day: sky-tinted glass by
 * day, a random share of warm lit rooms at night.
 */
export class WindowBank {
  private items: Record<WindowKind, { m: Matrix4; seed: number }[]> = { rect: [], arch: [], gothic: [] };
  private meshes: InstancedMesh[] = [];
  private seeds: number[][] = [];

  /** `facing` is a side, or a y-rotation in radians for curved walls (0 = facing +z). */
  add(kind: WindowKind, x: number, y: number, z: number, w: number, h: number, facing: Facing | number) {
    const q = typeof facing === 'number' ? new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), facing) : FACING_Q[facing];
    const m = new Matrix4().compose(new Vector3(x, y, z), q, new Vector3(w, h, 1));
    this.items[kind].push({ m, seed: rng(this.count() + 17) });
  }

  count() {
    return this.items.rect.length + this.items.arch.length + this.items.gothic.length;
  }

  build(): InstancedMesh[] {
    const geos: Record<WindowKind, BufferGeometry> = {
      rect: new PlaneGeometry(1, 1), arch: archShape(), gothic: gothicShape(),
    };
    for (const kind of ['rect', 'arch', 'gothic'] as WindowKind[]) {
      const list = this.items[kind];
      if (!list.length) continue;
      const mesh = new InstancedMesh(geos[kind], new MeshBasicMaterial({ color: 0xffffff }), list.length);
      list.forEach((it, i) => {
        mesh.setMatrixAt(i, it.m);
        mesh.setColorAt(i, new Color(0x223038));
      });
      mesh.instanceColor!.setUsage(DynamicDrawUsage);
      this.meshes.push(mesh);
      this.seeds.push(list.map((it) => it.seed));
    }
    return this.meshes;
  }

  /** Recolour for the current mood. `glass` is the daytime reflection tint. */
  paint(glass: Color, night: number) {
    const lit = new Color(0xffcf86);
    const dark = new Color(0x0c0f14);
    const c = new Color();
    this.meshes.forEach((mesh, mi) => {
      this.seeds[mi].forEach((seed, i) => {
        // chapel glass glows amber-red when lit; rooms light up progressively after dusk
        const on = seed < night * 0.45;
        if (on) c.copy(lit).multiplyScalar(0.85 + seed * 0.3);
        else c.copy(glass).lerp(dark, night);
        mesh.setColorAt(i, c);
      });
      mesh.instanceColor!.needsUpdate = true;
    });
  }
}

/** Many small static boxes (sills, cornices, bench slats, posts), one draw call. */
export class BoxBank {
  private items: { m: Matrix4; c: Color }[] = [];

  add(x: number, y: number, z: number, sx: number, sy: number, sz: number, color: number, rotY = 0) {
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), rotY);
    this.items.push({ m: new Matrix4().compose(new Vector3(x, y, z), q, new Vector3(sx, sy, sz)), c: new Color(color) });
  }

  build(material: Material = new MeshLambertMaterial({ color: 0xffffff, flatShading: true })): InstancedMesh {
    const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), material, this.items.length);
    this.items.forEach((it, i) => {
      mesh.setMatrixAt(i, it.m);
      mesh.setColorAt(i, it.c);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}
