// ─── Camera rig (pure math, no three.js) ──────────────────────────────
// yaw: which way the camera looks. Forward = (−sin yaw, 0, −cos yaw), so
// yaw 0 looks −z and yaw π looks +z (down the row from Usdan).
//
//  • Look: drag the look button or the top strip (or ←/→, Q/E) to turn
//    the view without moving you. Tap the button to look behind you;
//    double-tap the strip to snap back behind yourself.
//  • Follow: while you walk, the view eases round behind you — whichever
//    way you go, including back the way you came. Paused briefly after you
//    look around yourself, so it doesn't fight you.
//  • Basis lock: your walking direction is fixed the moment you put your
//    thumb down (it only changes if you look around). Without this, the
//    camera swinging round would bend your path into a circle.

export const LOOK_SENS = 0.0065; // radians per pixel dragged
export const PITCH_SENS = 0.004;
export const PITCH_MIN = -0.45;
export const PITCH_MAX = 0.7;
export const FOLLOW_RATE = 2.4; // how quickly the view catches up (1/s)
export const LOOK_HOLD = 1.4; // seconds of no auto-follow after you look
export const KEY_TURN = 1.9; // radians/second for ←/→

export const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export interface XZ { x: number; z: number }

export class CameraRig {
  yaw: number;
  pitch = 0;
  private basis: number | null = null;
  private lastLook = -Infinity;

  constructor(yaw = Math.PI) {
    this.yaw = yaw;
  }

  forward(yaw = this.yaw): XZ { return { x: -Math.sin(yaw), z: -Math.cos(yaw) }; }
  right(yaw = this.yaw): XZ { return { x: Math.cos(yaw), z: -Math.sin(yaw) }; }

  /** Drag to look: +dx turns right, +dy tilts to a higher, more top-down view. */
  look(dx: number, dy: number, t: number) {
    const dYaw = -dx * LOOK_SENS;
    this.yaw = wrap(this.yaw + dYaw);
    if (this.basis !== null) this.basis = wrap(this.basis + dYaw); // walking follows where you look
    this.pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, this.pitch + dy * PITCH_SENS));
    this.lastLook = t;
  }

  /** Keyboard turn: dir −1 = left, +1 = right. */
  turn(dir: number, dt: number, t: number) {
    this.look((dir * KEY_TURN * dt) / LOOK_SENS, 0, t);
  }

  /** Look the other way (the look button's tap). */
  turnAround(t: number) {
    this.yaw = wrap(this.yaw + Math.PI);
    if (this.basis !== null) this.basis = wrap(this.basis + Math.PI);
    this.lastLook = t;
  }

  /** Put the camera straight behind someone facing `heading` (radians, 0 = +z). */
  snapBehind(heading: number) {
    this.yaw = wrap(heading + Math.PI);
    if (this.basis !== null) this.basis = this.yaw;
  }

  /**
   * World-space walk vector for a stick input (x = right, y = up the screen).
   * `held` = a thumb/key is down; the direction basis locks while it is.
   */
  move(sx: number, sy: number, held: boolean): XZ {
    if (!held) { this.basis = null; return { x: 0, z: 0 }; }
    if (this.basis === null) this.basis = this.yaw;
    const f = this.forward(this.basis), r = this.right(this.basis);
    return { x: f.x * sy + r.x * sx, z: f.z * sy + r.z * sx };
  }

  /** Ease the view round behind someone walking with `heading`. */
  follow(dt: number, heading: number, moving: boolean, t: number) {
    if (!moving || t - this.lastLook < LOOK_HOLD) return;
    const diff = wrap(heading + Math.PI - this.yaw);
    this.yaw = wrap(this.yaw + diff * (1 - Math.exp(-dt * FOLLOW_RATE)));
  }
}
