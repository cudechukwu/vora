import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshLambertMaterial, Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../noise';

// ─── People ────────────────────────────────────────────────────────────
// Blocky low-poly students. Same rig for you, passers-by and friends:
//
//   root ─ body (bob, sway) ─┬ spine (lean, twist; torso + pack) ─┬ neck ─ head (+ hair), eyes
//                            │                                    └ shoulder ─ upper arm ─ elbow ─ forearm + hand  (×2)
//                            └ hip ─ thigh ─ knee ─ shin + shoe  (×2)
//
// Each segment is ONE mesh (its boxes merged, coloured per vertex), so knees
// and elbows cost no more draw calls than the old stiff rig. Everything faces
// +z locally. The gait (walk ↔ run) is a pure function of phase + speed.

export interface Look {
  skin: number;
  hair: number;
  hairStyle: 'short' | 'long' | 'puff' | 'bun' | 'cap';
  top: number;
  legs: number;
  pack: number | null;
  /** Long sleeves (else forearms are bare). Defaults from the top colour. */
  sleeves?: boolean;
}

const SKIN = [0x8d5524, 0xc68642, 0xe0ac69, 0xf1c27d, 0xffdbac, 0x6b3e26, 0xa8693f, 0x4a2c1a];
const HAIR = [0x1b1511, 0x2b1d14, 0x3a2516, 0x6b4a2f, 0xb8893f, 0x121212, 0x8a3b24];
const TOPS = [0xc8302a, 0xf1ead9, 0x2b3a66, 0x3d6b4f, 0xe8b33a, 0x1e1e22, 0x7a8fa6, 0xd9822b, 0x9a5fa0, 0xc8302a, 0x5a8a9e];
const LEGS = [0x2b2b30, 0x3b4a6b, 0x4a4238, 0x1d2226, 0x6b7a8a, 0xd8cfbd];
const SHOES = [0x1a1a1a, 0xf1f1ee, 0xf1f1ee, 0x6b2d2a, 0x2b3a66];
const STYLES: Look['hairStyle'][] = ['short', 'long', 'puff', 'bun', 'cap', 'short', 'long'];

export function randomLook(seed: number): Look {
  const pick = <T,>(a: T[], k: number) => a[Math.floor(rng(seed * 7 + k) * a.length) % a.length];
  return {
    skin: pick(SKIN, 1), hair: pick(HAIR, 2), hairStyle: pick(STYLES, 3),
    top: pick(TOPS, 4), legs: pick(LEGS, 5),
    pack: rng(seed * 7 + 6) < 0.55 ? pick([0x2b3a66, 0x1e1e22, 0x6b2d2a, 0x3d6b4f, 0x7a6a4f], 7) : null,
    sleeves: rng(seed * 7 + 8) < 0.5,
  };
}

// ── proportions (metres) ──
export const HIP_Y = 0.88;
const THIGH = 0.44, SHIN = 0.4;
const UPPER = 0.3, FORE = 0.26;
const SHOULDER_Y = 0.54, NECK_Y = 0.62;

// ── geometry: boxes merged per segment, coloured per vertex ──
type Part = [w: number, h: number, d: number, color: number, x: number, y: number, z: number];

const col = new Color();
function segment(parts: Part[]): BufferGeometry {
  const geos = parts.map(([w, h, d, c, x, y, z]) => {
    const g = new BoxGeometry(w, h, d).translate(x, y, z);
    col.setHex(c); // sRGB hex → linear, same as a material colour
    const n = g.getAttribute('position').count, cs = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { cs[i * 3] = col.r; cs[i * 3 + 1] = col.g; cs[i * 3 + 2] = col.b; }
    g.setAttribute('color', new Float32BufferAttribute(cs, 3));
    return g;
  });
  const merged = mergeGeometries(geos)!;
  for (const g of geos) g.dispose();
  return merged;
}

const SKIN_MAT = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
const EYE_MAT = new MeshLambertMaterial({ color: 0x15110e });
const EYES = segment([[0.055, 0.06, 0.02, 0xffffff, -0.07, 0, 0], [0.055, 0.06, 0.02, 0xffffff, 0.07, 0, 0]]);

/** Shared limb geometry by colour (lots of people wear the same jeans). */
const cache = new Map<string, BufferGeometry>();
const cached = (key: string, make: () => BufferGeometry) => {
  let g = cache.get(key);
  if (!g) { g = make(); cache.set(key, g); }
  return g;
};

function headParts(look: Look): Part[] {
  const p: Part[] = [[0.3, 0.32, 0.3, look.skin, 0, 0.16, 0], [0.06, 0.07, 0.05, look.skin, 0, 0.13, 0.17]]; // head, nose
  const hy = 0;
  const capC = look.top === 0x1e1e22 ? 0xc8302a : 0x1e1e22;
  switch (look.hairStyle) {
    case 'short': p.push([0.33, 0.1, 0.33, look.hair, 0, hy + 0.33, -0.01], [0.33, 0.16, 0.06, look.hair, 0, hy + 0.24, -0.15]); break;
    case 'long': p.push([0.33, 0.1, 0.33, look.hair, 0, hy + 0.33, -0.01], [0.33, 0.42, 0.08, look.hair, 0, hy + 0.1, -0.15]); break;
    case 'puff': p.push([0.42, 0.3, 0.42, look.hair, 0, hy + 0.34, -0.03]); break;
    case 'bun': p.push([0.33, 0.1, 0.33, look.hair, 0, hy + 0.33, -0.01], [0.14, 0.14, 0.14, look.hair, 0, hy + 0.44, -0.08]); break;
    case 'cap': p.push([0.33, 0.1, 0.33, capC, 0, hy + 0.34, -0.01], [0.3, 0.04, 0.16, capC, 0, hy + 0.31, 0.2], [0.33, 0.12, 0.06, look.hair, 0, hy + 0.22, -0.15]); break;
  }
  return p;
}

// ── the gait: walk ↔ run, as joint angles (pure) ──
export interface Pose {
  thigh: [number, number]; knee: [number, number]; // + = leg forward / knee folded (foot back)
  arm: [number, number]; elbow: [number, number]; // + = arm forward / elbow bent (hand forward)
  lean: number; twist: number; bob: number; sway: number;
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** How "running" a speed is: 0 = walking, 1 = full run. */
export const runBlend = (speed: number) => smooth(3.6, 5.6, speed);

/** How fast the stride cycle turns (rad/s) at a speed. */
export const strideRate = (speed: number) => mix(2.2 + speed * 2.2, 8.5 + speed * 0.45, runBlend(speed));

/** Joint angles at stride phase `ph` and `speed` (m/s). Left and right legs half a cycle apart. */
export function gait(ph: number, speed: number): Pose {
  const r = runBlend(speed);
  const amp = Math.min(speed / 1.4, 1); // ease in from standing
  const legA = mix(0.42, 0.8, r) * amp, armA = mix(0.44, 0.75, r) * amp;
  const leg = (p: number) => Math.sin(p) * legA;
  // the knee folds while the leg swings forward (cos > 0); running, the heel kicks right up behind
  const knee = (p: number) => amp * (mix(0.08, 0.35, r) + Math.max(0, Math.cos(p - mix(0, 0.5, r))) * mix(0.75, 1.9, r));
  const s = Math.sin(ph);
  return {
    thigh: [leg(ph), leg(ph + Math.PI)],
    knee: [knee(ph), knee(ph + Math.PI)],
    arm: [-s * armA, s * armA], // opposite arm to leg
    elbow: [mix(0.18, 1.45, r) * Math.max(amp, 0.4) + Math.max(0, -s) * armA * 0.4, mix(0.18, 1.45, r) * Math.max(amp, 0.4) + Math.max(0, s) * armA * 0.4],
    lean: mix(0.03, 0.3, r) * amp,
    twist: s * mix(0.1, 0.16, r) * amp,
    bob: Math.abs(Math.cos(ph)) * mix(0.04, 0.1, r) * amp,
    sway: s * mix(0.035, 0.015, r) * amp,
  };
}

interface Limb { top: Group; joint: Group }

export class Person {
  readonly root = new Group();
  private body = new Group();
  private spine = new Group();
  private neck = new Group();
  private eyes: Mesh;
  private legs: [Limb, Limb];
  private arms: [Limb, Limb];
  private phase = Math.random() * 10;
  private clock = Math.random() * 10;
  private blinkAt = 1 + Math.random() * 4;
  private glance = 0; // where the head's looking (yaw), drifting
  private glanceTo = 0;
  private lieOut = Math.random() < 0.5; // on the grass: legs out, or knees up
  private backDepth: number; // how far your back (or backpack) sticks out behind you
  heading = 0;

  constructor(look: Look) {
    const mesh = (geo: BufferGeometry, parent: Object3D, mat = SKIN_MAT) => {
      const m = new Mesh(geo, mat);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    this.root.rotation.order = 'YXZ'; // face first, then tip (for falling over)
    this.root.add(this.body);
    this.body.add(this.spine);
    this.spine.position.y = HIP_Y;

    // torso (+ belt, pack)
    const torso: Part[] = [[0.46, 0.62, 0.27, look.top, 0, 0.31, 0], [0.44, 0.08, 0.25, look.legs, 0, 0.02, 0]];
    this.backDepth = look.pack !== null ? 0.3 : 0.15;
    if (look.pack !== null) torso.push([0.34, 0.42, 0.16, look.pack, 0, 0.3, -0.21], [0.3, 0.12, 0.05, look.pack, 0, 0.18, -0.3]);
    mesh(segment(torso), this.spine);

    // head
    this.neck.position.y = NECK_Y;
    this.spine.add(this.neck);
    mesh(segment([[0.12, 0.06, 0.12, look.skin, 0, -0.01, 0], ...headParts(look)]), this.neck);
    this.eyes = mesh(EYES, this.neck, EYE_MAT);
    this.eyes.position.set(0, 0.2, 0.151);
    this.eyes.castShadow = false;

    // legs: thigh from the hip, shin + shoe from the knee
    const shoe = SHOES[Math.floor(rng(look.top * 0.001 + look.legs * 0.0001) * SHOES.length)];
    const thighG = cached(`th${look.legs}`, () => segment([[0.18, THIGH, 0.2, look.legs, 0, -THIGH / 2, 0]]));
    const shinG = cached(`sh${look.legs}:${shoe}`, () => segment([
      [0.16, SHIN, 0.18, look.legs, 0, -SHIN / 2, 0], [0.18, 0.08, 0.27, shoe, 0, -SHIN, 0.045],
    ]));
    this.legs = ([-0.12, 0.12] as const).map((x) => {
      const top = new Group(), joint = new Group();
      top.position.set(x, HIP_Y, 0);
      joint.position.y = -THIGH;
      mesh(thighG, top);
      mesh(shinG, joint);
      top.add(joint);
      this.body.add(top);
      return { top, joint };
    }) as [Limb, Limb];

    // arms: upper from the shoulder, forearm + hand from the elbow
    const sleeves = look.sleeves ?? (look.top % 2 === 0);
    const upperG = cached(`up${look.top}`, () => segment([[0.13, UPPER, 0.15, look.top, 0, -UPPER / 2, 0]]));
    const foreG = cached(`fo${sleeves ? look.top : look.skin}:${look.skin}`, () => segment([
      [0.11, FORE, 0.13, sleeves ? look.top : look.skin, 0, -FORE / 2, 0], [0.1, 0.11, 0.11, look.skin, 0, -FORE - 0.05, 0],
    ]));
    this.arms = ([-0.3, 0.3] as const).map((x) => {
      const top = new Group(), joint = new Group();
      top.position.set(x, SHOULDER_Y, 0);
      joint.position.y = -UPPER;
      mesh(upperG, top);
      mesh(foreG, joint);
      top.add(joint);
      this.spine.add(top);
      return { top, joint };
    }) as [Limb, Limb];
  }

  // ── posing helpers (angles in the Pose convention: + = forward / folded) ──
  private setLegs(t0: number, k0: number, t1: number, k1: number) {
    this.legs[0].top.rotation.set(-t0, 0, 0); this.legs[0].joint.rotation.x = k0;
    this.legs[1].top.rotation.set(-t1, 0, 0); this.legs[1].joint.rotation.x = k1;
  }
  private setArms(a0: number, e0: number, a1: number, e1: number, out = 0) {
    this.arms[0].top.rotation.set(-a0, 0, -out); this.arms[0].joint.rotation.x = -e0;
    this.arms[1].top.rotation.set(-a1, 0, out); this.arms[1].joint.rotation.x = -e1;
  }
  private straighten() {
    this.body.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    this.spine.rotation.set(0, 0, 0);
    this.spine.position.y = HIP_Y;
    this.root.rotation.x = 0;
    this.neck.rotation.x = 0;
    for (const l of this.legs) l.top.rotation.z = 0;
  }

  /** Little signs of life: blinking, glancing around. */
  private live(dt: number, glances: boolean) {
    this.clock += dt;
    if (this.clock > this.blinkAt) { this.blinkAt = this.clock + 2.5 + Math.random() * 3.5; }
    this.eyes.scale.y = this.blinkAt - this.clock < 0.12 ? 0.15 : 1;
    if (glances && Math.random() < dt * 0.35) this.glanceTo = (Math.random() - 0.5) * 1.3;
    if (!glances) this.glanceTo = 0;
    this.glance += (this.glanceTo - this.glance) * Math.min(1, dt * 3);
    this.neck.rotation.y = this.glance;
  }

  /** Walk, run or stand, by speed (m/s). Knees and elbows fold more the faster you go. */
  walk(dt: number, speed: number) {
    this.straighten();
    this.phase += dt * strideRate(speed);
    if (speed < 0.05) {
      // standing: breathe, shift your weight, arms loose
      const t = this.clock;
      this.setLegs(0, 0.04, 0, 0.04);
      this.setArms(0.04, 0.12 + Math.sin(t * 1.7) * 0.02, 0.04, 0.12 + Math.sin(t * 1.7) * 0.02, 0.06);
      this.spine.rotation.x = Math.sin(t * 1.7) * 0.012;
      this.body.rotation.z = Math.sin(t * 0.45) * 0.02;
      this.live(dt, true);
      return;
    }
    const p = gait(this.phase, speed);
    this.setLegs(p.thigh[0], p.knee[0], p.thigh[1], p.knee[1]);
    this.setArms(p.arm[0], p.elbow[0], p.arm[1], p.elbow[1], 0.05 + 0.13 * runBlend(speed)); // elbows out a little when running
    // drop the hips a touch as the knees bend, so the feet stay on the ground
    this.body.position.y = p.bob - 0.04 * runBlend(speed);
    this.body.rotation.z = p.sway;
    this.spine.rotation.set(p.lean, p.twist, 0);
    this.neck.rotation.x = -p.lean * 0.6; // keep looking ahead
    this.live(dt, speed < 2);
    this.neck.rotation.y -= p.twist; // head steady while the shoulders turn
  }

  /** In the air (jumping): knees tucked on the way up, legs reaching for the ground on the way down, arms up. */
  airPose(vy: number) {
    const up = Math.max(0, Math.min(1, vy / 6));
    this.setLegs(0.5 + up * 0.4, 0.9 + up * 0.6, 0.2 + up * 0.5, 0.6 + up * 0.8);
    this.setArms(-0.4 - up * 0.6, 0.4, -0.5 - up * 0.6, 0.4, 0.35);
    this.spine.rotation.x = 0.1;
  }

  /** Seated pose: on a bench (`seatY` ≈ 0.48) or on the grass (≈ 0.12). */
  sit(seatY: number) {
    this.straighten();
    const grass = seatY < 0.3;
    this.body.position.y = seatY - HIP_Y;
    if (!grass) {
      this.setLegs(Math.PI / 2, Math.PI / 2 - 0.05, Math.PI / 2 - 0.08, Math.PI / 2 + 0.1);
      this.setArms(0.55, 0.6, 0.5, 0.65, 0.08); // hands in your lap
      this.spine.rotation.x = -0.06;
    } else if (this.lieOut) {
      this.setLegs(Math.PI / 2 - 0.05, 0.1, Math.PI / 2 + 0.05, 0.2); // legs out, one knee bent a little
      this.setArms(-0.55, 0, -0.55, 0, 0.12); // leaning back on your hands
      this.spine.rotation.x = -0.32;
    } else {
      this.setLegs(2.4, 2.55, 2.35, 2.5); // knees up
      this.setArms(0.75, 0.95, 0.75, 0.95, 0.05); // arms round them
      this.spine.rotation.x = 0.25;
    }
  }

  /** Idle animation while seated (blink, look around, breathe). Pose stays. */
  sitIdle(dt: number) {
    this.live(dt, true);
  }

  /** Standing on a scooter: one foot forward, hands on the bars. */
  scoot(dt: number, speed: number) {
    this.straighten();
    this.phase += dt * (1 + speed * 0.2);
    this.body.position.y = 0.17;
    this.setLegs(0.12, 0.15, -0.22, 0.35);
    this.setArms(1.0, 0.3, 1.0, 0.3);
    this.spine.rotation.x = 0.12 + Math.min(speed, 9) * 0.01;
    this.body.rotation.z = Math.sin(this.phase * 0.7) * 0.02;
    this.live(dt, false);
  }

  /** On a bike: seated high, pedalling in proportion to speed. */
  ride(dt: number, speed: number) {
    this.straighten();
    this.phase += dt * speed * 1.4;
    this.body.position.y = 0.1;
    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    // thighs rise and fall with the pedals; knees open as the pedal goes down
    this.setLegs(1.0 + s * 0.38, 1.2 + c * 0.45, 1.0 - s * 0.38, 1.2 - c * 0.45);
    this.setArms(1.05, 0.25, 1.05, 0.25);
    this.spine.rotation.x = 0.35; // lean over the bars
    this.neck.rotation.x = -0.25;
    this.live(dt, false);
  }

  throwPose(t: number) {
    this.arms[1].top.rotation.x = -2.4 * t; // right arm
    this.arms[1].joint.rotation.x = -0.4 * t;
  }

  /** Tip the whole body over by `tilt`, lifted so a body lying flat rests on the ground, not in it. */
  private tip(tilt: number) {
    this.root.rotation.x = tilt;
    // lying on your back you rest on your backpack (if any); face down, on your nose
    const lift = (Math.sin(tilt) < 0 ? this.backDepth : 0.2) * Math.abs(Math.sin(tilt));
    this.body.position.set(0, Math.cos(tilt) * lift, -Math.sin(tilt) * lift); // (local "up", once tipped)
  }

  /** Airborne after being hit: arms and legs everywhere. `tilt` tips the whole body. */
  flail(dt: number, tilt: number) {
    this.straighten();
    this.tip(tilt);
    this.clock += dt * 9;
    const w = Math.sin(this.clock), v = Math.cos(this.clock * 1.3);
    this.setLegs(0.5 + w * 0.6, 0.6 + v * 0.4, -0.3 - w * 0.6, 0.9 - v * 0.4);
    this.legs[0].top.rotation.z = -0.25; this.legs[1].top.rotation.z = 0.25;
    this.setArms(1.2 + v, 0.5, 1.6 - v, 0.3, 1.1 + w * 0.3);
    this.eyes.scale.y = 1.4;
  }

  /** Lying where they landed, limp (or getting up, as `tilt` comes back to 0). */
  limp(tilt: number) {
    this.straighten();
    this.tip(tilt);
    // spread out flat: arms and legs splayed in the plane of the body, so nothing goes through the ground
    this.setLegs(0, 0, 0, 0);
    this.legs[0].top.rotation.z = -0.2; this.legs[1].top.rotation.z = 0.15;
    this.setArms(0, 0, 0, 0, 1.0);
    this.eyes.scale.y = 0.15;
  }

  face(heading: number) {
    this.heading = heading;
    this.root.rotation.y = heading;
  }
}

export const discGeometry = new CylinderGeometry(0.14, 0.14, 0.03, 12);
