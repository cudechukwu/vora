// ─── Vora world constants ──────────────────────────────────────────────
// Tunable knobs for the greybox. Keep gameplay-feel + palette numbers here
// so we can playtest-tweak without hunting through render code.

export const TILE_W = 64; // isometric tile width  (pixels, screen space)
export const TILE_H = 32; // isometric tile height (pixels, screen space)

export const ROOM_COLS = 26; // grid size of Foss Hill
export const ROOM_ROWS = 26;

export const WALK_SPEED = 3.2; // tiles per second the avatar moves
export const ARRIVE_EPS = 0.06; // how close counts as "arrived" at a tile

// Terrain: Foss Hill rises toward the back ridge (dorms + observatory) and
// slopes down to a flat field at the front (stage). Heights are in pixels.
export const HILL_HEIGHT = 150; // total rise from field to ridge
export const FIELD_FRACTION = 0.78; // front 22% is the flat field

// ─── Palette ── a real, sunny Foss Hill afternoon ──────────────────────
export const COLORS = {
  // sky
  skyTop: 0x6db8e8,
  skyMid: 0x9fd0ef,
  skyHaze: 0xdcecf2,
  // grass (top faces, lit) + earth (side faces, shaded)
  grassLit: 0x7cb648,
  grassMid: 0x6aa63c,
  grassDark: 0x568c30,
  earthSun: 0x6e5a34, // sunlit dirt side
  earthShade: 0x4f4124, // shaded dirt side
  // paths
  path: 0xcdbf9a,
  // structures
  brick: 0x9c4f3e,
  brickDark: 0x7c3a2c,
  brickLight: 0xb56450,
  trim: 0xf2ece0,
  roof: 0x3c4a52,
  domeMetal: 0xbfc6c9,
  domeShade: 0x8f989c,
  // trees
  trunk: 0x6b4a2f,
  leafLit: 0x5fa83e,
  leafMid: 0x4c9133,
  leafDark: 0x3a7327,
  leafFall: 0xd98a2b,
  // stage
  stageDark: 0x2a2630,
  stageRig: 0x14121a,
  // brand — Wesleyan cardinal
  cardinal: 0xb5231b,
  cardinalDeep: 0x8e1810,
  // ink / cream for UI + faces
  ink: 0x2a2018,
  cream: 0xf6f1e6,
  sun: 0xfff4cf,
} as const;
