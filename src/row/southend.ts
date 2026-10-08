import type { Box, XZ } from './collide';
import { zelnickY } from './zelnick';
import { BACK_PATH, ROAD, distToPoly, inPoly } from './layout';

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
export const BERM = { x0: -234, x1: -73, z0: 3.4, z1: 122.5 } as const; // (on south under Olin's lawn, down to Church Street's sidewalk)
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

/**
 * Olin Memorial Library (the user's photos, 2026-10-07: "Olin is what makes Wesleyan"). The old building is a brick
 * block on a high white marble base, its front to the south: a portico of six Ionic columns under a pediment, up a broad
 * flight of marble steps, onto a big lawn with an X of walks. Its back is the newer half drum of tall arched windows
 * facing the field (`r` round `cx`, `cz`). It stands on raised grounds (`OLIN_SITE`, `OLIN_RISE` higher than the bank):
 * the walk from the Pruzan climbs a small flight (`STAIRS_O`) to reach them.
 * (Moved 8 m west on 2026-10-07 for the Pruzan; its front brought north to z1 the same day, in line with the Frank Center's.)
 */
export const OLIN = { cx: -149, cz: 28, r: 14, x0: -172, x1: -126, z1: 62, h: 13, name: 'Olin Library' } as const;
export const OLIN_RISE = 0.9;
export const OLIN_Y = TERRACE_Y + OLIN_RISE;
/**
 * The raised grounds: the building, the walk along its front, the lawn. Grass slopes up to them all round; on the
 * Pruzan side (east) the slope is as long as the small stairs set into it (the user: no wall, just grass that slopes).
 */
export const OLIN_SITE = { x0: OLIN.x0 - 4, x1: OLIN.x1, z0: OLIN.cz - 2, z1: 117 } as const;
/** The small stairs up from the walk from the Pruzan onto Olin's grounds (rising toward −x), and the walk on along Olin's front. */
export const STAIRS_O = { x0: OLIN.x1 - 4.5, x1: OLIN.x1, z0: OLIN_WALK.z0, z1: OLIN_WALK.z1, steps: 5 } as const;
export const OLIN_FRONT_WALK = { x0: OLIN.x0 - 2, x1: STAIRS_O.x0, z0: OLIN_WALK.z0, z1: OLIN_WALK.z1 } as const;
/** The portico: its marble floor (`y`), stood out from the front wall; the six columns along its front edge. */
export const PORTICO_O = { x0: OLIN.cx - 9.6, x1: OLIN.cx + 9.6, z0: OLIN.z1, z1: OLIN.z1 + 4.6, y: OLIN_Y + 1.8 } as const;
export const OLIN_COLUMNS: XZ[] = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map((k) => ({ x: OLIN.cx + k * 3.3, z: PORTICO_O.z1 - 0.7 }));
/** The broad marble steps from the walk up to the portico (descending toward +z), the door at the top. */
export const OLIN_STEPS = { x0: PORTICO_O.x0, x1: PORTICO_O.x1, z0: PORTICO_O.z1, z1: OLIN_WALK.z0, steps: 10 } as const;
export const OLIN_DOOR = { x: OLIN.cx, z: OLIN.z1, half: 1.3 } as const;
/** The lawn in front, and its walks: two straight out from the steps side by side, and an X of diagonals corner to corner. */
export const OLIN_LAWN = { x0: OLIN.cx - 19, x1: OLIN.cx + 19, z0: OLIN_WALK.z1, z1: OLIN_SITE.z1 - 1.5 } as const;
export const LAWN_WALKS: { a: XZ; b: XZ; w: number }[] = [
  { a: { x: OLIN.cx - 2.4, z: OLIN_LAWN.z0 }, b: { x: OLIN.cx - 2.4, z: OLIN_LAWN.z1 }, w: 1.8 },
  { a: { x: OLIN.cx + 2.4, z: OLIN_LAWN.z0 }, b: { x: OLIN.cx + 2.4, z: OLIN_LAWN.z1 }, w: 1.8 },
  { a: { x: OLIN_LAWN.x0 + 2, z: OLIN_LAWN.z0 }, b: { x: OLIN_LAWN.x1 - 2, z: OLIN_LAWN.z1 }, w: 2 },
  { a: { x: OLIN_LAWN.x1 - 2, z: OLIN_LAWN.z0 }, b: { x: OLIN_LAWN.x0 + 2, z: OLIN_LAWN.z1 }, w: 2 },
];
/** How far (x, z) is from the nearest of the lawn's walks' centre lines. */
export function lawnWalkDist(p: XZ): number {
  let best = Infinity;
  for (const w of LAWN_WALKS) {
    const dx = w.b.x - w.a.x, dz = w.b.z - w.a.z, t = Math.max(0, Math.min(1, ((p.x - w.a.x) * dx + (p.z - w.a.z) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(p.x - (w.a.x + dx * t), p.z - (w.a.z + dz * t)) - w.w / 2);
  }
  return best;
}
/** Big old trees on the lawn (the photos: two flanking the steps, more out across it), benches by the walks, lamps at the foot of the steps, the sign. */
export const OLIN_TREES: XZ[] = [
  { x: OLIN.cx - 8, z: 80 }, { x: OLIN.cx + 8, z: 80 }, { x: OLIN.cx - 17, z: 92 }, { x: OLIN.cx + 17, z: 92 },
  { x: OLIN.cx - 18, z: 104 }, { x: OLIN.cx + 18, z: 104 }, { x: OLIN.cx - 7, z: 111 }, { x: OLIN.cx + 7, z: 111 },
];
export const OLIN_BENCHES = [
  { x: OLIN.cx - 5, z: 86, rot: Math.PI / 2 }, { x: OLIN.cx + 5, z: 86, rot: -Math.PI / 2 },
] as const;
export const OLIN_LAMPS: XZ[] = [{ x: PORTICO_O.x0 - 1.2, z: OLIN_WALK.z1 + 0.6 }, { x: PORTICO_O.x1 + 1.2, z: OLIN_WALK.z1 + 0.6 }];
export const OLIN_SIGN: XZ = { x: OLIN.cx + 6.5, z: OLIN_LAWN.z0 + 2.5 };

/**
 * Clark Hall (the user's photos, street views and aerial, 2026-10-07: a first-year residence hall, "we should be perfect
 * with it"): close west of Olin, only a narrow tar path between them (`CLARK_GAP`, tar right up to Olin's wall), long north–south with a wider block across each end (`CLARK_ENDS`), its north end
 * in line with Olin's. Rough-faced brownstone, a basement and four storeys, bands over the ground floor and under the
 * eaves, windows in pairs (dark six-over-six sashes), stone relieving arches over the ground floor's, a low grey hip
 * roof with a deep eave, a big chimney stack in the middle. Its entrance is on the west, down in a sunken paved court at
 * basement level (`CLARK_COURT`): the basement shows there, tall brownstone piers rise from the court to a flat dark porch
 * roof, a boxwood bed, and stairs climb out of it (west, `CLARK_STAIRS_W`; south-west, `CLARK_STAIRS_S`) with
 * galvanized railings. The narrow path runs north between it and Olin to stairs down the bank toward Andrus Field
 * (`STAIRS_C`, from the flat walk at the field's level, `CLARK_LOW`); south of Olin the lane off Church Street (`CLARK_LANE`) has cars parked along it.
 */
export const CLARK = { x0: -198, x1: -184, z0: 5, z1: 41, name: 'Clark Hall' } as const; // (it runs north past Olin's drum, down the bank, almost to the field road: the user)
/** The wider blocks across each end, standing out from both long sides. */
export const CLARK_ENDS = [
  { x0: CLARK.x0 - 1.4, x1: CLARK.x1 + 1.4, z0: CLARK.z0, z1: CLARK.z0 + 9 },
  { x0: CLARK.x0 - 1.4, x1: CLARK.x1 + 1.4, z0: CLARK.z1 - 9, z1: CLARK.z1 },
] as const;
/** Its grounds' level (the path and lawns round it): a little below Olin's terrace. The ground floor's a little above it. */
export const CLARK_Y = TERRACE_Y + 0.4;
export const CLARK_FLOOR = CLARK_Y + 0.6;
export const CLARK_SITE = { x0: -226, x1: OLIN.x0 - 4, z0: 10, z1: 117 } as const; // (north of it, the bank slopes down to the field road, Clark's north end standing on it)
const CLARK_MID = (CLARK.z0 + CLARK.z1) / 2;
/** The sunken entrance court on its west side, at basement level; the porch over its doors; the doors. */
export const CLARK_COURT = { x0: CLARK.x0 - 8, x1: CLARK.x0, z0: CLARK_MID - 7, z1: CLARK_MID + 7, y: CLARK_Y - 1.8 } as const;
export const CLARK_PORCH = { x0: CLARK.x0 - 3, x1: CLARK.x0, z0: CLARK_MID - 3.5, z1: CLARK_MID + 3.5 } as const;
export const CLARK_DOOR = { x: CLARK.x0, z: CLARK_MID } as const;
/** Stairs out of the court: west (rising toward −x) to the path, and south-west (rising toward +z) to the lawn. */
export const CLARK_STAIRS_W = { x0: CLARK_COURT.x0 - 3.6, x1: CLARK_COURT.x0, z0: CLARK_MID - 1.6, z1: CLARK_MID + 1.6, steps: 10 } as const;
export const CLARK_STAIRS_S = { x0: CLARK_COURT.x0 + 0.4, x1: CLARK_COURT.x0 + 3.4, z0: CLARK_COURT.z1, z1: CLARK_COURT.z1 + 3.6, steps: 10 } as const;
/** The boxwood bed in the court, by the porch. */
export const CLARK_HEDGE = { x0: CLARK_COURT.x0 + 3.6, x1: CLARK_COURT.x0 + 5.6, z0: CLARK_MID - 6.2, z1: CLARK_MID - 4.2 } as const;
/** From the top of the west stairs, a walk out west, then down the west side to Church Street. */
export const CLARK_PATH = { x0: -223, x1: CLARK_STAIRS_W.x0, z0: CLARK_DOOR.z - 1.3, z1: CLARK_DOOR.z + 1.3 } as const;
export const CLARK_WALK = { x0: -223, x1: -220.6, z0: CLARK_PATH.z0, z1: 122.6 } as const; // (to Church Street's sidewalk)
/** The narrow tar path between Clark and Olin, north to the stairs down toward Andrus; the lane carries on south of it. */
/** All tar from Clark's wall to Olin's (the user: no wall, no lines): a couple of cars park in it, the path goes by. */
export const CLARK_GAP = { x0: CLARK.x1 + 0.2, x1: OLIN.x0, z0: 25.6, z1: OLIN.z1 } as const;
/**
 * North of the parking, the way down to Andrus Field (the user's street views): a flat tar walk at the field's level
 * (`CLARK_LOW`) between Clark's wall and a tall limestone retaining wall (`OLIN_LOW_WALL`) holding up the ground on
 * Olin's side; at its south end, stairs climb to the parking's level (`STAIRS_C`), a planted bed beside them
 * (`STAIRS_C_BED`); up behind the wall, a strip of tar on to the dumpsters' pad (`CLARK_UPPER`).
 */
export const OLIN_LOW_WALL = { x0: CLARK.x1 + 4.9, x1: CLARK.x1 + 5.2, z0: 2.8, z1: CLARK_GAP.z0 } as const;
export const STAIRS_C = { x0: CLARK.x1 + 2.1, x1: OLIN_LOW_WALL.x0, z0: 20, z1: CLARK_GAP.z0, steps: 14 } as const; // (up toward +z, to CLARK_Y)
export const STAIRS_C_BED = { x0: CLARK.x1, x1: STAIRS_C.x0, z0: STAIRS_C.z0, z1: STAIRS_C.z1 } as const;
export const CLARK_LOW = { x0: CLARK.x1, x1: OLIN_LOW_WALL.x0, z0: 2.8, z1: STAIRS_C.z0 } as const;
export const CLARK_UPPER = { x0: OLIN_LOW_WALL.x1, x1: OLIN.x0, z0: 10.4, z1: CLARK_GAP.z0 } as const; // (north of it, the fence)
/** South of Olin, the lane carries on down to Church Street (cars may drive it and the gap). */
export const CLARK_LANE = { x0: CLARK_GAP.x0, x1: OLIN.x0 - 4, z0: OLIN.z1 - 4, z1: 122.6 } as const;
/** The spaces: a row nose-in to Olin's wall (heading +x), white lines, between Clark's end blocks; only two with cars in (the user). */
export const CLARK_STALLS: (XZ & { w: number; len: number })[] = Array.from({ length: 12 }, (_, i) => ({ x: OLIN.x0 - 0.5 - 2.4, z: 27 + i * 2.7, w: 2.7, len: 4.8 }));
export const CLARK_PARKED: [number, number][] = [[4, 0x23262b], [5, 0xd9dadb]];
/** By the top of the stairs down to Andrus, against the retaining wall: two green roll-off dumpsters, one open, both overflowing. */
export const DUMPSTERS = [
  { x: OLIN_LOW_WALL.x1 + 1.5, z: 15.5, w: 2.4, len: 6, h: 1.8, open: true },
  { x: OLIN_LOW_WALL.x1 + 4.3, z: 15.5, w: 2.4, len: 6, h: 1.8, open: false },
] as const;
/** The tall piers holding up the porch roof, standing in the court. */
export const CLARK_PIERS: XZ[] = [
  { x: CLARK_PORCH.x0 + 0.4, z: CLARK_PORCH.z0 + 0.4 }, { x: CLARK_PORCH.x0 + 0.4, z: CLARK_PORCH.z1 - 0.4 },
  { x: CLARK_PORCH.x0 + 0.4, z: CLARK_DOOR.z - 1.4 }, { x: CLARK_PORCH.x0 + 0.4, z: CLARK_DOOR.z + 1.4 },
];
/** Disc-headed pole lamps: by the court's west stairs, down the narrow path, by the lane. */
export const CLARK_LAMPS: XZ[] = [
  { x: CLARK_PATH.x1 - 1, z: CLARK_PATH.z1 + 1.2 }, { x: OLIN.x0 - 4.5, z: 12 }, { x: OLIN.x0 - 4.5, z: 66 },
  { x: CLARK_LANE.x0 - 0.7, z: 80 }, { x: CLARK_WALK.x1 + 0.9, z: CLARK.z1 + 6 },
];
/** A few young trees round it (the photos). */
export const CLARK_TREES: XZ[] = [
  { x: CLARK_COURT.x0 - 5, z: CLARK_COURT.z0 - 2 }, { x: CLARK_COURT.x0 - 6, z: CLARK_COURT.z1 + 6 }, { x: CLARK.x0 - 5, z: CLARK.z0 + 4 },
  { x: CLARK.x0 - 4, z: CLARK.z1 + 6 }, { x: CLARK_LANE.x0 - 2.5, z: 95 },
];
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
export const BALUSTRADE = { x0: OLIN_LOW_WALL.x1, x1: FRANK.x0, z: 10.4 } as const; // (straight on along Olin's drum to the end, behind the dumpsters: the user)
/**
 * Stairs down the grass bank from the fence to the field road, at intervals along Olin's drum (the user's photos), and
 * one at the fence's west end, by the dumpsters. Each climbs (+z) to the ground at its top.
 */
export const BANK_FLIGHTS = [OLIN_LOW_WALL.x1 + 1.9, -161, -149, -137].map((cx) => ({ x0: cx - 1.3, x1: cx + 1.3, z0: 3.6, z1: 9.6, steps: 12 }));
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

/**
 * Church Street (the user's street views, 2026-10-07): the road along the bottom of the bank, south of Olin's lawn and
 * Allbritton, two lanes and a double yellow line, curbs and sidewalks both sides; it meets High Street at a T. Across it
 * (not built yet): the Exley Science Center and the rest.
 */
export const CHURCH = { x0: -236, x1: ROAD.x0, z0: 125, z1: 133 } as const;
export const CHURCH_WALK_N = { x0: -236, x1: ROAD.x0, z0: 122.6, z1: CHURCH.z0 } as const;
export const CHURCH_WALK_S = { x0: -236, x1: ROAD.x0, z0: CHURCH.z1, z1: 135.4 } as const;

/**
 * Exley Science Center (the user's photos and street views, 2026-10-08), across Church Street from Clark and Olin.
 * Brutalist, in pinkish granite-aggregate concrete: an eight-storey square tower (`EXLEY_TOWER`) wrapped in a deep grid of
 * fins and floor ledges, narrow dark windows set back in each bay; round its foot a long one-storey glass pavilion
 * (`EXLEY_PAV`) of square piers, dark glass and a deep fascia, its doors onto the plaza; on the west a two-storey finned
 * block cantilevered over a glass ground floor (`EXLEY_WING`, its upper storeys `EXLEY_WING_UP`). In front, a plaza of
 * big concrete slabs with dark bands (`EXLEY_PLAZA`), a low concrete planter wall along it (open at the entry), round
 * planters with red flowers; a lawn mounded up from the sidewalk with big trees and a tall pine, hedges; the entry walk
 * straight from a crosswalk on Church Street (`EXLEY_XWALK`), a STOP-for-pedestrians sign in the road.
 * Its site is level (`EXLEY_Y`): campus climbs west, and Church Street is near that height here.
 */
export const EXLEY_Y = 2.6;
export const EXLEY_SITE = { x0: -208, x1: -104, z0: 138.5, z1: 220 } as const; // (east of it the ground eases down to Shanklin's level)
// (the tower on the west, the raised wing on the east, set well back behind a big plaza: the user, 2026-10-08)
export const EXLEY_PAV = { x0: -204, x1: -134, z0: 160, z1: 174, h: 4.6 } as const;
export const EXLEY_TOWER = { x0: -188, x1: -160, z0: 166, z1: 194, floors: 8, fh: 3.7 } as const;
export const EXLEY_WING = { x0: -134, x1: -108, z0: 160, z1: 184 } as const;
export const EXLEY_WING_UP = { x0: -136.5, x1: -107, z0: 157.6, z1: 184, y0: EXLEY_Y + 4.8, y1: EXLEY_Y + 12.2 } as const;
export const EXLEY_PLAZA = { x0: -206, x1: -106, z0: 146, z1: EXLEY_PAV.z0 } as const;
export const EXLEY_XWALK = { x0: -176.2, x1: -171.8 } as const;
export const EXLEY_ENTRY = { x0: -177, x1: -171, z0: CHURCH_WALK_S.z1, z1: EXLEY_PLAZA.z0 } as const;
export const EXLEY_DOOR = { x: -174, z: EXLEY_PAV.z0 } as const;
/** The low planter wall along the plaza's north edge (a gap at the entry), round planters, the in-street sign. */
export const EXLEY_WALLS = [
  { x0: EXLEY_PLAZA.x0, x1: EXLEY_ENTRY.x0 - 0.5, z0: EXLEY_PLAZA.z0, z1: EXLEY_PLAZA.z0 + 0.6 },
  { x0: EXLEY_ENTRY.x1 + 0.5, x1: EXLEY_PLAZA.x1, z0: EXLEY_PLAZA.z0, z1: EXLEY_PLAZA.z0 + 0.6 },
] as const;
export const EXLEY_PLANTERS: XZ[] = [{ x: -179, z: 148.6 }, { x: -169, z: 148.6 }, { x: -190, z: 154 }, { x: -154, z: 154 }, { x: -140, z: 149 }];
export const EXLEY_STOP: XZ = { x: (EXLEY_XWALK.x0 + EXLEY_XWALK.x1) / 2 + 2.8, z: (CHURCH.z0 + CHURCH.z1) / 2 };
/** Big trees on the lawn (and the pine at its east corner); a bench on the plaza. */
export const EXLEY_TREES: XZ[] = [{ x: -150, z: 141.8 }]; // (just one, and the pine: the user)
export const EXLEY_PINE: XZ = { x: -121, z: 143 }; // (on the lawn, clear of the steps up beside the wing)
export const EXLEY_BENCH = { x: -162, z: 152, len: 3.2 } as const;
/**
 * Shanklin Hall and Hall-Atwater (the user's photos, 2026-10-08), east of Exley's raised wing. Shanklin: long north–south,
 * its main front to the west onto Exley's plaza, its narrow end to Church Street; red brick on a raised basement, giant
 * white pilasters at the corners, white bands and tablets, tall white-framed windows (the ground floor's under brick
 * arches with round white medallions), the arched door in the middle up steps (`SHANK_STEPS`), a heavy white cornice and
 * balustrade, a slate roof with round dormers; on the street end a balcony with an outside stair down. Hall-Atwater,
 * joined to its east: a rough brownstone base, two storeys of dark glass in white frames, a dark top band, a plain brick
 * block at its east end, rows of white exhaust stacks. Their site (`SHANK_Y`) is a little above the street.
 */
export const SHANK_Y = 1.6;
export const SHANK_SITE = { x0: -103, x1: -44, z0: 139, z1: 218 } as const;
export const SHANKLIN = { x0: -97, x1: -81, z0: 154, z1: 198, // (set well back from Church Street: the user)
  base: 1.6, fh: 3.8, floors: 3, name: 'Shanklin Hall' } as const;
export const SHANK_DOOR = { x: SHANKLIN.x0, z: 176 } as const;
/** It sits at a slight angle to the street (the user's photos): turned this much about its middle (drawn only: it's fenced off). */
export const SHANK_SLANT = -0.12; // (its street end swung east: a V opening toward the street, its point by Exley)
export const SHANK_STEPS = { x0: SHANKLIN.x0 - 4.4, x1: SHANKLIN.x0, landing: 1.0, z0: SHANK_DOOR.z - 1.6, z1: SHANK_DOOR.z + 1.6, steps: 9 } as const; // (up toward +x)
export const SHANK_BALCONY = { x0: -92, x1: -86, z0: SHANKLIN.z0 - 1.3, z1: SHANKLIN.z0 } as const;
export const SHANK_STAIR = { x0: -86, x1: -82.2, z0: SHANKLIN.z0 - 1.2, z1: SHANKLIN.z0 } as const; // (down toward +x from the balcony)
export const SHANK_WALK = { x0: -106, x1: SHANK_STEPS.x0, z0: SHANK_DOOR.z - 1.2, z1: SHANK_DOOR.z + 1.2 } as const;
export const HALL_ATWATER = { x0: SHANKLIN.x1, x1: -50, z0: 162, z1: 194, h: 11.2, name: 'Hall-Atwater' } as const;
export const HA_BLOCK = { x0: -57, x1: -50, z0: 162, z1: 194, h: 13.4 } as const;
/**
 * Shanklin is being renovated (the user, 2026-10-08): a black construction fence (chain link with black screening) round
 * it and Hall-Atwater (`SHANK_FENCE`, solid). Between it and Exley, interlocking pavers at Exley's level (`EXLEY_GAP`),
 * up a flight of stairs from the sidewalk (`EXLEY_GAP_STAIRS`, just off it: not on the sidewalk).
 */
export const SHANK_FENCE = { x0: -100.4, x1: -46, z0: CHURCH_WALK_S.z1 + 1.2, z1: HALL_ATWATER.z1 + 5 } as const; // (its grassy bank to the street inside it too)
/** Little trees on that bank, inside the fence. */
export const SHANK_SAPLINGS: XZ[] = [{ x: -96, z: 141 }, { x: -88, z: 143.5 }, { x: -80, z: 140.5 }, { x: -71, z: 144 }, { x: -63, z: 141.5 }];
/** (The user's street view: a wide concrete walk in from the sidewalk between hedges, then three broad low steps, a landing, three more; no side walls.) */
const GS0 = CHURCH_WALK_S.z1;
export const EXLEY_GAP_STAIRS = {
  x0: -109, x1: -100.6, z0: GS0, z1: GS0 + 11.7,
  approach: [GS0, GS0 + 4.6], flight1: [GS0 + 4.6, GS0 + 6.4], landing: [GS0 + 6.4, GS0 + 9.9], flight2: [GS0 + 9.9, GS0 + 11.7], steps: 3,
} as const;
export const EXLEY_GAP = { x0: -107, x1: -100.6, z0: EXLEY_GAP_STAIRS.z1, z1: SHANK_FENCE.z1 } as const;
/** How far up (0 at the sidewalk, 1 at Exley's level) the walk and steps are at z: a gentle slope in, three steps, the landing, three steps. */
export function gapRise(z: number, smooth = false): number {
  const G = EXLEY_GAP_STAIRS, k = (r: readonly number[], a: number, b: number) => a + (b - a) * clamp01((z - r[0]) / (r[1] - r[0]));
  if (smooth) return z < G.approach[1] ? k(G.approach, 0, 0.24) : z < G.flight1[1] ? k(G.flight1, 0.24, 0.62) : z < G.landing[1] ? 0.62 : k(G.flight2, 0.62, 1);
  if (z < G.approach[1]) return k(G.approach, 0, 0.24);
  if (z < G.flight1[1]) return 0.24 + 0.38 * Math.min(1, Math.ceil(((z - G.flight1[0]) / (G.flight1[1] - G.flight1[0])) * G.steps - 1e-9) / G.steps);
  if (z < G.landing[1]) return 0.62;
  return 0.62 + 0.38 * Math.min(1, Math.ceil(((z - G.flight2[0]) / (G.flight2[1] - G.flight2[0])) * G.steps - 1e-9) / G.steps);
}
export const SHANK_TREES: XZ[] = [];

/**
 * The new science building (the user's renders and photo, 2026-10-08), east of Shanklin's barricade, across Church Street
 * from Allbritton, on level ground. A long block clad in tan limestone panels with tall paired slot windows in deep
 * reveals (`SCI`); at its west end a two-storey glass volume cantilevered out over a recessed glass lobby (`SCI_GLASS`,
 * its doors `SCI_DOOR`); a stone screen round the plant on its roof. In front of the glass, a paved plaza (`SCI_PLAZA`)
 * with a curved lawn, reached by a walk straight in from Church Street (`SCI_WALK`). The Casper Life Sciences Building (2026): biology, chemistry, MB&B; between Church Street and Lawn Avenue.
 */
export const SCI = { x0: -30, x1: 22, z0: 148, z1: 176, h: 17, name: 'Casper Life Sciences' } as const;
export const SCI_GLASS = { x0: SCI.x0 - 3, x1: SCI.x0 + 17, z0: SCI.z0 - 1.5, z1: SCI.z1 + 1.5, y0: 5.4 } as const;
export const SCI_LOBBY = { x0: SCI.x0 + 2.5, x1: SCI.x0 + 15, z0: SCI.z0 + 2, z1: SCI.z1 - 2 } as const;
export const SCI_DOOR = { x: SCI_LOBBY.x0, z: (SCI.z0 + SCI.z1) / 2 } as const;
export const SCI_PLAZA = { x0: -44, x1: SCI.x0, z0: 142, z1: 182 } as const;
export const SCI_WALK = { x0: -40, x1: -35, z0: CHURCH_WALK_S.z1, z1: SCI_PLAZA.z0 } as const;
export const SCI_LAWN = { x: -38, z: 163, r: 4.5 } as const;
/** Its entrance on the long side to Church Street (the user): big glass doors in a tall stone recess, interlocking pavers up to them from the sidewalk. */
export const SCI_NDOOR = { x: SCI.x0 + 31.5, z: SCI.z0, half: 2.4 } as const;
export const SCI_NWALK = { x0: SCI_NDOOR.x - 2.6, x1: SCI_NDOOR.x + 2.6, z0: CHURCH_WALK_S.z1, z1: SCI.z0 } as const;
export const SCI_TREES: XZ[] = [{ x: -42, z: 150 }, { x: -33, z: 174 }, { x: -42, z: 178 }, { x: -8, z: 142 }, { x: 16, z: 142 }];

/** How much of Exley's level site is at (x, z): 1 on it, easing to 0 round it. */
function shankT(x: number, z: number): number {
  const S = SHANK_SITE, R = 5;
  const t = Math.min(1, Math.max(0, Math.min((x - S.x0 + R) / R, (S.x1 + R - x) / R, (z - S.z0 + 3) / 3, (S.z1 + R - z) / R)));
  return t * t * (3 - 2 * t);
}
function exleyT(x: number, z: number): number {
  const S = EXLEY_SITE, R = 5;
  const t = Math.min(1, Math.max(0, Math.min((x - S.x0 + R) / R, (S.x1 + R - x) / R, (z - S.z0 + 3) / 3, (S.z1 + R - z) / R)));
  return t * t * (3 - 2 * t);
}
/**
 * How high Church Street is at x (the user, 2026-10-07: campus climbs westward toward Foss Hill — biking up it hurts).
 * Level from High Street past Allbritton and the walkway's foot; then up past the bank to Olin's height, so in front of
 * Olin the street and Olin's grounds are on one line; then on up, gently, toward Foss Hill.
 */
export const CHURCH_CLIMB = { x0: -78, x1: -155, west: -172, grade: 0.015 } as const; // (a long, even climb: the user found a short one too sudden)
export function churchY(x: number): number {
  const C = CHURCH_CLIMB;
  if (x >= C.x0) return 0;
  const t = Math.min(1, (C.x0 - x) / (C.x0 - C.x1));
  return (OLIN_Y * (1 - Math.cos(Math.PI * t))) / 2 + (x < C.west ? (C.west - x) * C.grade : 0);
}
/** Where the ground starts blending toward the street, north of it; and how far south it takes to come back down. */
const CH_NORTH = 6, CH_SOUTH = 20;
/** The ground near Church Street: the street's own height across it (and its sidewalks), blending into what's either side. */
function nearChurch(x: number, z: number, base: (x: number, z: number) => number): number {
  const N = CHURCH_WALK_N.z0, S = CHURCH_WALK_S.z1, h = churchY(x);
  if (z >= N && z <= S) return h;
  const sm = (t: number) => t * t * (3 - 2 * t);
  if (z > S) { const e = exleyT(x, z), k = shankT(x, z), w = Math.max(e, k), len = CH_SOUTH * (1 - w) + 3 * w, target = Math.max(EXLEY_Y * e, SHANK_Y * k); return h + (target - h) * sm(Math.min(1, (z - S) / len)); } // (up onto Exley's or Shanklin's site, or down)
  if (z < N - CH_NORTH) return base(x, z);
  const from = base(x, N - CH_NORTH), t = sm((z - (N - CH_NORTH)) / CH_NORTH);
  return from + (h - from) * t;
}

/**
 * Allbritton's back, onto Church Street (the user's street views, 2026-10-07). Not one flat wall but three parts, on a
 * tall base of rough granite: on the west, the old block under its copper hip roof, a stone-trimmed bay standing out
 * from it (`ALLB_BAY`); in the middle, a wide plain brick stair tower standing well out and up past the roof
 * (`ALLB_TOWER`, its grey door on its face); on the east, a block of its own come forward toward the street, with a flat
 * roof, a parapet and a little room on top, arched windows along its top floor (`ALLB_WING`, a door in its base). Along
 * the tower and that block, a long landing at the doors' level (`ALLB_LANDING`) with a railing, steps down off its west
 * end (`ALLB_STEPS`), a ramp down from its east end to the sidewalk (`ALLB_RAMP`, 1 in 12). The rest is a small parking
 * lot (`ALLB_LOT`) off the street (`ALLB_DRIVE` crosses the sidewalk): the two accessible spaces at the west end by a low
 * concrete wall (`ALLB_WALL`), more nose-in to the landing; the black "Allbritton Hall" sign at the foot of the steps.
 */
export const ALLB_BAY = { x0: -64, x1: -58.2, z0: ALLBRITTON.z1, z1: ALLBRITTON.z1 + 1.2 } as const;
export const ALLB_TOWER = { x0: -57.2, x1: -51.6, z0: ALLBRITTON.z1, z1: ALLBRITTON.z1 + 3, h: ALLBRITTON.h + 2.4 } as const;
export const ALLB_WING = { x0: ALLB_TOWER.x1, x1: ALLBRITTON.x1, z0: ALLBRITTON.z1 - 8, z1: ALLBRITTON.z1 + 2.5, h: ALLBRITTON.h + 1.2 } as const;
export const ALLB_REAR_DOOR = { x: (ALLB_TOWER.x0 + ALLB_TOWER.x1) / 2, z: ALLB_TOWER.z1 } as const;
export const ALLB_WING_DOOR = { x: ALLB_WING.x0 + 4.2, z: ALLB_WING.z1 } as const;
export const ALLB_LANDING = { x0: ALLB_TOWER.x0 - 2.2, x1: ALLB_WING.x1 - 0.4, z0: ALLBRITTON.z1, z1: ALLB_TOWER.z1 + 1.6, h: 0.5 } as const;
export const ALLB_STEPS = { x0: ALLB_LANDING.x0 - 2.1, x1: ALLB_LANDING.x0, z0: ALLB_BAY.z1 + 0.2, z1: ALLB_LANDING.z1, steps: 4 } as const; // (up toward +x)
export const ALLB_RAMP = { x0: ALLB_LANDING.x1 - 2.2, x1: ALLB_LANDING.x1, z0: ALLB_LANDING.z1, z1: ALLB_LANDING.z1 + ALLB_LANDING.h * 12 } as const; // (down toward +z)
export const ALLB_LOT = { x0: -71.5, x1: ALLBRITTON.x1 + 2, z0: ALLBRITTON.z1, z1: CHURCH_WALK_N.z0 } as const;
export const ALLB_DRIVE = { x0: -66.5, x1: -58.5 } as const;
export const ALLB_WALL = { x0: ALLB_LOT.x0 - 0.3, x1: ALLB_LOT.x0, z0: ALLB_LOT.z0, z1: ALLB_LOT.z1 - 1.5 } as const;
/** The stalls: where each car parks (its middle), nose to the building or the landing; the first two accessible. */
export const ALLB_STALLS: (XZ & { w: number; len: number; accessible: boolean })[] = [
  ...[0, 1, 2].map((i) => ({ x: ALLB_LOT.x0 + 0.2 + 1.35 + i * 2.7 + (i >= 2 ? 1.4 : 0), z: ALLB_BAY.z1 + 0.1 + 2.5, w: 2.7, len: 5, accessible: i < 2 })),
  ...[0, 1, 2].map((i) => ({ x: ALLB_TOWER.x0 + 1.3 + i * 2.6, z: ALLB_LANDING.z1 + 0.25 + 2.3, w: 2.6, len: 4.6, accessible: false })),
];
/** Which stalls have a car in, and what colour. */
export const ALLB_PARKED: [number, number][] = [[0, 0x1d1f24], [2, 0xe9e9e9], [3, 0x5a5f66], [5, 0x2148a8]];
export const ALLB_SIGN: XZ = { x: ALLB_STEPS.x0 + 1.2, z: ALLB_LANDING.z1 + 0.5 };

/**
 * The walkway to Church Street (the user's street views, and where they stood to show it, 2026-10-07): it carries on from
 * the south end of the plaza by the Frank Center, down Allbritton's west side, to the street. Slimmer than the back path
 * and coal tar like it, in a gentle S; planted either side (the bank rising on its west, stepped back here to make room:
 * `bankEast`), short posts with chains slung between them in a W along both edges (`CHAIN_POSTS`; they keep you on it),
 * bronze lamp posts; at the foot a hydrant and a crossing sign, a crosswalk over the street. Level, like the plaza and
 * the street.
 */
const WALKWAY_CTRL: XZ[] = [
  { x: -70, z: 81 }, { x: -73.3, z: 90 }, { x: -76.3, z: 100 }, { x: -77.3, z: 110 }, { x: -76, z: 118 }, { x: -75.3, z: CHURCH_WALK_N.z0 + 0.8 },
];
/** Its centre line, a smooth curve through those points, every half metre or so. */
export const WALKWAY_PTS: XZ[] = (() => {
  const c = WALKWAY_CTRL, out: XZ[] = [];
  for (let i = 0; i < c.length - 1; i++) {
    const p0 = c[Math.max(0, i - 1)], p1 = c[i], p2 = c[i + 1], p3 = c[Math.min(c.length - 1, i + 2)];
    const n = Math.ceil(Math.hypot(p2.x - p1.x, p2.z - p1.z) / 0.5);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) });
    }
  }
  out.push(c[c.length - 1]);
  return out;
})();
const WALKWAY_S: number[] = WALKWAY_PTS.reduce((acc, p, i) => (i ? [...acc, acc[i - 1] + Math.hypot(p.x - WALKWAY_PTS[i - 1].x, p.z - WALKWAY_PTS[i - 1].z)] : [0]), [] as number[]);
export const WALKWAY = { w: 3.2, len: WALKWAY_S[WALKWAY_S.length - 1], chains: 2.1, beds: 4.4 } as const; // (widened from 2.4 m at the user's ask) // (chains: how far out the posts stand; beds: how far the planting runs)
/** The nearest point of the walkway's centre line to p: how far, how far along, which way it runs there. */
export function walkwayAt(p: XZ): { d: number; s: number; x: number; z: number; dx: number; dz: number } {
  let best = { d: Infinity, s: 0, x: 0, z: 0, dx: 0, dz: 1 };
  for (let i = 1; i < WALKWAY_PTS.length; i++) {
    const a = WALKWAY_PTS[i - 1], b = WALKWAY_PTS[i], ex = b.x - a.x, ez = b.z - a.z, l2 = ex * ex + ez * ez;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.z - a.z) * ez) / l2));
    const x = a.x + ex * t, z = a.z + ez * t, d = Math.hypot(p.x - x, p.z - z);
    if (d < best.d) { const l = Math.sqrt(l2); best = { d, s: WALKWAY_S[i - 1] + l * t, x, z, dx: ex / l, dz: ez / l }; }
  }
  return best;
}
/** The point s metres along the walkway, and which way it runs there. */
export function walkwayPoint(s: number) {
  let i = 1;
  while (i < WALKWAY_S.length - 1 && WALKWAY_S[i] < s) i++;
  const a = WALKWAY_PTS[i - 1], b = WALKWAY_PTS[i], l = WALKWAY_S[i] - WALKWAY_S[i - 1] || 1, t = Math.max(0, Math.min(1, (s - WALKWAY_S[i - 1]) / l));
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, dx: (b.x - a.x) / l, dz: (b.z - a.z) / l };
}
/** The posts along both edges (from just past the plaza to the sidewalk), `side` −1 west / +1 east. */
export const CHAIN_POSTS: (XZ & { side: number; s: number })[] = (() => {
  const out: (XZ & { side: number; s: number })[] = [], s0 = 3, s1 = WALKWAY.len - 1.2, n = Math.round((s1 - s0) / 2.4);
  for (let k = 0; k <= n; k++) {
    const s = s0 + ((s1 - s0) * k) / n, p = walkwayPoint(s);
    for (const side of [-1, 1]) out.push({ x: p.x + side * p.dz * WALKWAY.chains, z: p.z - side * p.dx * WALKWAY.chains, side, s }); // (side +1: the east edge)
  }
  return out;
})();
/** Bronze lamp posts along it, either side in turn, outside the chains. */
export const WALKWAY_LAMPS: XZ[] = [8, 22, 36].map((s, i) => { const p = walkwayPoint(s), side = i % 2 ? 1 : -1; return { x: p.x + side * p.dz * 3.0, z: p.z - side * p.dx * 3.0 }; });
/** At its foot: the hydrant in the planting, the crossing sign at the curb, and the crosswalk over the street. */
const FOOT = WALKWAY_CTRL[WALKWAY_CTRL.length - 1];
export const HYDRANT: XZ = { x: FOOT.x + 2.6, z: CHURCH_WALK_N.z0 - 0.9 };
export const XING_SIGN: XZ = { x: FOOT.x + 3.4, z: CHURCH.z0 - 0.4 };
export const CHURCH_XWALK = { x0: FOOT.x - 1.9, x1: FOOT.x + 1.9 } as const;
/** Lamps along Church Street's north sidewalk. */
export const CHURCH_LAMPS: XZ[] = [-226, -195, -170, -140, -110, -50, -20, 4].map((x) => ({ x, z: CHURCH_WALK_N.z0 + 0.4 }));
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const inRect = (p: XZ, b: Rect, pad = 0) => p.x > b.x0 - pad && p.x < b.x1 + pad && p.z > b.z0 - pad && p.z < b.z1 + pad;

/** The bank's east edge (x) at z: along the plaza, then stepped back west past its south end, for the walkway down Allbritton's side. */
export function bankEast(z: number): number {
  const t = clamp01((z - 77) / 7);
  return BERM.x1 - 9 * t * t * (3 - 2 * t);
}

/** The bank's height, ignoring the stairs and landing cut into it. */
export function bankY(x: number, z: number): number {
  const a = Math.min((x - BERM.x0) / SLOPE, (bankEast(z) - x) / SLOPE, (z - BERM.z0) / SLOPE_N, (BERM.z1 - z) / SLOPE);
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
  if (inRect(p, ALLB_LANDING)) return ALLB_LANDING.h;
  if (inRect(p, ALLB_STEPS)) return ALLB_LANDING.h * clamp01((x - ALLB_STEPS.x0) / (ALLB_STEPS.x1 - ALLB_STEPS.x0));
  if (inRect(p, ALLB_RAMP)) return ALLB_LANDING.h * clamp01((ALLB_RAMP.z1 - z) / (ALLB_RAMP.z1 - ALLB_RAMP.z0));
  if (inRect(p, STAIRS_O)) return TERRACE_Y + OLIN_RISE * clamp01((STAIRS_O.x1 - x) / (STAIRS_O.x1 - STAIRS_O.x0));
  if (inRect(p, OLIN_STEPS)) return OLIN_Y + (PORTICO_O.y - OLIN_Y) * clamp01((OLIN_STEPS.z1 - z) / (OLIN_STEPS.z1 - OLIN_STEPS.z0));
  if (inRect(p, PORTICO_O)) return PORTICO_O.y;
  if (inRect(p, CLARK_COURT)) return CLARK_COURT.y;
  if (inRect(p, CLARK_STAIRS_W)) return CLARK_COURT.y + (CLARK_Y - CLARK_COURT.y) * clamp01((CLARK_STAIRS_W.x1 - x) / (CLARK_STAIRS_W.x1 - CLARK_STAIRS_W.x0));
  if (inRect(p, CLARK_STAIRS_S)) return CLARK_COURT.y + (CLARK_Y - CLARK_COURT.y) * clamp01((z - CLARK_STAIRS_S.z0) / (CLARK_STAIRS_S.z1 - CLARK_STAIRS_S.z0));
  if (inRect(p, CLARK_LOW)) return 0;
  if (inRect(p, EXLEY_GAP_STAIRS)) { const h0 = churchY(x); return h0 + (EXLEY_Y - h0) * gapRise(z); }
  if (inRect(p, EXLEY_GAP)) return EXLEY_Y;
  if (inRect(p, SHANK_STEPS)) return SHANK_Y + SHANKLIN.base * clamp01((x - SHANK_STEPS.x0) / (SHANK_STEPS.x1 - SHANK_STEPS.landing - SHANK_STEPS.x0)); // (a landing at the top)
  for (const f of BANK_FLIGHTS) if (inRect(p, f)) return terrainBase((f.x0 + f.x1) / 2, f.z1 + 0.05) * clamp01((z - f.z0) / (f.z1 - f.z0));
  if (inRect(p, STAIRS_C)) return CLARK_Y * clamp01((z - STAIRS_C.z0) / (STAIRS_C.z1 - STAIRS_C.z0));
  return terrainBase(x, z) || zelnickY(x, z); // (and up the steps and ramp at Zelnick's back entrance)
}
/** The bank and Olin's grounds, running into Church Street's climb at their south edge. */
function terrainBase(x: number, z: number): number {
  const base = (a: number, b: number) => {
    const h = bankY(a, b) + oliny(a, b), t = clarkT(a, b), south = h + (CLARK_Y - h) * t;
    // beside Olin, north of its front, the tar runs flat from Clark right up to Olin's wall; easing into Olin's grounds past its front
    if (a >= OLIN.x0 && a < OLIN.x0 + 4 && b >= CLARK_SITE.z0 && b < OLIN.cz - 4) { const u = (a - OLIN.x0) / 4; return CLARK_Y + (south - CLARK_Y) * u * u * (3 - 2 * u); } // (the tar eases down onto the paved terrace)
    if (a >= OLIN.x0 || a < OLIN.x0 - 8 || b > OLIN.z1 + 4 || b < CLARK_SITE.z0) return south;
    const s = clamp01((b - OLIN.z1) / 4);
    return CLARK_Y + (south - CLARK_Y) * s * s * (3 - 2 * s);
  };
  return z > CHURCH_WALK_N.z0 - CH_NORTH ? nearChurch(x, z, base) : base(x, z);
}

/** The ground itself, under anything built on it (Olin's steps and portico, the small stairs): for drawing the grass. */
export function terrainY(x: number, z: number): number {
  const p = { x, z };
  if (inRect(p, OLIN_STEPS) || inRect(p, PORTICO_O) || inRect(p, CLARK_STAIRS_W) || inRect(p, CLARK_STAIRS_S)) return terrainBase(x, z);
  if (inRect(p, EXLEY_GAP_STAIRS)) { const h0 = churchY(x); return h0 + (EXLEY_Y - h0) * gapRise(z, true) - 0.06; } // (just under the steps, smoothly: no grass on them)
  return groundY(x, z);
}

/** How much of Clark's (level) site is at (x, z): 1 on it, easing to 0 over a few metres round it. */
function clarkT(x: number, z: number): number {
  const S = CLARK_SITE, R = 3;
  if (x >= S.x1) return 0; // (a wall on the east: Olin's terrace)
  const t = clamp01(Math.min((x - S.x0 + R) / R, (z - S.z0 + R) / R, (S.z1 + R - z) / R));
  return t * t * (3 - 2 * t);
}

/** How much higher Olin's grounds are at (x, z): grass slopes up all round; on the east, a long straight one beside the small stairs. */
function oliny(x: number, z: number): number {
  const S = OLIN_SITE, R = 2;
  if (x >= S.x1 || x < S.x0) return 0; // (on the west, a retaining wall down to the path by Clark)
  const t = clamp01(Math.min(1, (z - S.z0 + R) / R, (S.z1 + R - z) / R));
  const east = clamp01((S.x1 - x) / (STAIRS_O.x1 - STAIRS_O.x0)); // (rising just as the stairs do)
  return OLIN_RISE * Math.min(t * t * (3 - 2 * t), east);
}

/** Too steep or high for a car: anywhere up the bank (or on the stairs). */
export const offRoadForCars = (p: XZ) =>
  !inRect(p, LANDING) && !inRect(p, CLARK_LANE) && !inRect(p, CLARK_GAP) && !inRect(p, CLARK_UPPER) && (inRect(p, STAIRS) || inRect(p, STAIRS_E) || inRect(p, STAIRS_W) || BANK_FLIGHTS.some((f) => inRect(p, f)) || inRect(p, STAIRS_C) || bankY(p.x, p.z) > 0.12);

const FRANK_PARTS: Rect[] = [FRANK, FRANK_LINK, FRANK_ADD];
const ALLB_PARTS: Rect[] = [ALLBRITTON, ALLB_TOWER, ALLB_WING, ALLB_BAY, CLARK, ...CLARK_ENDS, EXLEY_PAV, EXLEY_TOWER, EXLEY_WING, SHANKLIN, HALL_ATWATER, { x0: SCI.x0, x1: SCI.x1, z0: SCI.z0, z1: SCI.z1 }];
const PRUZAN_PARTS: Rect[] = [PRUZAN, PRUZAN_ENTRY, PRUZAN_LINK_N, ...PRUZAN_PIERS];
const inBlock = (p: XZ, pad: number) => inPoly(p, OLIN_LINK_POLY) || (pad > 0 && distToPoly(p, OLIN_LINK_POLY) < pad);

/** Inside (or within `pad` of) one of the buildings down here? */
export function inSouthEnd(p: XZ, pad = 0): boolean {
  return [...FRANK_PARTS, ...PRUZAN_PARTS, ...ALLB_PARTS].some((b) => inRect(p, b, pad)) || inBlock(p, pad)
    || inPoly(p, OLIN_POLY) || (pad > 0 && distToPoly(p, OLIN_POLY) < pad);
}

/** Which of them you're next to (for "now passing"), if any. */
export function southEndNear(p: XZ, reach = 8): string | null {
  if (PRUZAN_PARTS.some((b) => inRect(p, b, 4)) || inBlock(p, 4) || inRect(p, PRUZAN_COURT, 3) || inRect(p, NCOURT)) return PRUZAN.name; // (first: it's between the other two)
  if (FRANK_PARTS.some((b) => inRect(p, b, reach))) return FRANK.name;
  if ((inRect(p, SCI, 5) || inRect(p, SCI_PLAZA)) && p.z > CHURCH_WALK_S.z1) return SCI.name;
  if (inRect(p, SHANKLIN, 5) && p.z > CHURCH_WALK_S.z1) return SHANKLIN.name;
  if (inRect(p, HALL_ATWATER, 5) && p.z > CHURCH_WALK_S.z1) return HALL_ATWATER.name;
  if (inRect(p, EXLEY_SITE) && p.z > CHURCH_WALK_S.z1) return 'Exley Science Center';
  if (inRect(p, CLARK, 6) || inRect(p, CLARK_GAP) || inRect(p, CLARK_LOW) || inRect(p, CLARK_COURT)) return CLARK.name;
  if (inPoly(p, OLIN_POLY) || distToPoly(p, OLIN_POLY) < reach || inRect(p, OLIN_LAWN) || inRect(p, PORTICO_O, 2)) return OLIN.name;
  if (inRect(p, ALLBRITTON, reach) || inRect(p, ALLB_LOT)) return ALLBRITTON.name;
  if (p.x > CHURCH.x0 && p.x < CHURCH.x1 && p.z > CHURCH_WALK_N.z0 && p.z < CHURCH_WALK_S.z1) return 'Church Street';
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

/** The sunken court's retaining walls, as thin boxes along its edges: west (open at the west stairs), north, south (open at the south-west stairs). */
export function courtWalls(): Rect[] {
  const C = CLARK_COURT, W = CLARK_STAIRS_W, S = CLARK_STAIRS_S, t = 0.3;
  return [
    { x0: C.x0 - t, x1: C.x0, z0: C.z0 - t, z1: W.z0 }, { x0: C.x0 - t, x1: C.x0, z0: W.z1, z1: C.z1 + t },
    { x0: C.x0, x1: C.x1, z0: C.z0 - t, z1: C.z0 },
    { x0: C.x0, x1: S.x0, z0: C.z1, z1: C.z1 + t }, { x0: S.x1, x1: C.x1, z0: C.z1, z1: C.z1 + t },
  ];
}

/** The fence's runs, between the openings for the stairs down the bank. */
export function balustradeRuns(): [number, number][] {
  const gaps = [...BANK_FLIGHTS, STAIRS_W].sort((a, b) => a.x0 - b.x0), out: [number, number][] = [];
  let x = BALUSTRADE.x0;
  for (const f of gaps) { if (f.x0 - CHEEK > x) out.push([x, f.x0 - CHEEK]); x = f.x1 + CHEEK; }
  if (BALUSTRADE.x1 > x) out.push([x, BALUSTRADE.x1]);
  return out;
}

/** Points every 0.35 m along one edge's chain, post to post: they're solid, so you stay on the walkway. */
function chainLine(side: number): XZ[] {
  const posts = CHAIN_POSTS.filter((p) => p.side === side), out: XZ[] = [];
  for (let i = 1; i < posts.length; i++) {
    const a = posts[i - 1], b = posts[i], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.35);
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
  }
  out.push(posts[posts.length - 1]);
  return out;
}

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
    ...balustradeRuns().map(([x0, x1]) => bal(x0, x1)), // (open at each flight of stairs)
    b(BALUSTRADE.x1 - 0.2, (BALUSTRADE.z + FRANK.z0) / 2, 0.2, (FRANK.z0 - BALUSTRADE.z) / 2), // and the short run joining it to the Frank Center
    ...BANK_FLIGHTS.flatMap((f) => [f.x0 - CHEEK / 2, f.x1 + CHEEK / 2].map((x) => b(x, (f.z0 + f.z1) / 2, CHEEK / 2, (f.z1 - f.z0) / 2))),
    ...NCOURT_TABLES.map((t) => b(t.x, t.z, 0.6, 0.6)),
    ...[...NCOURT_TREES, LAWN_TREE].map((t) => b(t.x, t.z, 0.2, 0.2)),
    ...[LAWN_BENCH_N, LAWN_BENCH_S].map((t) => b(t.x, t.z, t.len / 2, t.len / 2)), // (roughly: they're turned)
    b(ex, STAIRS_E.z0 - CHEEK / 2, eh, CHEEK / 2), b(ex, STAIRS_E.z1 + CHEEK / 2, eh, CHEEK / 2),
    ...BOLLARDS.map((p) => b(p.x, p.z, 0.15, 0.15)),
    b(SIGN.x, SIGN.z, 0.1, 0.1),
    b(SYCAMORE.x, SYCAMORE.z, 0.75, 0.75), b(SYCAMORE2.x, SYCAMORE2.z, 0.7, 0.7),
    b(FLAGPOLE.x, FLAGPOLE.z, 0.08, 0.08), b(PRUZAN_BIRCH.x, PRUZAN_BIRCH.z, 0.3, 0.3),
    ...OLIN_COLUMNS.map((c) => b(c.x, c.z, 0.5, 0.5)),
    // Olin's grounds: the cheeks of its grand steps, the trees, benches, lamps, sign
    ...[PORTICO_O.x0 - 0.35, PORTICO_O.x1 + 0.35].map((x) => b(x, (PORTICO_O.z0 + OLIN_STEPS.z1) / 2, 0.35, (OLIN_STEPS.z1 - PORTICO_O.z0) / 2)),
    ...OLIN_TREES.map((t) => b(t.x, t.z, 0.45, 0.45)),
    ...OLIN_BENCHES.map((t) => b(t.x, t.z, 0.35, 1.0)),
    ...[...OLIN_LAMPS, OLIN_SIGN].map((t) => b(t.x, t.z, 0.12, 0.12)),
    // Allbritton's back: the railing along the landing's front (open at the ramp) and round the steps; both sides of the
    // ramp; the concrete wall at the lot's west end; the sign
    b((ALLB_LANDING.x0 + ALLB_RAMP.x0) / 2, ALLB_LANDING.z1, (ALLB_RAMP.x0 - ALLB_LANDING.x0) / 2, 0.05),
    ...[ALLB_STEPS.z0, ALLB_STEPS.z1].map((z) => b((ALLB_STEPS.x0 + ALLB_STEPS.x1) / 2, z, (ALLB_STEPS.x1 - ALLB_STEPS.x0) / 2, 0.05)),
    ...[ALLB_RAMP.x0, ALLB_RAMP.x1].map((x) => b(x, (ALLB_RAMP.z0 + ALLB_RAMP.z1) / 2, 0.05, (ALLB_RAMP.z1 - ALLB_RAMP.z0) / 2)),
    b((ALLB_WALL.x0 + ALLB_WALL.x1) / 2, (ALLB_WALL.z0 + ALLB_WALL.z1) / 2, (ALLB_WALL.x1 - ALLB_WALL.x0) / 2, (ALLB_WALL.z1 - ALLB_WALL.z0) / 2),
    b(ALLB_SIGN.x, ALLB_SIGN.z, 0.45, 0.1),
    // Clark Hall: its porch piers, the railings down both sides of its steps, its lamps
    ...CLARK_PIERS.map((q) => b(q.x, q.z, 0.35, 0.35)),
    ...CLARK_LAMPS.map((q) => b(q.x, q.z, 0.12, 0.12)), ...CLARK_TREES.map((q) => b(q.x, q.z, 0.2, 0.2)),
    ...DUMPSTERS.map((d) => b(d.x, d.z, d.w / 2 + 0.2, d.len / 2 + 0.2)), // (and the bags round them)
    // the court's retaining walls (open at its two stairs), its hedge; the cheeks of the stairs to Andrus
    ...courtWalls().map((w) => b((w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2, (w.x1 - w.x0) / 2, (w.z1 - w.z0) / 2)),
    b((CLARK_HEDGE.x0 + CLARK_HEDGE.x1) / 2, (CLARK_HEDGE.z0 + CLARK_HEDGE.z1) / 2, (CLARK_HEDGE.x1 - CLARK_HEDGE.x0) / 2, (CLARK_HEDGE.z1 - CLARK_HEDGE.z0) / 2),
    // the tall retaining wall along the flat walk (and up beside the stairs), the bed beside the stairs
    b((OLIN_LOW_WALL.x0 + OLIN_LOW_WALL.x1) / 2, (OLIN_LOW_WALL.z0 + OLIN_LOW_WALL.z1) / 2, (OLIN_LOW_WALL.x1 - OLIN_LOW_WALL.x0) / 2, (OLIN_LOW_WALL.z1 - OLIN_LOW_WALL.z0) / 2),
    b((STAIRS_C_BED.x0 + STAIRS_C_BED.x1) / 2, (STAIRS_C_BED.z0 + STAIRS_C_BED.z1) / 2, (STAIRS_C_BED.x1 - STAIRS_C_BED.x0) / 2, (STAIRS_C_BED.z1 - STAIRS_C_BED.z0) / 2),
    ...SCI_TREES.map((q) => b(q.x, q.z, 0.4, 0.4)), // the science building's trees
    // the construction fence round Shanklin and Hall-Atwater
    ...[[SHANK_FENCE.x0, SHANK_FENCE.z0, SHANK_FENCE.x1, SHANK_FENCE.z0], [SHANK_FENCE.x0, SHANK_FENCE.z1, SHANK_FENCE.x1, SHANK_FENCE.z1], [SHANK_FENCE.x0, SHANK_FENCE.z0, SHANK_FENCE.x0, SHANK_FENCE.z1], [SHANK_FENCE.x1, SHANK_FENCE.z0, SHANK_FENCE.x1, SHANK_FENCE.z1]]
      .map(([x0, z0, x1, z1]) => b((x0 + x1) / 2, (z0 + z1) / 2, Math.max(0.05, (x1 - x0) / 2), Math.max(0.05, (z1 - z0) / 2))),
    // Shanklin: its steps' sides, the outside stair at its street end; its trees
    ...[SHANK_STEPS.z0, SHANK_STEPS.z1].map((z) => b((SHANK_STEPS.x0 + SHANK_STEPS.x1) / 2, z, (SHANK_STEPS.x1 - SHANK_STEPS.x0) / 2, 0.06)),
    b((SHANK_STAIR.x0 + SHANK_STAIR.x1) / 2, (SHANK_STAIR.z0 + SHANK_STAIR.z1) / 2, (SHANK_STAIR.x1 - SHANK_STAIR.x0) / 2, (SHANK_STAIR.z1 - SHANK_STAIR.z0) / 2),
    ...SHANK_TREES.map((q) => b(q.x, q.z, 0.4, 0.4)),
    // Exley: the planter walls, the round planters, the trees, the bench, the sign in the road
    ...EXLEY_WALLS.map((w) => b((w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2, (w.x1 - w.x0) / 2, (w.z1 - w.z0) / 2)),
    ...EXLEY_PLANTERS.map((q) => b(q.x, q.z, 0.7, 0.7)), ...EXLEY_TREES.map((q) => b(q.x, q.z, 0.4, 0.4)), b(EXLEY_PINE.x, EXLEY_PINE.z, 0.5, 0.5),
    b(EXLEY_BENCH.x, EXLEY_BENCH.z, EXLEY_BENCH.len / 2, 0.3), b(EXLEY_STOP.x, EXLEY_STOP.z, 0.25, 0.25),
    // the walkway down to Church Street: its lamps, the hydrant, the sign, and the chains along both edges (posts and all)
    ...[...WALKWAY_LAMPS, HYDRANT, XING_SIGN, ...CHURCH_LAMPS].map((t) => b(t.x, t.z, 0.15, 0.15)),
    ...chainLine(-1).map((t) => b(t.x, t.z, 0.08, 0.08)), ...chainLine(1).map((t) => b(t.x, t.z, 0.08, 0.08)),
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
