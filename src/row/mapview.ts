import { BACK_PATH, FAR_WALK, FIELD_X, PATH_HALF, PLAZA, PLAZA_GAP, ROAD, RowStop, USDAN, XZ } from './layout';
import { DRIVEWAYS, HOUSE, toWorld } from './house/plan';
import { PLACES, Place, View, fitAll, placeAt, toMap } from './map';

// ─── Drawing the map ───────────────────────────────────────────────────
// One flat, quiet drawing of campus (grass, roads, paths, buildings), used
// by the mini map (top-right, centred on you) and the full map (tap it):
// tap a place, then "Go" to jump there.

const COL = {
  grass: '#4f7a3a', field: '#5f8f42', tar: '#3a3d40', path: '#c9bea6', plaza: '#d4c9b1',
  building: '#a4543f', usdan: '#9a5040', house: '#e8e0cc', you: '#00ff88', pin: '#f6f1e6',
};

export function drawCampus(g: CanvasRenderingContext2D, v: View, stops: RowStop[], fieldZ: number) {
  const P = (p: XZ) => toMap(v, p);
  const rect = (x0: number, x1: number, z0: number, z1: number, color: string) => {
    const a = P({ x: x0, z: z0 }), b = P({ x: x1, z: z1 });
    g.fillStyle = color;
    g.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  };
  const poly = (pts: XZ[], color: string) => {
    g.fillStyle = color;
    g.beginPath();
    pts.forEach((p, i) => { const m = P(p); if (i) g.lineTo(m.x, m.y); else g.moveTo(m.x, m.y); });
    g.closePath(); g.fill();
  };
  g.fillStyle = COL.grass;
  g.fillRect(0, 0, v.w, v.h);
  // Andrus Field + the football pitch
  rect(FIELD_X - 150, FIELD_X, -175, 120, COL.field);
  rect(FIELD_X - 56, FIELD_X - 7, fieldZ - 55, fieldZ + 55, '#6aa046');
  // roads and paths
  rect(ROAD.x0, ROAD.x1, -500, 300, COL.tar);
  rect(BACK_PATH.x0, BACK_PATH.x1, -175, 120, COL.tar);
  rect(-PATH_HALF, PATH_HALF, -500, 300, COL.path);
  rect(FAR_WALK.x0, FAR_WALK.x1, -500, 300, COL.path);
  for (const b of [PLAZA, PLAZA_GAP]) rect(b.x0, b.x1, b.z0, b.z1, COL.plaza);
  // buildings on the row, Usdan, your house + driveways
  for (const s of stops) rect(s.back, s.front, s.z1, s.z0, COL.building);
  poly(USDAN, COL.usdan);
  for (const d of DRIVEWAYS) { const a = toWorld(d.u0, d.v0), b = toWorld(d.u1, d.v1); rect(a.x, b.x, a.z, b.z, COL.path); }
  rect(HOUSE.x0, HOUSE.x0 + HOUSE.depth, HOUSE.zc - HOUSE.width / 2, HOUSE.zc + HOUSE.width / 2, COL.house);
}

/** You: a green arrow pointing the way you face. */
export function drawYou(g: CanvasRenderingContext2D, v: View, you: XZ, heading: number, size = 7) {
  const m = toMap(v, you);
  g.save();
  g.translate(m.x, m.y);
  g.rotate(Math.PI - heading); // heading 0 = +z = down the map
  g.fillStyle = COL.you;
  g.strokeStyle = 'rgba(0,0,0,.6)';
  g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(0, -size * 1.3); g.lineTo(size, size); g.lineTo(0, size * 0.45); g.lineTo(-size, size); g.closePath();
  g.fill(); g.stroke();
  g.restore();
}

/** The mini map: a small square, centred on you, north up. */
export class MiniMap {
  private g: CanvasRenderingContext2D;
  private dpr = Math.min(2, devicePixelRatio || 1);
  constructor(private canvas: HTMLCanvasElement, private stops: RowStop[], private fieldZ: number, private span = 150) {
    this.g = canvas.getContext('2d')!;
  }
  draw(you: XZ, heading: number) {
    const css = this.canvas.clientWidth || 104, px = Math.round(css * this.dpr);
    if (this.canvas.width !== px) { this.canvas.width = this.canvas.height = px; }
    const v: View = { cx: you.x, cz: you.z, scale: px / this.span, w: px, h: px };
    drawCampus(this.g, v, this.stops, this.fieldZ);
    drawYou(this.g, v, you, heading, 6 * this.dpr);
  }
}

/** The full map: the whole campus, labelled pins; tap one, then Go. */
export class FullMap {
  private g: CanvasRenderingContext2D;
  private view!: View;
  private chosen: Place | null = null;
  onGo: (p: Place) => void = () => {};

  constructor(private root: HTMLElement, private stops: RowStop[], private fieldZ: number) {
    const canvas = root.querySelector('canvas')!;
    this.g = canvas.getContext('2d')!;
    canvas.addEventListener('pointerup', (e) => {
      const r = canvas.getBoundingClientRect(), dpr = canvas.width / r.width;
      this.choose(placeAt(this.view, { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr }, 30 * dpr));
    });
    root.querySelector('.close')!.addEventListener('click', () => this.close());
    root.querySelector('.go')!.addEventListener('click', () => { if (this.chosen) { const p = this.chosen; this.close(); this.onGo(p); } });
  }

  get isOpen() { return this.root.classList.contains('show'); }

  open(you: XZ, heading: number) {
    this.root.classList.add('show');
    this.choose(null);
    this.you = { ...you, heading };
    this.draw();
  }
  close() { this.root.classList.remove('show'); }

  /** Pick a place by id (tests, or the list under the map). */
  pick(id: string) { this.choose(PLACES.find((p) => p.id === id) ?? null); }

  private you = { x: 0, z: 0, heading: 0 };

  private choose(p: Place | null) {
    this.chosen = p;
    const bar = this.root.querySelector('.bar') as HTMLElement;
    bar.classList.toggle('show', !!p);
    bar.querySelector('.n')!.textContent = p ? p.name : '';
    if (this.view) this.draw();
  }

  private draw() {
    const canvas = this.root.querySelector('canvas')!;
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    this.view = fitAll(canvas.width, canvas.height, 40 * dpr);
    const g = this.g, v = this.view;
    drawCampus(g, v, this.stops, this.fieldZ);
    g.font = `600 ${11 * dpr}px 'JetBrains Mono', monospace`;
    g.textAlign = 'center';
    for (const p of PLACES) {
      const m = toMap(v, p.pin), on = p === this.chosen;
      g.fillStyle = on ? COL.you : COL.pin;
      g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 2 * dpr;
      g.beginPath(); g.arc(m.x, m.y, (on ? 7 : 5) * dpr, 0, Math.PI * 2); g.fill(); g.stroke();
      g.lineWidth = 3 * dpr; g.strokeText(p.name, m.x, m.y - 10 * dpr);
      g.fillStyle = on ? COL.you : COL.pin; g.fillText(p.name, m.x, m.y - 10 * dpr);
    }
    drawYou(g, v, this.you, this.you.heading, 8 * dpr);
  }
}
