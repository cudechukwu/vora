import type { XZ } from './collide';
import { BACK_PATH } from './layout';

// ─── Physical Plant's golf cart (pure rules, no three.js) ──────────────
// Putters up and down the coal-tar path behind the row, keeping right.
// Stops for anyone in front of it, waits a bit at each end, turns round.

export const CART = { speed: 3.6, len: 2.6, halfW: 0.7, wait: 6 } as const; // ~8 mph
const MID = (BACK_PATH.x0 + BACK_PATH.x1) / 2;
/** Its lane: keep right (heading +z, your right is −x). */
export const cartLaneX = (dir: 1 | -1) => MID - dir * 1.6;
const STOP_SHORT = 1.6; // how far short of a person it stops
const LOOK = 9;

export interface Cart { x: number; z: number; dir: 1 | -1; speed: number; wait: number; z0: number; z1: number }

export function createCart(z0: number, z1: number): Cart {
  return { x: cartLaneX(1), z: z0 + 20, dir: 1, speed: CART.speed, wait: 0, z0, z1 };
}

/** Which way it's facing (radians, 0 = +z). */
export const cartHeading = (c: Cart) => (c.dir > 0 ? 0 : Math.PI);

export function stepCart(c: Cart, dt: number, people: XZ[] = []): void {
  if (!(dt > 0)) return;
  if (c.wait > 0) { // parked at an end, about to head back
    c.wait -= dt;
    c.speed = 0;
    if (c.wait <= 0) { c.dir = c.dir > 0 ? -1 : 1; c.x = cartLaneX(c.dir); }
    return;
  }
  const front = c.z + c.dir * CART.len / 2;
  let room = (c.dir > 0 ? c.z1 - front : front - c.z0);
  for (const p of people) {
    if (Math.abs(p.x - c.x) > CART.halfW + 0.6) continue;
    const ahead = (p.z - front) * c.dir;
    if (ahead > -0.5 && ahead < LOOK) room = Math.min(room, ahead - STOP_SHORT);
  }
  const target = room <= 0 ? 0 : Math.min(CART.speed, Math.sqrt(2 * 3 * room));
  c.speed += Math.max(-6 * dt, Math.min(2 * dt, target - c.speed));
  const step = Math.max(0, Math.min(c.speed * dt, room));
  c.z += c.dir * step;
  // reached the end of the path: wait, then turn round
  if ((c.dir > 0 && c.z + CART.len / 2 >= c.z1 - 0.01) || (c.dir < 0 && c.z - CART.len / 2 <= c.z0 + 0.01)) c.wait = CART.wait;
}

/** Its footprint, for bumping into. */
export const cartBox = (c: Cart, pad = 0) =>
  ({ x0: c.x - CART.halfW - pad, x1: c.x + CART.halfW + pad, z0: c.z - CART.len / 2 - pad, z1: c.z + CART.len / 2 + pad });
