import type { Box, Extra, XZ } from '../collide';
import { USDAN, distToPoly, inPoly } from '../layout';

// ─── Inside Usdan (pure data, no three.js) ─────────────────────────────
// The ground floor, laid out inside Usdan's real outline (world coords),
// from the user's photos. Like your house it's its own little world: walk
// through a door and you're in a separate scene.
//
//   Lobby (south doors, on the Boger–South walkway): Information desk + its
//     orange column, TV niches in wood walls with wood chairs on rugs.
//   Lounge + corridor (east doors, from the plaza): black box sofas round a
//     red column; a long hall north past the Navaratri display case, the
//     elevator and blue recycling bins, under hanging room signs.
//   Atrium (under the courtyard): double height, globe pendants, the curved
//     red-walled staircase, the big W, round café tables.
//   Flex Dining (along the field side): yellow walls, tall windows, square
//     tables on patterned carpet.
//   Café (north): counter, coolers, chips, coffee, someone working it.
//
// −z is north, +x is east. You can't get into the west wing or behind the café.

const R = 0.3; // your radius

// ── the doors ──
// Six of them, all the way round, each with a path leading up to it outside and a clear way to it inside.
export type DoorId = 'plaza' | 'plazaNorth' | 'walkway' | 'field' | 'fieldWest' | 'north';
export interface Door { id: DoorId; x: number; z: number; nx: number; nz: number; w: number; label: string; main: boolean }

/** A door on edge i of Usdan's outline (from corner i to corner i+1), `t` of the way along, facing out. */
function doorOn(id: DoorId, i: number, t: number, label: string, main = false, w = 3): Door {
  const a = USDAN[i], b = USDAN[(i + 1) % USDAN.length];
  const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz);
  return { id, x: a.x + dx * t, z: a.z + dz * t, nx: dz / l, nz: -dx / l, w, label, main };
}

export const DOORS: Door[] = [
  doorOn('plaza', 0, 41 / 60, 'the plaza', true), // east face → the lounge
  doorOn('plazaNorth', 0, 12 / 60, 'the plaza'), // east face, north end → the corridor
  doorOn('walkway', 1, 0.3, 'the walkway', true), // south face, off the Boger–South walkway → the lobby
  doorOn('field', 2, 0.25, 'Andrus Field'), // south-west face → Flex Dining
  doorOn('fieldWest', 2, 0.66, 'Andrus Field'), // …its west end
  doorOn('north', 4, 0.8, 'Wyllys Ave', true), // north face → the corridor's north end
];
/** Where you are relative to a door: `d` outward from the wall (+ = outside), `lat` along it. */
export function doorFrame(door: Door, p: XZ) {
  const dx = p.x - door.x, dz = p.z - door.z;
  return { d: dx * door.nx + dz * door.nz, lat: dx * -door.nz + dz * door.nx };
}

export type InOut = 'out' | 'usdan';

/** Stepping into a doorway takes you through it. */
export function usdanPortalAt(where: InOut | string, p: XZ): { door: Door; kind: 'enter' | 'exit' } | null {
  for (const door of DOORS) {
    const { d, lat } = doorFrame(door, p);
    if (Math.abs(lat) > door.w / 2 - 0.3) continue;
    if (where === 'out' && d > -0.2 && d < 1.3) return { door, kind: 'enter' };
    if (where === 'usdan' && d > -1.0 && d < 0.5) return { door, kind: 'exit' };
  }
  return null;
}

/** Close enough to a door to offer the button. */
export function nearUsdanDoor(where: InOut | string, p: XZ): Door | null {
  for (const door of DOORS) {
    const { d, lat } = doorFrame(door, p);
    if (Math.abs(lat) > door.w / 2 + 0.5) continue;
    if (where === 'out' && d > 0 && d < 3) return door;
    if (where === 'usdan' && d < 0 && d > -3.2) return door;
  }
  return null;
}

/** The main doors have a glass entrance vestibule that sticks out from the wall: this deep, this wide. */
export const VESTIBULE = { depth: 2.6, extra: 1.6, h: 3.3 } as const;

/** Where you end up after going through `door`, and which way you face. */
export function arriveAt(door: Door, kind: 'enter' | 'exit') {
  const s = kind === 'enter' ? -2.6 : door.main ? VESTIBULE.depth + 1.4 : 2.4; // (out past the vestibule)
  const x = door.x + door.nx * s, z = door.z + door.nz * s;
  const heading = Math.atan2(door.nx * Math.sign(s), door.nz * Math.sign(s));
  return { x, z, heading };
}

// ── rooms (for floors and finishes) ──
export interface Room { id: string; name: string; x0: number; x1: number; z0: number; z1: number }
export const ROOMS: Room[] = [
  { id: 'lobby', name: 'Lobby', x0: -72.5, x1: -60, z0: -192, z1: -176 },
  { id: 'corridor', name: 'Corridor', x0: -70, x1: -60, z0: -238, z1: -190 },
  { id: 'atrium', name: 'Atrium', x0: -92, x1: -70, z0: -214, z1: -190.5 },
  { id: 'flex', name: 'Flex Dining', x0: -100, x1: -72.5, z0: -190.5, z1: -176 },
  { id: 'cafe', name: 'Café', x0: -80, x1: -70, z0: -224, z1: -215.5 },
];
export const roomAt = (p: XZ) => ROOMS.find((r) => p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1) ?? null;

// ── internal walls ──
export type Finish = 'wood' | 'cream' | 'sage' | 'yellow';
export interface Wall {
  axis: 'x' | 'z'; // 'x' = runs along x at z = at; 'z' = runs along z at x = at
  at: number; a: number; b: number;
  h: number;
  openings: [number, number][];
  /** finish on the −side / +side (west/north = −, east/south = +) */
  finish: [Finish, Finish];
}
const W = (axis: 'x' | 'z', at: number, a: number, b: number, h: number, finish: [Finish, Finish], openings: [number, number][] = []): Wall =>
  ({ axis, at, a, b, h, finish, openings });

export const ATRIUM_H = 9;
export const STOREY_H = 4.4;

export const WALLS: Wall[] = [
  W('z', -72.5, -190.5, -176.5, STOREY_H, ['yellow', 'wood']), // lobby | flex dining (TV niche on the lobby side)
  W('x', -190.5, -100, -72.5, ATRIUM_H, ['cream', 'yellow'], [[-90, -87], [-84, -81], [-78, -75]]), // atrium | flex dining
  W('z', -100, -190.5, -180.6, STOREY_H, ['cream', 'yellow']), // flex dining's west end
  W('z', -92, -214, -190.5, ATRIUM_H, ['cream', 'cream']), // atrium | west wing
  W('x', -214, -92, -80, ATRIUM_H, ['cream', 'cream']), // atrium's north wall, behind the stairs
  W('x', -215.5, -80, -70, ATRIUM_H, ['cream', 'cream'], [[-77, -73]]), // café front, opening onto the atrium
  W('z', -80, -224, -214, STOREY_H, ['cream', 'cream']), // café west
  W('x', -224, -80, -70, STOREY_H, ['cream', 'cream']), // café back
  W('z', -70, -224, -215.5, STOREY_H, ['cream', 'sage']), // café | corridor (elevator on the corridor side)
];

/** Solid pieces of a wall (gaps at openings), padded by your radius. */
export function wallBoxes(w: Wall, pad = R): Box[] {
  const pieces: [number, number][] = [];
  let at = w.a;
  for (const [o0, o1] of [...w.openings].sort((p, q) => p[0] - q[0])) { if (o0 > at) pieces.push([at, o0]); at = Math.max(at, o1); }
  if (at < w.b) pieces.push([at, w.b]);
  const t = 0.1 + pad;
  return pieces.map(([a, b]) => (w.axis === 'x'
    ? { x0: a - pad, x1: b + pad, z0: w.at - t, z1: w.at + t }
    : { x0: w.at - t, x1: w.at + t, z0: a - pad, z1: b + pad }));
}

// ── furniture ──
export type Kind =
  | 'column' | 'redColumn' | 'infoDesk' | 'sofa' | 'armchair' | 'woodChair' | 'roundTable' | 'squareTable'
  | 'case' | 'bins' | 'counter' | 'coolers' | 'chips' | 'stairs' | 'longTable' | 'banner' | 'plant' | 'deskSide';
export interface Item { kind: Kind; x: number; z: number; alongZ?: boolean; heading?: number }
const I = (kind: Kind, x: number, z: number, extra: Partial<Item> = {}): Item => ({ kind, x, z, ...extra });

export const ITEMS: Item[] = [
  // lobby
  I('infoDesk', -63.4, -185.5, { alongZ: true }),
  I('deskSide', -61.7, -188.1), I('deskSide', -61.7, -182.9), // the booth's sides, back to the wall
  I('column', -66.4, -185.5),
  I('woodChair', -71.3, -183.3, { heading: Math.PI / 2 + 0.3 }), I('woodChair', -71.3, -185.6, { heading: Math.PI / 2 - 0.3 }),
  I('banner', -70.9, -189.3),
  // lounge, where the corridor opens out
  I('redColumn', -66.2, -193.2),
  I('sofa', -67.6, -191.2), I('sofa', -67.6, -195.3), I('armchair', -64.4, -193.3, { heading: -Math.PI / 2 }),
  // corridor
  I('case', -62.1, -214, { alongZ: true }),
  I('bins', -68.9, -212.6, { alongZ: true }),
  I('plant', -69.2, -227),
  // atrium: the stairs against the north wall, rolling tables along its red wall, café tables
  I('stairs', -83, -212.4),
  I('longTable', -86, -210.2), I('longTable', -81.2, -210.2),
  ...[-88, -83, -78].flatMap((x) => [-205.5, -200.5, -195.5].map((z) => I('roundTable', x, z))),
  I('roundTable', -73.6, -205.5), I('roundTable', -73.6, -200.5),
  // flex dining
  ...[[-96, -186], [-91, -184.5], [-86, -186], [-81, -184.5], [-76.5, -186]].map(([x, z]) => I('squareTable', x, z)),
  I('plant', -99, -182.5),
  // café
  I('counter', -75.05, -220), // wall to wall: the staff side is behind it
  I('coolers', -75, -223.3),
  I('chips', -71.2, -217.6),
];

/** Footprint half-size (x, z) of each kind. */
export function half(it: Item): [number, number] {
  const sw = (a: number, b: number): [number, number] => (it.alongZ ? [b, a] : [a, b]);
  switch (it.kind) {
    case 'column': case 'redColumn': return [0.45, 0.45];
    case 'infoDesk': return sw(2.2, 0.8);
    case 'sofa': return [1.0, 0.45];
    case 'armchair': return [0.45, 0.45];
    case 'woodChair': return [0.3, 0.3];
    case 'roundTable': return [0.5, 0.5];
    case 'squareTable': return [0.45, 0.45];
    case 'case': return sw(2.4, 0.45);
    case 'bins': return sw(0.9, 0.35);
    case 'deskSide': return [1.0, 0.2];
    case 'counter': return [4.55, 0.5];
    case 'coolers': return [3.0, 0.4];
    case 'chips': return [0.5, 0.35];
    case 'stairs': return [8, 1.4];
    case 'longTable': return [2.2, 0.4];
    case 'banner': return [0.45, 0.15];
    case 'plant': return [0.35, 0.35];
  }
}

/** Chairs round a table: where someone sits and which way they face. */
export function chairsAt(it: Item): { x: number; z: number; heading: number }[] {
  if (it.kind === 'roundTable') {
    return [0, 1, 2].map((k) => {
      const a = k * (Math.PI * 2 / 3) + 0.4;
      return { x: it.x + Math.sin(a) * 0.85, z: it.z + Math.cos(a) * 0.85, heading: a + Math.PI };
    });
  }
  if (it.kind === 'squareTable') {
    return [{ x: it.x, z: it.z - 0.8, heading: 0 }, { x: it.x, z: it.z + 0.8, heading: Math.PI }];
  }
  return [];
}

// ── people ──
/** Students sitting (table index into ITEMS, chair index). */
export const SITTERS: [number, number][] = (() => {
  const idx = (k: Kind, n: number) => ITEMS.map((it, i) => [it, i] as const).filter(([it]) => it.kind === k)[n][1];
  return [
    [idx('roundTable', 0), 0], [idx('roundTable', 0), 2], [idx('roundTable', 4), 1], [idx('roundTable', 6), 0],
    [idx('roundTable', 9), 2], [idx('squareTable', 1), 0], [idx('squareTable', 3), 1], [idx('squareTable', 4), 0],
  ];
})();
/** Someone on each sofa. */
export const SOFA_SITTERS = [{ x: -67.6, z: -191.35, heading: Math.PI }, { x: -67.6, z: -195.15, heading: 0 }];
/** Staff: behind the Information desk, behind the café counter. */
export const STAFF = [
  { x: -61.7, z: -185.5, heading: -Math.PI / 2, role: 'info' },
  { x: -76.5, z: -221.4, heading: 0, role: 'cafe' },
];
/** Students at the Information window. */
export const AT_DESK = [{ x: -65.1, z: -184.6, heading: Math.PI / 2 }, { x: -65.2, z: -186.6, heading: Math.PI / 2 - 0.3 }];
/** Lanes people walk up and down (x, z0, z1). */
export const WALK_LANES: [number, number, number][] = [[-64.2, -228, -196], [-67.6, -226, -198], [-72, -210, -180]];

// ── walking around inside ──
const PAD = 0.6;
/** Inside the walls (you can get right up to a doorway). */
export function insideUsdan(p: XZ): boolean {
  if (!inPoly(p, USDAN)) return false;
  if (distToPoly(p, USDAN) > PAD) return true;
  return DOORS.some((d) => { const f = doorFrame(d, p); return Math.abs(f.lat) < d.w / 2 - 0.3 && f.d > -PAD - 0.01; });
}

export function usdanSolids(pad = R): Box[] {
  const items = ITEMS.map((it) => {
    const [hx, hz] = half(it);
    return { x0: it.x - hx - pad, x1: it.x + hx + pad, z0: it.z - hz - pad, z1: it.z + hz + pad };
  });
  return [...WALLS.flatMap((w) => wallBoxes(w, pad)), ...items];
}

const SOLIDS = usdanSolids();
/** Collision rules inside: stay within the outline, don't walk through walls or furniture. */
export const usdanExtra = (): Extra => ({ solids: SOLIDS, interior: insideUsdan });

/**
 * Outside: the glass sides of each vestibule are solid (you go in through its front), as a run of
 * small boxes so they work at any angle.
 */
export function vestibuleSolids(pad = R): Box[] {
  const out: Box[] = [];
  for (const d of DOORS) {
    if (!d.main) continue;
    const half = (d.w + VESTIBULE.extra) / 2, tx = -d.nz, tz = d.nx;
    for (const side of [-1, 1]) {
      for (let k = 0.2; k <= VESTIBULE.depth; k += 0.3) {
        const x = d.x + d.nx * k + tx * side * half, z = d.z + d.nz * k + tz * side * half;
        out.push({ x0: x - 0.12 - pad, x1: x + 0.12 + pad, z0: z - 0.12 - pad, z1: z + 0.12 + pad });
      }
      // the front panels either side of the opening
      for (let l = d.w / 2 + 0.1; l <= half; l += 0.3) {
        const x = d.x + d.nx * VESTIBULE.depth + tx * side * l, z = d.z + d.nz * VESTIBULE.depth + tz * side * l;
        out.push({ x0: x - 0.12 - pad, x1: x + 0.12 + pad, z0: z - 0.12 - pad, z1: z + 0.12 + pad });
      }
    }
  }
  return out;
}
