import { BoxGeometry, CylinderGeometry, Group, Mesh, Object3D } from 'three';
import { lambert } from './kit';
import { rng } from '../noise';

// ─── People ────────────────────────────────────────────────────────────
// Blocky low-poly students. Same rig for you, passers-by and friends:
// legs + arms swing from pivots, everything faces +z locally.

export interface Look {
  skin: number;
  hair: number;
  hairStyle: 'short' | 'long' | 'puff' | 'bun' | 'cap';
  top: number;
  legs: number;
  pack: number | null;
}

const SKIN = [0x8d5524, 0xc68642, 0xe0ac69, 0xf1c27d, 0xffdbac, 0x6b3e26, 0xa8693f, 0x4a2c1a];
const HAIR = [0x1b1511, 0x2b1d14, 0x3a2516, 0x6b4a2f, 0xb8893f, 0x121212, 0x8a3b24];
const TOPS = [0xc8302a, 0xf1ead9, 0x2b3a66, 0x3d6b4f, 0xe8b33a, 0x1e1e22, 0x7a8fa6, 0xd9822b, 0x9a5fa0, 0xc8302a, 0x5a8a9e];
const LEGS = [0x2b2b30, 0x3b4a6b, 0x4a4238, 0x1d2226, 0x6b7a8a, 0xd8cfbd];
const STYLES: Look['hairStyle'][] = ['short', 'long', 'puff', 'bun', 'cap', 'short', 'long'];

export function randomLook(seed: number): Look {
  const pick = <T,>(a: T[], k: number) => a[Math.floor(rng(seed * 7 + k) * a.length) % a.length];
  return {
    skin: pick(SKIN, 1), hair: pick(HAIR, 2), hairStyle: pick(STYLES, 3),
    top: pick(TOPS, 4), legs: pick(LEGS, 5),
    pack: rng(seed * 7 + 6) < 0.55 ? pick([0x2b3a66, 0x1e1e22, 0x6b2d2a, 0x3d6b4f, 0x7a6a4f], 7) : null,
  };
}

const G = {
  leg: new BoxGeometry(0.17, 0.84, 0.19).translate(0, -0.42, 0),
  torso: new BoxGeometry(0.46, 0.62, 0.27).translate(0, 0.31, 0),
  arm: new BoxGeometry(0.12, 0.6, 0.14).translate(0, -0.3, 0),
  head: new BoxGeometry(0.3, 0.32, 0.3).translate(0, 0.16, 0),
  hairTop: new BoxGeometry(0.33, 0.1, 0.33),
  hairBack: new BoxGeometry(0.33, 0.42, 0.08),
  puff: new BoxGeometry(0.42, 0.3, 0.42),
  bun: new BoxGeometry(0.14, 0.14, 0.14),
  brim: new BoxGeometry(0.3, 0.04, 0.16),
  pack: new BoxGeometry(0.34, 0.42, 0.16),
  shoe: new BoxGeometry(0.18, 0.08, 0.26),
  disc: new CylinderGeometry(0.14, 0.14, 0.03, 12),
};

export class Person {
  readonly root = new Group();
  private body = new Group();
  private legL = new Group();
  private legR = new Group();
  private armL = new Group();
  private armR = new Group();
  private phase = Math.random() * 10;
  heading = 0;

  constructor(look: Look) {
    const m = (geo: BoxGeometry, color: number, parent: Object3D, x = 0, y = 0, z = 0) => {
      const mesh = new Mesh(geo, lambert(color));
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    this.root.add(this.body);

    for (const [leg, x] of [[this.legL, -0.12], [this.legR, 0.12]] as const) {
      leg.position.set(x, 0.86, 0);
      m(G.leg, look.legs, leg);
      m(G.shoe, 0x1a1a1a, leg, 0, -0.82, 0.04);
      this.body.add(leg);
    }
    m(G.torso, look.top, this.body, 0, 0.84, 0);
    for (const [arm, x] of [[this.armL, -0.3], [this.armR, 0.3]] as const) {
      arm.position.set(x, 1.4, 0);
      m(G.arm, look.top, arm);
      m(new BoxGeometry(0.1, 0.1, 0.1), look.skin, arm, 0, -0.64, 0);
      this.body.add(arm);
    }
    m(G.head, look.skin, this.body, 0, 1.47, 0);
    const hy = 1.47;
    switch (look.hairStyle) {
      case 'short': m(G.hairTop, look.hair, this.body, 0, hy + 0.33, -0.01); break;
      case 'long':
        m(G.hairTop, look.hair, this.body, 0, hy + 0.33, -0.01);
        m(G.hairBack, look.hair, this.body, 0, hy + 0.1, -0.15);
        break;
      case 'puff': m(G.puff, look.hair, this.body, 0, hy + 0.34, -0.03); break;
      case 'bun':
        m(G.hairTop, look.hair, this.body, 0, hy + 0.33, -0.01);
        m(G.bun, look.hair, this.body, 0, hy + 0.44, -0.08);
        break;
      case 'cap':
        m(G.hairTop, look.top === 0x1e1e22 ? 0xc8302a : 0x1e1e22, this.body, 0, hy + 0.34, -0.01);
        m(G.brim, look.top === 0x1e1e22 ? 0xc8302a : 0x1e1e22, this.body, 0, hy + 0.31, 0.2);
        break;
    }
    if (look.pack !== null) m(G.pack, look.pack, this.body, 0, 1.12, -0.21);
  }

  /** Advance the walk cycle. `speed` in m/s; 0 settles into idle. */
  walk(dt: number, speed: number) {
    this.phase += dt * (1.6 + speed * 2.4);
    const amp = Math.min(speed / 1.4, 1) * 0.62;
    const s = Math.sin(this.phase);
    this.legL.rotation.x = s * amp;
    this.legR.rotation.x = -s * amp;
    this.armL.rotation.x = -s * amp * 0.8;
    this.armR.rotation.x = s * amp * 0.8;
    this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.05 * (amp / 0.62);
    this.body.rotation.x = speed > 5 ? 0.22 : speed * 0.015; // lean into a run
    this.armL.rotation.z = this.armR.rotation.z = 0;
    if (speed < 0.05) this.body.rotation.z = Math.sin(this.phase * 0.25) * 0.02; // idle sway
    else this.body.rotation.z = 0;
  }

  /** Seated pose: on a bench (`seatY` ≈ 0.48) or on the grass (≈ 0.12). */
  sit(seatY: number) {
    const grass = seatY < 0.3;
    this.body.position.y = seatY - 0.86;
    this.legL.rotation.x = this.legR.rotation.x = grass ? -1.45 : -1.2;
    this.armL.rotation.x = this.armR.rotation.x = grass ? 0.5 : -0.35;
    this.armL.rotation.z = grass ? 0.25 : 0;
    this.armR.rotation.z = grass ? -0.25 : 0;
  }

  /** Standing on a scooter: one foot forward, hands on the bars. */
  scoot(dt: number, speed: number) {
    this.phase += dt * (1 + speed * 0.2);
    this.body.position.y = 0.17;
    this.body.rotation.x = 0.12 + Math.min(speed, 9) * 0.01;
    this.body.rotation.z = Math.sin(this.phase * 0.7) * 0.02;
    this.legL.rotation.x = -0.12;
    this.legR.rotation.x = 0.18;
    this.armL.rotation.x = this.armR.rotation.x = -1.0;
  }

  /** On a bike: seated high, pedalling in proportion to speed. */
  ride(dt: number, speed: number) {
    this.phase += dt * speed * 1.4;
    this.body.position.y = 0.12;
    this.body.rotation.x = 0.25; // lean over the bars
    this.body.rotation.z = 0;
    const s = Math.sin(this.phase);
    this.legL.rotation.x = -0.9 + s * 0.45;
    this.legR.rotation.x = -0.9 - s * 0.45;
    this.armL.rotation.x = this.armR.rotation.x = -1.1;
  }

  throwPose(t: number) {
    this.armR.rotation.x = -2.4 * t;
  }

  face(heading: number) {
    this.heading = heading;
    this.root.rotation.y = heading;
  }
}

export const discGeometry = G.disc;
