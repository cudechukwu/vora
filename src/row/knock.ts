import type { XZ } from './collide';
import { CarKind, distToCar } from './cars';

// ─── Getting hit by a car (pure rules, no three.js) ────────────────────
// Clip someone with a car going faster than a jog and they go flying:
// up and away from the car, tumbling, bounce once or twice, slide, lie
// there a moment, then get back up. The view just reads the pose.

export const HIT_SPEED = 2.2; // m/s — slower than this and you just nudge them
export const HIT_REACH = 0.35; // how close to the car's outline counts as a hit
const G = 18; // a bit more than real gravity: snappier arcs
const DOWN_FOR = 1.6; // seconds lying there
const UP_FOR = 0.6; // seconds getting up

export type Phase = 'air' | 'down' | 'up' | 'done';

export interface Knock {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  tilt: number; // rotation about their own left-right axis (0 = upright; ±π/2 = flat)
  spin: number; // rad/s while airborne
  heading: number; // which way they face (toward where they were hit from)
  phase: Phase;
  t: number; // seconds in this phase
  lieAt: number; // the flat tilt they settled on
}

interface CarLike { x: number; z: number; heading: number; len: number; kind: CarKind; speed: number }

/** Is this person in the way of a car moving fast enough to send them flying? */
export function hits(car: CarLike, p: XZ): boolean {
  return Math.abs(car.speed) >= HIT_SPEED && distToCar(car, p) <= HIT_REACH;
}

/** Send someone flying: mostly along the car's travel, partly straight away from it, and up. */
export function launch(car: CarLike, p: XZ): Knock {
  const s = Math.abs(car.speed), dir = Math.sign(car.speed) || 1;
  const fx = Math.sin(car.heading) * dir, fz = Math.cos(car.heading) * dir;
  let ax = p.x - car.x, az = p.z - car.z;
  const n = Math.hypot(ax, az) || 1;
  ax /= n; az /= n;
  const vx = fx * s * 0.75 + ax * (2 + s * 0.15), vz = fz * s * 0.75 + az * (2 + s * 0.15);
  return {
    x: p.x, y: 0, z: p.z, vx, vy: 3.2 + s * 0.38, vz,
    tilt: 0, spin: -(5 + s * 0.7), // backwards somersault: they were hit from the front
    heading: Math.atan2(-vx, -vz), // facing the car
    phase: 'air', t: 0, lieAt: -Math.PI / 2,
  };
}

/** Nearest flat pose (on their back or front) to a tilt. */
const nearestFlat = (tilt: number) => Math.round((tilt + Math.PI / 2) / Math.PI) * Math.PI - Math.PI / 2;
/** Nearest upright pose (a whole number of turns) to a tilt. */
const nearestUp = (tilt: number) => Math.round(tilt / (Math.PI * 2)) * Math.PI * 2;

export function stepKnock(k: Knock, dt: number): void {
  if (!(dt > 0) || k.phase === 'done') return;
  k.t += dt;
  if (k.phase === 'air') {
    k.vy -= G * dt;
    k.x += k.vx * dt; k.y += k.vy * dt; k.z += k.vz * dt;
    k.tilt += k.spin * dt;
    if (k.y <= 0 && k.vy < 0) {
      k.y = 0;
      if (-k.vy > 4) { // bounce
        k.vy = -k.vy * 0.3;
        k.vx *= 0.55; k.vz *= 0.55; k.spin *= 0.5;
      } else {
        k.phase = 'down'; k.t = 0;
        k.lieAt = nearestFlat(k.tilt);
      }
    }
    return;
  }
  if (k.phase === 'down') {
    // slide to a stop, settling flat
    const f = Math.exp(-6 * dt);
    k.vx *= f; k.vz *= f;
    k.x += k.vx * dt; k.z += k.vz * dt;
    k.tilt += (k.lieAt - k.tilt) * Math.min(1, dt * 14);
    if (k.t >= DOWN_FOR) { k.phase = 'up'; k.t = 0; k.vx = k.vz = 0; }
    return;
  }
  // up: back on their feet
  const up = nearestUp(k.lieAt);
  const u = Math.min(1, k.t / UP_FOR);
  k.tilt = k.lieAt + (up - k.lieAt) * (1 - Math.pow(1 - u, 3));
  if (u >= 1) { k.tilt = 0; k.phase = 'done'; }
}

/** Lines people yell after you've hit them. */
export const OUCH = ['OW!!', 'watch where you\'re going!', 'are you insane?!', 'my phone!!', 'DUDE.', 'i\'m calling public safety'];
