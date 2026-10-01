import { FAR_WALK } from '../layout';

// ─── Your house (pure data, no three.js) ───────────────────────────────
// A big two-storey wood frame across High Street. Everything here is in
// house-local metres:  u = depth from the front wall (0) to the back (16),
// toward +x;  v = across the house, −9 … +9, along z.
//
//  GROUND (level 0)                      UPSTAIRS (level 1)
//  v=+9 ┌──────────── stairs ─┬────────┐  ┌ R6 ┬─void─┬landing┬ R4 ┬ R5 ┐
//       │  hall  (front door) │ dining │  │    │      │       │    │    │
//  v=1.5├── arch ──┐          │ kitchen│  ├─────── corridor ─────────────┤
//       │  living room  (TV)  │ island │  │ R1 (you) │   R2   │   R3     │
//  v=−9 └─────────────────────┴────────┘  └──────────┴────────┴──────────┘
//       u=0 (porch, High St)      u=16

export const HOUSE = {
  x0: FAR_WALK.x1 + 4.5, // front wall, set back behind a little front yard
  zc: -276, // across the road from the start, near Usdan
  depth: 16,
  width: 18,
  floorH: 3.3, // floor-to-floor
  wallT: 0.2,
} as const;

export const UPSTAIRS_Y = HOUSE.floorH;
export const R = 0.3; // your radius, for collisions

export type Level = 0 | 1;

/** Axis-aligned box in local (u, v). */
export interface Rect { u0: number; u1: number; v0: number; v1: number }

export interface Opening { a: number; b: number; kind: 'door' | 'window' | 'arch' }
/** A straight wall. axis 'v' = runs along v at u = at; axis 'u' = runs along u at v = at. */
export interface Wall { level: Level; axis: 'u' | 'v'; at: number; a: number; b: number; exterior?: boolean; openings: Opening[] }

const W = (level: Level, axis: 'u' | 'v', at: number, a: number, b: number, openings: Opening[] = [], exterior = false): Wall =>
  ({ level, axis, at, a, b, openings, exterior });
const door = (a: number, b: number): Opening => ({ a, b, kind: 'door' });
const win = (a: number, b: number): Opening => ({ a, b, kind: 'window' });
const arch = (a: number, b: number): Opening => ({ a, b, kind: 'arch' });

export const FRONT_DOOR = { v0: 3.3, v1: 4.7 };

export const WALLS: Wall[] = [
  // ── ground: outside ──
  W(0, 'v', 0, -9, 9, [win(-7.6, -5.6), win(-3.6, -1.6), door(FRONT_DOOR.v0, FRONT_DOOR.v1), win(6.0, 7.2)], true),
  W(0, 'v', 16, -9, 9, [win(-6, -4), win(-1, 1), win(5, 7)], true),
  W(0, 'u', -9, 0, 16, [win(2, 4), win(5.6, 7.6), win(11, 13)], true),
  W(0, 'u', 9, 0, 16, [win(10, 12), win(13.4, 15)], true),
  // ── ground: inside ──
  W(0, 'u', 1.5, 0, 8, [arch(2.6, 5.6)]), // living ↔ hall
  W(0, 'v', 8, -9, 9, [arch(-7, -1.5), arch(2.4, 6.4)]), // front rooms ↔ kitchen; solid behind the stairs top
  W(0, 'u', 7.4, 3.2, 8), // side of the stairs: you can only get on at the bottom
  // ── upstairs: outside ──
  W(1, 'v', 0, -9, 9, [win(-7.2, -5.4), win(-3.4, -1.6), win(5.8, 7.4)], true),
  W(1, 'v', 16, -9, 9, [win(-6, -4), win(5.6, 7.4)], true),
  W(1, 'u', -9, 0, 16, [win(1.6, 3.6), win(7, 9), win(12.4, 14.4)], true),
  W(1, 'u', 9, 0, 16, [win(10.8, 12), win(13.9, 15.1)], true),
  // ── upstairs: inside ──
  W(1, 'u', 1.5, 0, 16, [door(3.8, 4.8), door(7.6, 8.6), door(12, 13)]), // corridor ↔ R1 R2 R3
  W(1, 'v', 16 / 3, -9, 1.5), W(1, 'v', 32 / 3, -9, 1.5), // between R1 | R2 | R3
  W(1, 'u', 4, 0, 3.5, [door(1, 2)]), // R6
  W(1, 'u', 4, 10, 16, [door(11, 12), door(14, 15)]), // R4, R5
  W(1, 'v', 3.5, 4, 9), W(1, 'v', 10, 4, 9), W(1, 'v', 13, 4, 9),
];

/** Wall height for a level (top of the wall above that floor). */
export const WALL_H = 3.0;

/** Railing round the stairwell opening upstairs (visual + solid, upstairs only). */
export const STAIRWELL: Rect = { u0: 3.5, u1: 7.6, v0: 7.4, v1: 9 };

/** Stairs: run along +u at the north wall, bottom at u0 (ground) → top at u1 (upstairs). */
export const STAIRS = { u0: 2.0, u1: 7.6, v0: 7.55, v1: 8.85 } as const;

/** Floor height on the stairs at local u. */
export const stairY = (u: number) => Math.min(1, Math.max(0, (u - STAIRS.u0) / (STAIRS.u1 - STAIRS.u0))) * UPSTAIRS_Y;

export const inStairs = (u: number, v: number) => u >= STAIRS.u0 - 0.2 && u <= STAIRS.u1 + 0.3 && v >= STAIRS.v0 - 0.15 && v <= STAIRS.v1 + 0.15;

// ── furniture (solid on its level) ──
export interface Furniture extends Rect { level: Level; kind: string; h: number }
const F = (level: Level, kind: string, u0: number, u1: number, v0: number, v1: number, h: number): Furniture => ({ level, kind, u0, u1, v0, v1, h });

export const FURNITURE: Furniture[] = [
  // living room: sectional facing the TV on the south wall
  F(0, 'sofa', 1.9, 6.6, -3.9, -2.8, 0.85),
  F(0, 'sofa-end', 1.0, 1.9, -6.2, -2.8, 0.85),
  F(0, 'coffee-table', 3.4, 5.2, -6.0, -5.2, 0.42),
  F(0, 'tv-stand', 3.0, 5.6, -8.9, -8.4, 0.55),
  F(0, 'armchair', 6.6, 7.6, -7.4, -6.4, 0.85),
  F(0, 'bookshelf', 0.1, 0.45, -5.3, -3.9, 1.9), // between the front windows
  F(0, 'plant', 7.35, 7.85, -8.75, -8.25, 1.2), // living room corner
  F(0, 'plant', 7.2, 7.7, 1.75, 2.25, 1.2), // hall
  F(0, 'coat-rack', 0.2, 0.6, 1.95, 2.35, 1.8), // by the front door
  // kitchen + dining
  F(0, 'counter', 15.2, 15.9, -8.6, 2.6, 0.95),
  F(0, 'fridge', 15.0, 15.9, 3.0, 4.0, 1.9),
  F(0, 'island', 11.0, 12.6, -5.2, -2.8, 0.95),
  F(0, 'dining-table', 10.6, 13.0, 4.1, 5.3, 0.76),
  // dining chairs (you sit on them, but can't walk through them)
  F(0, 'chair', 10.98, 11.42, 3.38, 3.82, 0.95), F(0, 'chair', 12.18, 12.62, 3.38, 3.82, 0.95),
  F(0, 'chair', 10.98, 11.42, 5.58, 6.02, 0.95), F(0, 'chair', 12.18, 12.62, 5.58, 6.02, 0.95),
  // your room (R1: u 0…5.33, v −9…1.5)
  F(1, 'bed', 3.0, 5.15, -8.85, -6.6, 0.55),
  F(1, 'desk', 0.15, 0.85, -4.6, -2.8, 0.76),
  F(1, 'closet', 4.55, 5.2, -2.6, -0.4, 2.1),
  F(1, 'chair', 1.0, 1.4, -3.9, -3.5, 1.0), // desk chair
];

/** Places someone can sit, with which way they face (radians, 0 = +z = +v). */
export interface Seat { id: string; u: number; v: number; level: Level; heading: number; y: number; approach: [number, number] }
const S = (id: string, u: number, v: number, heading: number, y: number, approach: [number, number], level: Level = 0): Seat =>
  ({ id, u, v, heading, y, approach, level });

export const SEATS: Seat[] = [
  S('couch0', 2.6, -3.35, Math.PI, 0.5, [2.6, -4.6]),
  S('couch1', 3.7, -3.35, Math.PI, 0.5, [3.7, -4.6]),
  S('couch2', 4.8, -3.35, Math.PI, 0.5, [4.8, -4.6]),
  S('couch3', 5.9, -3.35, Math.PI, 0.5, [5.9, -4.6]),
  S('dine0', 11.2, 3.6, 0, 0.5, [11.2, 3.0]),
  S('dine1', 12.4, 3.6, 0, 0.5, [12.4, 3.0]),
  S('dine2', 11.2, 5.8, Math.PI, 0.5, [11.2, 6.4]),
  S('dine3', 12.4, 5.8, Math.PI, 0.5, [12.4, 6.4]),
  S('porch0', -1.2, -6.6, -Math.PI / 2, 0.48, [-1.9, -6.6]),
  S('porch1', -1.2, -5.4, -Math.PI / 2, 0.48, [-1.9, -5.4]),
];

/** Standing spots (cooking) — face the counter. */
export const COOK_SPOTS = [
  { id: 'cook0', u: 14.6, v: -5, heading: Math.PI / 2 },
  { id: 'cook1', u: 14.6, v: -1.5, heading: Math.PI / 2 },
];

export const TV = { u: 4.3, v: -8.75, w: 2.3, h: 1.3, y: 1.45 };
export const BED_SPOT = { u: 2.5, v: -7.6 }; // stand here to sleep

export const ROOMMATES = [
  { id: 'jules', room: 'R2' }, { id: 'kofi', room: 'R3' }, { id: 'ines', room: 'R4' },
  { id: 'nico', room: 'R5' }, { id: 'ama', room: 'R6' },
] as const;
export type RoommateId = (typeof ROOMMATES)[number]['id'];

/** Bedroom doors on the upstairs corridor (where a roommate goes to "be in their room"). */
export const ROOM_DOORS: Record<string, [number, number]> = {
  R1: [4.3, 1.5], R2: [8.1, 1.5], R3: [12.5, 1.5], R4: [11.5, 4], R5: [14.5, 4], R6: [1.5, 4],
};

/** Porch, the front yard and the lot your house sits on (local). */
export const PORCH: Rect = { u0: -2.6, u1: 0, v0: -9, v1: 9 };
export const PORCH_STEPS = { v0: 2.6, v1: 5.4 };
export const LOT: Rect = { u0: FAR_WALK.x1 - 0.4 - HOUSE.x0, u1: HOUSE.depth + 2, v0: -11, v1: 11 };

/**
 * Two driveways, one each side of the house, from the sidewalk back to the side of the house.
 * Seen from the street, yours is on the left (−v), kofi's on the right (+v).
 */
export interface Driveway extends Rect { owner: 'you' | RoommateId; park: { u: number; v: number } }
const DRIVE_W = 3.4, DRIVE_V = 12.8, DRIVE_U0 = FAR_WALK.x1 - 0.5 - HOUSE.x0, DRIVE_U1 = 12;
export const DRIVEWAYS: Driveway[] = [
  { owner: 'you', u0: DRIVE_U0, u1: DRIVE_U1, v0: -DRIVE_V - DRIVE_W / 2, v1: -DRIVE_V + DRIVE_W / 2, park: { u: 5, v: -DRIVE_V } },
  { owner: 'kofi', u0: DRIVE_U0, u1: DRIVE_U1, v0: DRIVE_V - DRIVE_W / 2, v1: DRIVE_V + DRIVE_W / 2, park: { u: 5, v: DRIVE_V } },
];

/** Inside the walls (not the porch). */
export const insideHouse = (u: number, v: number) => u > 0 && u < HOUSE.depth && v > -HOUSE.width / 2 && v < HOUSE.width / 2;

// ── local ↔ world ──
export const toWorld = (u: number, v: number) => ({ x: HOUSE.x0 + u, z: HOUSE.zc + v });
export const toLocal = (x: number, z: number) => ({ u: x - HOUSE.x0, v: z - HOUSE.zc });
