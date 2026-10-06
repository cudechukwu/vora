import { BACK_PATH, BuildingId, RowStop, XZ } from './layout';

// ─── The lawn behind the row (pure) ────────────────────────────────────
// Between the backs of North College, South College and Judd and the coal-tar back path is a strip of lawn. From the
// user's photos (and the Wikipedia shot of the rear of College Row): each building has a rear door, a walk of
// interlocking concrete pavers runs straight out to it from the back path, and a paver apron runs along the back wall.
// A few small trees, not many: the lawn stays open. (Boger's back looks onto the plaza, which is paved already;
// the chapel and Zelnick come right back to the path.)

export interface Box { x0: number; x1: number; z0: number; z1: number }

/** The buildings with a rear door onto the lawn: where along the back (z offset from the centre) and the walk's width. */
export const REAR_DOORS: Partial<Record<BuildingId, { at: number; w: number }>> = {
  north: { at: 0, w: 3 },
  south: { at: 0, w: 2.6 },
  judd: { at: -10 / 3, w: 2.6 }, // a bay off centre, so the walk lands between the teak benches on the path
};

/** How wide the paver apron along each back wall is. */
export const APRON = 2.2;

export const rearDoorZ = (s: RowStop) => s.zc + (REAR_DOORS[s.id]?.at ?? 0);
const withDoor = (stops: RowStop[]) => stops.filter((s) => REAR_DOORS[s.id]);

/** The walks: from the edge of the back path straight across the lawn to the apron by each rear door. */
export function rearWalks(stops: RowStop[]): Box[] {
  return withDoor(stops).map((s) => {
    const z = rearDoorZ(s), h = REAR_DOORS[s.id]!.w / 2;
    return { x0: BACK_PATH.x1, x1: s.back - APRON, z0: z - h, z1: z + h };
  });
}

/** The aprons: a band of pavers along the whole back wall (tucked a little under it, so there's no seam). */
export function aprons(stops: RowStop[]): Box[] {
  return withDoor(stops).map((s) => ({ x0: s.back - APRON, x1: s.back + 0.4, z0: s.z1, z1: s.z0 }));
}

const inBox = (p: XZ, b: Box, pad = 0) => p.x >= b.x0 - pad && p.x <= b.x1 + pad && p.z >= b.z0 - pad && p.z <= b.z1 + pad;

/** On the rear pavers (a walk or an apron)? */
export const onRearPaving = (p: XZ, stops: RowStop[], pad = 0) =>
  [...rearWalks(stops), ...aprons(stops)].some((b) => inBox(p, b, pad));

/** Where a walk meets the back path (z span), so the curb and the hosta bed stop there. */
export const rearWalkAt = (z: number, stops: RowStop[], pad = 0.3) =>
  rearWalks(stops).some((w) => z > w.z0 - pad && z < w.z1 + pad);

/**
 * Small trees on the back lawns (x, z, size; the street trees are 1.2–1.6). Two flank North College's walk like
 * the pair in the user's photo, one off South College's corner, one behind Judd.
 */
export const BACK_TREES: { x: number; z: number; s: number }[] = [
  { x: -42.5, z: -137, s: 0.8 },
  { x: -42, z: -122.5, s: 0.75 },
  { x: -42.5, z: -87.5, s: 0.7 },
  { x: -42.5, z: 25.5, s: 0.75 },
];

// ── The X between Judd and the chapel ──
// The open lawn between Judd and Memorial Chapel (the user's street-view shots, 2026-10-06) is crossed by two concrete
// walks in an X: corner to corner, from the College Row walk out front to the back path (the way up to Usdan).

export interface Seg { a: XZ; b: XZ; w: number }
/** Where the X's walks stand clear of Judd's and the chapel's ends (m), and how wide they are. */
export const QUAD_X = { inset: 2.5, w: 2.6 } as const;
const FRONT_WALK_X = -2.6; // the College Row walk's lawn-side edge (PATH_HALF)

export function quadX(stops: RowStop[]): Seg[] {
  const judd = stops.find((s) => s.id === 'judd')!, chapel = stops.find((s) => s.id === 'chapel')!;
  const zS = judd.z1 - QUAD_X.inset, zN = chapel.z0 + QUAD_X.inset;
  return [
    { a: { x: FRONT_WALK_X, z: zS }, b: { x: BACK_PATH.x1, z: zN }, w: QUAD_X.w },
    { a: { x: FRONT_WALK_X, z: zN }, b: { x: BACK_PATH.x1, z: zS }, w: QUAD_X.w },
  ];
}

/** How far along a walk (0 at `a`, 1 at `b`) the point nearest p is, and how far p is from it. */
export function along(s: Seg, p: XZ): { t: number; d: number } {
  const dx = s.b.x - s.a.x, dz = s.b.z - s.a.z, L2 = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((p.x - s.a.x) * dx + (p.z - s.a.z) * dz) / L2));
  return { t, d: Math.hypot(p.x - (s.a.x + dx * t), p.z - (s.a.z + dz * t)) };
}

export const onQuadX = (p: XZ, stops: RowStop[], pad = 0) => quadX(stops).some((s) => along(s, p).d <= s.w / 2 + pad);

/** Where the X meets the back path (z), so the curb and hosta bed (x ≈ −50.2…−48.1) stop there too. */
export const quadXAt = (z: number, stops: RowStop[]) => [-50.3, -49.2, -48.1].some((x) => onQuadX({ x, z }, stops, 0.3));
