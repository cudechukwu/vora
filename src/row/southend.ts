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
export const BERM = { x0: -180, x1: -73, z0: 3.4, z1: 88 } as const;
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
/** The historic block's door under the medallion, on its east side: along the walk on top of the bank. */
export const FRANK_DOOR = { x: FRANK.x1, z: 44 } as const;
/**
 * The addition's main entry ("FRANK CENTER"): a tall glass bay standing out from its east face, onto the back path
 * across from Judd, at the south end (the user's photo, 2026-10-06). `out` is how far it stands out, `half` its half-width.
 */
export const MAIN_ENTRY = { x: FRANK_ADD.x1, z: FRANK_ADD.z1 - 5, out: 1.2, half: 2.1 } as const;

/**
 * Inside the addition's east end, seen through its glass from the back path (the architects' photos, 2026-10-06):
 * behind the two tall windows across from Judd, a **classroom** (curved tiered desks facing a wall of whiteboards);
 * behind the glass entry bay, the **lobby** with its grand stair up to a landing. `split` is the wall between them.
 * Inside the addition (still solid to you): these are to look at. `floor` stands on the stone base.
 */
export const FRANK_ROOMS = { x0: FRANK_ADD.x1 - 6.5, x1: FRANK_ADD.x1, z0: FRANK_ADD.z0 + 1.5, split: 31, z1: FRANK_ADD.z1 - 1.5, floor: 0.6, ceil: 7.6 } as const;
/** The classroom's tall windows on the east face (z of each). */
export const FRANK_WINDOWS = [FRANK_ADD.z0 + 5, FRANK_ADD.z0 + 13.5] as const;

export interface Seat { x: number; z: number; y: number; heading: number }
/**
 * The classroom: whiteboards on its north wall, and rows of curved desks round it, each a step higher (the photo's
 * tiers). Returns each desk segment (centre, along-angle) and the chair behind it, facing the boards.
 */
export function classroom() {
  const R = FRANK_ROOMS, cx = (R.x0 + R.x1) / 2, board = { x: cx, z: R.z0 + 0.2 };
  const C = { x: cx, z: R.z0 - 2.2 }; // the arcs' centre, behind the boards, so the rows curve gently
  const desks: { x: number; z: number; y: number; rot: number }[] = [];
  const seats: Seat[] = [];
  for (let row = 0; row < 5; row++) {
    const r = 6.2 + row * 1.9, y = R.floor + row * 0.22;
    for (let a = -0.42; a <= 0.4201; a += 0.14) {
      const x = C.x + r * Math.sin(a), z = C.z + r * Math.cos(a);
      if (x < R.x0 + 0.6 || x > R.x1 - 1.0) continue;
      desks.push({ x, z, y, rot: a });
      const sx = C.x + (r + 0.6) * Math.sin(a), sz = C.z + (r + 0.6) * Math.cos(a);
      seats.push({ x: sx, z: sz, y, heading: Math.atan2(C.x - sx, C.z - sz) }); // facing the boards
    }
  }
  return { board, desks, seats, teacher: { x: cx - 1.4, z: R.z0 + 1.1, heading: 0 } };
}
/** Which of the classroom's chairs have someone in them. */
export const CLASS_TAKEN = [0, 2, 3, 6, 9, 11, 14, 17, 19, 22];

/** The lobby's grand stair: up along its back wall toward the split, to a landing across the room. */
export const GRAND_STAIR = (() => {
  const R = FRANK_ROOMS;
  return { x0: R.x0 + 0.1, x1: R.x0 + 1.7, zBottom: R.z1 - 0.8, zTop: R.split + 2, steps: 16, rise: 3.6, landing: { z0: R.split, z1: R.split + 2 } };
})();

/**
 * The lounge in the glass connector, seen through its glass from the top of the stairs and from the walk to its south
 * doors (the architects' Forum photos): lounge chairs round low tables, a white bench, a long table with stools.
 */
export const LOUNGE = { x0: FRANK_LINK.x0, x1: FRANK_LINK.x1, z0: FRANK_LINK.z0, z1: FRANK_LINK.z1, floor: TERRACE_Y, ceil: TERRACE_Y + 7 } as const;
export const LOUNGE_SEATS: (Seat & { chair: 'lounge' | 'bench' | 'stool' })[] = [
  { x: -83.5, z: 19.2, y: TERRACE_Y, heading: Math.PI / 2, chair: 'lounge' },
  { x: -82, z: 20.6, y: TERRACE_Y, heading: Math.PI, chair: 'lounge' },
  { x: -80.6, z: 19.2, y: TERRACE_Y, heading: -Math.PI / 2, chair: 'lounge' },
  { x: -79.6, z: 23.5, y: TERRACE_Y, heading: 0, chair: 'bench' },
  { x: -77.6, z: 24.3, y: TERRACE_Y, heading: -Math.PI / 2, chair: 'stool' },
  { x: -76, z: 25.2, y: TERRACE_Y, heading: Math.PI / 2, chair: 'stool' },
];
export const LOUNGE_TABLES = { round: [{ x: -82, z: 19.2 }], long: { x: -76.8, z: 24.8, len: 3.4 } } as const;

/** Tan brick pavers at the foot of the stairs, off the road. */
export const LANDING = { x0: LINK_DOOR.x - 7, x1: LINK_DOOR.x + 7, z0: FIELD_ROAD.z1, z1: 4.8 } as const;
/** Granite stairs straight up the bank from the field road, toward the glass connector. */
export const STAIRS = { x0: LINK_DOOR.x - 2, x1: LINK_DOOR.x + 2, z0: LANDING.z1, z1: 9.6, steps: 12 } as const;
/**
 * The stairs up the bank's east side from the plaza (rising toward −x): well south of the Frank Center, so the plaza
 * between them and the addition is wide open (the user's street views, 2026-10-06). They're the walk up to Olin's
 * front door, not into the Frank Center.
 */
export const STAIRS_E = { x0: -78, x1: -73.5, z0: 70, z1: 74.5, steps: 12 } as const; // (pushed 10 m south on 2026-10-07: the walk on top kept clear of the Frank Center and the Pruzan)
/** At the top of the east stairs, a walk straight on west along the top of the bank, past the Frank Center's south end, to Olin's front door. */
export const OLIN_WALK = { x0: -126, x1: STAIRS_E.x0, z0: STAIRS_E.z0 + 0.25, z1: STAIRS_E.z1 - 0.25 } as const;

/** The tar plaza at the foot of the bank: south of the addition, east of the historic block. */
export const PLAZA_F = { x0: -73, x1: BACK_PATH.x0, z0: FRANK_ADD.z1, z1: 82 } as const;
export const PLAZA_TABLES: XZ[] = [{ x: -68, z: 48.5 }, { x: -63.5, z: 53 }, { x: -68, z: 57.5 }];
export const PLAZA_BENCHES: XZ[] = [{ x: -71.7, z: 47 }, { x: -71.7, z: 51.5 }, { x: -71.7, z: 56 }, { x: -71.7, z: 77.5 }]; // along the foot of the bank, facing east (the last just past the stairs)
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
/** (Moved 8 m west on 2026-10-07 to make room for the Pruzan Art Center between it and the Frank Center.) */
export const OLIN = { cx: -149, cz: 28, r: 14, x0: -172, x1: -126, z1: 82, h: 13, name: 'Olin Library' } as const;
/** Olin's front door, on its east side, at the end of the walk from the east stairs; a limestone portico of four columns stands out over it. */
export const OLIN_DOOR = { x: OLIN.x1, z: (STAIRS_E.z0 + STAIRS_E.z1) / 2, out: 2.6, half: 4 } as const;
/**
 * The Pruzan Art Center's tall limestone block of galleries, against Olin's east side (the user's photos, 2026-10-07).
 * It stops short of the Frank Center: a paved courtyard runs between them (`NCOURT`). Its north end, to the field,
 * bows out in a gentle curve (`bulge`) with deep slot windows.
 */
export const OLIN_LINK = { x0: OLIN.x1, x1: FRANK.x0 - 8.5, z0: 20, z1: 44, h: 8.6, bulge: 2.5 } as const;
/** Its outline: straight sides, the north end bowed out. */
export const OLIN_LINK_POLY: XZ[] = (() => {
  const L = OLIN_LINK, pts: XZ[] = [{ x: L.x0, z: L.z1 }];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push({ x: L.x0 + (L.x1 - L.x0) * t, z: L.z0 - L.bulge * Math.sin(Math.PI * t) });
  }
  pts.push({ x: L.x1, z: L.z1 });
  return pts;
})();

/**
 * The Pruzan Art Center (the user's photos, and the architects' and photographer's, 2026-10-07): the gallery in the gap
 * between Olin and the Frank Center, facing south onto a courtyard off the walk to Olin's door. Like Zelnick but not
 * the same: a glass front between two limestone piers under a canopy whose edge sags in a long curve, white fascia over a
 * warm wood soffit that carries straight on inside as the ceiling; the tall limestone block of the galleries behind it
 * (the south end of `OLIN_LINK`); the entrance, dark-framed glass doors, set back in a glass link against the Frank
 * Center. Through the glass, a lounge: limestone walls, carpet, sage sofas, little lights let into the back wall, an
 * exhibition graphic. Out front, on interlocking pavers, a square fountain of dark granite brimming over all four
 * sides, a raised bed of tall grasses in it. A planted bed and a small birch between it and Olin; bollard lights.
 * `h` is the canopy's top at the piers; it sags `sag` lower in the middle. Look-only inside, like the Frank Center.
 */
export const PRUZAN = { x0: OLIN.x1 + 1.5, x1: FRANK.x0 - 3.2, z0: OLIN_LINK.z1, z1: OLIN_LINK.z1 + 7, h: 5.6, sag: 0.95, name: 'Pruzan Art Center' } as const;
/** The limestone piers at either end of the glass, standing a little proud of it. */
export const PRUZAN_PIERS = [
  { x0: PRUZAN.x0, x1: PRUZAN.x0 + 1.2, z0: PRUZAN.z0, z1: PRUZAN.z1 + 0.4 },
  { x0: PRUZAN.x1 - 1.3, x1: PRUZAN.x1, z0: PRUZAN.z0, z1: PRUZAN.z1 + 0.4 },
] as const;
/** The glass front between them. */
export const PRUZAN_GLASS = { x0: PRUZAN_PIERS[0].x1, x1: PRUZAN_PIERS[1].x0, z: PRUZAN.z1 } as const;
/** How high the canopy's underside is at x (the glass meets it): highest at the piers, sagging in the middle. */
export function pruzanSoffit(x: number): number {
  const mid = (PRUZAN.x0 + PRUZAN.x1) / 2, half = (PRUZAN.x1 - PRUZAN.x0) / 2, u = Math.min(1, Math.abs(x - mid) / half);
  return TERRACE_Y + PRUZAN.h - 0.45 - PRUZAN.sag * (1 - u * u);
}
/**
 * The glass link between the galleries and the Frank Center, an L: its south part set back between the east pier and the
 * Frank Center, dark-framed doors onto the fountain courtyard (`PRUZAN_DOOR`); its north part as wide as the courtyard
 * on the field side, tall glass with light-framed doors onto it (`PRUZAN_DOOR_N`; the photographer's night photo).
 */
export const PRUZAN_ENTRY = { x0: PRUZAN.x1, x1: FRANK.x0, z0: PRUZAN.z0, z1: PRUZAN.z1 - 1.4, h: 4.3 } as const;
export const PRUZAN_DOOR = { x: (PRUZAN_ENTRY.x0 + PRUZAN_ENTRY.x1) / 2, z: PRUZAN_ENTRY.z1 } as const;
export const PRUZAN_LINK_N = { x0: OLIN_LINK.x1, x1: FRANK.x0, z0: OLIN_LINK.z1 - 4, z1: OLIN_LINK.z1, h: 4.8 } as const;
export const PRUZAN_DOOR_N = { x: (PRUZAN_LINK_N.x0 + PRUZAN_LINK_N.x1) / 2, z: PRUZAN_LINK_N.z0 } as const;
/**
 * The fountain courtyard in front, from the glass down to the walk to Olin: a big sweep of interlocking pavers, its west
 * edge curving in and out (`pruzanPaveEdge`) with lawn and mulch beyond it toward Olin; a planted strip along the
 * Frank Center (`PRUZAN_FRANK_BED`).
 */
export const PRUZAN_COURT = { x0: OLIN.x1, x1: FRANK.x0, z0: PRUZAN.z1, z1: STAIRS_E.z0 + 0.25 } as const;
/** The fountain: a square basin of dark granite, water brimming over every edge; off-centre toward Olin, a walk's width out from the glass. */
export const POOL = { x0: PRUZAN_GLASS.x0 + 1.4, x1: PRUZAN_GLASS.x0 + 7.6, z0: PRUZAN.z1 + 2.4, z1: PRUZAN.z1 + 6.8, h: 0.55 } as const;
/** The raised bed of grasses in the water, toward the back. */
export const POOL_BED = { x0: POOL.x0 + 1.4, x1: POOL.x0 + 4.0, z0: POOL.z0 + 0.8, z1: POOL.z0 + 2.8 } as const;
/** The lounge inside (floor and back wall), the sofas, who's there. */
export const GALLERY = { x0: PRUZAN_GLASS.x0, x1: PRUZAN_GLASS.x1, z0: PRUZAN.z0, z1: PRUZAN.z1, floor: TERRACE_Y + 0.16 } as const;
export const GALLERY_SOFAS = [
  { x: GALLERY.x0 + 2.6, z: GALLERY.z0 + 3.2, len: 3.2, arm: 2.0 }, // an L, its arm toward the glass
  { x: GALLERY.x1 - 3.4, z: GALLERY.z0 + 4.4, len: 3.6, arm: 0 }, // a long one
] as const;
export const GALLERY_SITTERS: Seat[] = [
  { x: GALLERY.x0 + 2.0, z: GALLERY.z0 + 3.2, y: GALLERY.floor, heading: 0 },
  { x: GALLERY.x1 - 2.6, z: GALLERY.z0 + 4.4, y: GALLERY.floor, heading: 0 },
];
/** Standing about, looking at the work on the back wall. */
export const GALLERY_VISITORS: Seat[] = [
  { x: GALLERY.x1 - 4.6, z: GALLERY.z0 + 1.9, y: GALLERY.floor, heading: Math.PI },
  { x: GALLERY.x1 - 3.8, z: GALLERY.z0 + 2.2, y: GALLERY.floor, heading: Math.PI + 0.4 },
];
/** Two sitting on the fountain's rim (the architects' drawing), facing out. */
export const POOL_SITTERS: Seat[] = [
  { x: POOL.x0 + 1.6, z: POOL.z1 - 0.2, y: TERRACE_Y + POOL.h, heading: 0 },
  { x: POOL.x0 + 2.3, z: POOL.z1 - 0.2, y: TERRACE_Y + POOL.h, heading: -0.25 },
];
/** The pavers' west edge (x) at z: out past the west pier, round the fountain, in to a waist, flaring again at the walk (the photos' sweep). */
const PAVE_EDGE: [number, number][] = [
  [PRUZAN.z1, PRUZAN.x0], [PRUZAN.z1 + 4, PRUZAN.x0 + 0.6], [PRUZAN.z1 + 8, PRUZAN.x0 + 1.6], [PRUZAN.z1 + 11.5, PRUZAN.x0 + 4.3],
  [PRUZAN.z1 + 15, PRUZAN.x0 + 6.7], [PRUZAN_COURT.z1, PRUZAN.x0 + 3.5],
];
export function pruzanPaveEdge(z: number): number {
  if (z <= PAVE_EDGE[0][0]) return PAVE_EDGE[0][1];
  for (let i = 1; i < PAVE_EDGE.length; i++) {
    const [za, xa] = PAVE_EDGE[i - 1], [zb, xb] = PAVE_EDGE[i];
    if (z <= zb) { const t = (z - za) / (zb - za); return xa + (xb - xa) * (1 - Math.cos(Math.PI * t)) / 2; }
  }
  return PAVE_EDGE[PAVE_EDGE.length - 1][1];
}
/** The planted strip along the Frank Center's wall, from past the doors down to the walk (grasses, bollards at its edge). */
export const PRUZAN_FRANK_BED = { x0: FRANK.x0 - 1.3, x1: FRANK.x0, z0: PRUZAN_DOOR.z + 2.5, z1: PRUZAN_COURT.z1 - 1 } as const;
/** A small birch in the mulch by Olin, and a granite bench out on the lawn, facing the fountain. */
export const PRUZAN_BIRCH: XZ = { x: OLIN.x1 + 1.1, z: PRUZAN.z1 + 3.4 };
export const LAWN_BENCH_S = { x: OLIN.x1 + 3.2, z: PRUZAN.z1 + 13, len: 2.4, rot: 0.5 } as const;
/** The Frank Center's other medallion niche, on its west face looking onto the fountain courtyard (z of it). */
export const FRANK_NICHE_W = PRUZAN.z1 + 2.2;

/**
 * The courtyard on the field side, between the gallery block and the Frank Center (the photographer's photos): pavers,
 * round teak tables and chairs, bollards, a bed of shrubs and small trees along the Frank Center, little lights let into
 * the foot of the limestone wall, and at its south end the tall glass of the link. It opens north onto a lawn at the top
 * of the bank, with a white balustrade along its edge (urns on the piers) and stairs down to the field road.
 */
export const NCOURT = { x0: OLIN_LINK.x1, x1: FRANK.x0, z0: FRANK.z0, z1: PRUZAN_LINK_N.z0 } as const;
export const NCOURT_BED = { x0: FRANK.x0 - 1.3, x1: FRANK.x0, z0: NCOURT.z0 + 2.5, z1: NCOURT.z1 - 2 } as const;
export const NCOURT_TABLES: XZ[] = [
  { x: NCOURT.x0 + 1.7, z: 24 }, { x: NCOURT.x0 + 1.7, z: 32 }, { x: NCOURT.x1 - 2.5, z: 28 }, { x: NCOURT.x1 - 2.5, z: 36 },
];
export const NCOURT_SITTERS: [number, number][] = [[0, 1], [0, 3], [2, 0], [3, 2]];
export const NCOURT_TREES: XZ[] = [{ x: FRANK.x0 - 0.65, z: 19.5 }, { x: FRANK.x0 - 0.65, z: 31.5 }];
/** The Frank Center's tall arched niche on the same side, looking onto the tables. */
export const FRANK_NICHE_N = 23;
/** Stairs down the bank to the field road, in front of the gallery block. */
export const STAIRS_W = { x0: OLIN_LINK.x0 + 3, x1: OLIN_LINK.x0 + 6.5, z0: 3.6, z1: 9.6, steps: 12 } as const;
/** The white balustrade along the top of the bank, from in front of Olin to the Frank Center, open at the stairs. */
export const BALUSTRADE = { x0: OLIN.cx + 9, x1: FRANK.x0, z: 10.4 } as const;
/** The paver walk from the stairs along the lawn into the courtyard. */
export const NWALK = { x0: STAIRS_W.x0 - 0.5, x1: FRANK.x0, z0: BALUSTRADE.z + 0.3, z1: NCOURT.z0 } as const;
/** A stone bench and a small tree on the lawn, the flagpole in front of the block. */
export const LAWN_BENCH_N = { x: OLIN.x1 - 3, z: 15.5, len: 2.2, rot: 0 } as const;
export const LAWN_TREE: XZ = { x: OLIN_LINK.x0 + 2, z: 16.2 };

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
export const ALLBRITTON = { x0: -69, x1: -39, z0: 88, z1: 112, h: 16, name: 'Allbritton Center' } as const;
export const ALLBRITTON_DOOR = { x: (BACK_PATH.x0 + BACK_PATH.x1) / 2, z: ALLBRITTON.z0 } as const;
/**
 * Allbritton's two basement entrances (the user's street views): either side of the front steps, a sunken well with a
 * flight of stairs down along the facade to a door below ground, a low granite wall round it and a metal railing.
 * Each runs from `outer` (street level) down to `inner` (the door). Solid: you can't walk into the hole.
 */
export const ALLB_WELLS = [-1, 1].map((side) => {
  const inner = ALLBRITTON_DOOR.x + side * 3.4, outer = ALLBRITTON_DOOR.x + side * 7.8;
  return { side, x0: Math.min(inner, outer), x1: Math.max(inner, outer), z0: ALLBRITTON.z0 - 1.7, z1: ALLBRITTON.z0, inner, outer, depth: 1.6 };
});
/** The square concrete slabs in front of Allbritton, between the back path's end and its door. */
export const ALLB_FORECOURT = { x0: ALLBRITTON.x0 + 3, x1: ALLBRITTON.x1 - 3, z0: ALLBRITTON.z0 - 7, z1: ALLBRITTON.z0 } as const;
/**
 * The connector's other entrance (the user, 2026-10-06): glass doors in its south face, up on the bank, reached by a walk
 * of interlocking pavers north along the top of the bank from the walk to Olin, past the medallion door.
 */
export const LINK_DOOR_S = { x: -80.5, z: FRANK_LINK.z1 } as const;
export const LINK_WALK = { x0: LINK_DOOR_S.x - 1.4, x1: LINK_DOOR_S.x + 1.4, z0: FRANK_LINK.z1, z1: OLIN_WALK.z0 } as const;

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
  if (inRect(p, STAIRS_W)) return TERRACE_Y * clamp01((z - STAIRS_W.z0) / (STAIRS_W.z1 - STAIRS_W.z0));
  return bankY(x, z) || zelnickY(x, z); // (and up the steps and ramp at Zelnick's back entrance)
}

/** Too steep or high for a car: anywhere up the bank (or on the stairs). */
export const offRoadForCars = (p: XZ) =>
  !inRect(p, LANDING) && (inRect(p, STAIRS) || inRect(p, STAIRS_E) || inRect(p, STAIRS_W) || bankY(p.x, p.z) > 0.12);

const FRANK_PARTS: Rect[] = [FRANK, FRANK_LINK, FRANK_ADD];
const PRUZAN_PARTS: Rect[] = [PRUZAN, PRUZAN_ENTRY, PRUZAN_LINK_N, ...PRUZAN_PIERS];
const inBlock = (p: XZ, pad: number) => inPoly(p, OLIN_LINK_POLY) || (pad > 0 && distToPoly(p, OLIN_LINK_POLY) < pad);

/** Inside (or within `pad` of) one of the buildings down here? */
export function inSouthEnd(p: XZ, pad = 0): boolean {
  return [...FRANK_PARTS, ...PRUZAN_PARTS, ALLBRITTON].some((b) => inRect(p, b, pad)) || inBlock(p, pad)
    || inPoly(p, OLIN_POLY) || (pad > 0 && distToPoly(p, OLIN_POLY) < pad);
}

/** Which of them you're next to (for "now passing"), if any. */
export function southEndNear(p: XZ, reach = 8): string | null {
  if (PRUZAN_PARTS.some((b) => inRect(p, b, 4)) || inBlock(p, 4) || inRect(p, PRUZAN_COURT, 3) || inRect(p, NCOURT)) return PRUZAN.name; // (first: it's between the other two)
  if (FRANK_PARTS.some((b) => inRect(p, b, reach))) return FRANK.name;
  if (inPoly(p, OLIN_POLY) || distToPoly(p, OLIN_POLY) < reach) return OLIN.name;
  if (inRect(p, ALLBRITTON, reach)) return ALLBRITTON.name;
  return null;
}

export const BOLLARDS: XZ[] = [
  { x: LANDING.x0 - 0.5, z: 3.6 }, { x: LANDING.x1 + 0.5, z: 3.6 },
  { x: STAIRS.x0 - 1.2, z: 11.6 }, { x: STAIRS.x1 + 1.2, z: 11.6 },
  { x: STAIRS_E.x1 + 0.9, z: STAIRS_E.z0 - 0.9 }, { x: STAIRS_E.x1 + 0.9, z: STAIRS_E.z1 + 0.9 },
  // the Pruzan's: by its doors and along the planted strip by the Frank Center, out by the fountain's corner…
  { x: FRANK.x0 - 0.5, z: PRUZAN_DOOR.z + 1.2 }, { x: PRUZAN_FRANK_BED.x0 - 0.3, z: PRUZAN_DOOR.z + 6 }, { x: PRUZAN_FRANK_BED.x0 - 0.3, z: PRUZAN_DOOR.z + 13 },
  { x: POOL.x1 + 0.7, z: POOL.z1 + 0.7 },
  // …and in the courtyard on the field side, along the bed by the Frank Center
  { x: NCOURT_BED.x0 - 0.3, z: 26 }, { x: NCOURT_BED.x0 - 0.3, z: 38.5 },
];
export const SIGN: XZ = { x: STAIRS.x1 + 2.2, z: 4.1 };
/** The big sycamore at the foot of the stairs, and the one by the back path at the addition's corner. */
export const SYCAMORE: XZ = { x: STAIRS.x1 + 11, z: 7.2 };
export const SYCAMORE2: XZ = { x: -59.4, z: 31 };
/** The mulch bed round the first, east of the stairs. */
export const MULCH = { x0: STAIRS.x1 + 0.5, x1: FRANK_ADD.x1 + 2, z1: FRANK_ADD.z0 } as const;
export const FLAGPOLE: XZ = { x: OLIN_LINK.x1 - 2.5, z: 15.2 };
export const CHEEK = 0.35; // stair cheek wall thickness
/** The portico's four columns, standing out from Olin's front, either side of the walk. */
export const OLIN_COLUMNS: XZ[] = [-1, -1 / 3, 1 / 3, 1].map((k) => ({ x: OLIN_DOOR.x + OLIN_DOOR.out - 0.4, z: OLIN_DOOR.z + k * OLIN_DOOR.half }));

/** Things to bump into: the stair cheek walls, bollard lights, the sign, the trees, the flagpole, the Pruzan's fountain, the plaza's tables and benches. Padded by a walker's radius. */
export function southObstacles(pad = 0.3): Box[] {
  const b = (x: number, z: number, hx: number, hz: number): Box => ({ x0: x - hx - pad, x1: x + hx + pad, z0: z - hz - pad, z1: z + hz + pad });
  const nz = (STAIRS.z0 + STAIRS.z1) / 2, nh = (STAIRS.z1 - STAIRS.z0) / 2;
  const ex = (STAIRS_E.x0 + STAIRS_E.x1) / 2, eh = (STAIRS_E.x1 - STAIRS_E.x0) / 2;
  const wz = (STAIRS_W.z0 + STAIRS_W.z1) / 2, wh = (STAIRS_W.z1 - STAIRS_W.z0) / 2;
  const bal = (x0: number, x1: number) => b((x0 + x1) / 2, BALUSTRADE.z, (x1 - x0) / 2, 0.2);
  return [
    b(STAIRS.x0 - CHEEK / 2, nz, CHEEK / 2, nh), b(STAIRS.x1 + CHEEK / 2, nz, CHEEK / 2, nh),
    b(STAIRS_W.x0 - CHEEK / 2, wz, CHEEK / 2, wh), b(STAIRS_W.x1 + CHEEK / 2, wz, CHEEK / 2, wh),
    bal(BALUSTRADE.x0, STAIRS_W.x0 - CHEEK), bal(STAIRS_W.x1 + CHEEK, BALUSTRADE.x1), // (open at the stairs)
    ...NCOURT_TABLES.map((t) => b(t.x, t.z, 0.6, 0.6)),
    ...[...NCOURT_TREES, LAWN_TREE].map((t) => b(t.x, t.z, 0.2, 0.2)),
    ...[LAWN_BENCH_N, LAWN_BENCH_S].map((t) => b(t.x, t.z, t.len / 2, t.len / 2)), // (roughly: they're turned)
    b(ex, STAIRS_E.z0 - CHEEK / 2, eh, CHEEK / 2), b(ex, STAIRS_E.z1 + CHEEK / 2, eh, CHEEK / 2),
    ...BOLLARDS.map((p) => b(p.x, p.z, 0.15, 0.15)),
    b(SIGN.x, SIGN.z, 0.1, 0.1),
    b(SYCAMORE.x, SYCAMORE.z, 0.75, 0.75), b(SYCAMORE2.x, SYCAMORE2.z, 0.7, 0.7),
    b(FLAGPOLE.x, FLAGPOLE.z, 0.08, 0.08), b(PRUZAN_BIRCH.x, PRUZAN_BIRCH.z, 0.3, 0.3),
    ...OLIN_COLUMNS.map((c) => b(c.x, c.z, 0.35, 0.35)),
    b(MAIN_ENTRY.x + MAIN_ENTRY.out / 2, MAIN_ENTRY.z, MAIN_ENTRY.out / 2, MAIN_ENTRY.half), // the entry bay
    b((POOL.x0 + POOL.x1) / 2, (POOL.z0 + POOL.z1) / 2, (POOL.x1 - POOL.x0) / 2 + 0.3, (POOL.z1 - POOL.z0) / 2 + 0.3), // the fountain (and its drain round it)
    ...ALLB_WELLS.map((w) => b((w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2, (w.x1 - w.x0) / 2 + 0.2, (w.z1 - w.z0) / 2 + 0.2)), // Allbritton's basement wells
    ...PLAZA_TABLES.map((t) => b(t.x, t.z, 0.6, 0.6)),
    ...PLAZA_BENCHES.map((t) => b(t.x, t.z, 0.3, 0.9)),
    b(UTILITY_BOX.x, UTILITY_BOX.z, 0.8, 0.6), b(PLAZA_BIN.x, PLAZA_BIN.z, 0.35, 0.35),
  ];
}

/** Students walking the field road: their lanes (z) and how far west they go. */
export const ROAD_LANES = [FIELD_ROAD.z0 + 1.1, FIELD_ROAD.z1 - 1.1] as const;
export const ROAD_WALK = { x0: -170, x1: BACK_PATH.x1 - 1 } as const;
