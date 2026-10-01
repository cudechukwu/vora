import { describe, expect, it } from 'vitest';
import { moodAt } from '../../src/row/sky';
import {
  NIGHT_SPEEDUP, PRESETS, START_HOUR, advance, formatHour, isNightHour, nextPreset, periodOf,
} from '../../src/row/clock';

describe('time of day', () => {
  it('is day at noon and night at midnight and 10pm', () => {
    expect(moodAt(12).night).toBe(0);
    expect(moodAt(0).night).toBe(1);
    expect(moodAt(22).night).toBe(1);
    expect(moodAt(18.75).night).toBeGreaterThan(0);
    expect(moodAt(18.75).night).toBeLessThan(1);
  });

  it('wraps around the clock', () => {
    expect(moodAt(24).top.getHex()).toBe(moodAt(0).top.getHex());
    expect(moodAt(-1).top.getHex()).toBe(moodAt(23).top.getHex());
    expect(moodAt(25.5).sunI).toBeCloseTo(moodAt(1.5).sunI, 9);
  });

  it('changes smoothly — no jumps between one minute and the next', () => {
    let prev = moodAt(0);
    for (let m = 1; m <= 24 * 60; m++) {
      const cur = moodAt(m / 60);
      const dc = Math.abs(cur.top.r - prev.top.r) + Math.abs(cur.top.g - prev.top.g) + Math.abs(cur.top.b - prev.top.b);
      expect(dc, `at ${formatHour(m / 60)}`).toBeLessThan(0.05);
      expect(Math.abs(cur.sunI - prev.sunI)).toBeLessThan(0.05);
      expect(Math.abs(cur.night - prev.night)).toBeLessThan(0.03);
      prev = cur;
    }
  });

  it('always points the sun (or moon) above the horizon', () => {
    for (let h = 0; h < 24; h += 0.25) {
      const d = moodAt(h).sunDir;
      expect(d.length()).toBeCloseTo(1, 6);
      expect(d.y).toBeGreaterThan(0);
    }
  });

  it('puts the afternoon sun in the west (behind the row, −x)', () => {
    expect(moodAt(16.5).sunDir.x).toBeLessThan(0);
    expect(moodAt(8).sunDir.x).toBeGreaterThan(0);
  });
});

describe('clock button', () => {
  it('formats hours', () => {
    expect(formatHour(0)).toBe('12:00 AM');
    expect(formatHour(12.5)).toBe('12:30 PM');
    expect(formatHour(17.3)).toBe('5:18 PM');
    expect(formatHour(23.999)).toBe('11:59 PM');
    expect(formatHour(24)).toBe('12:00 AM');
    expect(formatHour(-0.5)).toBe('11:30 PM');
  });
});

describe('game clock', () => {
  it('runs one game minute per real second in the day', () => {
    expect(advance(12, 60)).toBeCloseTo(13, 9);
    expect(advance(9, 30)).toBeCloseTo(9.5, 9);
  });

  it('runs faster at night, so sessions are mostly daylight', () => {
    expect(advance(21.5, 30)).toBeCloseTo(21.5 + NIGHT_SPEEDUP / 2, 9);
    expect(isNightHour(2)).toBe(true);
    expect(isNightHour(12)).toBe(false);
  });

  it('wraps past midnight', () => {
    expect(advance(23.5, 60)).toBeCloseTo(1.5, 9);
  });

  it('a whole day passes in well under half an hour of play', () => {
    let h = 0, secs = 0;
    while (secs < 3600) {
      const next = advance(h, 1);
      secs++;
      if (next < h) break; // wrapped: a full day
      h = next;
    }
    expect(secs).toBeGreaterThan(15 * 60);
    expect(secs).toBeLessThan(24 * 60);
  });

  it('a fresh visit reaches evening within a few minutes', () => {
    let h = START_HOUR, secs = 0;
    while (periodOf(h) !== 'GOLDEN') { h = advance(h, 1); secs++; }
    expect(secs).toBeLessThan(3 * 60);
    while (periodOf(h) !== 'NIGHT') { h = advance(h, 1); secs++; }
    expect(secs).toBeLessThan(6 * 60);
  });

  it('never jumps: frame-sized steps add up to the same time as one big step', () => {
    let h = 18;
    for (let i = 0; i < 60 * 60; i++) h = advance(h, 1 / 60); // one real minute of frames
    expect(h).toBeCloseTo(advance(18, 60), 6);
  });

  it('tapping the clock skips forward to the next moment, round the clock', () => {
    expect(nextPreset(15.5).tag).toBe('GOLDEN');
    expect(nextPreset(17.3).tag).toBe('SUNSET');
    expect(nextPreset(22).tag).toBe('MORNING');
    expect(nextPreset(3).tag).toBe('MORNING');
    let h = 0;
    const seen = PRESETS.map(() => { h = nextPreset(h).h; return periodOf(h); });
    expect(seen).toEqual(['MORNING', 'MIDDAY', 'GOLDEN', 'SUNSET', 'NIGHT']);
  });
});
