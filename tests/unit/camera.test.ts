import { describe, expect, it } from 'vitest';
import { CameraRig, LOOK_HOLD, LOOK_SENS, PITCH_MAX, PITCH_MIN, wrap } from '../../src/row/camera';

const near = (a: number, b: number, eps = 1e-6) => Math.abs(wrap(a - b)) < eps;

/** Simulate a player: face where you walk, camera follows, `frames` at 60fps. */
function simulate(rig: CameraRig, sx: number, sy: number, seconds: number, start = { x: 0, z: 0, heading: 0 }) {
  let { x, z, heading } = start;
  const path: { x: number; z: number }[] = [];
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    const m = rig.move(sx, sy, true);
    const len = Math.hypot(m.x, m.z);
    if (len > 0.01) {
      x += (m.x / len) * 4 * dt;
      z += (m.z / len) * 4 * dt;
      const target = Math.atan2(m.x, m.z);
      heading += wrap(target - heading) * Math.min(1, dt * 12);
    }
    rig.follow(dt, heading, len > 0.01, 100 + t);
    path.push({ x, z });
  }
  return { x, z, heading, path };
}

describe('camera rig', () => {
  it('starts looking down the row (+z), with up-the-screen meaning forward', () => {
    const rig = new CameraRig();
    const f = rig.forward();
    expect(f.x).toBeCloseTo(0, 9);
    expect(f.z).toBeCloseTo(1, 9);
    const m = rig.move(0, 1, true);
    expect(m.z).toBeCloseTo(1, 9);
    expect(rig.move(1, 0, true).x).toBeCloseTo(-1, 9); // screen-right = toward the row (−x)
  });

  it('dragging right turns the view right, without needing to walk', () => {
    const rig = new CameraRig();
    const r0 = rig.right();
    rig.look(100, 0, 0);
    const f = rig.forward();
    expect(f.x * r0.x + f.z * r0.z).toBeGreaterThan(0); // forward swung toward the old right
    expect(rig.yaw).toBeCloseTo(wrap(Math.PI - 100 * LOOK_SENS), 9);
  });

  it('can turn a full 180° by dragging, then walks the other way', () => {
    const rig = new CameraRig();
    rig.look(Math.PI / LOOK_SENS, 0, 0);
    expect(near(rig.yaw, 0)).toBe(true);
    expect(rig.move(0, 1, true).z).toBeCloseTo(-1, 9);
  });

  it('clamps tilt', () => {
    const rig = new CameraRig();
    rig.look(0, 1e6, 0);
    expect(rig.pitch).toBe(PITCH_MAX);
    rig.look(0, -1e6, 0);
    expect(rig.pitch).toBe(PITCH_MIN);
  });

  it('keyboard turning spins at a steady rate', () => {
    const rig = new CameraRig(0);
    for (let i = 0; i < 60; i++) rig.turn(1, 1 / 60, i / 60);
    expect(rig.yaw).toBeCloseTo(-1.9, 6); // 1.9 rad/s to the right
  });

  it('look button tap turns the view round 180°, and pauses auto-follow', () => {
    const rig = new CameraRig(0.4);
    rig.turnAround(50);
    expect(near(rig.yaw, 0.4 + Math.PI)).toBe(true);
    const y = rig.yaw;
    rig.follow(0.1, 0, true, 50.5); // walking, but you just looked
    expect(rig.yaw).toBe(y);
  });

  it('double-tap snap puts the camera straight behind you', () => {
    const rig = new CameraRig(0.3);
    rig.snapBehind(1.2);
    expect(near(rig.yaw, 1.2 + Math.PI)).toBe(true);
  });

  it('walking backwards: the view swings round, but you keep walking in a straight line', () => {
    const rig = new CameraRig(); // looking +z
    const { path } = simulate(rig, 0, -1, 6); // hold "down"
    const end = path[path.length - 1];
    expect(end.z).toBeLessThan(-20); // went back the way you came (−z)
    for (const p of path) expect(Math.abs(p.x)).toBeLessThan(1e-6); // …in a straight line
    expect(near(rig.yaw, 0, 0.05)).toBe(true); // …and the camera is now behind you, looking −z
  });

  it('walking sideways: the view turns to face where you are going', () => {
    const rig = new CameraRig();
    const { heading } = simulate(rig, 1, 0, 5);
    expect(near(rig.yaw, heading + Math.PI, 0.05)).toBe(true);
  });

  it('does not fight you: no auto-follow for a moment after you look around', () => {
    const rig = new CameraRig();
    rig.look(200, 0, 10);
    const yaw = rig.yaw;
    rig.follow(0.1, 0, true, 10 + LOOK_HOLD * 0.5);
    expect(rig.yaw).toBe(yaw);
    rig.follow(0.1, 0, true, 10 + LOOK_HOLD + 0.01);
    expect(rig.yaw).not.toBe(yaw);
  });

  it('standing still never moves the camera on its own', () => {
    const rig = new CameraRig(0.7);
    for (let i = 0; i < 600; i++) rig.follow(1 / 60, 2.5, false, 100 + i / 60);
    expect(rig.yaw).toBe(0.7);
  });

  it('looking while walking steers your walk with the view', () => {
    const rig = new CameraRig();
    rig.move(0, 1, true); // lock basis looking +z
    rig.look(Math.PI / 2 / LOOK_SENS, 0, 0); // turn right 90°
    const m = rig.move(0, 1, true);
    const f = rig.forward();
    expect(m.x).toBeCloseTo(f.x, 9);
    expect(m.z).toBeCloseTo(f.z, 9);
  });

  it('releasing the stick re-bases forward on the current view', () => {
    const rig = new CameraRig();
    simulate(rig, 0, -1, 6); // camera swings to look −z while "down" is held
    rig.move(0, 0, false); // let go
    const m = rig.move(0, 1, true); // push "up" again
    expect(m.z).toBeCloseTo(rig.forward().z, 9);
    expect(m.z).toBeLessThan(-0.99);
  });
});
