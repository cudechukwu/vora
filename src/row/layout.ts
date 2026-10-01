// ─── College Row layout (pure data, no three.js / DOM) ─────────────────
// Where everything is, as plain numbers, so collision + traffic + tests
// can use it without a renderer. buildings.ts / world.ts draw from this.
//
// You walk +z along the High Street side, starting at Boger: the row is on
// your right (−x), High Street on your left (+x), Andrus Field behind the
// row. ROW is laid out along −z, so walking +z you meet it bottom-up:
// Boger, South, North, Zelnick, Chapel, Judd, Allbritton.
// Order from a student's walk-through + the wesleyan.edu/about aerial.
// Usdan isn't on the row: it's the big triangle behind Boger, north of the
// field (from the user's Google Maps screenshot), so it's a polygon below.
// (−z is north, +x is east.)

export const FRONT_X = -15; // x of most facades
export const BUILDING_DEPTH = 45; // deepest a building may be (behind its facade); each has its own `depth`
export const ROW_START_Z = 40;

/** Walk (sidewalk in front of the row). */
export const PATH_HALF = 2.6;

/**
 * Behind the row: a wide coal-tar path (no lines — it's for walking; Physical Plant's golf
 * cart uses it too) between the backs of the buildings and Andrus Field. It runs from the
 * Boger–South walkway (by Usdan) down the row.
 */
export const BACK_PATH = { x0: -58, x1: -50.5 } as const;
export const FIELD_X = -64; // Andrus Field starts here and runs back (−x)

/** High Street. */
export const ROAD = { x0: 11, x1: 20 } as const;
export const FAR_WALK = { x0: 20.3, x1: 23.5 } as const;
export const CROSSWALK_W = 4;

export type BuildingId =
  | 'allbritton' | 'judd' | 'chapel' | 'zelnick' | 'north' | 'south' | 'boger';

export interface Spec {
  id: BuildingId;
  name: string;
  w: number; // extent along z
  gap: number; // space after it (toward −z)
  crossing?: number; // a walkway through that gap, this wide
  door?: number; // door z offset from the building's centre
  bulge?: number; // how far the facade sticks out past FRONT_X
  depth: number; // how far back from its facade it's solid (matches what's drawn)
}

export const ROW: Spec[] = [
  { id: 'allbritton', name: 'Allbritton Center', w: 34, gap: 22, crossing: 7, depth: 18.4 },
  { id: 'judd', name: 'Judd Hall', w: 30, gap: 10, depth: 18.4 },
  { id: 'chapel', name: 'Memorial Chapel', w: 22, gap: 0, door: 3.2, depth: 32.4 },
  { id: 'zelnick', name: 'Zelnick Pavilion', w: 14, gap: 0, depth: 32.4 }, // the glass link: solid back to the chapel's depth
  { id: 'north', name: 'North College', w: 36, gap: 8, depth: 18.4 },
  { id: 'south', name: 'South College', w: 24, gap: 20, crossing: 5, depth: 16.4 },
  { id: 'boger', name: 'Boger Hall', w: 44, gap: 10, door: -5, depth: 18.4 },
];

export interface RowStop {
  id: BuildingId;
  name: string;
  z0: number; // +z edge
  z1: number; // −z edge
  zc: number; // centre
  doorZ: number;
  front: number; // x of the facade
  back: number; // x of the back wall
}

/** A walkway crossing the row (and High Street) between two buildings. */
export interface Crossing { z: number; w: number }

export function layoutRow(row: Spec[] = ROW): { stops: RowStop[]; crossings: Crossing[] } {
  const stops: RowStop[] = [];
  const crossings: Crossing[] = [];
  let z = ROW_START_Z;
  for (const s of row) {
    const zc = z - s.w / 2;
    stops.push({
      id: s.id, name: s.name, z0: z, z1: z - s.w, zc,
      doorZ: zc + (s.door ?? 0), front: FRONT_X + (s.bulge ?? 0), back: FRONT_X + (s.bulge ?? 0) - s.depth,
    });
    if (s.crossing) crossings.push({ z: z - s.w - s.gap / 2, w: s.crossing });
    z -= s.w + s.gap;
  }
  return { stops, crossings };
}

export const ROW_END_Z = ROW.reduce((z, s) => z - s.w - s.gap, ROW_START_Z);
export const WALK_MIN_Z = ROW_START_Z + 30; // +z end of the walk
export const WALK_MAX_Z = ROW_END_Z - 70; // −z end of the walk: lawn north of Boger, toward Wyllys Ave

/** Where you start: just short of Boger, the row ahead on your right. */
export const SPAWN = { x: -0.6, z: ROW_END_Z } as const;

// ── Usdan University Center: a big triangle behind Boger, between it and Andrus Field ──
export interface XZ { x: number; z: number }
/** Its footprint, going round: north-east corner, down the east side (behind Boger), along the south side, the west tip. */
export const USDAN: XZ[] = [
  { x: -46, z: -228 }, { x: -37, z: -177 }, { x: -58, z: -175 }, { x: -88, z: -181 }, { x: -98, z: -198 },
];
/** The courtyard cut into the middle of it (open to the sky; you can't get in). */
export const USDAN_COURT: XZ[] = [{ x: -68, z: -201 }, { x: -55, z: -208 }, { x: -53, z: -194 }];
export const USDAN_NAME = 'Usdan University Center';

/** Is p inside the polygon? (even–odd) */
export function inPoly(p: XZ, poly: XZ[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/** Distance from p to the polygon's outline. */
export function distToPoly(p: XZ, poly: XZ[]): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i];
    const dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz;
    const t = L ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L)) : 0;
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz)));
  }
  return best;
}

/** In (or within `pad` of) Usdan. */
export const inUsdan = (p: XZ, pad = 0) => inPoly(p, USDAN) || (pad > 0 && distToPoly(p, USDAN) < pad);

/** Everywhere you can stand. */
export const BOUNDS = { xMin: -200, xMax: FAR_WALK.x1 - 0.4, zMin: WALK_MAX_Z - 10, zMax: WALK_MIN_Z + 10 } as const;

export const byId = (stops: RowStop[], id: BuildingId) => stops.find((s) => s.id === id)!;
