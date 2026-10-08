import type { XZ } from './collide';
import {
  CHURCH, SCI, CHURCH_WALK_N, CHURCH_WALK_S, CHURCH_XWALK, EXLEY_DOOR, EXLEY_XWALK, FIELD_ROAD, LINK_DOOR, LINK_DOOR_S, OLIN, OLIN_DOOR,
  OLIN_WALK, PRUZAN_DOOR, PRUZAN_DOOR_N, SCI_DOOR, SCI_NDOOR, SCI_WALK, STAIRS_C, STAIRS_E, WALKWAY_PTS, BANK_FLIGHTS, CLARK, MAIN_ENTRY,
} from './southend';
import { BACK_PATH, layoutRow } from './layout';
import { rearDoorZ } from './backlawn';

// ─── People about the south end (pure) ─────────────────────────────────
// The user (2026-10-08): professors walking Church Street to class between Olin, Exley and Casper; a few students
// cutting across the grass from the Frank Center to Olin; the Frank Center's side busier; very few round Clark; some
// coming up off the field road. Each route runs between two doors (or a door and the edge of what's built): walkers
// go along it, go in at the end, and after a while come back out the other way. Across Church Street only at its
// crosswalks, where the traffic stops for them (and they wait for a car that's close).

export type Who = 'prof' | 'student';
export interface Route { id: string; who: Who; n: number; pts: XZ[] }

const P = (x: number, z: number): XZ => ({ x, z });
const midN = (CHURCH_WALK_N.z0 + CHURCH.z0) / 2, midS = (CHURCH.z1 + CHURCH_WALK_S.z1) / 2; // the sidewalks' middles
const exX = (EXLEY_XWALK.x0 + EXLEY_XWALK.x1) / 2, chX = (CHURCH_XWALK.x0 + CHURCH_XWALK.x1) / 2;
const sciX = (SCI_WALK.x0 + SCI_WALK.x1) / 2;
const walkZ = (OLIN_WALK.z0 + OLIN_WALK.z1) / 2;
const lawnX = OLIN.cx + 2.4; // the east one of the two walks straight out from Olin's steps
/** Out of Olin's door, down its steps onto the walk in front. */
const OLIN_OUT = [P(OLIN_DOOR.x, OLIN_DOOR.z + 0.6), P(OLIN_DOOR.x, walkZ)];
/** From the walk in front of Olin, down its lawn to Church Street's north sidewalk. */
const OLIN_TO_STREET = [P(lawnX, walkZ), P(lawnX, CHURCH_WALK_N.z0 - 1.2), P(lawnX + 1.2, midN)];
/** Out of Exley's doors, across its plaza and down the entry walk to the crosswalk. */
const EXLEY_OUT = [P(EXLEY_DOOR.x, EXLEY_DOOR.z - 0.6), P(exX, EXLEY_DOOR.z - 8), P(exX, midS)];
/** From Church Street's south sidewalk up Casper's walk, across its plaza to the lobby doors. */
const SCI_IN = [P(sciX, midS), P(sciX, 146), P(sciX, SCI_DOOR.z), P(SCI.x0 - 0.4, SCI_DOOR.z)];
/** From the top of the stairs up off the Frank Center's plaza, west along the walk to Olin's door. */
const WALK_TO_OLIN = [P(STAIRS_E.x0 - 0.5, walkZ), P(OLIN.x1 + 2, walkZ), P(OLIN_DOOR.x, walkZ), P(OLIN_DOOR.x, OLIN_DOOR.z + 0.6)];
/** The walkway down Allbritton's side, thinned to every few metres. */
/** Out of the Frank Center's glass main entry onto the back path. */
const FRANK_MAIN = P(MAIN_ENTRY.x + MAIN_ENTRY.out + 0.6, MAIN_ENTRY.z);
/** Out of Judd's back door, across to the back path. */
const judd = layoutRow().stops.find((st) => st.id === 'judd')!;
const JUDD_BACK = [P(judd.back - 0.6, rearDoorZ(judd)), P(BACK_PATH.x1 - 1.5, rearDoorZ(judd))];
/** The far (west) end of the field road, where it runs on toward Foss Hill. */
const ROAD_END_X = FIELD_ROAD.x0 + 2;
const roadZ = (FIELD_ROAD.z0 + FIELD_ROAD.z1) / 2 + 1.2; // (keeping right, on the bank's side)
const WALKWAY = WALKWAY_PTS.filter((_, i) => i % 6 === 0).concat(WALKWAY_PTS[WALKWAY_PTS.length - 1]);

export const ROUTES: Route[] = [
  // professors, between Olin, Exley and Casper
  { id: 'olin-exley', who: 'prof', n: 2, pts: [...OLIN_OUT, ...OLIN_TO_STREET, P(exX, midN), ...[...EXLEY_OUT].reverse()] },
  { id: 'olin-casper', who: 'prof', n: 2, pts: [...[...WALK_TO_OLIN].reverse(), P(STAIRS_E.x1 + 1, walkZ), P(-71, 78), ...WALKWAY, P(chX, midS), P(sciX, midS), ...SCI_IN.slice(1)] },
  { id: 'exley-casper', who: 'prof', n: 1, pts: [...EXLEY_OUT, P(sciX, midS), ...SCI_IN.slice(1)] },
  { id: 'casper-north', who: 'prof', n: 1, pts: [P(SCI_NDOOR.x, SCI_NDOOR.z - 0.6), P(SCI_NDOOR.x, midS), P(chX, midS), P(chX, midN), ...[...WALKWAY].reverse(), P(-66, 67), P(-58.6, 63), P(-58.6, 44), FRANK_MAIN] },
  // students: across the grass from the Frank Center to Olin (a shortcut, off the paving)
  { id: 'frank-olin-cut', who: 'student', n: 2, pts: [P(LINK_DOOR_S.x, LINK_DOOR_S.z + 0.6), P(LINK_DOOR_S.x, 57.5), P(-108, walkZ - 0.4), ...WALK_TO_OLIN.slice(2)] },
  // the Frank Center's side: up off its plaza to the Pruzan's doors; up the granite stairs from the field road
  { id: 'plaza-pruzan', who: 'student', n: 2, pts: [FRANK_MAIN, P(-58.6, 44), P(-58.6, 63), P(-66, 67), P(STAIRS_E.x1 + 1, walkZ), P(STAIRS_E.x0 - 0.5, walkZ), P(-111, walkZ), P(-111, 58), P(PRUZAN_DOOR.x, PRUZAN_DOOR.z + 0.6)] },
  { id: 'road-frank', who: 'student', n: 2, pts: [...JUDD_BACK, P(BACK_PATH.x1 - 1.5, roadZ), P(LINK_DOOR.x, roadZ), P(LINK_DOOR.x, LINK_DOOR.z - 0.6)] },
  // up off the field road, up a flight in the bank, along the terrace to the Pruzan's back doors
  { id: 'road-pruzan', who: 'student', n: 2, pts: [P(ROAD_END_X, roadZ), P((BANK_FLIGHTS[3].x0 + BANK_FLIGHTS[3].x1) / 2, roadZ), P((BANK_FLIGHTS[3].x0 + BANK_FLIGHTS[3].x1) / 2, 12.4), P(PRUZAN_DOOR_N.x, 12.4), P(PRUZAN_DOOR_N.x, PRUZAN_DOOR_N.z - 0.6)] },
  // round Clark, just one: off the field road, up past Clark, down the lane, across to Exley
  { id: 'clark-exley', who: 'student', n: 1, pts: [P(ROAD_END_X, roadZ), P((STAIRS_C.x0 + STAIRS_C.x1) / 2, roadZ), P((STAIRS_C.x0 + STAIRS_C.x1) / 2, STAIRS_C.z1 + 1), P(CLARK.x1 + 4, 40), P(CLARK.x1 + 4, CHURCH_WALK_N.z0 - 1), P(exX, midN), ...[...EXLEY_OUT].reverse()] },
];

/** Each route's length and the distance along it at each point. */
const cum = new Map<Route, number[]>();
function lengths(r: Route): number[] {
  let c = cum.get(r);
  if (!c) {
    c = [0];
    for (let i = 1; i < r.pts.length; i++) c.push(c[i - 1] + Math.hypot(r.pts[i].x - r.pts[i - 1].x, r.pts[i].z - r.pts[i - 1].z));
    cum.set(r, c);
  }
  return c;
}
export const routeLength = (r: Route) => { const c = lengths(r); return c[c.length - 1]; };

/** Where you are `s` metres along a route, and which way you face going forward (heading: 0 = +z). */
export function pointAt(r: Route, s: number): XZ & { heading: number } {
  const c = lengths(r), L = c[c.length - 1], t = Math.max(0, Math.min(L, s));
  let i = 1;
  while (i < c.length - 1 && c[i] < t) i++;
  const a = r.pts[i - 1], b = r.pts[i], seg = c[i] - c[i - 1] || 1, u = (t - c[i - 1]) / seg;
  return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, heading: Math.atan2(b.x - a.x, b.z - a.z) };
}

/** On Church Street's roadway (between its curbs)? */
export const inChurchRoad = (p: XZ) => p.z > CHURCH.z0 && p.z < CHURCH.z1 && p.x > CHURCH.x0 && p.x < CHURCH.x1;

/** Someone `ahead` metres short of stepping into the road waits while a car is close and coming. */
export function waitToCross(r: Route, s: number, dir: 1 | -1, cars: (XZ & { speed: number })[], ahead = 1.2): boolean {
  const here = pointAt(r, s), next = pointAt(r, s + dir * ahead);
  if (inChurchRoad(here) || !inChurchRoad(next)) return false;
  return cars.some((c) => Math.abs(c.x - next.x) < 16 && Math.abs(c.z - next.z) < 6 && c.speed > 0.5);
}
