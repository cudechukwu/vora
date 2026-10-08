import type { Box, Extra, XZ } from '../collide';
import { SCI, SCI_DOOR, SCI_NDOOR } from '../southend';

// ─── Inside Casper (pure data, no three.js) ────────────────────────────
// The Casper Life Sciences Building, from the user's photos and the architects' renders (2026-10-08). Like Usdan it's its
// own world: walk in through a door and you're in a separate scene. Four floors round a three-storey atrium.
//
//   L0, the ground floor: in from Church Street through a glass vestibule into a long corridor (wood-veneer walls, a cove
//     light along the top, a dark slatted ceiling, a grey plank-tile floor, a water-fountain niche, the elevators in a dark
//     recess, a wall of posters). It opens onto the atrium: the live-edge table, green pebble seats on a topographic rug,
//     the foot of the grand stair. West, under the glass, the café commons: a planter, white pebble seats, round tables,
//     long tables, the café counter. East and south, glass-fronted classrooms and teaching labs with green carpet.
//   L1–L3: pale oak floors; along the void, glass balustrades with wood handrails; teal tub chairs on topographic rugs,
//     green high-back chairs, a green phone booth, a long counter with teal stools; glass-walled labs (grey carpet,
//     lab benches, white casework, blue chairs) east; a study commons under the glass west.
//
// −z is north (Church Street), +x east. World coordinates, inside SCI's footprint.

const R = 0.3; // your radius

export const FH = 4.2; // floor to floor
export type CLevel = 0 | 1 | 2 | 3;
export const LEVELS = 4;

/** Where you can be inside (inset from the outer walls); on the ground floor the west end stops at the lobby's glass. */
export const IN_L0 = { x0: SCI_DOOR.x + 0.4, x1: SCI.x1 - 0.45, z0: SCI.z0 + 0.45, z1: SCI.z1 - 0.45 } as const;
export const IN_UP = { x0: SCI.x0 + 0.45, x1: SCI.x1 - 0.45, z0: SCI.z0 + 0.45, z1: SCI.z1 - 0.45 } as const;

/** The atrium: open from the ground floor up through L3's ceiling. */
export const VOID = { x0: -12, x1: 4, z0: 154, z1: 170 } as const;
/** On the top floor, a bridge across the atrium from the stair's landing to the south side (the renders). */
export const BRIDGE = { level: 3, x0: 0.2, x1: 2.6, z0: 157.4, z1: 170.2 } as const;

// ── the doors ──
export type CDoorId = 'north' | 'west';
export interface CDoor { id: CDoorId; x: number; z: number; nx: number; nz: number; w: number; label: string }
export const CDOORS: CDoor[] = [
  { id: 'north', x: SCI_NDOOR.x, z: SCI.z0, nx: 0, nz: -1, w: SCI_NDOOR.half * 2, label: 'Church Street' },
  { id: 'west', x: SCI_DOOR.x, z: SCI_DOOR.z, nx: -1, nz: 0, w: 2.6, label: 'the plaza' },
];
const frame = (d: CDoor, p: XZ) => {
  const dx = p.x - d.x, dz = p.z - d.z;
  return { d: dx * d.nx + dz * d.nz, lat: dx * -d.nz + dz * d.nx };
};
/** Stepping into a doorway (on the ground floor) takes you through it. */
export function casperPortalAt(where: string, p: XZ, level = 0): { door: CDoor; kind: 'enter' | 'exit' } | null {
  for (const door of CDOORS) {
    const { d, lat } = frame(door, p);
    if (Math.abs(lat) > door.w / 2 - 0.3) continue;
    if (where === 'out' && d > -0.2 && d < 1.3) return { door, kind: 'enter' };
    if (where === 'casper' && level === 0 && d > -1.05 && d < 0.5) return { door, kind: 'exit' };
  }
  return null;
}
/** Close enough to a door to offer the button. */
export function nearCasperDoor(where: string, p: XZ, level = 0): CDoor | null {
  for (const door of CDOORS) {
    const { d, lat } = frame(door, p);
    if (Math.abs(lat) > door.w / 2 + 0.5) continue;
    if (where === 'out' && d > 0 && d < 3) return door;
    if (where === 'casper' && level === 0 && d < 0 && d > -3.2) return door;
  }
  return null;
}
/** Where you end up after going through a door, and which way you face. */
export function casperArrive(door: CDoor, kind: 'enter' | 'exit') {
  const s = kind === 'enter' ? -3.2 : 2.4;
  const heading = Math.atan2(door.nx * (kind === 'enter' ? -1 : 1), door.nz * (kind === 'enter' ? -1 : 1));
  return { x: door.x + door.nx * s, z: door.z + door.nz * s, heading };
}

// ── the grand stairs ──
/** A flight: its footprint, the floor it starts from (`base`; it reaches base + 1), and which way it climbs. */
export interface Flight { id: string; x0: number; x1: number; z0: number; z1: number; base: CLevel; up: '+x' | '-x' }
export const FLIGHTS: Flight[] = [
  { id: 'A', x0: -8.5, x1: -1, z0: 154.4, z1: 157.2, base: 0, up: '+x' }, // ground → L1, along the void's north side
  { id: 'B', x0: -3.5, x1: 4, z0: 166.8, z1: 169.6, base: 1, up: '-x' }, // L1 → L2, along its south side
  { id: 'C', x0: -8.5, x1: -1, z0: 154.4, z1: 157.2, base: 2, up: '+x' }, // L2 → L3, over the first
];
const inR = (p: XZ, b: { x0: number; x1: number; z0: number; z1: number }) => p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1;
/** The flight you're on, if any (only one belongs to the floors either side of you). */
export function flightAt(level: number, p: XZ): Flight | null {
  return FLIGHTS.find((f) => inR(p, f) && (level === f.base || level === f.base + 1)) ?? null;
}
/** How far up a flight (0 at its foot, 1 at its head) x is. */
export const flightT = (f: Flight, x: number) => Math.min(1, Math.max(0, f.up === '+x' ? (x - f.x0) / (f.x1 - f.x0) : (f.x1 - x) / (f.x1 - f.x0)));
/** How far up (0–1 of a floor) you are at `t` along a flight: two runs of steps with a flat landing halfway (the photos). */
export const LANDING_T = [0.44, 0.56] as const;
export function flightRise(t: number): number {
  const [a, b] = LANDING_T;
  return t < a ? (t / a) * 0.5 : t < b ? 0.5 : 0.5 + ((t - b) / (1 - b)) * 0.5;
}
/** Height of the floor under you. */
export function casperFloorY(level: number, x: number, z: number): number {
  const f = flightAt(level, { x, z });
  return f ? (f.base + flightRise(flightT(f, x))) * FH : level * FH;
}
/** Which floor you're on after moving to (x, z): only the stairs change it. */
export function casperLevelAt(level: number, x: number, z: number): CLevel {
  const f = flightAt(level, { x, z });
  return (f ? (flightT(f, x) > 0.5 ? f.base + 1 : f.base) : level) as CLevel;
}

// ── the floors above the ground: where there's floor (the void left open, landings at the stairs) ──
const A = FLIGHTS[0], B = FLIGHTS[1], C = FLIGHTS[2];
function plates(level: number): Box[] {
  const I = IN_UP, V = VOID;
  const ring: Box[] = [
    { x0: I.x0, x1: I.x1, z0: I.z0, z1: V.z0 }, // north, along the void
    { x0: I.x0, x1: V.x0, z0: I.z0, z1: I.z1 }, // west, under the glass
    { x0: V.x1, x1: I.x1, z0: I.z0, z1: I.z1 }, // east
    { x0: I.x0, x1: I.x1, z0: V.z1, z1: I.z1 }, // south
  ];
  if (level === 1) return [...ring, { x0: A.x1 - 0.3, x1: V.x1 + 0.1, z0: V.z0 - 0.1, z1: A.z1 + 0.4 }, { ...A }, { ...B, x1: B.x1 + 0.3 }];
  if (level === 2) {
    return [...ring, { x0: V.x0 - 0.1, x1: B.x0 + 0.3, z0: B.z0 - 0.4, z1: V.z1 + 0.1 }, { x0: V.x0 - 0.1, x1: C.x0 + 0.3, z0: V.z0 - 0.1, z1: C.z1 + 0.4 }, { ...B }, { ...C }];
  }
  return [...ring, { x0: C.x1 - 0.3, x1: V.x1 + 0.1, z0: V.z0 - 0.1, z1: C.z1 + 0.4 }, { ...C }, { x0: BRIDGE.x0, x1: BRIDGE.x1, z0: BRIDGE.z0, z1: BRIDGE.z1 }];
}

// ── rooms: what's behind the glass (look-only), and the walls ──
export type Finish = 'wood' | 'glass' | 'dark' | 'white' | 'woodWindows';
export interface CWall { level: CLevel; x0: number; x1: number; z0: number; z1: number; finish: Finish; door?: { at: number; w: number }; windows?: [number, number][] }
export interface CRoom { level: CLevel; kind: 'classroom' | 'teaching' | 'lab' | 'seminar'; name: string; x0: number; x1: number; z0: number; z1: number }
export const ROOMS: CRoom[] = [
  { level: 0, kind: 'classroom', name: 'A154', x0: 5.1, x1: IN_L0.x1, z0: 152.9, z1: 163.6 },
  { level: 0, kind: 'teaching', name: 'TEACHING LABS', x0: 5.1, x1: IN_L0.x1, z0: 163.9, z1: IN_L0.z1 },
  { level: 0, kind: 'classroom', name: 'A120', x0: VOID.x0, x1: 4.8, z0: 171.1, z1: IN_L0.z1 },
  ...([1, 2, 3] as const).flatMap((level) => [
    { level, kind: 'lab' as const, name: `C${level}66`, x0: 6.8, x1: IN_UP.x1, z0: 152.6, z1: 163.6 },
    { level, kind: 'lab' as const, name: `C${level}68`, x0: 6.8, x1: IN_UP.x1, z0: 163.9, z1: IN_UP.z1 },
    { level, kind: 'seminar' as const, name: `B${level}40`, x0: VOID.x0, x1: 4.8, z0: 171.6, z1: IN_UP.z1 },
  ]),
];
/** The walls you bump into: glass fronts of the rooms (their doors closed), the corridor's wood wall, the stair's cheeks. */
export const CWALLS: CWall[] = [
  // ground floor: the glass vestibule's sides at the north door
  { level: 0, x0: SCI_NDOOR.x - 2.5, x1: SCI_NDOOR.x - 2.2, z0: IN_L0.z0, z1: 151, finish: 'glass' },
  { level: 0, x0: SCI_NDOOR.x + 2.2, x1: SCI_NDOOR.x + 2.5, z0: IN_L0.z0, z1: 151, finish: 'glass' },
  // the corridor's south wall east of the atrium (the fountain niche, the elevators, the posters on it)
  { level: 0, x0: 4.8, x1: IN_L0.x1, z0: 152.4, z1: 152.9, finish: 'wood' },
  { level: 0, x0: 4.8, x1: 5.1, z0: 152.9, z1: IN_L0.z1, finish: 'glass', door: { at: 158, w: 1.1 } },
  { level: 0, x0: 5.1, x1: IN_L0.x1, z0: 163.6, z1: 163.9, finish: 'wood' },
  { level: 0, x0: VOID.x0, x1: 4.8, z0: 170.8, z1: 171.1, finish: 'glass', door: { at: -4, w: 1.1 } },
  // the first flight's cheek walls and the wall under its head
  { level: 0, x0: A.x0, x1: A.x1, z0: A.z0 - 0.25, z1: A.z0, finish: 'dark' },
  { level: 0, x0: A.x0, x1: A.x1, z0: A.z1, z1: A.z1 + 0.25, finish: 'dark' },
  { level: 0, x0: A.x1, x1: A.x1 + 0.4, z0: A.z0 - 0.25, z1: A.z1 + 0.25, finish: 'dark' },
  // upstairs: the labs' glass fronts along the east corridor, the wall between them; the seminar rooms' fronts
  ...([1, 2, 3] as const).flatMap((level) => [
    // (upstairs the labs' fronts are wood-veneer walls with big windows and a white door cut into them: the photos)
    { level, x0: 6.5, x1: 6.8, z0: 152.6, z1: IN_UP.z1, finish: 'woodWindows' as const, door: { at: 160, w: 1.1 }, windows: [[153.6, 158.4], [161.4, 163.2], [164.6, 166.2], [167.4, 173.4]] as [number, number][] },
    { level, x0: 6.8, x1: IN_UP.x1, z0: 163.6, z1: 163.9, finish: 'white' as const },
    { level, x0: VOID.x0, x1: 4.8, z0: 171.3, z1: 171.6, finish: 'glass' as const, door: { at: -6, w: 1.1 } },
    { level, x0: 4.8, x1: 6.8, z0: 171.3, z1: 171.6, finish: 'wood' as const },
  ]),
];
const roomAt = (level: number, p: XZ) => ROOMS.some((r) => r.level === level && inR(p, r));

// ── furniture you bump into (by floor), and who's about ──
export type FKind = 'liveEdge' | 'pebble' | 'pebbleW' | 'roundTable' | 'longTable' | 'planter' | 'cafe' | 'tub' | 'highBack' | 'booth' | 'counter' | 'bench';
export interface FItem { level: CLevel; kind: FKind; x: number; z: number; rot?: number; len?: number }
export const FURNITURE: FItem[] = [
  // ground: the atrium (live-edge table, green pebble seats on the topo rug), the café commons
  { level: 0, kind: 'liveEdge', x: -4.5, z: 161, len: 4.2 },
  { level: 0, kind: 'pebble', x: -8.5, z: 165.5 }, { level: 0, kind: 'pebble', x: -6, z: 167.6, rot: 0.6 }, { level: 0, kind: 'pebble', x: -3, z: 165.2, rot: 1.2 },
  { level: 0, kind: 'roundTable', x: 0.5, z: 161.5 },
  { level: 0, kind: 'planter', x: -19.5, z: 162, len: 6 },
  { level: 0, kind: 'pebbleW', x: -15.4, z: 157 }, { level: 0, kind: 'pebbleW', x: -14.6, z: 159.2 }, { level: 0, kind: 'pebbleW', x: -16.2, z: 167.5 },
  { level: 0, kind: 'roundTable', x: -24, z: 155 }, { level: 0, kind: 'roundTable', x: -24, z: 169.5 }, { level: 0, kind: 'roundTable', x: -20.5, z: 172.5 },
  { level: 0, kind: 'longTable', x: -22.5, z: 152, len: 4 },
  { level: 0, kind: 'cafe', x: -16.5, z: 173.4, len: 5 },
  // L1: teal tub chairs on the north side, green high-backs, the phone booth, a long counter with stools on the void
  ...([1, 2, 3] as const).flatMap((level) => [
    { level, kind: 'tub' as const, x: -9, z: 151.6 }, { level, kind: 'tub' as const, x: -6.5, z: 150.8, rot: 0.8 }, { level, kind: 'tub' as const, x: -4.2, z: 152, rot: -0.5 },
    { level, kind: 'counter' as const, x: -8, z: 170.45, len: 6, rot: 0 },
    { level, kind: 'highBack' as const, x: 12, z: 150.5 }, { level, kind: 'highBack' as const, x: 14.4, z: 150.5, rot: Math.PI },
    { level, kind: 'booth' as const, x: 19.6, z: 150.6 },
    { level, kind: 'longTable' as const, x: -21, z: 158, len: 5 }, { level, kind: 'longTable' as const, x: -21, z: 166, len: 5 },
    { level, kind: 'roundTable' as const, x: -26, z: 152.5 }, { level, kind: 'tub' as const, x: -26.5, z: 172.5, rot: 2.4 },
  ]),
];
/** How big each piece is in plan (half-extents), for bumping into. */
export function fHalf(it: FItem): [number, number] {
  const s: Record<FKind, [number, number]> = {
    liveEdge: [(it.len ?? 4) / 2 + 0.35, 0.95], pebble: [1.0, 0.7], pebbleW: [0.6, 0.45], roundTable: [0.9, 0.9], longTable: [(it.len ?? 4) / 2 + 0.3, 1.0],
    planter: [(it.len ?? 5) / 2, 1.1], cafe: [(it.len ?? 5) / 2, 0.5], tub: [0.55, 0.55], highBack: [0.6, 0.6], booth: [0.8, 0.8], counter: [(it.len ?? 5) / 2, 0.4], bench: [1, 0.3],
  };
  return s[it.kind];
}

/** Everything solid on a floor, padded by your radius. */
function solids(level: number, pad = R): Box[] {
  const grow = (b: { x0: number; x1: number; z0: number; z1: number }): Box => ({ x0: b.x0 - pad, x1: b.x1 + pad, z0: b.z0 - pad, z1: b.z1 + pad });
  const walls = CWALLS.filter((w) => w.level === level).flatMap((w) => {
    if (!w.door) return [grow(w)];
    const alongX = w.x1 - w.x0 > w.z1 - w.z0, a = w.door.at - w.door.w / 2, b = w.door.at + w.door.w / 2;
    // (the doors are shut: the rooms are to look into, so a door is still a wall)
    return [grow(alongX ? { ...w, x1: a } : { ...w, z1: a }), grow(alongX ? { ...w, x0: a, x1: b } : { ...w, z0: a, z1: b }), grow(alongX ? { ...w, x0: b } : { ...w, z0: b })];
  });
  const furn = FURNITURE.filter((f) => f.level === level).map((f) => {
    const [hx, hz] = fHalf(f);
    return grow({ x0: f.x - hx, x1: f.x + hx, z0: f.z - hz, z1: f.z + hz });
  });
  return [...walls, ...furn];
}
const SOLIDS = [0, 1, 2, 3].map((l) => solids(l));
const PLATES = [null, plates(1), plates(2), plates(3)];

/** Inside the building, on that floor: within the walls, and not in a room you can only look into. */
export function insideCasper(p: XZ, level = 0): boolean {
  const I = level === 0 ? IN_L0 : IN_UP;
  return inR(p, I) && !roomAt(level, p);
}
export function casperExtra(level: number): Extra {
  return { solids: SOLIDS[level], walkable: PLATES[level] ?? undefined, interior: (p) => insideCasper(p, level) };
}

/** Where the people are: sitting (with a seat height) or standing, on each floor; and the lanes students walk. */
export interface CPerson { level: CLevel; x: number; z: number; heading: number; sit?: number; inRoom?: boolean }
export const CPEOPLE: CPerson[] = [
  { level: 0, x: -4.5, z: 159.9, heading: 0, sit: 0.66 }, { level: 0, x: -3.2, z: 162.1, heading: Math.PI, sit: 0.66 }, { level: 0, x: -6, z: 162.1, heading: Math.PI, sit: 0.66 },
  { level: 0, x: -8.5, z: 165.5, heading: 0.4, sit: 0.42 }, { level: 0, x: -3, z: 165.2, heading: -0.3, sit: 0.42 },
  { level: 0, x: -24, z: 154, heading: 0, sit: 0.46 }, { level: 0, x: -23, z: 155.6, heading: -2, sit: 0.46 }, { level: 0, x: -20.5, z: 171.5, heading: 0, sit: 0.46 },
  { level: 0, x: -16.5, z: 174.4, heading: Math.PI }, // at the café counter
  { level: 0, x: 10, z: 157, heading: -Math.PI / 2, sit: 0.46, inRoom: true }, { level: 0, x: 12, z: 159, heading: -Math.PI / 2, sit: 0.46, inRoom: true },
  { level: 0, x: 15, z: 168, heading: Math.PI / 2, inRoom: true }, { level: 0, x: -2, z: 173.5, heading: 0, sit: 0.46, inRoom: true },
  { level: 1, x: -6.5, z: 150.8, heading: 0.8 + Math.PI, sit: 0.42 }, { level: 1, x: 12, z: 150.5, heading: Math.PI, sit: 0.44 },
  { level: 1, x: 10, z: 158, heading: Math.PI / 2, inRoom: true }, { level: 1, x: 14, z: 157, heading: -Math.PI / 2, sit: 0.5, inRoom: true },
  { level: 1, x: -21, z: 156.9, heading: 0, sit: 0.46 }, { level: 1, x: -20, z: 159.1, heading: Math.PI, sit: 0.46 },
  { level: 2, x: -9, z: 171.0, heading: Math.PI, sit: 0.72 }, { level: 2, x: -6.5, z: 171.0, heading: Math.PI, sit: 0.72 },
  { level: 2, x: 12, z: 168, heading: Math.PI / 2, inRoom: true }, { level: 2, x: -26, z: 151.5, heading: 0, sit: 0.46 },
  // on the stairs: climbing, and two talking on a landing
  { level: 0, x: -6.2, z: 155.2, heading: Math.PI / 2 }, { level: 1, x: 0.2, z: 168.6, heading: -Math.PI / 2 }, { level: 1, x: 0.6, z: 167.6, heading: Math.PI / 2 },
  { level: 3, x: 1.4, z: 162, heading: 0 },
    { level: 3, x: -4.2, z: 152, heading: -0.5 + Math.PI, sit: 0.42 }, { level: 3, x: 16, z: 160, heading: -Math.PI / 2, inRoom: true },
];
export const CLANES: { level: CLevel; x0: number; x1: number; z: number }[] = [
  { level: 0, x0: -10, x1: 19, z: 150.4 }, { level: 1, x0: -22, x1: 18, z: 153 }, { level: 2, x0: -10, x1: 18, z: 153.2 },
];
