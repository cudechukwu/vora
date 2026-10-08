import { BACK_PATH, CROSSWALK_W, FAR_WALK, FIELD_X, PATH_HALF, PLAZA, PLAZA_GAP, PORTICO, CHAPEL_PORCH, JUDD_PORCH, ROAD, RowStop, SOUTH_TOWER, USDAN, USDAN_COURT, WALK_MAX_Z, WALK_MIN_Z, XZ, layoutRow } from './layout';
import { DRIVEWAYS, HOUSE, PORCH, toWorld } from './house/plan';
import { FOOTBALL, ITEMS, fenceRuns } from './plaza';
import { NEAR_WALK, frontTrees, frontWalks } from './frontlawn';
import { BACK_TREES, aprons, lawnWalks, rearWalks } from './backlawn';
import { ZEL_PARTS, FORECOURT } from './zelnick';
import { rng } from './noise';
import {
  ALLBRITTON, ALLB_BAY, ALLB_FORECOURT, ALLB_LANDING, ALLB_LOT, ALLB_TOWER, ALLB_WING, BERM, CHURCH, CHURCH_WALK_N, CHURCH_WALK_S, CHURCH_XWALK,
  CLARK, CLARK_COURT, CLARK_ENDS, CLARK_GAP, CLARK_LANE, CLARK_LOW, CLARK_PATH, CLARK_TREES, CLARK_UPPER, CLARK_WALK, EXLEY_ENTRY, EXLEY_PAV,
  EXLEY_PINE, EXLEY_PLAZA, EXLEY_TOWER, EXLEY_TREES, EXLEY_WING_UP, EXLEY_XWALK, EXLEY_GAP, FIELD_ROAD, FRANK, FRANK_ADD, FRANK_LINK, HALL_ATWATER, HA_BLOCK,
  LAWN_TREE, LAWN_WALKS, LINK_WALK, NCOURT, NCOURT_TREES, NWALK, OLIN_FRONT_WALK, OLIN_LAWN, OLIN_LINK_POLY, OLIN_POLY, OLIN_STEPS, OLIN_TREES, OLIN_WALK,
  PLAZA_F, POOL, PORTICO_O, PRUZAN, PRUZAN_BIRCH, PRUZAN_COURT, PRUZAN_ENTRY, PRUZAN_LINK_N, SCI, SCI_GLASS, SCI_LAWN, SCI_NWALK, SCI_PLAZA, SCI_TREES,
  SCI_WALK, SHANKLIN, SHANK_FENCE, SHANK_SLANT, SHANK_WALK, STAIRS, STAIRS_E, STAIRS_O, STAIRS_W, SYCAMORE, SYCAMORE2, WALKWAY, WALKWAY_PTS, BANK_FLIGHTS, LANDING,
} from './southend';

// ─── What the map draws (pure) ─────────────────────────────────────────
// Campus as flat shapes in world metres, bottom layer first: ground, roads and walks, buildings (each its real
// outline: porticos, towers, the chapel's porch, Olin's drum, Usdan's triangle), trees. mapview.ts paints them.

export type Fill =
  | 'bank' | 'field' | 'pitch' | 'pitchDark' | 'dirt' | 'lawn' | 'tar' | 'path' | 'paver' | 'plaza' | 'stone' | 'water' | 'lot'
  | 'brownstone' | 'brick' | 'limestone' | 'glass' | 'darkGlass' | 'concrete' | 'slate' | 'usdan' | 'clapboard' | 'yours' | 'black';

export interface Shape { fill: Fill; pts: XZ[]; building?: boolean; color?: string }
export interface Line { color: string; w: number; pts: XZ[]; dash?: number[] }
export interface Tree extends XZ { r: number }

type Box = { x0: number; x1: number; z0: number; z1: number };
const box = (b: Box): XZ[] => [{ x: b.x0, z: b.z0 }, { x: b.x1, z: b.z0 }, { x: b.x1, z: b.z1 }, { x: b.x0, z: b.z1 }];
const R = (x0: number, x1: number, z0: number, z1: number): Box => ({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });
/** A straight walk from a to b, w wide, as a quad. */
const seg = (a: XZ, b: XZ, w: number): XZ[] => {
  const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, nx = (-dz / l) * (w / 2), nz = (dx / l) * (w / 2);
  return [{ x: a.x + nx, z: a.z + nz }, { x: b.x + nx, z: b.z + nz }, { x: b.x - nx, z: b.z - nz }, { x: a.x - nx, z: a.z - nz }];
};
/** A box turned by `ang` (as three.js turns a group about y) about (cx, cz). */
const turned = (b: Box, ang: number, cx: number, cz: number): XZ[] => {
  const c = Math.cos(ang), s = Math.sin(ang);
  return box(b).map((p) => { const dx = p.x - cx, dz = p.z - cz; return { x: cx + dx * c + dz * s, z: cz - dx * s + dz * c }; });
};
const circle = (cx: number, cz: number, r: number, n = 20): XZ[] => Array.from({ length: n }, (_, i) => ({ x: cx + r * Math.cos((i / n) * Math.PI * 2), z: cz + r * Math.sin((i / n) * Math.PI * 2) }));
/** A square of side s turned 45°, about (cx, cz): the ball diamond. */
const diamond = (cx: number, cz: number, s: number): XZ[] => { const h = s / Math.SQRT2; return [{ x: cx, z: cz - h }, { x: cx + h, z: cz }, { x: cx, z: cz + h }, { x: cx - h, z: cz }]; };

/** The High Street houses, placed exactly as world.ts places them. */
export function streetHouses(): { b: Box; paint: string }[] {
  const paints = ['#f1ead9', '#d9dcd6', '#e8dcb4', '#b9c4c9', '#f1ead9', '#9fb0a0'];
  const out: { b: Box; paint: string }[] = [];
  let id = 900;
  for (let z = WALK_MIN_Z + 10; z > WALK_MAX_Z - 20; z -= 24) {
    if (Math.abs(z - HOUSE.zc) < 22) { id += 7; continue; }
    const w = 10 + rng(id) * 3, d = 12, x = FAR_WALK.x1 + 10.5 + rng(id + 2) * 3;
    out.push({ b: R(x - d / 2, x + d / 2, z - w / 2, z + w / 2), paint: paints[Math.floor(rng(id + 3) * paints.length)] });
    id += 7;
  }
  return out;
}

export interface CampusShapes { shapes: Shape[]; lines: Line[]; trees: Tree[] }

export function campusShapes(stops: RowStop[] = layoutRow().stops, fieldZ: number = FOOTBALL.z): CampusShapes {
  const shapes: Shape[] = [], lines: Line[] = [], trees: Tree[] = [];
  const { crossings } = layoutRow();
  const add = (fill: Fill, pts: XZ[], building = false) => shapes.push({ fill, pts, building });
  const B = (fill: Fill, b: Box, building = false) => add(fill, box(b), building);
  const north = -560, south = 300;

  // ground: Andrus Field and the bank by the Frank Center and Olin
  B('field', R(FIELD_X - 150, FIELD_X, -175, FIELD_ROAD.z0));
  B('bank', R(BERM.x0, BERM.x1, BERM.z0, BERM.z1));
  B('lawn', R(OLIN_LAWN.x0, OLIN_LAWN.x1, OLIN_LAWN.z0, OLIN_LAWN.z1));
  // the football pitch: mown stripes, end zones, yard lines; the stands and press box on the far side; the fence
  const { W, L } = FOOTBALL, cx = FIELD_X - FOOTBALL.gap - W / 2, zN = fieldZ - L / 2;
  for (let i = 0; i < 12; i++) B(i === 0 || i === 11 ? 'pitchDark' : 'pitch', R(cx - W / 2, cx + W / 2, zN + (i * L) / 12, zN + ((i + 1) * L) / 12));
  for (let yd = 0; yd <= 100; yd += 10) { const z = zN + (10 + yd) * 0.9144; lines.push({ color: 'rgba(255,255,255,.75)', w: 0.5, pts: [{ x: cx - W / 2, z }, { x: cx + W / 2, z }] }); }
  lines.push({ color: 'rgba(255,255,255,.85)', w: 0.6, pts: [...box(R(cx - W / 2, cx + W / 2, zN, zN + L)), { x: cx - W / 2, z: zN }] });
  const sx = cx - W / 2 - 5;
  B('concrete', R(sx - 7, sx + 0.6, fieldZ - 21, fieldZ + 21), true);
  B('black', R(sx - 8, sx - 5.6, fieldZ - 5, fieldZ + 5), true);
  for (const [x0, z0, x1, z1] of fenceRuns(FIELD_X, fieldZ)) lines.push({ color: 'rgba(40,46,50,.55)', w: 0.35, pts: [{ x: x0, z: z0 }, { x: x1, z: z1 }] });
  const dz = fieldZ - 20, dx = FIELD_X - 117;
  add('dirt', diamond(dx, dz, 30)); add('field', diamond(dx - 1.5, dz, 19)); add('dirt', circle(dx - 1.5, dz, 1.6, 10));

  // High Street: the road, its yellow line, sidewalks both sides, the zebra crosswalks
  B('tar', R(ROAD.x0, ROAD.x1, north, south));
  lines.push({ color: '#e8c14a', w: 0.3, pts: [{ x: (ROAD.x0 + ROAD.x1) / 2, z: north }, { x: (ROAD.x0 + ROAD.x1) / 2, z: south }], dash: [3, 3] });
  B('path', R(FAR_WALK.x0, FAR_WALK.x1, north, south));
  B('path', R(NEAR_WALK.x0, NEAR_WALK.x1, north, CHURCH_WALK_N.z0));
  B('path', R(-PATH_HALF, PATH_HALF, WALK_MAX_Z, WALK_MIN_Z));
  // the walkways between the buildings, from the field across the back path and the lawn to the street
  for (const c of crossings) {
    const tar = c.z + c.w / 2 > FIELD_ROAD.z0;
    B(tar ? 'tar' : 'path', R(tar ? BACK_PATH.x1 : BACK_PATH.x0 - 6, ROAD.x0, c.z - c.w / 2, c.z + c.w / 2));
    for (let x = ROAD.x0 + 0.6; x < ROAD.x1 - 0.3; x += 1.1) B('stone', R(x - 0.27, x + 0.27, c.z - CROSSWALK_W / 2, c.z + CROSSWALK_W / 2));
  }
  for (const w of frontWalks(stops)) add('path', seg(w.a, w.b, w.w));
  // behind the row: the back path, the lawn walks, the rear walks and aprons
  B('tar', R(BACK_PATH.x0, BACK_PATH.x1, crossings[crossings.length - 1].z - crossings[crossings.length - 1].w / 2, ALLBRITTON.z0));
  for (const w of lawnWalks(stops)) add('path', seg(w.a, w.b, w.w));
  for (const b of [...rearWalks(stops), ...aprons(stops)]) B('paver', b);
  const boger = stops.find((s) => s.id === 'boger');
  if (boger) B('path', R(boger.back - 3.2, boger.back - 0.6, boger.z1 - 12, boger.z0 + 2));
  // the plaza between Usdan and Boger
  for (const b of [PLAZA, PLAZA_GAP]) B('plaza', b);

  // the south end: the field road, the Frank Center's plaza, the walks and courts up on the bank
  B('tar', R(FIELD_ROAD.x0, FIELD_ROAD.x1, FIELD_ROAD.z0, FIELD_ROAD.z1));
  B('tar', R(PLAZA_F.x0, PLAZA_F.x1, PLAZA_F.z0, PLAZA_F.z1));
  for (const b of [LANDING, OLIN_WALK, LINK_WALK, PRUZAN_COURT, NCOURT, NWALK, OLIN_FRONT_WALK]) B('paver', b);
  for (const b of [STAIRS, STAIRS_E, STAIRS_O, STAIRS_W, ...BANK_FLIGHTS, OLIN_STEPS]) B('stone', b);
  for (const w of LAWN_WALKS) add('path', seg(w.a, w.b, w.w));
  B('water', POOL);
  // the walkway down Allbritton's side to Church Street
  lines.push({ color: '#45484c', w: WALKWAY.w, pts: WALKWAY_PTS });
  // Church Street: road, double yellow, sidewalks, crosswalks; Allbritton's lot; Clark's lane
  B('tar', R(CHURCH.x0, ROAD.x0, CHURCH.z0, CHURCH.z1));
  for (const o of [-0.15, 0.15]) lines.push({ color: '#e8c14a', w: 0.18, pts: [{ x: CHURCH.x0, z: (CHURCH.z0 + CHURCH.z1) / 2 + o }, { x: ROAD.x0, z: (CHURCH.z0 + CHURCH.z1) / 2 + o }] });
  for (const w of [CHURCH_WALK_N, CHURCH_WALK_S]) B('path', w);
  for (const xw of [CHURCH_XWALK, EXLEY_XWALK]) for (let z = CHURCH.z0 + 0.5; z < CHURCH.z1 - 0.3; z += 1.1) B('stone', R(xw.x0, xw.x1, z - 0.27, z + 0.27));
  B('lot', ALLB_LOT); B('paver', ALLB_FORECOURT); B('stone', ALLB_LANDING);
  for (const b of [CLARK_LANE, CLARK_GAP, CLARK_LOW, CLARK_UPPER]) B('tar', b);
  for (const b of [CLARK_COURT, CLARK_PATH, CLARK_WALK]) B('paver', b);
  // across Church Street: Exley's plaza and walks, the walk by Shanklin, Casper's plaza
  B('plaza', EXLEY_PLAZA); B('path', EXLEY_ENTRY); B('paver', EXLEY_GAP); B('path', SHANK_WALK);
  B('paver', SCI_PLAZA); B('path', SCI_WALK); B('paver', SCI_NWALK); add('lawn', circle(SCI_LAWN.x, SCI_LAWN.z, SCI_LAWN.r));
  // your house's lot
  for (const d of DRIVEWAYS) { const a = toWorld(d.u0, d.v0), b = toWorld(d.u1, d.v1); B('path', R(a.x, b.x, a.z, b.z)); }

  // ── buildings ──
  const mat: Record<string, Fill> = { boger: 'brick', north: 'brownstone', south: 'brownstone', chapel: 'brownstone', judd: 'brownstone' };
  for (const s of stops) {
    if (s.id === 'zelnick') {
      const Z = ZEL_PARTS;
      B('paver', FORECOURT);
      B('glass', R(Z.links.x0, Z.links.x1, s.z1, s.z0), true);
      B('glass', Z.middle, true);
      B('glass', Z.front, true);
      B('glass', Z.rear, true);
      B('limestone', Z.pier, true);
      B('concrete', Z.stairTower, true);
      continue;
    }
    B(mat[s.id] ?? 'brick', R(s.back, s.front, s.z1, s.z0), true);
    if (s.id === 'north') B('limestone', R(s.front, s.front + PORTICO.out, s.doorZ - PORTICO.at[3] - 0.9, s.doorZ - PORTICO.at[0] + 0.9), true); // the portico
    if (s.id === 'south') B('brownstone', R(s.front, s.front + SOUTH_TOWER.out, s.doorZ - SOUTH_TOWER.half, s.doorZ + SOUTH_TOWER.half), true); // the tower
    if (s.id === 'chapel') B('brownstone', R(s.front, s.front + CHAPEL_PORCH.out, s.doorZ - CHAPEL_PORCH.half, s.doorZ + CHAPEL_PORCH.half), true); // the porch
    if (s.id === 'judd') B('limestone', R(s.front, s.front + JUDD_PORCH.out, s.doorZ + JUDD_PORCH.at[0] - 0.6, s.doorZ + JUDD_PORCH.at[3] + 0.6), true); // the porch
  }
  add('usdan', USDAN, true);
  add('plaza', USDAN_COURT);
  B('brick', FRANK, true); B('brick', FRANK_ADD, true); B('glass', FRANK_LINK, true);
  add('limestone', OLIN_LINK_POLY, true);
  for (const b of [PRUZAN, PRUZAN_ENTRY, PRUZAN_LINK_N]) B('glass', b, true);
  add('brick', OLIN_POLY, true);
  B('limestone', R(PORTICO_O.x0, PORTICO_O.x1, PORTICO_O.z0, PORTICO_O.z1), true);
  B('brick', ALLBRITTON, true); B('limestone', ALLB_BAY, true); B('brick', ALLB_TOWER, true); B('brick', ALLB_WING, true);
  for (const b of [CLARK, ...CLARK_ENDS]) B('brownstone', b, true);
  B('darkGlass', EXLEY_PAV, true); B('concrete', EXLEY_WING_UP, true); B('concrete', EXLEY_TOWER, true);
  { // Shanklin and Hall-Atwater, at their slight angle; the construction fence round them
    const scx = (SHANKLIN.x0 + SHANKLIN.x1) / 2, scz = (SHANKLIN.z0 + SHANKLIN.z1) / 2;
    shapes.push({ fill: 'brownstone', pts: turned(HALL_ATWATER, SHANK_SLANT, scx, scz), building: true });
    shapes.push({ fill: 'brick', pts: turned(HA_BLOCK, SHANK_SLANT, scx, scz), building: true });
    shapes.push({ fill: 'brick', pts: turned(SHANKLIN, SHANK_SLANT, scx, scz), building: true });
    lines.push({ color: 'rgba(20,22,24,.7)', w: 0.4, pts: [...box(SHANK_FENCE), { x: SHANK_FENCE.x0, z: SHANK_FENCE.z0 }], dash: [1.5, 1] });
  }
  B('limestone', SCI, true); B('darkGlass', SCI_GLASS, true);
  for (const h of streetHouses()) shapes.push({ fill: 'clapboard', pts: box(h.b), building: true, color: h.paint });
  { const a = toWorld(PORCH.u0, PORCH.v0), b = toWorld(PORCH.u1, PORCH.v1); B('stone', R(a.x, b.x, a.z, b.z), true); }
  B('yours', R(HOUSE.x0, HOUSE.x0 + HOUSE.depth, HOUSE.zc - HOUSE.width / 2, HOUSE.zc + HOUSE.width / 2), true);

  // ── trees ──
  const T = (p: XZ, r: number) => trees.push({ x: p.x, z: p.z, r });
  for (const t of frontTrees(stops)) T(t, 4.5 * t.s);
  for (const t of BACK_TREES) T(t, 3 * t.s);
  for (const it of ITEMS) if (it.kind === 'tree') T(it, 3 * (it.size ?? 1));
  for (const t of OLIN_TREES) T(t, 5.5);
  for (const t of [...CLARK_TREES, ...SCI_TREES, ...EXLEY_TREES]) T(t, 3.5);
  for (const t of [SYCAMORE, SYCAMORE2]) T(t, 5);
  for (const t of [...NCOURT_TREES, PRUZAN_BIRCH, LAWN_TREE]) T(t, 1.8);
  T(EXLEY_PINE, 3);
  return { shapes, lines, trees };
}
