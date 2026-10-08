import { BOUNDS } from './layout';

// ─── Where you were (pure) ─────────────────────────────────────────────
// The page can reload under you: the dev server does on every code change,
// and iPhone Safari throws away background tabs to save memory. So every few
// seconds (and when the page is hidden) we note where you are, and put you
// back there next time. It lives on your phone (localStorage) — no server.

export type Place = 'out' | 'in' | 'usdan' | 'casper';

export interface SavedSpot {
  where: Place;
  x: number;
  z: number;
  heading: number;
  level: number; // (0–1 in your house, 0–3 in Casper)
  /** when it was saved (ms since epoch) */
  at: number;
}

export const SPOT_KEY = 'vora.row.spot';
/** Older than this and you start fresh outside your house (a new day, a new visit). */
export const SPOT_TTL = 12 * 60 * 60 * 1000;

export const saveSpot = (s: SavedSpot) => JSON.stringify({
  where: s.where, x: +s.x.toFixed(2), z: +s.z.toFixed(2), heading: +s.heading.toFixed(3), level: s.level, at: Math.round(s.at),
});

/**
 * Read a saved spot back. Anything odd, too old, or out of the world → null (start at home).
 * `ok` lets the caller veto a spot it can't stand on (inside a wall, say).
 */
export function loadSpot(raw: string | null, now: number, ok: (s: SavedSpot) => boolean = () => true): SavedSpot | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!s || !['out', 'in', 'usdan', 'casper'].includes(s.where)) return null;
    if (![s.x, s.z, s.heading, s.at].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
    if (![0, 1, 2, 3].includes(s.level) || (s.where !== 'casper' && s.level > 1)) return null;
    if (now - s.at > SPOT_TTL || s.at > now + 60_000) return null;
    if (s.x < BOUNDS.xMin || s.z < BOUNDS.zMin || s.z > BOUNDS.zMax || s.x > 110) return null;
    const spot: SavedSpot = { where: s.where, x: s.x, z: s.z, heading: s.heading, level: s.level, at: s.at };
    return ok(spot) ? spot : null;
  } catch {
    return null;
  }
}
