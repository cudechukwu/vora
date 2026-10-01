import {
  AdditiveBlending, CanvasTexture, CircleGeometry, Color, CylinderGeometry, DynamicDrawUsage, Group,
  IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry,
  Quaternion, RepeatWrapping, SRGBColorSpace, Sprite, SpriteMaterial, Vector3, BoxGeometry, Float32BufferAttribute,
} from 'three';
import { BoxBank, PAL, lambert, prism } from './kit';
import type { Box } from './collide';
import {
  CROSSWALK_W, Crossing, FAR_WALK, FRONT_X, PATH_HALF, ROAD, RowStop, WALK_MAX_Z, WALK_MIN_Z,
} from './layout';
import { noise2, rng } from '../noise';
import { DRIVEWAYS, HOUSE } from './house/plan';

// ─── The ground around the row ─────────────────────────────────────────
// Lawn in front of the buildings, the walk, a tree line along the field
// between the walk and High Street, and Andrus Field *behind* the row:
// football field and stands behind the chapel, ball diamond beyond —
// glimpsed through the walkways between buildings.


export interface Bench { x: number; z: number }
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

  constructor(stops: RowStop[], private crossings: Crossing[], box: BoxBank) {
    const chapel = stops.find((s) => s.name === 'Memorial Chapel');
    this.ground();
    this.field(chapel ? chapel.doorZ : -60, box);
    this.walks(stops);
    this.street(box);
    this.trees(stops);
    this.lamps();
    this.benchesAlongLawn(box);
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
    const len = WALK_MIN_Z - WALK_MAX_Z + 40, wid = 150;
    tex.repeat.set(1, len / 10);
    const f = new Mesh(new PlaneGeometry(wid, len), new MeshLambertMaterial({ map: tex }));
    f.rotation.x = -Math.PI / 2;
    f.position.set(-(55 + wid / 2), 0.01, (WALK_MIN_Z + WALK_MAX_Z) / 2);
    f.receiveShadow = true;
    this.group.add(f);

    this.football(fz, box);

    // ball diamond, beyond the stands
    const dz = fz - 20, dx = -172;
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
    const W = 49, L = 110, cx = -(62 + W / 2);
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
    box.add(sx - 6.8, 5.6, fz, 2.4, 2.4, 10, 0xe8e2d4); // press box
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
    for (const x of [ROAD.x0, ROAD.x1]) box.add(x, 0.08, midZ, 0.25, 0.16, len, PAL.curb);
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
      const w = 10 + rng(id) * 3, d = 12, h = 6.5 + rng(id + 1) * 2.5, x = 34 + rng(id + 2) * 3;
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
    // walkways that cut across the row, from between the buildings out to the field
    for (const c of this.crossings) {
      const x0 = FRONT_X - 45, x1 = ROAD.x0; // from Andrus Field to the High Street curb
      const cr = new Mesh(new PlaneGeometry(x1 - x0, c.w), lambert(PAL.path));
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
    const nearDoor = (z: number) => stops.some((s) => Math.abs(s.doorZ - z) < 3.4)
      || this.crossings.some((c) => Math.abs(c.z - z) < c.w / 2 + 2.5);
    // lawn trees between the walk and the facades
    for (let z = WALK_MIN_Z; z > WALK_MAX_Z; z -= 11) {
      const j = rng(id);
      const zz = z - j * 6;
      if (!nearDoor(zz)) list.push({ x: -9.5 + (rng(id + 3) - 0.5) * 3, z: zz, s: 0.9 + rng(id + 5) * 0.5, id: id++ });
      else id++;
    }
    // street trees between the walk and High Street — this is what makes it a "walk"
    for (let z = WALK_MIN_Z - 4; z > WALK_MAX_Z; z -= 17) {
      if (nearDoor(z)) continue;
      list.push({ x: 6.8 + rng(id) * 1.5, z: z - rng(id + 1) * 4, s: 1.2 + rng(id + 2) * 0.4, id: id++ });
    }
    // behind the buildings, peeking over rooftops
    for (let z = WALK_MIN_Z; z > WALK_MAX_Z - 40; z -= 9) {
      if (nearDoor(z)) continue;
      list.push({ x: FRONT_X - 36 - rng(id) * 6, z: z - rng(id + 1) * 6, s: 1.6 + rng(id + 2) * 0.8, id: id++ });
    }
    // far side of Andrus Field, across High Street, and the two ends
    for (let z = WALK_MIN_Z + 30; z > WALK_MAX_Z - 60; z -= 7) {
      list.push({ x: -215 - rng(id) * 30, z: z - rng(id + 1) * 5, s: 1.6 + rng(id + 2) * 0.9, id: id++ });
    }
    for (let z = WALK_MIN_Z + 20; z > WALK_MAX_Z - 40; z -= 13) {
      const tz = z - rng(id + 1) * 6;
      const yard = Math.max(...DRIVEWAYS.map((d) => Math.max(-d.v0, d.v1))) + 3; // not in your front yard or the driveways
      if (Math.abs(tz - HOUSE.zc) > yard) list.push({ x: 26 + rng(id) * 4, z: tz, s: 1.3 + rng(id + 2) * 0.6, id });
      id++;
      list.push({ x: 48 + rng(id + 3) * 20, z: z - rng(id + 4) * 6, s: 1.6 + rng(id + 5) * 0.8, id: id++ });
    }
    for (let x = -240; x < 70; x += 8) {
      list.push({ x: x + rng(id) * 4, z: WALK_MAX_Z - 50 - rng(id + 1) * 20, s: 1.6 + rng(id + 2), id: id++ });
      list.push({ x: x + rng(id + 3) * 4, z: WALK_MIN_Z + 45 + rng(id + 4) * 20, s: 1.6 + rng(id + 5), id: id++ });
    }

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
      m4.compose(v.set(t.x, 0, t.z), q.identity(), sc.set(t.s, trunkH, t.s));
      trunks.setMatrixAt(i, m4);
      const col = new Color(leaves[Math.floor(rng(t.id * 13) * leaves.length)]);
      for (let k = 0; k < 3; k++) {
        const r = (2.1 - k * 0.45) * t.s;
        const ox = (rng(t.id * 5 + k) - 0.5) * 1.6 * t.s;
        const oz = (rng(t.id * 9 + k) - 0.5) * 1.6 * t.s;
        q.setFromAxisAngle(v.set(0, 1, 0), rng(t.id + k) * 3);
        m4.compose(v.set(t.x + ox, trunkH + r * 0.6 + k * 1.1 * t.s, t.z + oz), q, sc.set(r, r * 0.85, r));
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
    for (let z = WALK_MIN_Z + 40; z > WALK_MAX_Z - 40; z -= 30) {
      // never in the mouth of a driveway: slide it along to just beside one
      let fz = z - 15;
      const drive = DRIVEWAYS.find((d) => fz > HOUSE.zc + d.v0 - 1.5 && fz < HOUSE.zc + d.v1 + 1.5);
      if (drive) fz = HOUSE.zc + (fz > HOUSE.zc + (drive.v0 + drive.v1) / 2 ? drive.v1 + 1.6 : drive.v0 - 1.6);
      spots.push({ x: ROAD.x0 - 0.5, z, h: 7.5, arm: 2.6 }, { x: ROAD.x1 + 0.5, z: fz, h: 7.5, arm: -2.6 });
    }
    return spots;
  }

  private lamps() {
    const spots = World.lampSpots();
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
      const pr = l.h > 5 ? 6.5 : 4.2;
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
    this.glowMat.opacity = on * 0.95;
    this.poolMat.opacity = on * 0.55;
  }
}
