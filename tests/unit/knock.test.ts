import { describe, expect, it } from 'vitest';
import { HIT_REACH, HIT_SPEED, Knock, hits, launch, stepKnock } from '../../src/row/knock';

const car = (speed: number, heading = 0) => ({ x: 0, z: 0, heading, len: 4.4, kind: 'car' as const, speed });
const front = { x: 0, z: 2.2 + HIT_REACH - 0.05 }; // just off the front bumper

function run(k: Knock, secs: number, each?: (k: Knock) => void) {
  for (let t = 0; t < secs; t += 1 / 60) { stepKnock(k, 1 / 60); each?.(k); }
  return k;
}

describe('getting hit', () => {
  it('only at speed, and only if you touch the car', () => {
    expect(hits(car(HIT_SPEED + 1), front)).toBe(true);
    expect(hits(car(HIT_SPEED - 0.5), front)).toBe(false);
    expect(hits(car(10), { x: 0, z: 4 })).toBe(false);
    expect(hits(car(-8), { x: 0, z: -2.4 })).toBe(true); // reversing into someone counts
  });

  it('sends them up and along the way the car was going, faster car → further', () => {
    const slow = run(launch(car(4), front), 6), fast = run(launch(car(14), front), 6);
    expect(slow.z).toBeGreaterThan(front.z + 1);
    expect(fast.z).toBeGreaterThan(slow.z + 3);
    let peak = 0;
    run(launch(car(14), front), 2, (k) => { peak = Math.max(peak, k.y); });
    expect(peak).toBeGreaterThan(1.2);
  });

  it('reversing knocks them backwards', () => {
    const k = run(launch(car(-5), { x: 0, z: -2.4 }), 6);
    expect(k.z).toBeLessThan(-3);
  });

  it('they face the car that hit them', () => {
    const k = launch(car(10), front);
    expect(Math.cos(k.heading)).toBeLessThan(-0.9); // car came from −z, so they face −z
  });

  it('tumbles, lands flat, lies there, then gets back up', () => {
    const k = launch(car(12), front);
    const seen = new Set<string>();
    let flatWhileDown = true;
    run(k, 8, (s) => {
      seen.add(s.phase);
      if (s.phase === 'down' && s.t > 0.4) flatWhileDown &&= Math.abs(Math.cos(s.tilt)) < 0.05;
    });
    expect([...seen]).toEqual(['air', 'down', 'up', 'done']);
    expect(flatWhileDown).toBe(true);
    expect(k.tilt).toBe(0);
    expect(k.y).toBe(0);
  });

  it('never goes underground', () => {
    run(launch(car(16), front), 6, (k) => expect(k.y).toBeGreaterThanOrEqual(0));
  });

  it('a bogus frame changes nothing', () => {
    const k = launch(car(10), front);
    const before = { ...k };
    stepKnock(k, -1);
    stepKnock(k, NaN);
    expect(k).toEqual(before);
  });
});
