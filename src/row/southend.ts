import type { Box, XZ } from './collide';
import { zelnickY } from './zelnick';
import { BACK_PATH, distToPoly, inPoly } from './layout';

// ─── The south end of Andrus Field (pure data) ─────────────────────────
// From the user's photos, the architects' photos of the Frank Center and
// their Google Maps view (2026-10-04). Judd is the last building on the
// row, level with the Frank Center across the back path; south of it a tar
// walkway runs to High Street, and the back path carries on to Allbritton
// (usdan ──────> allbritton). At Judd's north end a coal-tar road goes off
// west between the football field (north, behind its chain-link fence) and
// a raised grass bank. On the bank, west of the back path:
//  - the Frank Center's historic block (brick, white limestone corners,
//    cornice and parapet; an arched niche with a balcony on its north end,
//    a medallion over the door on its east side, stairs up to it from a
//    plaza with tables);
//  - its new addition at the foot of the bank (brick, white roof edges,
//    tall stone-framed windows, the glass "FRANK CENTER" main entry facing
//    the plaza), joined to the old block by a tall glass connector, which
//    you reach by the granite stairs up from the field road;
//  - a good way west, Olin Library (its curved drum of tall arched windows
//    facing the field), joined to the Frank Center by a pale limestone
//    connector with a glass entrance pavilion in front.
// At the foot of the stairs: a big sycamore in mulch, a tan paver landing,
// brown bollard lights, a black sign. Another sycamore stands by the back
// path at the addition's corner.

/** The road along the south end of the field. Its east end meets the back path. */
export const FIELD_ROAD = { x0: -190, x1: BACK_PATH.x0, z0: -4.2, z1: 2.8 } as const;

/** How high the bank lifts the buildings. */
export const TERRACE_Y = 2;

/** The bank: flat on top, sloping down to its edges here (the north slope, to the road, is longer). */
export const BERM = { x0: -172, x1: -73, z0: 3.4, z1: 73 } as const;
const SLOPE = 5, SLOPE_N = 6;

type Rect = { x0: number; x1: number; z0: number; z1: number };

/** The Frank Center's historic block, up on the bank: its short north end faces the field, its long east side the plaza. */
export const FRANK = { x0: -108, x1: -86, z0: 14, z1: 56, h: 15.5, name: 'Frank Center' } as const;
/** The tall glass connector between the historic block and the addition: its doors face the stairs up from the field road. */
export const FRANK_LINK = { x0: -86, x1: -74, z0: 15, z1: 29, h: 11 } as const;
/** The new addition, at the foot of the bank by the back path. */
export const FRANK_ADD = { x0: -74, x1: -61, z0: 13, z1: 40, h: 12.5 } as const;
/** The glass doors into the connector (at the top of the stairs). */
export const LINK_DOOR = { x: -82, z: FRANK_LINK.z0 } as const;
/** The historic block's door under the medallion, on its east side, up the east stairs from the plaza. */
export const FRANK_DOOR = { x: FRANK.x1, z: 44 } as const;
/** The addition's main entry ("FRANK CENTER"), on its south side, onto the plaza. */
export const MAIN_ENTRY = { x: -67.5, z: FRANK_ADD.z1 } as const;

/** Tan brick pavers at the foot of the stairs, off the road. */
export const LANDING = { x0: LINK_DOOR.x - 7, x1: LINK_DOOR.x + 7, z0: FIELD_ROAD.z1, z1: 4.8 } as const;
/** Granite stairs straight up the bank from the field road, toward the glass connector. */
export const STAIRS = { x0: LINK_DOOR.x - 2, x1: LINK_DOOR.x + 2, z0: LANDING.z1, z1: 9.6, steps: 12 } as const;
/** The stairs up the bank's east side from the plaza to the medallion door (rising toward −x). */
export const STAIRS_E = { x0: -78, x1: -73.5, z0: FRANK_DOOR.z - 2, z1: FRANK_DOOR.z + 2, steps: 12 } as const;

/** The tar plaza at the foot of the bank: south of the addition, east of the historic block. */
export const PLAZA_F = { x0: -73, x1: BACK_PATH.x0, z0: FRANK_ADD.z1, z1: 62 } as const;
export const PLAZA_TABLES: XZ[] = [{ x: -68, z: 48.5 }, { x: -63.5, z: 53 }, { x: -68, z: 57.5 }];
export const PLAZA_BENCHES: XZ[] = [{ x: -71.7, z: 50.5 }, { x: -71.7, z: 55 }, { x: -71.7, z: 59.5 }]; // along the foot of the bank, facing east
export const UTILITY_BOX: XZ = { x: -61, z: 60 };
export const PLAZA_BIN: XZ = { x: -59.6, z: 43 };
/** Chairs round a plaza table: where you sit and which way you face (at the table). */
export function plazaChairs(t: XZ): { x: number; z: number; heading: number }[] {
  return [0, 1, 2, 3].map((k) => {
    const a = k * (Math.PI / 2) + Math.PI / 4;
    const x = t.x + Math.sin(a) * 1.0, z = t.z + Math.cos(a) * 1.0;
    return { x, z, heading: Math.atan2(t.x - x, t.z - z) };
  });
}
/** Who's out at the tables (table, chair). */
export const PLAZA_SITTERS: [number, number][] = [[0, 0], [0, 2], [1, 1], [2, 3]];

/** Olin Library, a good way west: a block, with a half drum on its north side facing the field. */
export const OLIN = { cx: -141, cz: 28, r: 14, x0: -164, x1: -118, z1: 66, h: 13, name: 'Olin Library' } as const;
/** The pale limestone connector between Olin and the Frank Center… */
export const OLIN_LINK = { x0: OLIN.x1, x1: FRANK.x0, z0: 24, z1: 46, h: 7 } as const;
/** …and the glass entrance pavilion in front of it, under a thin flat roof (like Zelnick). */
export const PAVILION = { x0: OLIN.x1 + 1, x1: FRANK.x0 - 1, z0: 16, z1: OLIN_LINK.z0, h: 5 } as const;

/** Olin's outline, going round: the block's north-east corner, the drum from its east end round to the west, the rest of the block. */
export const OLIN_POLY: XZ[] = (() => {
  const pts: XZ[] = [{ x: OLIN.x1, z: OLIN.cz }];
  for (let i = 0; i <= 16; i++) {
    const a = (Math.PI * i) / 16;
    pts.push({ x: OLIN.cx + OLIN.r * Math.cos(a), z: OLIN.cz - OLIN.r * Math.sin(a) });
  }
  pts.push({ x: OLIN.x0, z: OLIN.cz }, { x: OLIN.x0, z: OLIN.z1 }, { x: OLIN.x1, z: OLIN.z1 });
  return pts;
})();

/** Allbritton Center: off the row, at the south end of the back path, which runs straight to its front door. */
export const ALLBRITTON = { x0: -69, x1: -39, z0: 66, z1: 90, h: 16, name: 'Allbritton Center' } as const;
export const ALLBRITTON_DOOR = { x: (BACK_PATH.x0 + BACK_PATH.x1) / 2, z: ALLBRITTON.z0 } as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const inRect = (p: XZ, b: Rect, pad = 0) => p.x > b.x0 - pad && p.x < b.x1 + pad && p.z > b.z0 - pad && p.z < b.z1 + pad;

/** The bank's height, ignoring the stairs and landing cut into it. */
export function bankY(x: number, z: number): number {
  const a = Math.min((x - BERM.x0) / SLOPE, (BERM.x1 - x) / SLOPE, (z - BERM.z0) / SLOPE_N, (BERM.z1 - z) / SLOPE);
  const t = clamp01(a);
  return TERRACE_Y * t * t * (3 - 2 * t);
}

/** Height of the ground outside at (x, z): 0 almost everywhere, up the bank, up the stairs, up Zelnick's ramp. */
export function groundY(x: number, z: number): number {
  const p = { x, z };
  if (inRect(p, LANDING)) return 0;
  if (inRect(p, STAIRS)) return TERRACE_Y * clamp01((z - STAIRS.z0) / (STAIRS.z1 - STAIRS.z0));
  if (inRect(p, STAIRS_E)) return TERRACE_Y * clamp01((STAIRS_E.x1 - x) / (STAIRS_E.x1 - STAIRS_E.x0));
  return bankY(x, z) || zelnickY(x, z); // (and up the steps and ramp at Zelnick's back entrance)
}

/** Too steep or high for a car: anywhere up the bank (or on the stairs). */
export const offRoadForCars = (p: XZ) =>
  !inRect(p, LANDING) && (inRect(p, STAIRS) || inRect(p, STAIRS_E) || bankY(p.x, p.z) > 0.12);

const FRANK_PARTS: Rect[] = [FRANK, FRANK_LINK, FRANK_ADD];
const OLIN_PARTS: Rect[] = [OLIN_LINK, PAVILION];

/** Inside (or within `pad` of) one of the buildings down here? */
export function inSouthEnd(p: XZ, pad = 0): boolean {
  return [...FRANK_PARTS, ...OLIN_PARTS, ALLBRITTON].some((b) => inRect(p, b, pad))
    || inPoly(p, OLIN_POLY) || (pad > 0 && distToPoly(p, OLIN_POLY) < pad);
}

/** Which of them you're next to (for "now passing"), if any. */
export function southEndNear(p: XZ, reach = 8): string | null {
  if (FRANK_PARTS.some((b) => inRect(p, b, reach))) return FRANK.name;
  if (inPoly(p, OLIN_POLY) || distToPoly(p, OLIN_POLY) < reach || OLIN_PARTS.some((b) => inRect(p, b, reach))) return OLIN.name;
  if (inRect(p, ALLBRITTON, reach)) return ALLBRITTON.name;
  return null;
}

export const BOLLARDS: XZ[] = [
  { x: LANDING.x0 - 0.5, z: 3.6 }, { x: LANDING.x1 + 0.5, z: 3.6 },
  { x: STAIRS.x0 - 1.2, z: 11.6 }, { x: STAIRS.x1 + 1.2, z: 11.6 },
  { x: STAIRS_E.x1 + 0.9, z: STAIRS_E.z0 - 0.9 }, { x: STAIRS_E.x1 + 0.9, z: STAIRS_E.z1 + 0.9 },
];
export const SIGN: XZ = { x: STAIRS.x1 + 2.2, z: 4.1 };
/** The big sycamore at the foot of the stairs, and the one by the back path at the addition's corner. */
export const SYCAMORE: XZ = { x: STAIRS.x1 + 11, z: 7.2 };
export const SYCAMORE2: XZ = { x: -59.4, z: 31 };
/** The mulch bed round the first, east of the stairs. */
export const MULCH = { x0: STAIRS.x1 + 0.5, x1: FRANK_ADD.x1 + 2, z1: FRANK_ADD.z0 } as const;
export const FLAGPOLE: XZ = { x: (OLIN.x1 + FRANK.x0) / 2, z: 11.5 };
export const CHEEK = 0.35; // stair cheek wall thickness

/** Things to bump into: the stair cheek walls, bollard lights, the sign, the trees, the flagpole, the plaza's tables and benches. Padded by a walker's radius. */
export function southObstacles(pad = 0.3): Box[] {
  const b = (x: number, z: number, hx: number, hz: number): Box => ({ x0: x - hx - pad, x1: x + hx + pad, z0: z - hz - pad, z1: z + hz + pad });
  const nz = (STAIRS.z0 + STAIRS.z1) / 2, nh = (STAIRS.z1 - STAIRS.z0) / 2;
  const ex = (STAIRS_E.x0 + STAIRS_E.x1) / 2, eh = (STAIRS_E.x1 - STAIRS_E.x0) / 2;
  return [
    b(STAIRS.x0 - CHEEK / 2, nz, CHEEK / 2, nh), b(STAIRS.x1 + CHEEK / 2, nz, CHEEK / 2, nh),
    b(ex, STAIRS_E.z0 - CHEEK / 2, eh, CHEEK / 2), b(ex, STAIRS_E.z1 + CHEEK / 2, eh, CHEEK / 2),
    ...BOLLARDS.map((p) => b(p.x, p.z, 0.15, 0.15)),
    b(SIGN.x, SIGN.z, 0.1, 0.1),
    b(SYCAMORE.x, SYCAMORE.z, 0.75, 0.75), b(SYCAMORE2.x, SYCAMORE2.z, 0.7, 0.7),
    b(FLAGPOLE.x, FLAGPOLE.z, 0.08, 0.08),
    ...PLAZA_TABLES.map((t) => b(t.x, t.z, 0.6, 0.6)),
    ...PLAZA_BENCHES.map((t) => b(t.x, t.z, 0.3, 0.9)),
    b(UTILITY_BOX.x, UTILITY_BOX.z, 0.8, 0.6), b(PLAZA_BIN.x, PLAZA_BIN.z, 0.35, 0.35),
  ];
}

/** Students walking the field road: their lanes (z) and how far west they go. */
export const ROAD_LANES = [FIELD_ROAD.z0 + 1.1, FIELD_ROAD.z1 - 1.1] as const;
export const ROAD_WALK = { x0: -170, x1: BACK_PATH.x1 - 1 } as const;
