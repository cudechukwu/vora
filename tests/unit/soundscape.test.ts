import { describe, expect, it } from 'vitest';
import { Listen, daylight, falloff, honkNow, mixAt } from '../../src/row/soundscape';

const base: Listen = { hour: 13, where: 'out', roadDist: 50, traffic: 0, people: 0, car: null, gas: 0, surface: 'grass', skidding: false };
const at = (o: Partial<Listen>) => mixAt({ ...base, ...o });

describe('the soundscape', () => {
  it('birds in the day, crickets at night', () => {
    expect(at({ hour: 13 }).birds).toBeGreaterThan(0.2);
    expect(at({ hour: 13 }).crickets).toBe(0);
    expect(at({ hour: 23 }).crickets).toBeGreaterThan(0.2);
    expect(at({ hour: 23 }).birds).toBe(0);
    expect(daylight(6.2)).toBeGreaterThan(0);
    expect(daylight(6.2)).toBeLessThan(1);
  });

  it('High Street hums louder the closer you are, and with traffic going by', () => {
    expect(at({ roadDist: 2 }).road).toBeGreaterThan(at({ roadDist: 40 }).road * 1.5);
    expect(at({ roadDist: 2, traffic: 1 }).road).toBeGreaterThan(at({ roadDist: 2 }).road);
  });

  it('indoors: no birds, wind or crickets; the street is muffled; there\'s a room tone', () => {
    for (const where of ['in', 'usdan'] as const) {
      const m = at({ where, roadDist: 5, hour: 23 });
      expect(m.birds + m.crickets + m.wind).toBe(0);
      expect(m.road).toBeLessThan(at({ roadDist: 5 }).road * 0.3);
      expect(m.room).toBeGreaterThan(0);
    }
  });

  it('Usdan is busy; a crowd outside is louder the more people there are', () => {
    expect(at({ where: 'usdan' }).crowd).toBeGreaterThan(0.3);
    expect(at({ people: 10 }).crowd).toBeGreaterThan(at({ people: 2 }).crowd);
    expect(at({ people: 0 }).crowd).toBe(0);
  });

  it('your engine: off on foot; idles in the car, revs up with speed and gas; tyres louder off the tar', () => {
    expect(at({}).engine).toBe(0);
    const idle = at({ car: 0 }), fast = at({ car: 20, gas: 1 });
    expect(idle.engine).toBeGreaterThan(0);
    expect(fast.rpm).toBeGreaterThan(idle.rpm + 40);
    expect(at({ car: 10, surface: 'grass' }).tyres).toBeGreaterThan(at({ car: 10, surface: 'tar' }).tyres);
    expect(at({ car: 10, surface: 'grass' }).tyreTone).toBeLessThan(at({ car: 10, surface: 'tar' }).tyreTone);
  });

  it('tyres squeal skidding on hard ground, not on grass', () => {
    expect(at({ car: 15, surface: 'tar', skidding: true }).skid).toBeGreaterThan(0);
    expect(at({ car: 15, surface: 'grass', skidding: true }).skid).toBe(0);
  });

  it('every level stays in 0..1', () => {
    for (const hour of [0, 6, 12, 19.5, 23]) for (const where of ['out', 'in', 'usdan'] as const) {
      const m = at({ hour, where, roadDist: 0, traffic: 5, people: 99, car: 30, gas: 1, skidding: true, surface: 'tar' });
      for (const [k, v] of Object.entries(m)) if (k !== 'rpm' && k !== 'tyreTone') expect([k, v >= 0 && v <= 1]).toEqual([k, true]);
    }
  });
});

describe('horns', () => {
  it('a held-up driver honks after a moment, then every few seconds, not every frame', () => {
    expect(honkNow(1, -1)).toBe(false);
    expect(honkNow(1.6, -1)).toBe(true);
    expect(honkNow(2.5, 1.6)).toBe(false);
    expect(honkNow(5.2, 1.6)).toBe(true);
  });

  it('sounds fade with distance', () => {
    expect(falloff(0)).toBe(1);
    expect(falloff(30)).toBeGreaterThan(falloff(50));
    expect(falloff(80)).toBe(0);
  });
});
