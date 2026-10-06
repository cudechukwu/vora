import { XZ, byId, layoutRow } from './layout';

// ─── Zelnick Pavilion (pure) ───────────────────────────────────────────
// The glass pavilion between Memorial Chapel and South College (the user's photos and street view, 2026-10-06).
// From High Street: set back behind a granite forecourt, a tall glass box under a thin flared roof, double glass
// doors in the middle, low glass links either side to its neighbours. Through it, a lower glass link to the back
// pavilion on the field side: glass under a deep roof with a wood soffit, a stone-clad pier and a glass stair tower
// at one end, and — what the user wanted kept — a landing up a few steps, and a ramp along the wall, with metal
// railings. The ramp and steps really lift you (`zelnickY`, added to the ground height outside).

export interface Rect { x0: number; x1: number; z0: number; z1: number }

const stop = byId(layoutRow().stops, 'zelnick');
const zc = stop.zc;

/** Its stop: front (set back behind the forecourt) and back, both ends. */
export const ZEL = { front: stop.front, back: stop.back, z0: stop.z0, z1: stop.z1, zc } as const;

/** The parts, as rectangles in plan (and their heights), from the front back. */
export const ZEL_PARTS = {
  front: { x0: stop.front - 11, x1: stop.front, z0: zc - 8, z1: zc + 8, h: 6.2 }, // the tall glass box
  links: { x0: stop.front - 9, x1: stop.front - 2, h: 3.6 }, // low glass either side, to the chapel and South College
  middle: { x0: stop.back + 7, x1: stop.front - 11, z0: zc - 5, z1: zc + 5, h: 4.4 },
  rear: { x0: stop.back, x1: stop.back + 7, z0: zc - 9, z1: zc + 7, h: 6 },
  pier: { x0: stop.back + 3, x1: stop.back + 7, z0: stop.z1, z1: zc - 9, h: 9.5 }, // stone-clad
  stairTower: { x0: stop.back, x1: stop.back + 3, z0: stop.z1, z1: zc - 9, h: 8 },
} as const;

/** The forecourt between the walk's spur and the front doors, granite paving. */
export const FORECOURT: Rect = { x0: stop.front, x1: stop.front + 3, z0: zc - 8, z1: zc + 8 };

/** The back entrance: its door, the raised landing in front, steps down off its side, a ramp down along the wall. */
export const REAR_ENTRY = (() => {
  const H = 0.45, x = stop.back, doorZ = zc - 5;
  return {
    H, doorZ,
    landing: { x0: x - 2, x1: x, z0: zc - 7, z1: zc - 3 },
    steps: { x0: x - 3.5, x1: x - 2, z0: zc - 7, z1: zc - 3, n: 3 },
    ramp: { x0: x - 2, x1: x, z0: zc - 3, z1: zc - 3 + 5.4 }, // down toward +z, 1:12 (2 m wide: you keep clear of the wall)
  };
})();

const inR = (p: XZ, r: Rect) => p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1;

/** How high the ground is at (x, z) at Zelnick's back entrance: up the steps or the ramp to the landing. 0 elsewhere. */
export function zelnickY(x: number, z: number): number {
  const p = { x, z }, R = REAR_ENTRY;
  if (inR(p, R.landing)) return R.H;
  if (inR(p, R.ramp)) return R.H * (1 - (z - R.ramp.z0) / (R.ramp.z1 - R.ramp.z0));
  if (inR(p, R.steps)) { // the top step is the landing's height less one riser
    const k = Math.min(R.steps.n - 1, Math.floor(((x - R.steps.x0) / (R.steps.x1 - R.steps.x0)) * R.steps.n));
    return (R.H * (k + 1)) / (R.steps.n + 1);
  }
  return 0;
}

/**
 * What you bump into outside: the railing and low granite wall down the ramp's open side, the railing along the
 * landing and steps' far edge, the granite bench out on the front lawn, the forecourt's low side walls and its lamp.
 * Padded by `pad` (your radius).
 */
export function zelnickSolids(pad = 0.3): Rect[] {
  const R = REAR_ENTRY, grow = (r: Rect): Rect => ({ x0: r.x0 - pad, x1: r.x1 + pad, z0: r.z0 - pad, z1: r.z1 + pad });
  return [
    { x0: R.ramp.x0 - 0.15, x1: R.ramp.x0 + 0.05, z0: R.ramp.z0, z1: R.ramp.z1 }, // ramp's open side
    { x0: R.steps.x0, x1: R.landing.x1, z0: R.landing.z0 - 0.15, z1: R.landing.z0 + 0.05 }, // the far rail
    ...ZEL_BENCH,
    { x0: FORECOURT.x0, x1: FORECOURT.x1, z0: FORECOURT.z0 - 0.4, z1: FORECOURT.z0 }, // low walls
    { x0: FORECOURT.x0, x1: FORECOURT.x1, z0: FORECOURT.z1, z1: FORECOURT.z1 + 0.4 },
    { x0: ZEL_LAMP.x - 0.12, x1: ZEL_LAMP.x + 0.12, z0: ZEL_LAMP.z - 0.12, z1: ZEL_LAMP.z + 0.12 },
  ].map(grow);
}

/** The long, low granite bench out on the lawn in front (the user's street view), off to the side of the spur walk. */
export const ZEL_BENCH: Rect[] = [{ x0: stop.front + 7, x1: stop.front + 7.6, z0: zc + 2.5, z1: zc + 9.5 }];
/** A disc-headed pole lamp at the forecourt's corner. */
export const ZEL_LAMP = { x: stop.front + 3.4, z: zc - 9 } as const;
