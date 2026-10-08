// ─── College Row layout (pure data, no three.js / DOM) ─────────────────
// Where everything is, as plain numbers, so collision + traffic + tests
// can use it without a renderer. buildings.ts / world.ts draw from this.
//
// You walk +z along the High Street side, starting at Boger: the row is on
// your right (−x), High Street on your left (+x), Andrus Field behind the
// row. ROW is laid out along −z, so walking +z you meet it bottom-up:
// Boger, North College (long, brownstone, a columned portico), a glass
// bridge, South College (the old one with the belfry tower), Zelnick,
// Chapel, Judd. Judd is the last one, level with the Frank Center across
// the back path: south of it, a tar walkway, and Allbritton sits off the
// row at the south end of the back path (southend.ts). Order and sizes from
// the user's Google Maps view and photos (2026-10-04).
// Order from a student's walk-through + the wesleyan.edu/about aerial.
// Usdan isn't on the row: it's the big triangle behind Boger, north of the
// field (from the user's Google Maps screenshot), so it's a polygon below.
// (−z is north, +x is east.)

export const FRONT_X = -15; // x of most facades
export const BUILDING_DEPTH = 45; // deepest a building may be (behind its facade); each has its own `depth`
export const ROW_START_Z = 60;

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
/** (Moved 30 m east on 2026-10-07: the lawn in front of the row is big, the user's photos; it's `frontlawn.ts`.) */
export const ROAD = { x0: 41, x1: 50 } as const;
export const FAR_WALK = { x0: 50.3, x1: 53.5 } as const;
export const CROSSWALK_W = 4;

export type BuildingId =
  | 'judd' | 'chapel' | 'zelnick' | 'north' | 'south' | 'boger';

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
  { id: 'judd', name: 'Judd Hall', w: 30, gap: 10, depth: 18.4 }, // (a straight walk runs through the gap to the back path)
  { id: 'chapel', name: 'Memorial Chapel', w: 22, gap: 0, door: 3.2, depth: 18.4 }, // its back in line with Judd's
  { id: 'zelnick', name: 'Zelnick Pavilion', w: 22, gap: 0, bulge: -3, depth: 25 }, // glass, set back 3 m behind a forecourt; through to a back entrance
  { id: 'south', name: 'South College', w: 24, gap: 26, depth: 16.4 }, // (the lawn with the X of walks, to North College)
  { id: 'north', name: 'North College', w: 60, gap: 20, crossing: 5, depth: 18.4 },
  { id: 'boger', name: 'Boger Hall', w: 44, gap: 10, door: -5, depth: 18.4 },
];

/**
 * The row starts this far in from ROW_START_Z: before Judd (south of it) is open lawn, crossed `walk` m
 * short of Judd by a tar walkway this wide, from High Street to the back path (and on west as the field road).
 */
export const ROW_OPEN = { len: 26, walk: 7.5, w: 7 } as const;

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
  let z = ROW_START_Z - ROW_OPEN.len;
  crossings.push({ z: z + ROW_OPEN.walk, w: ROW_OPEN.w }); // the walkway south of Judd
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

export const ROW_END_Z = ROW.reduce((z, s) => z - s.w - s.gap, ROW_START_Z - ROW_OPEN.len);
export const WALK_MIN_Z = ROW_START_Z + 30; // +z end of the walk
export const WALK_MAX_Z = ROW_END_Z - 70; // −z end of the walk: lawn north of Boger, toward Wyllys Ave

/** The north end of the walk, just short of Boger, the row ahead on your right (bikes in a rack here). */
export const ROW_ENTRY = { x: -0.6, z: ROW_END_Z } as const;
// (where you start the game — outside your house — is HOME_SPAWN in house/plan.ts)

// ── Usdan University Center: a big triangle behind Boger, between it and Andrus Field ──
export interface XZ { x: number; z: number }
/**
 * Its footprint, going round: north-east corner, down the east face (which looks across the plaza at
 * Boger, the back path running straight into it), along the south side, the west tip.
 */
export const USDAN: XZ[] = [
  { x: -62, z: -238 }, { x: -60, z: -178 }, { x: -80, z: -176 }, { x: -104, z: -182 }, { x: -114, z: -201 },
];
/** The courtyard cut into the middle of it (open to the sky; you can't get in). */
export const USDAN_COURT: XZ[] = [{ x: -84, z: -204 }, { x: -71, z: -211 }, { x: -69, z: -197 }];

/**
 * The plaza between Usdan and Boger: speckled concrete slabs, trees in stone-chip pits, granite
 * benches and tables, outdoor tables and chairs. Fills the space between Usdan's east face and
 * the back of Boger, and spills round Boger's south end into the walkway to High Street.
 */
export const PLAZA = { x0: -60, x1: -32, z0: -240, z1: -163 } as const;
export const PLAZA_GAP = { x0: -32, x1: -15.5, z0: -178.6, z1: -161.4 } as const; // between Boger and South College
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
export const BOUNDS = { xMin: -200, xMax: FAR_WALK.x1 - 0.4, zMin: WALK_MAX_Z - 10, zMax: 135 } as const; // (south: Church Street's far sidewalk)

export const byId = (stops: RowStop[], id: BuildingId) => stops.find((s) => s.id === id)!;

/** North College's portico: four giant columns this far out in front of its facade, at these offsets from its middle. */
export const PORTICO = { out: 2.6, r: 0.55, at: [-6.3, -2.1, 2.1, 6.3] } as const;
/** Judd's entrance porch: two pairs of columns this far out from its facade, at these offsets from its middle. */
export const JUDD_PORCH = { out: 2.3, r: 0.26, at: [-2.0, -1.35, 1.35, 2.0] } as const;
/** Memorial Chapel's entrance porch on High Street: this far out from the facade, this wide either side of its door. */
export const CHAPEL_PORCH = { out: 3.4, half: 2.5 } as const;
/** South College's tower, standing out this far from the middle of its facade, this wide either side. */
export const SOUTH_TOWER = { out: 3.2, half: 3 } as const;

/** Bits of the row that stand out past the facades (and are solid): the portico's columns, Judd's and the chapel's porches, South College's tower. */
export function rowSolids(stops: RowStop[], pad = 0.3): { x0: number; x1: number; z0: number; z1: number }[] {
  const out: { x0: number; x1: number; z0: number; z1: number }[] = [];
  const north = stops.find((s) => s.id === 'north'), south = stops.find((s) => s.id === 'south'), judd = stops.find((s) => s.id === 'judd');
  if (north) {
    for (const o of PORTICO.at) {
      const x = FRONT_X + PORTICO.out, z = north.zc + o, r = PORTICO.r + pad;
      out.push({ x0: x - r, x1: x + r, z0: z - r, z1: z + r });
    }
  }
  if (judd) {
    for (const o of JUDD_PORCH.at) {
      const x = FRONT_X + JUDD_PORCH.out, z = judd.doorZ + o, r = JUDD_PORCH.r + pad;
      out.push({ x0: x - r, x1: x + r, z0: z - r, z1: z + r });
    }
  }
  const chapel = stops.find((s) => s.id === 'chapel');
  if (chapel) {
    out.push({ x0: FRONT_X - 1, x1: FRONT_X + CHAPEL_PORCH.out + pad, z0: chapel.doorZ - CHAPEL_PORCH.half - pad, z1: chapel.doorZ + CHAPEL_PORCH.half + pad });
    const bx = FRONT_X - 18; // the granite seat wall along its back
    out.push({ x0: bx - 1.9 - pad, x1: bx - 1.3 + pad, z0: chapel.doorZ - 7 - pad, z1: chapel.doorZ + 7 + pad });
  }
  if (south) out.push({ x0: FRONT_X - 1, x1: FRONT_X + SOUTH_TOWER.out + pad, z0: south.zc - SOUTH_TOWER.half - pad, z1: south.zc + SOUTH_TOWER.half + pad });
  return out;
}
