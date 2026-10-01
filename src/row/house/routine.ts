import { COOK_SPOTS, Level, ROOMMATES, ROOM_DOORS, RoommateId, SEATS } from './plan';

// ─── Roommates' days (pure) ────────────────────────────────────────────
// Each roommate follows a rough daily schedule on the game clock: breakfast,
// out at class, the porch around golden hour, the couch at night. Generic
// places ("couch") resolve to a specific free seat so nobody sits on anyone.
// Later, a real friend can take over any of these slots.

export type Place = 'couch' | 'dine' | 'cook' | 'porch' | 'room' | 'out';
type Block = [from: number, place: Place];

export const SCHEDULE: Record<RoommateId, Block[]> = {
  jules: [[0, 'couch'], [1, 'room'], [8, 'dine'], [9, 'out'], [16, 'porch'], [18, 'cook'], [19, 'couch']],
  kofi: [[0, 'couch'], [2, 'room'], [9, 'cook'], [10, 'out'], [15, 'couch'], [17, 'porch'], [19, 'dine'], [21, 'couch']],
  ines: [[0, 'room'], [7, 'cook'], [8, 'out'], [17, 'dine'], [18, 'cook'], [20, 'couch'], [23, 'room']],
  nico: [[0, 'couch'], [3, 'room'], [10, 'dine'], [12, 'out'], [18, 'porch'], [19, 'couch']],
  ama: [[0, 'room'], [6, 'porch'], [7, 'dine'], [9, 'out'], [19, 'porch'], [21, 'dine']],
};

export function placeAt(id: RoommateId, hour: number): Place {
  const h = ((hour % 24) + 24) % 24;
  let p: Place = SCHEDULE[id][0][1];
  for (const [from, place] of SCHEDULE[id]) if (h >= from) p = place;
  return p;
}

/** Where someone is: a seat, a standing spot, or hidden (in their room / out). */
export interface Spot {
  id: string;
  u: number; v: number; level: Level;
  heading: number;
  pose: 'sit' | 'stand' | 'hidden';
  y: number; // seat height (sit) or 0
  approach: [number, number]; // where you walk to before sitting down
}

const SLOTS: Record<'couch' | 'dine' | 'porch' | 'cook', Spot[]> = {
  couch: SEATS.filter((s) => s.id.startsWith('couch')).map((s) => ({ ...s, pose: 'sit' as const })),
  dine: SEATS.filter((s) => s.id.startsWith('dine')).map((s) => ({ ...s, pose: 'sit' as const })),
  porch: SEATS.filter((s) => s.id.startsWith('porch')).map((s) => ({ ...s, pose: 'sit' as const })),
  cook: COOK_SPOTS.map((c) => ({ ...c, level: 0 as Level, pose: 'stand' as const, y: 0, approach: [c.u - 0.6, c.v] as [number, number] })),
};

export const OUT: Spot = { id: 'out', u: -6.5, v: 4, level: 0, heading: 0, pose: 'hidden', y: 0, approach: [-6.5, 4] };

const roomSpot = (room: string): Spot => {
  const [u, v] = ROOM_DOORS[room];
  return { id: `room-${room}`, u, v, level: 1, heading: 0, pose: 'hidden', y: 0, approach: [u, v + (v < 3 ? 1.2 : -1.2)] };
};

/** Everyone's spot at an hour. Seats are handed out in roommate order, so no two people share one. */
export function assignments(hour: number): Record<RoommateId, Spot> {
  const taken = new Set<string>();
  const out = {} as Record<RoommateId, Spot>;
  for (const r of ROOMMATES) {
    const place = placeAt(r.id, hour);
    if (place === 'room') { out[r.id] = roomSpot(r.room); continue; }
    if (place === 'out') { out[r.id] = OUT; continue; }
    const free = SLOTS[place].find((s) => !taken.has(s.id));
    if (!free) throw new Error(`no free ${place} for ${r.id} at ${hour}`);
    taken.add(free.id);
    out[r.id] = free;
  }
  return out;
}

// ── getting around the house: a small waypoint graph ──
export interface Node { u: number; v: number; level: Level }
export const NODES: Record<string, Node> = {
  out: { u: -6.5, v: 4, level: 0 },
  step: { u: -3.3, v: 4, level: 0 },
  porch: { u: -1.6, v: 4, level: 0 },
  porchS: { u: -1.9, v: -4.4, level: 0 },
  door: { u: 0.7, v: 4, level: 0 },
  hall: { u: 2.6, v: 4.3, level: 0 },
  arch: { u: 4.1, v: 1.5, level: 0 },
  livE: { u: 7.1, v: -1.2, level: 0 },
  livS: { u: 7.1, v: -4.8, level: 0 },
  couchFront: { u: 4.2, v: -4.6, level: 0 },
  archK: { u: 8, v: 4.4, level: 0 },
  kitN: { u: 9.6, v: 3.0, level: 0 },
  kitNW: { u: 9.6, v: 6.5, level: 0 },
  archL: { u: 8, v: -4.3, level: 0 },
  kitMid: { u: 9.8, v: -1.0, level: 0 },
  kitE: { u: 13.8, v: -1.0, level: 0 },
  kitSW: { u: 9.8, v: -6.5, level: 0 },
  kitSE: { u: 13.8, v: -6.5, level: 0 },
  stBot: { u: 1.6, v: 8.2, level: 0 },
  stTop: { u: 8.1, v: 8.2, level: 1 },
  land: { u: 8.6, v: 5.6, level: 1 },
  corr: { u: 8.6, v: 2.75, level: 1 },
  corrW: { u: 1.5, v: 2.75, level: 1 },
  corrE: { u: 14.5, v: 2.75, level: 1 },
};

export const EDGES: [string, string][] = [
  ['out', 'step'], ['step', 'porch'], ['porch', 'porchS'], ['porch', 'door'], ['door', 'hall'],
  ['hall', 'arch'], ['arch', 'livE'], ['livE', 'livS'], ['livS', 'couchFront'],
  ['hall', 'archK'], ['archK', 'kitN'], ['kitN', 'kitNW'], ['livE', 'archL'], ['archL', 'kitMid'],
  ['archL', 'kitSW'], ['kitSW', 'kitSE'], ['kitMid', 'kitN'], ['kitMid', 'kitE'], ['kitE', 'kitSE'],
  ['hall', 'stBot'], ['stBot', 'stTop'], ['stTop', 'land'], ['land', 'corr'], ['corr', 'corrW'], ['corr', 'corrE'],
];

const dist = (a: Node, b: { u: number; v: number }) => Math.hypot(a.u - b.u, a.v - b.v);

/** Nearest graph node on the same level as a spot's approach point. */
export function nearestNode(p: { u: number; v: number; level: Level }): string {
  let best = '', bd = Infinity;
  for (const [id, n] of Object.entries(NODES)) {
    if (n.level !== p.level) continue;
    const d = dist(n, p);
    if (d < bd) { bd = d; best = id; }
  }
  return best;
}

/** Shortest route between two nodes (Dijkstra over a tiny graph). */
export function route(from: string, to: string): string[] {
  const d: Record<string, number> = {}, prev: Record<string, string | null> = {};
  const todo = new Set(Object.keys(NODES));
  for (const k of todo) { d[k] = Infinity; prev[k] = null; }
  d[from] = 0;
  while (todo.size) {
    let k = '';
    for (const c of todo) if (!k || d[c] < d[k]) k = c;
    todo.delete(k);
    if (k === to || d[k] === Infinity) break;
    for (const [a, b] of EDGES) {
      const n = a === k ? b : b === k ? a : null;
      if (!n || !todo.has(n)) continue;
      const nd = d[k] + dist(NODES[k], NODES[n]);
      if (nd < d[n]) { d[n] = nd; prev[n] = k; }
    }
  }
  if (d[to] === Infinity) return [];
  const path = [to];
  while (prev[path[0]]) path.unshift(prev[path[0]]!);
  return path;
}

/** Full walk from a node to a spot: graph route, then the approach point, then the spot itself. */
export function walkTo(fromNode: string, spot: Spot): { u: number; v: number; level: Level }[] {
  const ap = { u: spot.approach[0], v: spot.approach[1], level: spot.level };
  const end = nearestNode(ap);
  const pts = route(fromNode, end).map((id) => ({ ...NODES[id] }));
  pts.push(ap, { u: spot.u, v: spot.v, level: spot.level });
  return pts;
}

// ── coming home ──
export interface Homecoming { home: RoommateId[]; out: RoommateId[]; greeter: RoommateId | null; line: string }

/**
 * Who's in when you walk through the door, and what the first person you'd
 * see says. Someone in their room counts as home; someone at class doesn't.
 */
export function homecoming(hour: number, pick = 0): Homecoming {
  const home: RoommateId[] = [], out: RoommateId[] = [];
  for (const r of ROOMMATES) (placeAt(r.id, hour) === 'out' ? out : home).push(r.id);
  const order: Place[] = ['couch', 'cook', 'dine'];
  let greeter: RoommateId | null = null, place: Place | null = null;
  for (const p of order) {
    const r = ROOMMATES.find((x) => placeAt(x.id, hour) === p);
    if (r) { greeter = r.id; place = p; break; }
  }
  const LINES: Record<string, string[]> = {
    couch: ['yo, you\'re back!', 'come sit, we\'re watching something', 'heyyy, grab a seat'],
    cook: ['want some? i made way too much', 'perfect timing, food\'s almost ready', 'hey! you hungry?'],
    dine: ['hey you', 'oh hey, how was your day?', 'pull up a chair'],
  };
  const pool = place ? LINES[place] : [];
  return { home, out, greeter, line: pool.length ? pool[Math.abs(Math.floor(pick)) % pool.length] : '' };
}

/** "kofi, ines & nico" */
export const listNames = (ids: string[]) =>
  ids.length <= 1 ? ids.join('') : `${ids.slice(0, -1).join(', ')} & ${ids[ids.length - 1]}`;
