import { describe, expect, it } from 'vitest';
import { Box3, Mesh } from 'three';
import { Person, gait, randomLook, runBlend, strideRate } from '../../src/row/people';
import { SPEED } from '../../src/row/mobility';

const meshes = (p: Person) => { let n = 0; p.root.traverse((o) => { if ((o as Mesh).isMesh) n++; }); return n; };
const lowest = (p: Person) => { p.root.updateMatrixWorld(true); return new Box3().setFromObject(p.root).min.y; };
const highest = (p: Person) => { p.root.updateMatrixWorld(true); return new Box3().setFromObject(p.root).max.y; };

describe('the gait', () => {
  it('walking is walking, running is running', () => {
    expect(runBlend(1.3)).toBe(0);
    expect(runBlend(SPEED.walk)).toBe(0);
    expect(runBlend(SPEED.run)).toBe(1);
  });

  it('running folds the knees far more than walking (heel up behind)', () => {
    const maxKnee = (speed: number) => {
      let m = 0;
      for (let ph = 0; ph < Math.PI * 2; ph += 0.05) m = Math.max(m, ...gait(ph, speed).knee);
      return m;
    };
    expect(maxKnee(SPEED.run)).toBeGreaterThan(1.8);
    expect(maxKnee(1.3)).toBeLessThan(0.9);
    expect(maxKnee(SPEED.run)).toBeGreaterThan(maxKnee(1.3) * 2);
  });

  it('running: elbows bent, body leaning in, longer stride', () => {
    const run = gait(1, SPEED.run), walk = gait(1, 1.3);
    expect(Math.min(...run.elbow)).toBeGreaterThan(1.2);
    expect(run.lean).toBeGreaterThan(0.25);
    expect(walk.lean).toBeLessThan(0.06);
    expect(Math.abs(gait(Math.PI / 2, SPEED.run).thigh[0])).toBeGreaterThan(Math.abs(gait(Math.PI / 2, 1.3).thigh[0]));
  });

  it('legs and arms alternate: left leg forward, right leg back, left arm back', () => {
    const p = gait(Math.PI / 2, 1.3);
    expect(p.thigh[0]).toBeGreaterThan(0);
    expect(p.thigh[1]).toBeLessThan(0);
    expect(p.arm[0]).toBeLessThan(0);
    expect(p.arm[1]).toBeGreaterThan(0);
  });

  it('your stride quickens as you go faster, without going frantic', () => {
    expect(strideRate(SPEED.walk)).toBeGreaterThan(strideRate(1.3));
    expect(strideRate(SPEED.run)).toBeGreaterThan(strideRate(SPEED.walk));
    expect(strideRate(SPEED.run) / (Math.PI * 2)).toBeLessThan(2.2); // < 2.2 strides a second
  });
});

describe('a person', () => {
  it('has knees and elbows, for no more draw calls than the old stiff rig (~13)', () => {
    const p = new Person(randomLook(3));
    expect(meshes(p)).toBeLessThanOrEqual(12);
  });

  it('stands about 1.8m tall, feet on the ground', () => {
    const p = new Person(randomLook(4));
    p.walk(1 / 60, 0);
    expect(lowest(p)).toBeCloseTo(0, 1);
    expect(highest(p)).toBeGreaterThan(1.7);
    expect(highest(p)).toBeLessThan(2.0);
  });

  it.each([1.3, SPEED.walk, SPEED.run])('feet never sink far into the ground at %f m/s', (speed) => {
    const p = new Person(randomLook(5));
    for (let i = 0; i < 120; i++) {
      p.walk(1 / 60, speed);
      expect(lowest(p)).toBeGreaterThan(-0.12);
    }
  });

  it('sits on a bench with feet on the ground, and on the grass without sinking into it', () => {
    for (let seed = 0; seed < 6; seed++) {
      const p = new Person(randomLook(seed));
      p.sit(0.5);
      expect(lowest(p)).toBeGreaterThan(-0.1);
      expect(lowest(p)).toBeLessThan(0.1);
      p.sit(0.12);
      expect(lowest(p)).toBeGreaterThan(-0.15);
    }
  });

  it('lies flat on the ground after being knocked down, not under it', () => {
    const p = new Person(randomLook(7));
    for (const tilt of [-Math.PI / 2, Math.PI / 2]) {
      p.limp(tilt);
      expect(lowest(p)).toBeGreaterThan(-0.1);
      expect(highest(p)).toBeLessThan(0.6);
    }
    p.limp(0);
    expect(highest(p)).toBeGreaterThan(1.7); // back up
  });
});
