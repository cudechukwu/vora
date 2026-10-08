import {
  AdditiveBlending, CanvasTexture, CircleGeometry, Color, CylinderGeometry, DynamicDrawUsage, Group,
  IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry, PointLight,
  Quaternion, RepeatWrapping, SRGBColorSpace, Sprite, SpriteMaterial, Vector3, BoxGeometry, Float32BufferAttribute,
} from 'three';
import { BoxBank, PAL, PAVER_TILE, lambert, paverMap, prism } from './kit';
import { zelnickSolids } from './zelnick';
import { BACK_TREES, aprons, lawnWalks, onQuadX, quadXAt, rearWalkAt, rearWalks } from './backlawn';
import type { Box } from './collide';
import { vestibuleSolids } from './usdan/plan';
import {
  BED, FOOTBALL, ITEMS, Item, PATH_ITEMS, chairs, fenceObstacles, fenceRuns, half, pathObstacles, plazaObstacles,
} from './plaza';
import {
  BACK_PATH, PLAZA, PLAZA_GAP, CROSSWALK_W, Crossing, FAR_WALK, FIELD_X, PATH_HALF, ROAD, RowStop, USDAN, WALK_MAX_Z, WALK_MIN_Z,
  inUsdan, rowSolids,
} from './layout';
import { noise2, rng } from './noise';
import { DRIVEWAYS, HOUSE } from './house/plan';
import { NEAR_WALK, frontBenches, frontTrees, frontWalkDist, frontWalks } from './frontlawn';
import { ALLBRITTON, BERM, CHURCH, CHURCH_WALK_S, EXLEY_SITE, EXLEY_TREES, SHANK_TREES, SCI, SCI_TREES, FIELD_ROAD, OLIN_TREES, bankY, groundY, inSouthEnd, southObstacles } from './southend';

// ─── The ground around the row ─────────────────────────────────────────
// Lawn in front of the buildings, the walk, a tree line along the field
// between the walk and High Street, and Andrus Field *behind* the row:
// football field and stands behind the chapel, ball diamond beyond —
// glimpsed through the walkways between buildings.


export interface Bench { x: number; z: number }

const inPlaza = (p: { x: number; z: number }) =>
  [PLAZA, PLAZA_GAP].some((b) => p.x > b.x0 - 2 && p.x < b.x1 + 2 && p.z > b.z0 - 2 && p.z < b.z1 + 2);
export interface Lamp { x: number; z: number; h: number; arm: number }

export class World {
  readonly group = new Group();
  readonly benches: Bench[] = [];
  /** Things you bump into outside: tree trunks, lamp posts, benches (already padded by your radius). */
  readonly obstacles: Box[] = [];
  private lampHeads!: InstancedMesh;
  private glows: Sprite[] = [];
  private glowMat!: SpriteMaterial;
  private poolMat!: MeshBasicMaterial;
  private spots: Lamp[] = [];
  private fz = -60; // centre of the football field (z)
  private lampOn = 0;
  /** Real lights, moved to whichever street lamps are nearest you (so people + walls light up, not just the ground). */
  readonly lampLights: PointLight[] = [0, 1, 2, 3].map(() => new PointLight(0xffd59a, 0, 18, 1.4));

  constructor(stops: RowStop[], private crossings: Crossing[], box: BoxBank) {
    this.ground();
    this.fz = FOOTBALL.z;
    this.field(this.fz, box);
    this.walks(stops);
    this.frontLawn(stops, box);
    this.street(box);
    this.backPath(stops);
    this.rearLawn(stops, box);
    this.trees(stops);
    this.lamps();
    this.benchesAlongLawn(box);
    this.plaza(box);
    this.pathSide(box, stops);
    this.obstacles.push(...plazaObstacles(), ...pathObstacles(), ...fenceObstacles(FIELD_X, this.fz), ...vestibuleSolids(), ...southObstacles(), ...rowSolids(stops), ...zelnickSolids());
  }

  private ground() {
    const geo = new PlaneGeometry(1000, 1000, 100, 100);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position');
    const cols: number[] = [];
    const a = new Color(0x5f9a3a), b = new Color(0x7aae48), c = new Color();
    for (let i = 0; i < pos.count; i++) {
      const n = noise2(pos.getX(i) / 22, pos.getZ(i) / 22) * 0.7 + noise2(pos.getX(i) / 6, pos.getZ(i) / 6) * 0.3;
      c.copy(a).lerp(b, n);
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new Float32BufferAttribute(cols, 3));
    const m = new Mesh(geo, new MeshLambertMaterial({ vertexColors: true }));
    m.position.set(80, 0, -150);
    m.receiveShadow = true;
    this.group.add(m);
  }

  private field(fz: number, box: BoxBank) {
    // mowing stripes: two greens alternating every 5m along the field
    const cv = document.createElement('canvas');
    cv.width = 4; cv.height = 64;
    const g = cv.getContext('2d')!;
    g.fillStyle = '#8fc25a'; g.fillRect(0, 0, 4, 32);
    g.fillStyle = '#6fa640'; g.fillRect(0, 32, 4, 32);
    const tex = new CanvasTexture(cv);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.colorSpace = SRGBColorSpace;
    const zN = USDAN.reduce((m, p) => Math.max(m, p.z), -Infinity) + 3; // the field starts just south of Usdan
    const len = FIELD_ROAD.z0 - zN, wid = 150; // down to the road along its south end
    tex.repeat.set(1, len / 10);
    const f = new Mesh(new PlaneGeometry(wid, len), new MeshLambertMaterial({ map: tex }));
    f.rotation.x = -Math.PI / 2;
    f.position.set(FIELD_X - wid / 2, 0.01, zN + len / 2);
    f.receiveShadow = true;
    this.group.add(f);

    this.football(fz, box);

    // ball diamond, beyond the stands
    const dz = fz - 20, dx = FIELD_X - 117;
    const dirt = new Mesh(new PlaneGeometry(30, 30), lambert(PAL.dirt));
    dirt.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
    dirt.position.set(dx, 0.02, dz);
    const infield = new Mesh(new PlaneGeometry(19, 19), new MeshLambertMaterial({ color: 0x7fb34f }));
    infield.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
    infield.position.set(dx - 1.5, 0.03, dz);
    const mound = new Mesh(new CircleGeometry(1.6, 12), lambert(PAL.dirt));
    mound.rotation.x = -Math.PI / 2;
    mound.position.set(dx - 1.5, 0.04, dz);
    for (const m of [dirt, infield, mound]) { m.receiveShadow = true; this.group.add(m); }
    // backstop
    const fence = new Mesh(new BoxGeometry(0.1, 4, 12), new MeshBasicMaterial({ color: 0x33383c, transparent: true, opacity: 0.45 }));
    fence.position.set(dx - 23, 2, dz);
    this.group.add(fence);
  }

  /** Football field behind the chapel, with goalposts and the red-trimmed stands on the far side. */
  private football(fz: number, box: BoxBank) {
    const { W, L } = FOOTBALL, cx = FIELD_X - FOOTBALL.gap - W / 2;
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 288;
    const g = cv.getContext('2d')!;
    const py = 288 / L; // px per metre along the field
    for (let i = 0; i < 12; i++) {
      g.fillStyle = i === 0 || i === 11 ? '#5e9a3c' : i % 2 ? '#78b24c' : '#6ca844';
      g.fillRect(0, i * 24, 128, 24);
    }
    g.fillStyle = '#f4f1e8';
    for (let yd = 0; yd <= 100; yd += 10) g.fillRect(0, Math.round((10 + yd) * 0.9144 * py) - 1, 128, 2);
    g.fillRect(0, 0, 3, 288); g.fillRect(125, 0, 3, 288);
    g.fillStyle = '#b8352c'; // end zone ends
    g.fillRect(0, 0, 128, 2); g.fillRect(0, 286, 128, 2);
    const tex = new CanvasTexture(cv);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 8;
    const f = new Mesh(new PlaneGeometry(W, L), new MeshLambertMaterial({ map: tex }));
    f.rotation.x = -Math.PI / 2;
    f.position.set(cx, 0.02, fz);
    f.receiveShadow = true;
    this.group.add(f);

    // goalposts at both ends
    for (const e of [-1, 1]) {
      const z = fz + e * (L / 2 - 0.5);
      box.add(cx, 1.5, z, 0.2, 3, 0.2, 0xf1ead9);
      box.add(cx, 3.05, z, 5.6, 0.18, 0.18, 0xf1ead9);
      for (const dx of [-2.75, 2.75]) box.add(cx + dx, 6, z, 0.14, 6, 0.14, 0xf1ead9);
    }
    // stands on the far sideline, facing back toward the row
    const sx = cx - W / 2 - 5, sl = 42;
    for (let r = 0; r < 7; r++) {
      box.add(sx - r * 0.9, 0.9 + r * 0.45, fz, 0.9, 0.35, sl, r % 2 ? 0x9aa0a4 : 0xb4b8bb);
    }
    box.add(sx + 0.5, 0.45, fz, 0.2, 0.9, sl, 0xb8352c); // red front wall
    box.add(sx - 3.5, 1.8, fz, 7, 3.6, sl, 0x6a7074); // understructure
    box.add(sx - 6.8, 5.6, fz, 2.4, 2.4, 10, 0x1d1f22); // black press box (Corwin Stadium)
    box.add(sx - 6.8, 7.0, fz, 2.6, 0.3, 10.4, 0xf1f1ee); // its white roof
    for (let i = -4; i <= 4; i++) box.add(sx - 5.58, 5.5, fz + i * 1.05, 0.02, 0.6, 0.8, 0x8a9aa6); // windows
    box.add(sx - 5.56, 6.35, fz, 0.03, 0.55, 3.2, 0xf1f1ee); // the sign…
    box.add(sx - 5.54, 6.35, fz, 0.03, 0.35, 0.5, 0xb8352c); // …with its red W
    // a low chain-link fence round the field: posts, a top rail, and see-through mesh
    const mesh = new MeshBasicMaterial({ color: 0x8a9096, transparent: true, opacity: 0.3, depthWrite: false });
    for (const [x0, z0, x1, z1] of fenceRuns(FIELD_X, fz)) {
      const len = Math.hypot(x1 - x0, z1 - z0), alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      box.add(mx, 1.25, mz, alongX ? len : 0.05, 0.05, alongX ? 0.05 : len, 0x9aa0a4);
      const n = Math.max(1, Math.round(len / 3));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        box.add(x0 + (x1 - x0) * t, 0.64, z0 + (z1 - z0) * t, 0.06, 1.28, 0.06, 0x9aa0a4);
      }
      const m = new Mesh(new PlaneGeometry(len, 1.2), mesh);
      m.position.set(mx, 0.62, mz);
      m.rotation.y = alongX ? 0 : Math.PI / 2;
      this.group.add(m);
    }
  }

  /** The plaza between Usdan and Boger: speckled concrete slabs and everything on them (see plaza.ts). */
  private plaza(box: BoxBank) {
    // slabs in a running bond, speckled, with darker joints
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g = cv.getContext('2d')!;
    g.fillStyle = '#c9bea7'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = rng(i * 7 + 1) < 0.5 ? 'rgba(70,62,52,.45)' : 'rgba(240,234,220,.5)';
      g.fillRect(rng(i * 7 + 2) * 256, rng(i * 7 + 3) * 256, 1.5, 1.5);
    }
    g.strokeStyle = 'rgba(90,80,66,.55)'; g.lineWidth = 2;
    for (let r = 0; r < 4; r++) {
      g.beginPath(); g.moveTo(0, r * 64); g.lineTo(256, r * 64); g.stroke();
      for (let c = 0; c < 2; c++) { const x = c * 128 + (r % 2) * 64; g.beginPath(); g.moveTo(x, r * 64); g.lineTo(x, r * 64 + 64); g.stroke(); }
    }
    const tex = new CanvasTexture(cv);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.colorSpace = SRGBColorSpace;
    for (const p of [PLAZA, PLAZA_GAP]) {
      const t = tex.clone();
      t.needsUpdate = true;
      t.repeat.set((p.x1 - p.x0) / 4, (p.z1 - p.z0) / 4); // one tile = 4m × 4m (slabs ~2m × 1m)
      const m = new Mesh(new PlaneGeometry(p.x1 - p.x0, p.z1 - p.z0), new MeshLambertMaterial({ map: t }));
      m.rotation.x = -Math.PI / 2;
      m.position.set((p.x0 + p.x1) / 2, 0.034, (p.z0 + p.z1) / 2);
      m.receiveShadow = true;
      this.group.add(m);
    }
    // a pale granite band where the plaza meets the walkway
    box.add((PLAZA.x0 + PLAZA_GAP.x1) / 2, 0.04, PLAZA_GAP.z0 - 0.2, PLAZA_GAP.x1 - PLAZA.x0, 0.02, 0.45, 0xb9b8b1);

    const granite = 0xaeada7, grey = 0xb6babd, slat = 0x7d8286;
    const draw = (it: Item) => {
      const [hx, hz] = half(it);
      const r = it.alongZ ? Math.PI / 2 : 0;
      const along = (d: number) => (it.alongZ ? [0, d] : [d, 0]);
      switch (it.kind) {
        case 'tree':
          box.add(it.x, 0.045, it.z, 3, 0.02, 3, 0x5c2f29); // square pit of red stone chips
          break;
        case 'bench': { // a rounded granite slab on three round legs
          box.add(it.x, 0.45, it.z, 2.2, 0.22, 0.6, granite, r);
          for (const d of [-0.75, 0, 0.75]) { const [ox, oz] = along(d); box.add(it.x + ox, 0.18, it.z + oz, 0.42, 0.36, 0.42, 0x9d9c96); }
          break;
        }
        case 'oval':
          box.add(it.x, 0.72, it.z, 2.6, 0.16, 1.2, granite, r);
          for (const d of [-0.7, 0.7]) { const [ox, oz] = along(d); box.add(it.x + ox, 0.32, it.z + oz, 0.6, 0.64, 0.6, 0x9d9c96); }
          break;
        case 'table': {
          box.add(it.x, 0.74, it.z, hx * 2, 0.05, hz * 2, grey);
          for (const dx of [-hx + 0.1, hx - 0.1]) for (const dz of [-hz + 0.1, hz - 0.1]) box.add(it.x + dx, 0.37, it.z + dz, 0.05, 0.74, 0.05, grey);
          for (const c of chairs(it)) chair(c.x, c.z, c.heading, grey, slat);
          break;
        }
        case 'woodTable':
          box.add(it.x, 0.74, it.z, 1.2, 0.06, 1.2, 0x6b5a48);
          box.add(it.x, 0.37, it.z, 0.18, 0.74, 0.18, 0x3b3128);
          for (const c of chairs(it)) chair(c.x, c.z, c.heading, 0x6b5a48, 0x58493a);
          break;
        case 'planter': { // a round concrete bowl of red and yellow mums
          const bowl = new Mesh(new CylinderGeometry(0.62, 0.48, 0.62, 14), lambert(0xd9d4c9));
          bowl.position.set(it.x, 0.31, it.z);
          bowl.castShadow = true;
          this.group.add(bowl);
          for (let k = 0; k < 14; k++) {
            const a = k * 2.4, rr = 0.15 + (k % 4) * 0.12;
            box.add(it.x + Math.sin(a) * rr, 0.68 + (k % 3) * 0.04, it.z + Math.cos(a) * rr, 0.22, 0.16, 0.22, k % 3 ? 0xa81c22 : 0xe8d27a, a);
          }
          box.add(it.x, 0.64, it.z, 0.9, 0.08, 0.9, 0x3d5a2f); // leaves under the flowers
          break;
        }
        case 'bollard': {
          const b = new Mesh(new CylinderGeometry(0.19, 0.21, 0.9, 10), lambert(0xc4c2bb));
          b.position.set(it.x, 0.45, it.z);
          b.castShadow = true;
          this.group.add(b);
          break;
        }
        case 'bin': {
          const b = new Mesh(new CylinderGeometry(0.28, 0.25, 0.85, 12), lambert(0x8a8f94));
          b.position.set(it.x, 0.43, it.z);
          const lid = new Mesh(new CylinderGeometry(0.3, 0.3, 0.12, 12), lambert(0x1f5fbf));
          lid.position.set(it.x, 0.9, it.z);
          this.group.add(b, lid);
          break;
        }
      }
      void hx; void hz;
    };
    const chair = (x: number, z: number, heading: number, frame: number, seat: number) => {
      // seat + back, behind the sitter (heading points at the table)
      const bx = x - Math.sin(heading) * 0.22, bz = z - Math.cos(heading) * 0.22;
      box.add(x, 0.46, z, 0.46, 0.05, 0.46, seat, heading);
      box.add(bx, 0.72, bz, 0.46, 0.46, 0.04, frame, heading);
      box.add(x, 0.23, z, 0.42, 0.46, 0.04, frame, heading);
    };
    for (const it of ITEMS) draw(it);
  }

  /** Along the back path: granite curbs, hosta beds, and up by Judd the benches, bins and a hydrant. */
  private pathSide(box: BoxBank, stops: RowStop[]) {
    const { z0, z1 } = World.backPathZ(this.crossings);
    // where walkways cross the path, the curbs and beds stop (and on the field side, where the field road goes off west)
    const walkway = (z: number) => this.crossings.some((c) => Math.abs(c.z - z) < c.w / 2 + 0.3);
    const road = (z: number) => z > FIELD_ROAD.z0 - 0.3 && z < FIELD_ROAD.z1 + 0.3;
    const spans = (open: (z: number) => boolean) => {
      const runs: [number, number][] = [];
      let start: number | null = null;
      for (let z = z0; z <= z1; z += 0.5) {
        if (!open(z) && start === null) start = z;
        if ((open(z) || z + 0.5 > z1) && start !== null) { runs.push([start, z]); start = null; }
      }
      return runs;
    };
    for (const [a, b] of spans((z) => walkway(z) || road(z))) box.add(BACK_PATH.x0, 0.07, (a + b) / 2, 0.3, 0.14, b - a, 0xb9b8b1); // curb, field side
    const items = PATH_ITEMS.map((p) => p.z);
    for (const [a, b] of spans((z) => walkway(z) || rearWalkAt(z, stops) || quadXAt(z, stops))) { // (and where the paver walks come in)
      const mid = (a + b) / 2, len = b - a;
      box.add(BACK_PATH.x1, 0.07, mid, 0.3, 0.14, len, 0xb9b8b1); // curb, building side
      box.add((BED.x0 + BED.x1) / 2, 0.04, mid, BED.x1 - BED.x0, 0.03, len, 0x4a3426); // mulch
      for (let z = a + 1; z < b - 1; z += 1.7) { // hostas, round and low
        if (items.some((iz) => Math.abs(iz - z) < 1.6)) continue;
        const k = Math.floor(rng(z * 3.1) * 3);
        box.add(BED.x0 + 0.9 + rng(z) * 0.4, 0.2, z, 0.75, 0.38, 0.75, [0x4e7a35, 0x6a8f3e, 0x3f6a32][k], rng(z * 1.7) * 3);
      }
    }
    for (const it of PATH_ITEMS) {
      if (it.kind === 'teakBench') { // facing the path (−x)
        box.add(it.x, 0.44, it.z, 0.5, 0.06, 1.8, 0x9a8a72);
        box.add(it.x + 0.24, 0.72, it.z, 0.06, 0.5, 1.8, 0x9a8a72);
        for (const d of [-0.8, 0.8]) box.add(it.x, 0.22, it.z + d, 0.5, 0.44, 0.06, 0x7d6f5c);
      } else if (it.kind === 'bigbelly') {
        box.add(it.x, 0.62, it.z, 0.72, 1.24, 0.72, 0x1c1e20);
        box.add(it.x - 0.37, 0.8, it.z, 0.02, 0.3, 0.42, 0xe9e9e4); // the label
      } else {
        box.add(it.x, 0.32, it.z, 0.24, 0.64, 0.24, 0xc8241f);
        box.add(it.x, 0.68, it.z, 0.3, 0.1, 0.3, 0xc8241f);
        box.add(it.x, 0.4, it.z, 0.42, 0.1, 0.12, 0xc8241f);
      }
    }
  }

  /** High Street: the road on the open side of the walk, with old houses across it. */
  private street(box: BoxBank) {
    const len = WALK_MIN_Z - WALK_MAX_Z + 160, midZ = (WALK_MIN_Z + WALK_MAX_Z) / 2;
    const cx = (ROAD.x0 + ROAD.x1) / 2, rw = ROAD.x1 - ROAD.x0;
    const road = new Mesh(new PlaneGeometry(rw, len), lambert(0x44484c));
    road.rotation.x = -Math.PI / 2;
    road.position.set(cx, 0.025, midZ);
    road.receiveShadow = true;
    this.group.add(road);
    box.add(ROAD.x1, 0.08, midZ, 0.25, 0.16, len, PAL.curb);
    { // the near curb, open where Church Street comes in
      const z0 = midZ - len / 2, z1 = midZ + len / 2;
      box.add(ROAD.x0, 0.08, (z0 + CHURCH.z0) / 2, 0.25, 0.16, CHURCH.z0 - z0, PAL.curb);
      box.add(ROAD.x0, 0.08, (CHURCH.z1 + z1) / 2, 0.25, 0.16, z1 - CHURCH.z1, PAL.curb);
    }
    const onCrosswalk = (z: number) => this.crossings.some((c) => Math.abs(c.z - z) < CROSSWALK_W / 2 + 1.5);
    for (let z = WALK_MIN_Z + 70; z > WALK_MAX_Z - 70; z -= 6) if (!onCrosswalk(z)) box.add(cx, 0.035, z, 0.14, 0.02, 3, 0xe8c14a);
    // bike lane lines
    for (const x of [ROAD.x0 + 1.6, ROAD.x1 - 1.6]) box.add(x, 0.033, midZ, 0.1, 0.02, len, 0xe8e4da);
    // zebra crosswalks where each walkway meets the road, stop bars before them
    for (const c of this.crossings) {
      for (let x = ROAD.x0 + 0.6; x < ROAD.x1 - 0.3; x += 1.1) box.add(x, 0.036, c.z, 0.55, 0.02, CROSSWALK_W, 0xf2f0ea);
      box.add((ROAD.x0 + cx) / 2, 0.036, c.z - CROSSWALK_W / 2 - 1.1, cx - ROAD.x0, 0.02, 0.35, 0xf2f0ea);
      box.add((ROAD.x1 + cx) / 2, 0.036, c.z + CROSSWALK_W / 2 + 1.1, ROAD.x1 - cx, 0.02, 0.35, 0xf2f0ea);
    }
    // the far sidewalk
    const far = new Mesh(new PlaneGeometry(FAR_WALK.x1 - FAR_WALK.x0, len), lambert(PAL.path));
    far.rotation.x = -Math.PI / 2;
    far.position.set((FAR_WALK.x0 + FAR_WALK.x1) / 2, 0.03, midZ);
    far.receiveShadow = true;
    this.group.add(far);
    // clapboard houses, gable ends to the street
    const paints = [0xf1ead9, 0xd9dcd6, 0xe8dcb4, 0xb9c4c9, 0xf1ead9, 0x9fb0a0];
    const roof = lambert(PAL.slate);
    let id = 900;
    for (let z = WALK_MIN_Z + 10; z > WALK_MAX_Z - 20; z -= 24) {
      if (Math.abs(z - HOUSE.zc) < 22) { id += 7; continue; } // that lot is yours (house/)
      const w = 10 + rng(id) * 3, d = 12, h = 6.5 + rng(id + 1) * 2.5, x = FAR_WALK.x1 + 10.5 + rng(id + 2) * 3;
      box.add(x, h / 2, z, d, h, w, paints[Math.floor(rng(id + 3) * paints.length)]);
      for (const fy of [2, h - 2]) for (const fz of [-w / 4, w / 4]) box.add(x - d / 2 - 0.05, fy, z + fz, 0.1, 1.5, 1, 0x2a3036);
      box.add(x - d / 2 - 0.9, 0.3, z, 1.8, 0.6, 2.4, 0xd8d2c4); // porch step
      const r = new Mesh(prism(w + 0.6, 4, d + 0.8), roof);
      r.rotation.y = Math.PI / 2;
      r.position.set(x, h, z);
      r.castShadow = true;
      this.group.add(r);
      id += 7;
    }
  }

  /** Where the coal-tar path behind the row starts (by Usdan, at the Boger–South walkway) and ends. */
  static backPathZ(crossings: Crossing[]) {
    const byUsdan = crossings[crossings.length - 1]; // the Boger–South walkway
    return { z0: byUsdan.z - byUsdan.w / 2, z1: ALLBRITTON.z0 }; // past Judd and the field road, it ends at Allbritton
  }

  /** Behind the row: a wide coal-tar path — no lines, no curbs, just students walking back from class. */
  private backPath(stops: RowStop[]) {
    const { z0, z1 } = World.backPathZ(this.crossings);
    const tar = lambert(0x3b3e41);
    const strip = (x0: number, x1: number, za: number, zb: number, mat = tar) => {
      const m = new Mesh(new PlaneGeometry(x1 - x0, zb - za), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set((x0 + x1) / 2, 0.027, (za + zb) / 2);
      m.receiveShadow = true;
      this.group.add(m);
    };
    strip(BACK_PATH.x0, BACK_PATH.x1, z0, z1);
    // worn, patched tar: a few lighter and darker patches
    for (let i = 0; i < 18; i++) {
      const z = z0 + rng(i * 3 + 400) * (z1 - z0), x = BACK_PATH.x0 + 0.8 + rng(i * 3 + 401) * (BACK_PATH.x1 - BACK_PATH.x0 - 1.6);
      const w = 0.8 + rng(i * 3 + 402) * 1.6;
      const m = new Mesh(new PlaneGeometry(w, w * 1.6), lambert(i % 2 ? 0x46494c : 0x333638));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.029, z);
      this.group.add(m);
    }
    // and a narrow one between Boger and Usdan, up toward Wyllys Ave
    const boger = stops.find((s) => s.id === 'boger');
    if (boger) strip(boger.back - 3.2, boger.back - 0.6, boger.z1 - 12, boger.z0 + 2, lambert(PAL.path));
  }

  /** Behind North College, South College and Judd: interlocking pavers along each back wall and out to the path. */
  private rearLawn(stops: RowStop[], box: BoxBank) {
    const mat = new MeshLambertMaterial({ map: paverMap() });
    const lay = (b: { x0: number; x1: number; z0: number; z1: number }, y: number) => {
      const w = b.x1 - b.x0, l = b.z1 - b.z0;
      const geo = new PlaneGeometry(w, l);
      const uv = geo.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / PAVER_TILE, (uv.getY(i) * l) / PAVER_TILE); // 1 tile = PAVER_TILE m
      const m = new Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set((b.x0 + b.x1) / 2, y, (b.z0 + b.z1) / 2);
      m.receiveShadow = true;
      this.group.add(m);
    };
    const edge = 0x8f8a80; // a soldier course of darker pavers along the edges
    for (const a of aprons(stops)) {
      lay(a, 0.033);
      box.add(a.x0 + 0.1, 0.035, (a.z0 + a.z1) / 2, 0.2, 0.02, a.z1 - a.z0, edge);
    }
    for (const w of rearWalks(stops)) {
      lay(w, 0.034);
      for (const z of [w.z0 + 0.1, w.z1 - 0.1]) box.add((w.x0 + w.x1) / 2, 0.036, z, w.x1 - w.x0, 0.02, 0.2, edge);
    }
    // the X of concrete walks across the lawn between South and North College, and the walk between Judd and the
    // chapel (each run on a metre at each end, under the
    // College Row walk and the back path's tar, so the cut ends never show)
    const concrete = lambert(0xc8c4ba);
    lawnWalks(stops).forEach((sg, i) => {
      const dx = sg.b.x - sg.a.x, dz = sg.b.z - sg.a.z, L = Math.hypot(dx, dz);
      const m = new Mesh(new PlaneGeometry(sg.w, L + 2), concrete);
      m.rotation.set(-Math.PI / 2, 0, Math.atan2(dx, dz)); // the plane's length (its y) along the walk
      m.position.set((sg.a.x + sg.b.x) / 2, 0.022 + i * 0.002, (sg.a.z + sg.b.z) / 2);
      m.receiveShadow = true;
      this.group.add(m);
    });
  }

  /** The lawn in front of the row (frontlawn.ts): the sidewalk along High Street, the walks across, benches beside them. */
  private frontLawn(stops: RowStop[], box: BoxBank) {
    const len = WALK_MIN_Z - WALK_MAX_Z + 160, midZ = (WALK_MIN_Z + WALK_MAX_Z) / 2;
    const side = new Mesh(new PlaneGeometry(NEAR_WALK.x1 - NEAR_WALK.x0, len), lambert(PAL.path));
    side.rotation.x = -Math.PI / 2;
    side.position.set((NEAR_WALK.x0 + NEAR_WALK.x1) / 2, 0.03, midZ);
    side.receiveShadow = true;
    this.group.add(side);
    const concrete = lambert(0xc8c4ba);
    frontWalks(stops).forEach((wk, i) => {
      const dx = wk.b.x - wk.a.x, dz = wk.b.z - wk.a.z, L = Math.hypot(dx, dz);
      const m = new Mesh(new PlaneGeometry(wk.w, L + 1.5), concrete);
      m.rotation.set(-Math.PI / 2, 0, Math.atan2(dx, dz));
      m.position.set((wk.a.x + wk.b.x) / 2, 0.024 + i * 0.001, (wk.a.z + wk.b.z) / 2);
      m.receiveShadow = true;
      this.group.add(m);
    });
    for (const b of frontBenches(stops)) { // a slatted wooden bench on iron ends, along the walk
      const c = Math.cos(b.rot), sn = Math.sin(b.rot);
      box.add(b.x, 0.46, b.z, 0.5, 0.08, 1.9, PAL.wood, b.rot);
      box.add(b.x - c * 0.24, 0.78, b.z + sn * 0.24, 0.08, 0.5, 1.9, PAL.wood, b.rot);
      for (const d of [-0.8, 0.8]) box.add(b.x + sn * d, 0.22, b.z + c * d, 0.5, 0.44, 0.08, PAL.iron, b.rot);
      this.obstacles.push({ x0: b.x - 0.8, x1: b.x + 0.8, z0: b.z - 0.8, z1: b.z + 0.8 }); // (roughly: it may be turned)
    }
  }

  private walks(stops: RowStop[]) {
    const len = WALK_MIN_Z - WALK_MAX_Z + 60;
    const midZ = (WALK_MIN_Z + WALK_MAX_Z) / 2;
    const path = new Mesh(new PlaneGeometry(PATH_HALF * 2, len), lambert(PAL.path));
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.03, midZ);
    path.receiveShadow = true;
    this.group.add(path);
    for (const side of [-1, 1]) {
      const curb = new Mesh(new PlaneGeometry(0.25, len), lambert(PAL.curb));
      curb.rotation.x = -Math.PI / 2;
      curb.position.set(side * (PATH_HALF + 0.12), 0.035, midZ);
      curb.receiveShadow = true;
      this.group.add(curb);
    }
    // walkways that cut across the row, from between the buildings to the back sidewalk
    for (const c of this.crossings) {
      // from the field, across the back path, to the High Street curb (where the field road carries on, it's tar from the back path)
      const tar = c.z + c.w / 2 > FIELD_ROAD.z0; // the one south of Judd is tar, like the field road it runs into
      const x0 = tar ? BACK_PATH.x1 : BACK_PATH.x0 - 6, x1 = ROAD.x0;
      const cr = new Mesh(new PlaneGeometry(x1 - x0, c.w), lambert(tar ? 0x3b3e41 : PAL.path));
      cr.rotation.x = -Math.PI / 2;
      cr.position.set((x0 + x1) / 2, 0.031, c.z);
      cr.receiveShadow = true;
      this.group.add(cr);
    }
    // a short walk up to each front door
    for (const s of stops) {
      const w = -PATH_HALF - s.front;
      const spur = new Mesh(new PlaneGeometry(w, 2.6), lambert(PAL.path));
      spur.rotation.x = -Math.PI / 2;
      spur.position.set(s.front + w / 2, 0.032, s.doorZ);
      spur.receiveShadow = true;
      this.group.add(spur);
    }
  }

  private trees(stops: RowStop[]) {
    type T = { x: number; z: number; s: number; id: number };
    const list: T[] = [];
    let id = 1;
    const nearDoor = (z: number) => stops.some((s) => Math.abs(s.doorZ - z) < (s.id === 'north' ? 9.5 : 3.4)) // (North College's portico is wide)
      || this.crossings.some((c) => Math.abs(c.z - z) < c.w / 2 + 2.5);
    // lawn trees between the walk and the facades
    for (let z = WALK_MIN_Z; z > WALK_MAX_Z; z -= 11) {
      const j = rng(id);
      const zz = z - j * 6;
      if (!nearDoor(zz)) list.push({ x: -9.5 + (rng(id + 3) - 0.5) * 3, z: zz, s: 0.9 + rng(id + 5) * 0.5, id: id++ });
      else id++;
    }
    // street trees along the walk's lawn edge, and the big old trees out on the lawn between it and High Street
    for (let z = WALK_MIN_Z - 4; z > WALK_MAX_Z; z -= 17) {
      if (nearDoor(z) || frontWalkDist({ x: 6.8, z }, frontWalks(stops), this.crossings) < 3) continue;
      list.push({ x: 6.8 + rng(id) * 1.5, z: z - rng(id + 1) * 4, s: 1.2 + rng(id + 2) * 0.4, id: id++ });
    }
    for (const t of frontTrees(stops, this.crossings)) list.push({ ...t, id: id++ });
    // lining the field side of the back road, peeking over the rooftops from the walk
    for (let z = FIELD_ROAD.z0 - 3; z > WALK_MAX_Z - 40; z -= 9) { // (the back path stops at the field road)
      if (nearDoor(z)) continue;
      list.push({ x: BACK_PATH.x0 - 2.6 - rng(id) * 3, z: z - rng(id + 1) * 6, s: 1.6 + rng(id + 2) * 0.8, id: id++ });
    }
    // far side of Andrus Field, across High Street, and the two ends
    for (let z = WALK_MIN_Z + 30; z > WALK_MAX_Z - 60; z -= 7) {
      list.push({ x: FIELD_X - 160 - rng(id) * 30, z: z - rng(id + 1) * 5, s: 1.6 + rng(id + 2) * 0.9, id: id++ });
    }
    for (let z = WALK_MIN_Z + 20; z > WALK_MAX_Z - 40; z -= 13) {
      const tz = z - rng(id + 1) * 6;
      const yard = Math.max(...DRIVEWAYS.map((d) => Math.max(-d.v0, d.v1))) + 3; // not in your front yard or the driveways
      if (Math.abs(tz - HOUSE.zc) > yard) list.push({ x: FAR_WALK.x1 + 2.5 + rng(id) * 4, z: tz, s: 1.3 + rng(id + 2) * 0.6, id });
      id++;
      list.push({ x: FAR_WALK.x1 + 24.5 + rng(id + 3) * 20, z: z - rng(id + 4) * 6, s: 1.6 + rng(id + 5) * 0.8, id: id++ });
    }
    for (let x = -240; x < 70; x += 8) {
      list.push({ x: x + rng(id) * 4, z: WALK_MAX_Z - 50 - rng(id + 1) * 20, s: 1.6 + rng(id + 2), id: id++ });
      list.push({ x: x + rng(id + 3) * 4, z: CHURCH_WALK_S.z1 + 6 + rng(id + 4) * 20, s: 1.6 + rng(id + 5), id: id++ }); // (across Church Street)
    }

    // along the field road's south verge, west of the bank; and a few up on the bank round the Frank Center and Olin
    for (let x = BERM.x0 - 4; x > FIELD_ROAD.x0 + 6; x -= 13) list.push({ x: x - rng(id) * 4, z: FIELD_ROAD.z1 + 3 + rng(id + 1) * 3, s: 1.5 + rng(id + 2) * 0.6, id: id++ });
    // the open lawn south of Judd, past the walkway, beside Allbritton
    for (const [x, z, s] of [[-18, 50, 1.6], [-28, 56, 1.8], [-14, 62, 1.5], [-30, 47, 1.3]]) list.push({ x, z, s, id: id++ });
    for (const [x, z, s] of [[-101, 40, 1.9], [-101, 58, 1.7], [-66, 56, 1.4]]) list.push({ x, z, s, id: id++ });
    for (const [i, t] of OLIN_TREES.entries()) list.push({ x: t.x, z: t.z, s: 2.0 + (i % 3) * 0.25, id: id++ }); // the big old trees on Olin's lawn

    const clear = (t: T) => inUsdan(t, 3) || inPlaza(t) || inSouthEnd(t, 3) || onQuadX(t, stops, 1.6) || zelnickSolids(2).some((b) => t.x > b.x0 && t.x < b.x1 && t.z > b.z0 && t.z < b.z1)
      || (t.z > FIELD_ROAD.z0 - 1.5 && t.z < FIELD_ROAD.z1 + 1.5 && t.x < FIELD_ROAD.x1 + 8) // not in the road
      || (bankY(t.x, t.z) > 0.02 && bankY(t.x, t.z) < 1.98); // nor on the slope of the bank
    for (let i = list.length - 1; i >= 0; i--) if (clear(list[i]) || (list[i].x > EXLEY_SITE.x0 - 4 && list[i].x < SCI.x1 + 6 && list[i].z > CHURCH_WALK_S.z1 && list[i].z < EXLEY_SITE.z1 + 4)) list.splice(i, 1); // (and none of the background trees on Exley's site) // not in Usdan, on the plaza, or in the way
    for (const [i, t] of SCI_TREES.entries()) list.push({ x: t.x, z: t.z, s: 1.2 + (i % 2) * 0.2, id: id++ }); // young trees by the science building
    for (const [i, t] of SHANK_TREES.entries()) list.push({ x: t.x, z: t.z, s: 1.9 + (i % 2) * 0.3, id: id++ }); // by Shanklin
    for (const [i, t] of EXLEY_TREES.entries()) list.push({ x: t.x, z: t.z, s: 2.1 + (i % 2) * 0.3, id: id++ }); // the big trees on Exley's lawn (after the clearing)
    // a few small ones on the lawns behind the row
    for (const t of BACK_TREES) list.push({ ...t, id: id++ });
    // the plaza's own trees, in their pits
    for (const it of ITEMS) if (it.kind === 'tree') list.push({ x: it.x, z: it.z, s: it.size ?? 1.1, id: id++ });

    // early-fall Connecticut: mostly green, some already turning
    const leaves = [0x5a9a38, 0x4a8a30, 0x6aa840, 0x5a9a38, 0x4a8a30, 0xd9a032, 0xd9782b, 0xb8452a, 0xe6c147];
    const trunkGeo = new CylinderGeometry(0.2, 0.32, 1, 6).translate(0, 0.5, 0);
    const blobGeo = new IcosahedronGeometry(1, 0);
    const trunks = new InstancedMesh(trunkGeo, lambert(PAL.wood), list.length);
    const blobs = new InstancedMesh(blobGeo, new MeshLambertMaterial({ color: 0xffffff, flatShading: true }), list.length * 3);
    const m4 = new Matrix4(), q = new Quaternion(), v = new Vector3(), sc = new Vector3();
    let bi = 0;
    list.forEach((t, i) => {
      const trunkH = 2.6 * t.s;
      const r = 0.3 * t.s + 0.3; // trunk radius + yours
      this.obstacles.push({ x0: t.x - r, x1: t.x + r, z0: t.z - r, z1: t.z + r });
      const y = groundY(t.x, t.z); // (up on the bank by Olin)
      m4.compose(v.set(t.x, y, t.z), q.identity(), sc.set(t.s, trunkH, t.s));
      trunks.setMatrixAt(i, m4);
      const col = new Color(leaves[Math.floor(rng(t.id * 13) * leaves.length)]);
      for (let k = 0; k < 3; k++) {
        const r = (2.1 - k * 0.45) * t.s;
        const ox = (rng(t.id * 5 + k) - 0.5) * 1.6 * t.s;
        const oz = (rng(t.id * 9 + k) - 0.5) * 1.6 * t.s;
        q.setFromAxisAngle(v.set(0, 1, 0), rng(t.id + k) * 3);
        m4.compose(v.set(t.x + ox, y + trunkH + r * 0.6 + k * 1.1 * t.s, t.z + oz), q, sc.set(r, r * 0.85, r));
        blobs.setMatrixAt(bi, m4);
        blobs.setColorAt(bi, col.clone().multiplyScalar(0.9 + k * 0.08));
        bi++;
      }
    });
    for (const m of [trunks, blobs]) { m.castShadow = true; m.receiveShadow = true; this.group.add(m); }
  }

  /** Lamp spots: short heritage lamps along the walk, tall arm lamps over High Street. */
  static lampSpots(): Lamp[] {
    const spots: Lamp[] = [];
    for (let z = WALK_MIN_Z - 6; z > WALK_MAX_Z; z -= 24) {
      spots.push({ x: -PATH_HALF - 0.7, z, h: 4, arm: 0 }, { x: PATH_HALF + 0.7, z: z - 12, h: 4, arm: 0 });
    }
    // the back path: heritage lamps along both edges
    for (let z = ALLBRITTON.z0 - 3; z > WALK_MAX_Z - 20; z -= 22) {
      spots.push({ x: BACK_PATH.x1 + 0.5, z, h: 4, arm: 0 }, { x: BACK_PATH.x0 - 0.5, z: z - 11, h: 4, arm: 0 });
    }
    // the field road: heritage lamps on its south side (the field's fence is on the other), one on the corner by the stairs
    spots.push({ x: BACK_PATH.x0 - 5.5, z: FIELD_ROAD.z1 + 0.6, h: 4, arm: 0 });
    for (let x = -72; x > FIELD_ROAD.x0 + 4; x -= 22) spots.push({ x, z: FIELD_ROAD.z1 + 0.6, h: 4, arm: 0 });
    for (let z = WALK_MIN_Z + 40; z > WALK_MAX_Z - 40; z -= 30) {
      // never in the mouth of a driveway: slide it along to just beside one
      let fz = z - 15;
      const drive = DRIVEWAYS.find((d) => fz > HOUSE.zc + d.v0 - 1.5 && fz < HOUSE.zc + d.v1 + 1.5);
      if (drive) fz = HOUSE.zc + (fz > HOUSE.zc + (drive.v0 + drive.v1) / 2 ? drive.v1 + 1.6 : drive.v0 - 1.6);
      spots.push({ x: ROAD.x0 - 0.5, z, h: 7.5, arm: 2.6 }, { x: ROAD.x1 + 0.5, z: fz, h: 7.5, arm: -2.6 });
    }
    return spots.filter((l) => !inUsdan(l, 2) && !inSouthEnd(l, 2) && bankY(l.x, l.z) < 0.05); // nothing inside a building or up the bank
  }

  private lamps() {
    const spots = (this.spots = World.lampSpots());
    for (const l of this.lampLights) this.group.add(l);
    const unitPost = new CylinderGeometry(0.07, 0.1, 1, 6).translate(0, 0.5, 0);
    const posts = new InstancedMesh(unitPost, lambert(PAL.iron), spots.length);
    const arms = new InstancedMesh(new BoxGeometry(1, 0.1, 0.1), lambert(PAL.iron), spots.length);
    this.lampHeads = new InstancedMesh(new BoxGeometry(0.34, 0.5, 0.34), new MeshBasicMaterial({ color: 0xffffff }), spots.length);
    const m4 = new Matrix4(), q = new Quaternion(), v = new Vector3(), sc = new Vector3();
    spots.forEach((l, i) => {
      const r = l.h > 5 ? 1.5 : 1; // tall lamps: thicker post, bigger head
      const pr = 0.1 * r + 0.3;
      this.obstacles.push({ x0: l.x - pr, x1: l.x + pr, z0: l.z - pr, z1: l.z + pr });
      posts.setMatrixAt(i, m4.compose(v.set(l.x, 0, l.z), q, sc.set(r, l.h, r)));
      arms.setMatrixAt(i, m4.compose(v.set(l.x + l.arm / 2, l.h - 0.05, l.z), q, sc.set(Math.abs(l.arm) || 0.001, 1, 1)));
      this.lampHeads.setMatrixAt(i, m4.compose(v.set(l.x + l.arm, l.h - (l.arm ? 0.25 : 0), l.z), q, sc.set(r * (l.arm ? 1.6 : 1), l.arm ? 0.4 : 1, r)));
      this.lampHeads.setColorAt(i, new Color(0x9aa0a0));
    });
    this.lampHeads.instanceColor!.setUsage(DynamicDrawUsage);
    posts.castShadow = true;
    arms.castShadow = true;
    this.group.add(posts, arms, this.lampHeads);

    // glow halo + warm pool on the ground, both invisible by day
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d')!;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,220,160,1)');
    grd.addColorStop(0.35, 'rgba(255,200,130,.35)');
    grd.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const tex = new CanvasTexture(cv);
    this.glowMat = new SpriteMaterial({ map: tex, blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
    this.poolMat = new MeshBasicMaterial({ map: tex, blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
    const pools = new InstancedMesh(new CircleGeometry(1, 20).rotateX(-Math.PI / 2), this.poolMat, spots.length);
    spots.forEach((l, i) => {
      const s = new Sprite(this.glowMat);
      const hx = l.x + l.arm, hy = l.h - (l.arm ? 0.25 : 0);
      s.position.set(hx, hy, l.z);
      s.scale.setScalar(l.h > 5 ? 3.4 : 2.6);
      this.glows.push(s);
      this.group.add(s);
      const pr = l.h > 5 ? 8 : 5.2;
      pools.setMatrixAt(i, m4.compose(v.set(hx, 0.05, l.z), q, sc.set(pr, 1, pr)));
    });
    pools.renderOrder = 2;
    this.group.add(pools);
  }

  private benchesAlongLawn(box: BoxBank) {
    for (let z = WALK_MIN_Z - 18; z > WALK_MAX_Z; z -= 32) {
      const x = -PATH_HALF - 1.5;
      if (this.crossings.some((c) => Math.abs(c.z - z) < c.w / 2 + 1.5)) continue;
      box.add(x, 0.46, z, 0.5, 0.08, 1.9, PAL.wood); // seat
      box.add(x - 0.24, 0.78, z, 0.08, 0.5, 1.9, PAL.wood); // back
      for (const dz of [-0.8, 0.8]) box.add(x, 0.22, z + dz, 0.5, 0.44, 0.08, PAL.iron);
      this.benches.push({ x, z });
      this.obstacles.push({ x0: x - 0.3 - 0.3, x1: x + 0.25 + 0.3, z0: z - 0.95 - 0.3, z1: z + 0.95 + 0.3 });
    }
  }

  /** Lamps on at dusk. */
  setNight(night: number) {
    const on = Math.min(1, Math.max(0, (night - 0.25) / 0.5));
    const c = new Color(0x9aa0a0).lerp(new Color(0xffe2a8), on);
    for (let i = 0; i < this.lampHeads.count; i++) this.lampHeads.setColorAt(i, c);
    this.lampHeads.instanceColor!.needsUpdate = true;
    this.glowMat.opacity = on;
    this.poolMat.opacity = on * 0.7;
    this.lampOn = on;
  }

  /** Put the real lamp lights on the lamps nearest `p`. Cheap enough to call every few frames. */
  lightNear(p: { x: number; z: number }) {
    const near = [...this.spots]
      .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))
      .slice(0, this.lampLights.length);
    near.forEach((l, i) => {
      const light = this.lampLights[i];
      light.position.set(l.x + l.arm, l.h - 0.6, l.z);
      light.intensity = this.lampOn * (l.h > 5 ? 30 : 14);
    });
  }
}
