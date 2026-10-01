import type { Box } from './collide';

// ─── The plaza between Usdan and Boger (pure data) ─────────────────────
// From the user's photos walking from Judd past Usdan and Boger: speckled
// concrete slabs, a double row of trees in square stone-chip pits, rounded
// granite benches and a granite oval table among them, a cluster of grey
// outdoor tables and chairs by Boger's south end under a big locust, round
// concrete planters of red and yellow mums, granite bollards, a blue-lidded
// trash can by Usdan, and a wooden table with people at it.
// world.ts draws these; main.ts sits people at the seats.

export type Kind = 'tree' | 'bench' | 'oval' | 'table' | 'woodTable' | 'planter' | 'bollard' | 'bin';

export interface Item {
  kind: Kind;
  x: number;
  z: number;
  /** true = long side runs along z (else along x) */
  alongZ?: boolean;
  size?: number; // trees: scale
}

const tree = (x: number, z: number, size = 1.1): Item => ({ kind: 'tree', x, z, size });
const bench = (x: number, z: number, alongZ = true): Item => ({ kind: 'bench', x, z, alongZ });

export const ITEMS: Item[] = [
  // a double row of trees down the middle, granite benches beside them
  tree(-46, -228), tree(-46, -214), tree(-46, -200), tree(-38, -221), tree(-38, -207),
  bench(-49.4, -228), bench(-49.4, -214), bench(-49.4, -200), bench(-41.4, -221), bench(-34.8, -207),
  { kind: 'oval', x: -42.5, z: -194, alongZ: true },
  // the big locust by South College, and the outdoor tables by Boger's south end
  tree(-36, -168, 1.9),
  { kind: 'table', x: -45, z: -184 }, { kind: 'table', x: -39.5, z: -184 }, { kind: 'table', x: -42.2, z: -189 },
  // a wooden table at the north end
  { kind: 'woodTable', x: -54, z: -224 },
  // planters of mums, bollards, a trash can
  { kind: 'planter', x: -36, z: -176 }, { kind: 'planter', x: -59, z: -175.6 }, { kind: 'planter', x: -34.5, z: -236 },
  { kind: 'bollard', x: -36, z: -178.6 }, { kind: 'bollard', x: -38.5, z: -178.6 },
  { kind: 'bin', x: -59, z: -206 },
];

/** Footprint half-sizes (x, z) of each kind, before padding. */
export function half(it: Item): [number, number] {
  const swap = (a: number, b: number): [number, number] => (it.alongZ ? [b, a] : [a, b]);
  switch (it.kind) {
    case 'tree': return [0.3 * (it.size ?? 1), 0.3 * (it.size ?? 1)]; // the trunk
    case 'bench': return swap(1.1, 0.3);
    case 'oval': return swap(1.3, 0.6);
    case 'table': return [1.1, 0.45];
    case 'woodTable': return [0.6, 0.6];
    case 'planter': return [0.6, 0.6];
    case 'bollard': return [0.2, 0.2];
    case 'bin': return [0.3, 0.3];
  }
}

/** Solid boxes for everything on the plaza, padded by a walker's radius. */
export function plazaObstacles(pad = 0.3): Box[] {
  return ITEMS.map((it) => {
    const [hx, hz] = half(it);
    return { x0: it.x - hx - pad, x1: it.x + hx + pad, z0: it.z - hz - pad, z1: it.z + hz + pad };
  });
}

/** Chairs round a table: where someone sits and which way they face (toward the table). */
export function chairs(it: Item): { x: number; z: number; heading: number }[] {
  if (it.kind === 'woodTable') {
    return [{ x: it.x, z: it.z - 1.05, heading: 0 }, { x: it.x, z: it.z + 1.05, heading: Math.PI },
      { x: it.x - 1.05, z: it.z, heading: Math.PI / 2 }, { x: it.x + 1.05, z: it.z, heading: -Math.PI / 2 }];
  }
  if (it.kind === 'table') {
    const out: { x: number; z: number; heading: number }[] = [];
    for (const dx of [-0.7, 0, 0.7]) out.push({ x: it.x + dx, z: it.z - 0.9, heading: 0 }, { x: it.x + dx, z: it.z + 0.9, heading: Math.PI });
    return out;
  }
  return [];
}

/** Who's sitting out on the plaza (table, chair index). */
export const SITTERS: [number, number][] = [
  [ITEMS.findIndex((i) => i.kind === 'woodTable'), 0], [ITEMS.findIndex((i) => i.kind === 'woodTable'), 1],
  [ITEMS.findIndex((i) => i.kind === 'table'), 1], [ITEMS.findIndex((i) => i.kind === 'table'), 4],
  [ITEMS.findIndex((i) => i.kind === 'table') + 2, 2],
];

// ─── Along the back path (pure data) ───────────────────────────────────
// Granite curbs both edges; on the building side, mulch beds of hostas, and
// up by Judd and Allbritton wooden benches, a row of Bigbelly bins and a red
// hydrant; on the field side, heritage lamps and a low chain-link fence
// round the football field.

export type PathKind = 'teakBench' | 'bigbelly' | 'hydrant';
export interface PathItem { kind: PathKind; x: number; z: number }

/** x of the building-side edge of the back path's furniture strip. */
export const BED = { x0: -50.2, x1: -48.1 } as const;

export const PATH_ITEMS: PathItem[] = [
  { kind: 'teakBench', x: -49.3, z: 22 }, { kind: 'teakBench', x: -49.3, z: 17.5 },
  { kind: 'teakBench', x: -49.3, z: -27 }, { kind: 'teakBench', x: -49.3, z: -31.5 },
  { kind: 'bigbelly', x: -49.2, z: -36.5 }, { kind: 'bigbelly', x: -49.2, z: -37.4 }, { kind: 'bigbelly', x: -49.2, z: -38.3 },
  { kind: 'hydrant', x: -49.0, z: 12 },
];

export function pathItemHalf(k: PathKind): [number, number] {
  return k === 'teakBench' ? [0.35, 0.9] : k === 'bigbelly' ? [0.38, 0.38] : [0.18, 0.18];
}

export function pathObstacles(pad = 0.3): Box[] {
  return PATH_ITEMS.map((it) => {
    const [hx, hz] = pathItemHalf(it.kind);
    return { x0: it.x - hx - pad, x1: it.x + hx + pad, z0: it.z - hz - pad, z1: it.z + hz + pad };
  });
}

/** Andrus Field's football pitch: width (x), length (z), centre x. Its centre z comes from the chapel. */
export const FOOTBALL = { W: 49, L: 110, gap: 7 } as const;

/**
 * The low chain-link fence round the football field, as straight runs (x0,z0 → x1,z1), with a gate
 * on the path side and one at the end toward the Allbritton–Judd walkway.
 */
export function fenceRuns(fieldX: number, fz: number): [number, number, number, number][] {
  const cx = fieldX - FOOTBALL.gap - FOOTBALL.W / 2;
  const e = cx + FOOTBALL.W / 2 + 3, w = cx - FOOTBALL.W / 2 - 2.5;
  const n = fz - FOOTBALL.L / 2 - 3, s = fz + FOOTBALL.L / 2 + 3, gate = 2.5;
  return [
    [e, n, e, fz - gate], [e, fz + gate, e, s], // path side, gate in the middle
    [w, n, w, s], // in front of the stands
    [w, n, e, n], // north end
    [w, s, cx - gate, s], [cx + gate, s, e, s], // south end, gate toward the walkway
  ];
}

/** The fence as thin solid boxes. */
export const fenceObstacles = (fieldX: number, fz: number, pad = 0.3): Box[] =>
  fenceRuns(fieldX, fz).map(([x0, z0, x1, z1]) => ({
    x0: Math.min(x0, x1) - 0.05 - pad, x1: Math.max(x0, x1) + 0.05 + pad, z0: Math.min(z0, z1) - 0.05 - pad, z1: Math.max(z0, z1) + 0.05 + pad,
  }));
