import { Application, Container, Graphics, FederatedPointerEvent } from 'pixi.js';
import { Terrain } from './Terrain';
import { Avatar, randomAppearance } from './Avatar';
import { makeTree, makeDorm, makeObservatory, makeStage } from './props';
import { HUD } from '../ui/HUD';
import { COLORS, ROOM_COLS, ROOM_ROWS } from '../config';
import { gridToWorld, worldToGrid, depth } from '../iso';

// ─── Game ──────────────────────────────────────────────────────────────
// Foss Hill, assembled: a sunny sky, the grassy slope, the observatory +
// dorms on the ridge, trees, a stage at the field, and a varied crowd
// gathered on the grass. Camera follows you; tap to walk up and down.

const FIRST_NAMES = [
  'mara', 'devon', 'amara', 'jack', 'sofia', 'theo', 'imani', 'liam', 'noor',
  'kai', 'elena', 'marcus', 'yuki', 'chloe', 'andre', 'priya', 'sam', 'zoe',
  'malik', 'ava', 'finn', 'leila', 'omar', 'grace', 'nina', 'reed', 'tariq',
  'isla', 'caleb', 'mei', 'rosa', 'jude', 'aisha', 'beck', 'lola', 'cyrus',
];

export class Game {
  private camera: Container;
  private entities: Container;
  private skyLayer: Graphics;
  private terrain: Terrain;
  private self: Avatar;
  private movers: Avatar[] = [];
  private hud: HUD;

  constructor(private app: Application) {
    this.hud = new HUD();

    this.skyLayer = new Graphics();
    this.app.stage.addChild(this.skyLayer);
    this.drawSky();

    this.camera = new Container();
    this.app.stage.addChild(this.camera);

    this.terrain = new Terrain();
    this.camera.addChild(this.terrain.view);

    this.entities = new Container();
    this.entities.sortableChildren = true;
    this.camera.addChild(this.entities);

    this.buildScene();

    // you — spawn mid-slope
    const meGx = ROOM_COLS * 0.5;
    const meGy = ROOM_ROWS * 0.55;
    this.self = new Avatar(
      'self', 'you', meGx, meGy,
      { skin: 0xe7b48c, hair: 0x3a2516, hairStyle: 'short', shirt: COLORS.cardinal, legs: 0x2b2b30, shorts: false, backpack: 0x2b3a66 },
      (gx, gy) => this.terrain.heightAt(gx, gy),
      true,
    );
    this.entities.addChild(this.self.view);

    this.bindInput();
    this.app.ticker.add(() => this.tick(this.app.ticker.deltaMS));
    this.hud.setPresence(1, false);
  }

  private place(view: Container, gx: number, gy: number) {
    const { x, y } = gridToWorld(gx, gy);
    view.position.set(x, y - this.terrain.heightAt(gx, gy));
    view.zIndex = depth(gx, gy);
    this.entities.addChild(view);
  }

  private blockRect(gx: number, gy: number, w: number, h: number) {
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) this.terrain.addBlocked(gx + i, gy + j);
  }

  private buildScene() {
    // ── ridge structures (back = low gx+gy) ──
    const obs = makeObservatory();
    this.place(obs, 5, 2);
    this.blockRect(4, 1, 3, 3);

    const dormA = makeDorm(11);
    this.place(dormA, 3, 8);
    this.blockRect(1, 6, 3, 4);

    const dormB = makeDorm(27);
    this.place(dormB, 10, 3);
    this.blockRect(8, 1, 4, 3);

    // ── stage at the front field (front = high gx+gy) ──
    const stage = makeStage();
    this.place(stage, 17, 21);
    this.blockRect(16, 20, 4, 3);

    // ── trees: ring the hill + scatter on slopes ──
    const treeSpots: [number, number][] = [
      [2, 4], [2, 12], [3, 18], [6, 22], [13, 23], [20, 22], [23, 18],
      [23, 11], [22, 5], [16, 2], [8, 14], [14, 9], [18, 13], [11, 18],
      [6, 9], [20, 9],
    ];
    treeSpots.forEach(([gx, gy], i) => {
      if (this.terrain.walkable(gx, gy)) this.terrain.addBlocked(gx, gy);
      this.place(makeTree(i * 7 + 3), gx, gy);
    });

    // ── crowd: clusters gathered on the slope facing the stage ──
    let nameIdx = 0;
    const nextName = () => FIRST_NAMES[nameIdx++ % FIRST_NAMES.length];
    const clusters: [number, number, number][] = [
      [14, 17, 7], [11, 15, 6], [17, 15, 5], [13, 12, 5], [9, 11, 4],
    ];
    let seed = 100;
    for (const [cx, cy, n] of clusters) {
      for (let i = 0; i < n; i++) {
        const gx = cx + (Math.random() - 0.5) * 3.4;
        const gy = cy + (Math.random() - 0.5) * 3.4;
        const c = this.terrain.clamp(gx, gy);
        const a = new Avatar(nextName(), nextName(), c.gx, c.gy, randomAppearance(seed++), (x, y) => this.terrain.heightAt(x, y));
        this.entities.addChild(a.view);
        // gathered = mostly idle; nudge occasionally
        this.movers.push(a);
      }
    }
    // a few wanderers crossing the hill
    for (let i = 0; i < 8; i++) {
      const c = this.terrain.clamp(4 + Math.random() * 18, 4 + Math.random() * 18);
      const a = new Avatar(nextName(), nextName(), c.gx, c.gy, randomAppearance(seed++), (x, y) => this.terrain.heightAt(x, y));
      a.wanders = true;
      this.entities.addChild(a.view);
      this.movers.push(a);
    }
  }

  private bindInput() {
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on('pointertap', (e: FederatedPointerEvent) => {
      const wx = e.global.x - this.camera.position.x;
      const wy = e.global.y - this.camera.position.y;
      const g = worldToGrid(wx, wy);
      const c = this.terrain.clamp(g.gx, g.gy);
      if (this.terrain.walkable(c.gx, c.gy)) {
        this.self.moveTo(c.gx, c.gy);
        this.hud.dismissHint();
      }
    });
  }

  private wanderTimer = 0;
  private tick(dtMs: number) {
    // occasionally give wanderers a new destination
    this.wanderTimer -= dtMs;
    if (this.wanderTimer <= 0) {
      this.wanderTimer = 1400;
      for (const a of this.movers) {
        if (a.wanders && !a.moving && Math.random() < 0.5) {
          const c = this.terrain.clamp(a.gx + (Math.random() - 0.5) * 8, a.gy + (Math.random() - 0.5) * 8);
          if (this.terrain.walkable(c.gx, c.gy)) a.moveTo(c.gx, c.gy);
        }
      }
    }
    for (const a of this.movers) a.update(dtMs);
    this.self.update(dtMs);
    this.hud.update(dtMs);

    // camera follows you, centered with a slight upward bias
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    const p = this.self.view.position;
    this.camera.position.set(sw / 2 - p.x, sh * 0.56 - p.y);

    // location banner by region of the hill
    const front = this.self.gx + this.self.gy > ROOM_COLS * 1.25;
    this.hud.setLocation(front ? 'Andrus Field' : 'Foss Hill');
  }

  private drawSky() {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    this.skyLayer.clear();
    // simple vertical gradient via bands
    const bands = 24;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const col = lerpColor(COLORS.skyTop, COLORS.skyHaze, t);
      this.skyLayer.rect(0, (h * i) / bands, w, h / bands + 1).fill({ color: col });
    }
    // warm sun glow, top-right
    this.skyLayer.circle(w * 0.82, h * 0.16, Math.max(w, h) * 0.5).fill({ color: COLORS.sun, alpha: 0.18 });
    this.skyLayer.circle(w * 0.82, h * 0.16, 46).fill({ color: 0xffffff, alpha: 0.8 });
  }

  resize() {
    this.app.stage.hitArea = this.app.screen;
    this.drawSky();
  }
}

// linear-interpolate two 0xRRGGBB colors
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
