import { Container, Graphics } from 'pixi.js';
import { TILE_W, TILE_H, ROOM_COLS, ROOM_ROWS, HILL_HEIGHT, FIELD_FRACTION, COLORS } from '../config';
import { gridToWorld } from '../iso';
import { noise2 } from '../noise';

// ─── Terrain ───────────────────────────────────────────────────────────
// Foss Hill: an isometric grassy slope that rises to a back ridge (where
// the dorms + observatory sit) and flattens into a field at the front
// (where the stage is). Drawn as elevated diamond tiles with sunlit dirt
// "skirts" on their downhill faces so the slope reads as solid 3D.

function smooth(t: number) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

export class Terrain {
  readonly view: Container;
  private blocked = new Set<string>();
  private path = new Set<string>();

  constructor() {
    this.view = new Container();
    this.carvePath();
    this.build();
  }

  private key(gx: number, gy: number) {
    return `${gx},${gy}`;
  }

  // continuous elevation (px) — used by avatars/props so they glide smoothly
  heightAt(gx: number, gy: number): number {
    const d = (gx + gy) / (ROOM_COLS + ROOM_ROWS - 2);
    const ramp = smooth((FIELD_FRACTION - d) / FIELD_FRACTION);
    let h = HILL_HEIGHT * ramp;
    h += (noise2(gx * 0.18, gy * 0.18) - 0.5) * 22 * (0.3 + 0.7 * ramp);
    return Math.max(0, h);
  }

  // a worn diagonal path students walk, from front-left up toward the dorms
  private carvePath() {
    for (let gy = 2; gy < ROOM_ROWS - 2; gy++) {
      const gx = Math.round(4 + gy * 0.55 + Math.sin(gy * 0.6) * 1.4);
      for (let w = -1; w <= 1; w++) this.path.add(this.key(gx + w, gy));
    }
  }

  private grassColor(gx: number, gy: number): number {
    if (this.path.has(this.key(gx, gy))) return COLORS.path;
    const n = noise2(gx * 0.55, gy * 0.55);
    if (n > 0.64) return COLORS.grassLit;
    if (n < 0.34) return COLORS.grassDark;
    return COLORS.grassMid;
  }

  private build() {
    const N = ROOM_COLS + ROOM_ROWS - 2;
    // paint back-to-front along iso diagonals (increasing gx+gy)
    for (let s = 0; s <= N; s++) {
      for (let gx = 0; gx < ROOM_COLS; gx++) {
        const gy = s - gx;
        if (gy < 0 || gy >= ROOM_ROWS) continue;
        this.drawTile(gx, gy);
      }
    }
  }

  private drawTile(gx: number, gy: number) {
    const { x, y } = gridToWorld(gx, gy);
    const h = this.heightAt(gx, gy);
    const hRight = gx + 1 < ROOM_COLS ? this.heightAt(gx + 1, gy) : 0;
    const hLeft = gy + 1 < ROOM_ROWS ? this.heightAt(gx, gy + 1) : 0;
    const top = -h; // screen-y offset (up is negative)

    const g = new Graphics();

    // right downhill skirt (faces front-right → sunlit dirt)
    const dropR = Math.max(0, h - hRight) + (gx + 1 >= ROOM_COLS ? 14 : 0);
    if (dropR > 0.5) {
      g.moveTo(TILE_W / 2, top)
        .lineTo(0, top + TILE_H / 2)
        .lineTo(0, top + TILE_H / 2 + dropR)
        .lineTo(TILE_W / 2, top + dropR)
        .closePath()
        .fill({ color: COLORS.earthSun });
    }
    // left downhill skirt (faces front-left → shaded dirt)
    const dropL = Math.max(0, h - hLeft) + (gy + 1 >= ROOM_ROWS ? 14 : 0);
    if (dropL > 0.5) {
      g.moveTo(-TILE_W / 2, top)
        .lineTo(0, top + TILE_H / 2)
        .lineTo(0, top + TILE_H / 2 + dropL)
        .lineTo(-TILE_W / 2, top + dropL)
        .closePath()
        .fill({ color: COLORS.earthShade });
    }

    // grass top diamond
    g.moveTo(0, top - TILE_H / 2)
      .lineTo(TILE_W / 2, top)
      .lineTo(0, top + TILE_H / 2)
      .lineTo(-TILE_W / 2, top)
      .closePath()
      .fill({ color: this.grassColor(gx, gy) });

    g.position.set(x, y);
    this.view.addChild(g);
  }

  // ─── footprints / movement ──────────────────────────────────────────
  addBlocked(gx: number, gy: number) {
    this.blocked.add(this.key(Math.round(gx), Math.round(gy)));
  }

  walkable(gx: number, gy: number): boolean {
    const rx = Math.round(gx);
    const ry = Math.round(gy);
    if (rx < 1 || ry < 1 || rx >= ROOM_COLS - 1 || ry >= ROOM_ROWS - 1) return false;
    return !this.blocked.has(this.key(rx, ry));
  }

  clamp(gx: number, gy: number) {
    return {
      gx: Math.max(1, Math.min(ROOM_COLS - 2, gx)),
      gy: Math.max(1, Math.min(ROOM_ROWS - 2, gy)),
    };
  }
}
