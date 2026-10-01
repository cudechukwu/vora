// ─── Game clock ────────────────────────────────────────────────────────
// Vora keeps its own time, GTA-style: one real second is one game minute,
// so a full day passes in ~24 minutes of play. Night runs twice as fast so
// a session isn't mostly dark. Tapping the clock skips ahead to the next
// moment worth seeing; time keeps flowing from there.

export const GAME_MIN_PER_SEC = 1;
export const NIGHT_SPEEDUP = 2;
export const NIGHT_FROM = 21; // speed-up window (hours)
export const NIGHT_TO = 5.5;
export const START_HOUR = 15.5; // a fresh visit starts mid-afternoon: golden hour is ~2 min away

export interface Preset { tag: string; h: number }
export const PRESETS: Preset[] = [
  { tag: 'MORNING', h: 7.6 }, { tag: 'MIDDAY', h: 12.5 }, { tag: 'GOLDEN', h: 17.3 },
  { tag: 'SUNSET', h: 18.75 }, { tag: 'NIGHT', h: 22 },
];

export const wrapHour = (h: number) => ((h % 24) + 24) % 24;

export const isNightHour = (h: number) => {
  const w = wrapHour(h);
  return w >= NIGHT_FROM || w < NIGHT_TO;
};

/** Hours per real second right now. */
export const rateAt = (h: number) => (GAME_MIN_PER_SEC / 60) * (isNightHour(h) ? NIGHT_SPEEDUP : 1);

/** Advance the game clock by `dt` real seconds. */
export function advance(h: number, dt: number): number {
  // integrate in small slices so the speed change at dusk/dawn lands in the right place
  let left = dt;
  while (left > 0) {
    const step = Math.min(left, 1);
    h = wrapHour(h + rateAt(h) * step);
    left -= step;
  }
  return h;
}

/** The next preset strictly after `h` (wrapping past midnight) — what a tap on the clock jumps to. */
export function nextPreset(h: number): Preset {
  const w = wrapHour(h);
  return PRESETS.find((p) => p.h > w + 1e-6) ?? PRESETS[0];
}

/** Name for the part of the day, shown next to the time. */
export function periodOf(h: number): string {
  const w = wrapHour(h);
  if (w < 5) return 'NIGHT';
  if (w < 6.5) return 'DAWN';
  if (w < 11) return 'MORNING';
  if (w < 14) return 'MIDDAY';
  if (w < 16.8) return 'AFTERNOON';
  if (w < 18.3) return 'GOLDEN';
  if (w < 19.4) return 'SUNSET';
  if (w < 20.5) return 'DUSK';
  return 'NIGHT';
}

/** 17.3 → "5:18 PM" */
export function formatHour(h: number): string {
  const wrapped = wrapHour(h);
  const H = Math.floor(wrapped);
  const M = Math.min(59, Math.floor((wrapped - H) * 60 + 1e-6));
  return `${((H + 11) % 12) + 1}:${String(M).padStart(2, '0')} ${H < 12 ? 'AM' : 'PM'}`;
}

/**
 * Where sleep takes you. A nap in the day (5am–3pm) runs into the night; go to bed any
 * other time and you wake up the next morning.
 */
export function wakeFrom(h: number): { h: number; tag: 'night' | 'morning' } {
  const w = wrapHour(h);
  return w >= 5 && w < 15 ? { h: 21, tag: 'night' } : { h: 7.5, tag: 'morning' };
}
