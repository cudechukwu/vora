// ─── College Row layout (pure data, no three.js / DOM) ─────────────────
// Where everything is, as plain numbers, so collision + traffic + tests
// can use it without a renderer. buildings.ts / world.ts draw from this.
//
// You walk +z along the High Street side, starting at Usdan: the row is on
// your right (−x), High Street on your left (+x), Andrus Field behind the
// row. ROW is laid out along −z, so walking +z you meet it bottom-up:
// Usdan, Boger, South, North, Zelnick, Chapel, Judd, Allbritton.
// Order from a student's walk-through + the wesleyan.edu/about aerial.

export const FRONT_X = -15; // x of most facades
export const BUILDING_DEPTH = 45; // how far behind its facade a building is solid
export const ROW_START_Z = 40;

/** Walk (sidewalk in front of the row). */
export const PATH_HALF = 2.6;

/** High Street. */
export const ROAD = { x0: 11, x1: 20 } as const;
export const FAR_WALK = { x0: 20.3, x1: 23.5 } as const;
export const CROSSWALK_W = 4;

export type BuildingId =
  | 'allbritton' | 'judd' | 'chapel' | 'zelnick' | 'north' | 'south' | 'boger' | 'usdan';

export interface Spec {
  id: BuildingId;
  name: string;
  w: number; // extent along z
  gap: number; // space after it (toward −z)
  crossing?: number; // a walkway through that gap, this wide
  door?: number; // door z offset from the building's centre
  bulge?: number; // how far the facade sticks out past FRONT_X
}

export const ROW: Spec[] = [
  { id: 'allbritton', name: 'Allbritton Center', w: 34, gap: 22, crossing: 7 },
  { id: 'judd', name: 'Judd Hall', w: 30, gap: 10 },
  { id: 'chapel', name: 'Memorial Chapel', w: 22, gap: 0, door: 3.2 },
  { id: 'zelnick', name: 'Zelnick Pavilion', w: 14, gap: 0 },
  { id: 'north', name: 'North College', w: 36, gap: 8 },
  { id: 'south', name: 'South College', w: 24, gap: 20, crossing: 5 },
  { id: 'boger', name: 'Boger Hall', w: 44, gap: 10, door: -5 },
  { id: 'usdan', name: 'Usdan University Center', w: 50, gap: 0, bulge: 6 },
];

export interface RowStop {
  id: BuildingId;
  name: string;
  z0: number; // +z edge
  z1: number; // −z edge
  zc: number; // centre
  doorZ: number;
  front: number; // x of the facade
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
      doorZ: zc + (s.door ?? 0), front: FRONT_X + (s.bulge ?? 0),
    });
    if (s.crossing) crossings.push({ z: z - s.w - s.gap / 2, w: s.crossing });
    z -= s.w + s.gap;
  }
  return { stops, crossings };
}

export const ROW_END_Z = ROW.reduce((z, s) => z - s.w - s.gap, ROW_START_Z);
export const WALK_MIN_Z = ROW_START_Z + 30; // +z end of the walk
export const WALK_MAX_Z = ROW_END_Z - 20; // −z end of the walk

/** Everywhere you can stand. */
export const BOUNDS = { xMin: -200, xMax: FAR_WALK.x1 - 0.4, zMin: WALK_MAX_Z - 10, zMax: WALK_MIN_Z + 10 } as const;

export const byId = (stops: RowStop[], id: BuildingId) => stops.find((s) => s.id === id)!;
