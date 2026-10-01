import { Container, Graphics } from 'pixi.js';
import { COLORS } from '../config';
import { rng } from '../noise';

// ─── Props ─────────────────────────────────────────────────────────────
// Hand-built isometric set pieces for Foss Hill. Each returns a Container
// whose origin (0,0) sits at the prop's ground contact point, so the caller
// can place it with gridToWorld + elevation and depth-sort it by tile.

function shadow(w: number, h = w * 0.42, alpha = 0.22): Graphics {
  return new Graphics().ellipse(0, 0, w, h).fill({ color: 0x1a2a14, alpha });
}

// ── Tree ── layered canopy, some green, some autumn ────────────────────
export function makeTree(seed: number): Container {
  const c = new Container();
  const r = rng(seed);
  const scale = 0.8 + rng(seed + 9) * 0.6;
  const fall = rng(seed + 3) > 0.7;
  const lit = fall ? COLORS.leafFall : COLORS.leafLit;
  const mid = fall ? 0xc9781f : COLORS.leafMid;
  const dark = fall ? 0x9c5a16 : COLORS.leafDark;

  c.addChild(shadow(22 * scale));

  // trunk
  const trunkH = 30 * scale;
  c.addChild(
    new Graphics()
      .roundRect(-3.5 * scale, -trunkH, 7 * scale, trunkH, 2)
      .fill({ color: COLORS.trunk }),
  );

  // canopy — three overlapping blobs, shaded bottom-left, lit top-right
  const cy = -trunkH - 16 * scale;
  const blob = (dx: number, dy: number, rad: number, col: number) =>
    c.addChild(new Graphics().circle(dx, cy + dy, rad).fill({ color: col }));
  blob(-10 * scale, 6 * scale, 18 * scale, dark);
  blob(9 * scale, 7 * scale, 17 * scale, mid);
  blob(0, -6 * scale, 20 * scale, mid);
  blob(5 * scale, -10 * scale, 13 * scale, lit);
  blob(-6 * scale + r * 4, 0, 12 * scale, lit);

  return c;
}

// ── helper: draw a windowed wall as a parallelogram with window grid ────
function wall(
  g: Graphics,
  ax: number, ay: number, // far-edge vector (along ground)
  hgt: number,
  face: number,
  win: number,
  cols: number,
  rows: number,
) {
  // wall corners: front tip F(0,0) -> A(ax,ay) along ground, extruded up by hgt
  g.moveTo(0, 0).lineTo(ax, ay).lineTo(ax, ay - hgt).lineTo(0, -hgt).closePath().fill({ color: face });
  // windows
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const a = (i + 0.7) / (cols + 0.4); // along ground edge
      const b = (j + 0.6) / (rows + 0.3); // up the wall
      const px = ax * a;
      const py = ay * a - hgt * b;
      const wu = ax / (cols + 0.4) * 0.5; // window half-width along edge
      const wv = hgt / (rows + 0.3) * 0.52; // window height
      const wuy = ay / (cols + 0.4) * 0.5;
      g.moveTo(px - wu, py - wuy)
        .lineTo(px + wu, py + wuy)
        .lineTo(px + wu, py + wuy - wv)
        .lineTo(px - wu, py - wuy - wv)
        .closePath()
        .fill({ color: win });
    }
  }
}

// ── Brick dorm (Foss-area brownstone) ──────────────────────────────────
export function makeDorm(seed: number): Container {
  const c = new Container();
  const rw = 132 + rng(seed) * 40; // right ground extent
  const lw = 104 + rng(seed + 1) * 30; // left ground extent
  const H = 120 + rng(seed + 2) * 40; // height

  c.addChild(shadow(Math.max(rw, lw) * 0.9, 36, 0.26));

  const g = new Graphics();
  // left wall (shaded)
  wall(g, -lw, -lw * 0.5, H, COLORS.brickDark, 0xcfd8dc, 4, 5);
  // right wall (sunlit)
  wall(g, rw, -rw * 0.5, H, COLORS.brickLight, 0xeaf2f4, 5, 5);
  // roof top diamond
  const F2 = -H;
  g.moveTo(0, F2)
    .lineTo(rw, -rw * 0.5 + F2)
    .lineTo(rw - lw, -rw * 0.5 - lw * 0.5 + F2)
    .lineTo(-lw, -lw * 0.5 + F2)
    .closePath()
    .fill({ color: COLORS.roof });
  // white trim line at roofline (both front edges)
  g.moveTo(-lw, -lw * 0.5 - H).lineTo(0, -H).lineTo(rw, -rw * 0.5 - H)
    .stroke({ color: COLORS.trim, width: 3 });
  // door at the front corner
  g.moveTo(-4, 0).lineTo(14, -9).lineTo(14, -34).lineTo(-4, -25).closePath()
    .fill({ color: 0x402a1c });

  c.addChild(g);
  return c;
}

// ── Van Vleck Observatory — the dome that crowns the hill ──────────────
export function makeObservatory(): Container {
  const c = new Container();
  c.addChild(shadow(60, 26, 0.26));

  const g = new Graphics();
  const R = 52; // base radius
  const baseH = 58;
  // stone cylinder body
  g.moveTo(-R, 0).lineTo(-R, -baseH).lineTo(R, -baseH).lineTo(R, 0)
    .ellipse(0, 0, R, R * 0.42) // bottom curve hint
    .fill({ color: 0xb9b0a0 });
  g.rect(-R, -baseH, R * 2, baseH).fill({ color: 0xcbc3b4 });
  g.ellipse(0, -baseH, R, R * 0.42).fill({ color: 0xd8d1c4 }); // top rim
  // shaded left half of body
  g.rect(-R, -baseH, R, baseH).fill({ color: 0xaaa291, alpha: 0.5 });
  // metal dome
  g.moveTo(-R, -baseH)
    .arc(0, -baseH, R, Math.PI, 0)
    .closePath()
    .fill({ color: COLORS.domeMetal });
  g.moveTo(-R, -baseH).arc(0, -baseH, R, Math.PI, Math.PI * 1.5).lineTo(0, -baseH).closePath()
    .fill({ color: COLORS.domeShade, alpha: 0.6 }); // shaded dome quarter
  // telescope slit
  g.moveTo(-5, -baseH).lineTo(5, -baseH).lineTo(3, -baseH - R + 6).lineTo(-3, -baseH - R + 6).closePath()
    .fill({ color: 0x2b3236 });

  c.addChild(g);
  return c;
}

// ── Concert / event stage at the base of the hill ──────────────────────
export function makeStage(): Container {
  const c = new Container();
  const W = 150;
  const D = 80;
  c.addChild(shadow(W * 0.9, 34, 0.28));

  const g = new Graphics();
  // platform top (iso diamond): left, back, right, front corners
  g.moveTo(0, 0)
    .lineTo(W / 2, -D / 2)
    .lineTo(W, 0)
    .lineTo(W / 2, D / 2)
    .closePath()
    .fill({ color: COLORS.stageDark });
  // platform front skirt (the two front edges, dropped 16px)
  g.moveTo(0, 0).lineTo(W / 2, D / 2).lineTo(W / 2, D / 2 + 16).lineTo(0, 16).closePath()
    .fill({ color: COLORS.stageRig });
  g.moveTo(W / 2, D / 2).lineTo(W, 0).lineTo(W, 16).lineTo(W / 2, D / 2 + 16).closePath()
    .fill({ color: COLORS.stageRig });
  // back banner wall (rises off the back-left edge)
  g.moveTo(0, 0).lineTo(W / 2, -D / 2).lineTo(W / 2, -D / 2 - 64).lineTo(0, -64).closePath()
    .fill({ color: COLORS.cardinalDeep });
  g.moveTo(W / 2, -D / 2).lineTo(W, 0).lineTo(W, -64).lineTo(W / 2, -D / 2 - 64).closePath()
    .fill({ color: COLORS.cardinal });
  // truss uprights + top bar spanning the front
  g.rect(0, -96, 6, 96).fill({ color: COLORS.stageRig });
  g.rect(W - 6, -96, 6, 96).fill({ color: COLORS.stageRig });
  g.rect(0, -96, W, 7).fill({ color: COLORS.stageRig });

  c.addChild(g);
  return c;
}
