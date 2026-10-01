import {
  AdditiveBlending, BoxGeometry, CanvasTexture, Color, CylinderGeometry, Group, Mesh, MeshBasicMaterial,
  PlaneGeometry, Sprite, SpriteMaterial,
} from 'three';
import { lambert, PAL } from './kit';
import { CROSSWALK_W, Crossing, ROAD } from './layout';
import { Person, randomLook } from './people';
import { LANES, Light, TrafficState, Vehicle, lightAt } from './traffic';

// ─── Drawing High Street ───────────────────────────────────────────────
// Meshes for the vehicles + traffic signals, driven by traffic.ts state.

const wheelGeo = new CylinderGeometry(0.34, 0.34, 0.26, 10).rotateZ(Math.PI / 2);
const bikeWheelGeo = new CylinderGeometry(0.34, 0.34, 0.05, 14).rotateZ(Math.PI / 2);
const tyre = lambert(0x151515);

function glowTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

interface Drawn { v: Vehicle; root: Group; rider?: Person; wheels: Mesh[] }

export class Traffic {
  readonly group = new Group();
  private drawn: Drawn[] = [];
  private head = new MeshBasicMaterial({ color: 0xdedbd0 });
  private tail = new MeshBasicMaterial({ color: 0x5a1512 });
  private beamMat: MeshBasicMaterial;
  private haloMat: SpriteMaterial;
  private tailHaloMat: SpriteMaterial;
  private sig: Record<Light, MeshBasicMaterial> = {
    red: new MeshBasicMaterial(), yellow: new MeshBasicMaterial(), green: new MeshBasicMaterial(),
  };
  private walkSig = new MeshBasicMaterial();
  private night = 0;
  private lastLight: Light | null = null;

  constructor(private state: TrafficState) {
    const tex = glowTexture();
    this.beamMat = new MeshBasicMaterial({ map: tex, color: 0xffe6b0, blending: AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 });
    this.haloMat = new SpriteMaterial({ map: tex, color: 0xfff0d0, blending: AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 });
    this.tailHaloMat = new SpriteMaterial({ map: tex, color: 0xff3020, blending: AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 });
    for (const v of state.vehicles) this.drawn.push(this.build(v));
    for (const c of state.crossings) this.signal(c);
  }

  private lights(root: Group, halfW: number, front: number, back: number, y: number) {
    for (const s of [-1, 1]) {
      const h = new Mesh(new BoxGeometry(0.34, 0.16, 0.06), this.head);
      h.position.set(s * halfW, y, front);
      const t = new Mesh(new BoxGeometry(0.3, 0.14, 0.06), this.tail);
      t.position.set(s * halfW, y, back);
      const halo = new Sprite(this.haloMat);
      halo.position.set(s * halfW, y, front + 0.1);
      halo.scale.set(1.1, 1.1, 1);
      const th = new Sprite(this.tailHaloMat);
      th.position.set(s * halfW, y, back - 0.1);
      th.scale.set(0.7, 0.7, 1);
      root.add(h, t, halo, th);
    }
    // light thrown on the road ahead
    const beam = new Mesh(new PlaneGeometry(3.2, 9).rotateX(-Math.PI / 2), this.beamMat);
    beam.position.set(0, 0.06, front + 4.8);
    beam.renderOrder = 2;
    root.add(beam);
  }

  private build(v: Vehicle): Drawn {
    const root = new Group();
    const wheels: Mesh[] = [];
    const wheel = (x: number, z: number, geo = wheelGeo) => {
      const w = new Mesh(geo, tyre);
      w.position.set(x, 0.34, z);
      wheels.push(w);
      root.add(w);
    };
    let rider: Person | undefined;
    if (v.kind === 'car') {
      const body = new Mesh(new BoxGeometry(1.9, 0.72, v.len), lambert(v.color));
      body.position.y = 0.62;
      const cabin = new Mesh(new BoxGeometry(1.72, 0.62, 2.3), lambert(0x2a333a));
      cabin.position.set(0, 1.28, -0.2);
      const roof = new Mesh(new BoxGeometry(1.74, 0.08, 2.0), lambert(v.color));
      roof.position.set(0, 1.62, -0.25);
      root.add(body, cabin, roof);
      for (const x of [-0.9, 0.9]) for (const z of [-1.4, 1.4]) wheel(x, z);
      this.lights(root, 0.66, v.len / 2 + 0.02, -v.len / 2 - 0.02, 0.72);
    } else if (v.kind === 'truck') {
      const cab = new Mesh(new BoxGeometry(2.2, 2.1, 2.1), lambert(v.color));
      cab.position.set(0, 1.35, v.len / 2 - 1.05);
      const glass = new Mesh(new BoxGeometry(2.0, 0.7, 0.05), lambert(0x2a333a));
      glass.position.set(0, 1.9, v.len / 2 + 0.01);
      const box = new Mesh(new BoxGeometry(2.4, 2.8, v.len - 2.4), lambert(0xe8e4da));
      box.position.set(0, 1.9, -1.2);
      root.add(cab, glass, box);
      for (const x of [-1.0, 1.0]) for (const z of [v.len / 2 - 1.2, -1.4, -v.len / 2 + 1.1]) wheel(x, z);
      this.lights(root, 0.8, v.len / 2 + 0.02, -v.len / 2 - 0.02, 0.8);
    } else {
      const frame = new Mesh(new BoxGeometry(0.06, 0.08, 1.1), lambert(v.color));
      frame.position.set(0, 0.62, 0);
      const bar = new Mesh(new BoxGeometry(0.5, 0.05, 0.05), lambert(PAL.iron));
      bar.position.set(0, 1.0, 0.45);
      root.add(frame, bar);
      wheel(0, 0.62, bikeWheelGeo);
      wheel(0, -0.62, bikeWheelGeo);
      rider = new Person(randomLook(700 + v.id));
      rider.root.position.z = -0.1;
      root.add(rider.root);
      const lamp = new Sprite(this.haloMat);
      lamp.position.set(0, 0.95, 0.62);
      lamp.scale.set(0.6, 0.6, 1);
      root.add(lamp);
    }
    root.traverse((o) => { if ((o as Mesh).isMesh && (o as Mesh).material !== this.beamMat) o.castShadow = true; });
    root.rotation.y = LANES[v.lane].dir > 0 ? 0 : Math.PI;
    this.group.add(root);
    return { v, root, rider, wheels };
  }

  /** Mast-arm signals over the road on both approaches + walk signals at the curbs. */
  private signal(c: Crossing) {
    const pole = lambert(0x2a2f33);
    const approaches: { x: number; z: number; face: 1 | -1; armTo: number }[] = [
      // far side of the crosswalk, facing oncoming drivers
      { x: ROAD.x1 + 0.6, z: c.z + CROSSWALK_W / 2 + 1.2, face: -1, armTo: 13.6 }, // for traffic heading +z
      { x: ROAD.x0 - 0.6, z: c.z - CROSSWALK_W / 2 - 1.2, face: 1, armTo: 17.4 }, // for traffic heading −z
    ];
    for (const a of approaches) {
      const g = new Group();
      const post = new Mesh(new CylinderGeometry(0.12, 0.15, 6.2, 8).translate(0, 3.1, 0), pole);
      post.position.set(a.x, 0, a.z);
      const len = Math.abs(a.armTo - a.x);
      const arm = new Mesh(new BoxGeometry(len, 0.12, 0.12), pole);
      arm.position.set((a.x + a.armTo) / 2, 5.9, a.z);
      const head = new Mesh(new BoxGeometry(0.46, 1.25, 0.34), lambert(0x1c1f22));
      head.position.set(a.armTo, 5.2, a.z);
      g.add(post, arm, head);
      (['red', 'yellow', 'green'] as Light[]).forEach((l, i) => {
        const lamp = new Mesh(new BoxGeometry(0.28, 0.28, 0.04), this.sig[l]);
        lamp.position.set(a.armTo, 5.6 - i * 0.38, a.z + a.face * 0.19);
        g.add(lamp);
      });
      // pedestrian head on the post, facing across the road
      const ped = new Mesh(new BoxGeometry(0.06, 0.34, 0.34), this.walkSig);
      ped.position.set(a.x + (a.x > 15 ? -0.2 : 0.2), 2.6, a.z);
      g.add(ped);
      g.traverse((o) => { if ((o as Mesh).isMesh) o.castShadow = true; });
      this.group.add(g);
    }
  }

  setNight(night: number) {
    this.night = night;
    const on = Math.min(1, Math.max(0, (night - 0.2) / 0.5));
    this.head.color.set(0xdedbd0).lerp(new Color(0xfff6dc), on);
    this.tail.color.set(0x5a1512).lerp(new Color(0xff2a1a), on);
    this.beamMat.opacity = on * 0.5;
    this.haloMat.opacity = on * 0.9;
    this.tailHaloMat.opacity = on * 0.6;
    this.lastLight = null; // repaint signals for the new brightness
  }

  /** Sync meshes to the simulation. */
  update(dt: number) {
    for (const d of this.drawn) {
      d.root.position.set(LANES[d.v.lane].x, 0, d.v.z);
      for (const w of d.wheels) w.rotation.x += (d.v.speed * dt) / 0.34;
      if (d.rider) d.rider.ride(dt, d.v.speed);
    }
    const light = lightAt(this.state.t);
    if (light === this.lastLight) return;
    this.lastLight = light;
    const dim = 0.12 + this.night * 0.05;
    const base: Record<Light, number> = { red: 0xff2a1a, yellow: 0xffb81c, green: 0x3dff8a };
    for (const l of ['red', 'yellow', 'green'] as Light[]) {
      this.sig[l].color.set(base[l]).multiplyScalar(l === light ? 1 : dim);
    }
    this.walkSig.color.set(light === 'red' ? 0xf4f4f0 : 0xff8a1c).multiplyScalar(light === 'red' ? 1 : 0.8);
  }
}
