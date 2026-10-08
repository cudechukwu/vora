import type { RowStop, XZ } from './layout';
import { PLACES, Place, View, cardinalUp, fitAll, headingUp, placeAt, placeLabels, toMap, toWorldXZ, upIs } from './map';
import { CampusShapes, Fill, campusShapes } from './mapshapes';

// ─── Drawing the map ───────────────────────────────────────────────────
// One flat, quiet drawing of campus (grass, roads, walks, every building in its real outline, trees), used by the
// mini map (top-right, round, turning with you so ahead is up) and the full map (tap it: turned to the nearest of
// N/E/S/W you face, pinch or scroll to zoom, drag to pan, the compass flips it north up): tap a place, then "Go".

const FILL: Record<Fill, string> = {
  bank: '#86ad69', field: '#8ab46b', pitch: '#78ad55', pitchDark: '#6a9e4a', dirt: '#c49c6d', lawn: '#8bb46d',
  tar: '#4a4d52', path: '#e6dfcf', paver: '#d9c8a9', plaza: '#e3d9c5', stone: '#f1ece2', water: '#5d97b5', lot: '#56595e',
  brownstone: '#8d6757', brick: '#b2614b', limestone: '#ddd3bf', glass: '#9fc8d8', darkGlass: '#4f6872', concrete: '#c6b8ad',
  slate: '#6c7077', usdan: '#a3533f', clapboard: '#e8e0cc', yours: '#f6ecd0', black: '#24272a',
};
const COL = { grass: '#7fa865', tree: '#4f7d3c', treeHi: 'rgba(170,210,120,.45)', you: '#00ff88', pin: '#ffffff', pinOn: '#00c46a', ink: '#17201b' };

/** A colour a little darker (for a building's edge). */
const darker = (hex: string, k = 0.72) => {
  const n = parseInt(hex.slice(1), 16), c = (s: number) => Math.round(((n >> s) & 255) * k);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};

type Boxed = CampusShapes & { bb: WeakMap<object, [number, number, number, number]> };
const cache = new Map<string, Boxed>();
/** The shapes, worked out once (and each one's bounds, to skip what's off the map). */
function shapesFor(stops: RowStop[], fieldZ: number): Boxed {
  const key = `${stops.length}:${fieldZ}`;
  let c = cache.get(key);
  if (!c) {
    const s = campusShapes(stops, fieldZ), bb = new WeakMap<object, [number, number, number, number]>();
    for (const o of [...s.shapes, ...s.lines]) {
      const xs = o.pts.map((p) => p.x), zs = o.pts.map((p) => p.z);
      bb.set(o, [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]);
    }
    c = { ...s, bb };
    cache.set(key, c);
  }
  return c;
}

export function drawCampus(g: CanvasRenderingContext2D, v: View, stops: RowStop[], fieldZ: number) {
  const S = shapesFor(stops, fieldZ);
  const reach = Math.hypot(v.w, v.h) / 2 / v.scale + 10, inView = (o: object) => {
    const b = S.bb.get(o)!;
    return b[1] > v.cx - reach && b[0] < v.cx + reach && b[3] > v.cz - reach && b[2] < v.cz + reach;
  };
  const trace = (pts: XZ[], dx = 0, dy = 0) => {
    g.beginPath();
    pts.forEach((p, i) => { const m = toMap(v, p); if (i) g.lineTo(m.x + dx, m.y + dy); else g.moveTo(m.x + dx, m.y + dy); });
    g.closePath();
  };
  g.fillStyle = COL.grass;
  g.fillRect(0, 0, v.w, v.h);
  const ground = S.shapes.filter((s) => !s.building && inView(s)), built = S.shapes.filter((s) => s.building && inView(s));
  for (const s of ground) { g.fillStyle = s.color ?? FILL[s.fill]; trace(s.pts); g.fill(); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const l of S.lines) {
    if (!inView(l)) continue;
    g.strokeStyle = l.color; g.lineWidth = Math.max(0.8, l.w * v.scale);
    g.setLineDash(l.dash ? l.dash.map((d) => d * v.scale) : []);
    g.beginPath();
    l.pts.forEach((p, i) => { const m = toMap(v, p); if (i) g.lineTo(m.x, m.y); else g.moveTo(m.x, m.y); });
    g.stroke();
  }
  g.setLineDash([]);
  // buildings: a soft shadow (always down-right on the page, as if lit from the top left), then the roof and its edge
  const sh = Math.max(1, Math.min(6, v.scale * 1.6));
  g.fillStyle = 'rgba(20,30,20,.28)';
  for (const s of built) { trace(s.pts, sh * 0.7, sh); g.fill(); }
  g.lineWidth = Math.max(0.6, Math.min(1.6, v.scale * 0.35));
  for (const s of built) {
    const c = s.color ?? FILL[s.fill];
    g.fillStyle = c; g.strokeStyle = darker(c); trace(s.pts); g.fill(); g.stroke();
  }
  // trees: canopies with a lit side
  for (const t of S.trees) {
    const m = toMap(v, t), r = t.r * v.scale;
    if (m.x < -r || m.y < -r || m.x > v.w + r || m.y > v.h + r) continue;
    g.fillStyle = 'rgba(20,40,15,.25)'; g.beginPath(); g.arc(m.x + r * 0.25, m.y + r * 0.3, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = COL.tree; g.beginPath(); g.arc(m.x, m.y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = COL.treeHi; g.beginPath(); g.arc(m.x - r * 0.3, m.y - r * 0.3, r * 0.55, 0, Math.PI * 2); g.fill();
  }
}

/** You: a green arrow pointing the way you face (turned with the map). */
export function drawYou(g: CanvasRenderingContext2D, v: View, you: XZ, heading: number, size = 7) {
  const m = toMap(v, you);
  g.save();
  g.translate(m.x, m.y);
  g.rotate(Math.PI - heading + (v.rot ?? 0)); // heading 0 = +z = down a north-up map
  g.fillStyle = COL.you;
  g.strokeStyle = 'rgba(0,0,0,.7)';
  g.lineWidth = Math.max(1.5, size * 0.22);
  g.beginPath(); g.moveTo(0, -size * 1.3); g.lineTo(size, size); g.lineTo(0, size * 0.45); g.lineTo(-size, size); g.closePath();
  g.fill(); g.stroke();
  g.restore();
}

/** The mini map: a round window centred on you, turned so the way the camera looks is up, an N on its rim. */
export class MiniMap {
  private g: CanvasRenderingContext2D;
  private dpr = Math.min(2, devicePixelRatio || 1);
  /** how it's turned now (eases toward the camera's way) */
  rot = 0;
  constructor(private canvas: HTMLCanvasElement, private stops: RowStop[], private fieldZ: number, private span = 130) {
    this.g = canvas.getContext('2d')!;
  }
  /** `look`: the way the camera looks, as a heading (0 = +z). */
  draw(you: XZ, heading: number, look = heading) {
    const css = this.canvas.clientWidth || 104, px = Math.round(css * this.dpr);
    if (this.canvas.width !== px) { this.canvas.width = this.canvas.height = px; }
    const want = headingUp(look), d = Math.atan2(Math.sin(want - this.rot), Math.cos(want - this.rot));
    this.rot += Math.abs(d) > 1.5 ? d : d * 0.5;
    const v: View = { cx: you.x, cz: you.z, scale: px / this.span, w: px, h: px, rot: this.rot };
    const g = this.g;
    drawCampus(g, v, this.stops, this.fieldZ);
    drawYou(g, v, you, heading, 6 * this.dpr);
    // N on the rim, where north is
    const r = px / 2 - 9 * this.dpr, nx = px / 2 + Math.sin(this.rot) * r, ny = px / 2 - Math.cos(this.rot) * r;
    g.fillStyle = 'rgba(14,18,16,.82)'; g.beginPath(); g.arc(nx, ny, 7 * this.dpr, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = `700 ${8.5 * this.dpr}px 'JetBrains Mono', monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('N', nx, ny + 0.5 * this.dpr);
  }
}

/** The full map: the whole campus, labelled pins; tap one, then Go. Turned to the way you face (N/E/S/W). */
export class FullMap {
  private g: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private view!: View;
  private chosen: Place | null = null;
  /** turned to the way you face (snapped to N/E/S/W), or north up */
  private mode: 'facing' | 'north' = 'facing';
  private zoom = 1;
  private pan = { x: 0, z: 0 };
  private you = { x: 0, z: 0, heading: 0 };
  private look = 0;
  onGo: (p: Place) => void = () => {};

  constructor(private root: HTMLElement, private stops: RowStop[], private fieldZ: number) {
    const canvas = (this.canvas = root.querySelector('canvas')!);
    this.g = canvas.getContext('2d')!;
    this.gestures();
    root.querySelector('.close')!.addEventListener('click', () => this.close());
    root.querySelector('.go')!.addEventListener('click', () => { if (this.chosen) { const p = this.chosen; this.close(); this.onGo(p); } });
    root.querySelector('.compass')?.addEventListener('click', () => { this.mode = this.mode === 'facing' ? 'north' : 'facing'; this.startZoom(); this.draw(); });
    // the slider on the right: up to magnify, down to see the whole campus (it moves with pinches and scrolls too)
    const zs = root.querySelector('.zoom') as HTMLInputElement | null;
    zs?.addEventListener('input', () => {
      const v = this.view;
      if (v) this.zoomAt(2 ** Number(zs.value) / this.zoom, { x: v.w / 2, y: v.h / 2 });
    });
    addEventListener('resize', () => { if (this.isOpen) this.draw(); });
  }

  get isOpen() { return this.root.classList.contains('show'); }
  /** which way is up now: 'N', 'E', 'S' or 'W' */
  get up() { return upIs(this.rot); }
  private get rot() { return this.mode === 'north' ? 0 : cardinalUp(this.look); }

  /** `look`: the way the camera looks (a heading); the map turns to the nearest of N/E/S/W to it. */
  open(you: XZ, heading: number, look = heading) {
    this.root.classList.add('show');
    this.you = { x: you.x, z: you.z, heading };
    this.look = look;
    this.startZoom();
    this.chosen = null;
    this.choose(null);
    this.draw();
  }
  close() { this.root.classList.remove('show'); }

  /** Pick a place by id (tests, or the list under the map). */
  pick(id: string) { this.choose(PLACES.find((p) => p.id === id) ?? null); }

  private choose(p: Place | null) {
    this.chosen = p;
    const bar = this.root.querySelector('.bar') as HTMLElement;
    bar.classList.toggle('show', !!p);
    bar.querySelector('.n')!.textContent = p ? p.name : '';
    if (this.view) this.draw();
  }

  /** Drag to pan, pinch (or scroll) to zoom, tap to pick a place. */
  private gestures() {
    const c = this.canvas, pts = new Map<number, { x: number; y: number }>();
    let moved = 0, last: { x: number; y: number; d: number } | null = null;
    const dpr = () => c.width / (c.getBoundingClientRect().width || 1);
    const at = (e: MouseEvent) => { const r = c.getBoundingClientRect(), k = dpr(); return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k }; };
    const centre = () => {
      const a = [...pts.values()], x = a.reduce((s, p) => s + p.x, 0) / a.length, y = a.reduce((s, p) => s + p.y, 0) / a.length;
      return { x, y, d: a.length > 1 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0 };
    };
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture?.(e.pointerId);
      pts.set(e.pointerId, at(e));
      if (pts.size === 1) moved = 0;
      last = centre();
    });
    c.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId) || !last) return;
      pts.set(e.pointerId, at(e));
      const now = centre();
      moved += Math.hypot(now.x - last.x, now.y - last.y) + Math.abs(now.d - last.d);
      if (moved > 8 * dpr()) {
        if (last.d && now.d) this.zoomAt(now.d / last.d, now);
        this.panBy(now.x - last.x, now.y - last.y);
      }
      last = now;
    });
    const up = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      const tap = pts.size === 1 && moved <= 8 * dpr();
      pts.delete(e.pointerId);
      last = pts.size ? centre() : null;
      if (tap) this.choose(placeAt(this.view, at(e), 30 * dpr()) ?? this.chosen);
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); last = pts.size ? centre() : null; });
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomAt(Math.exp(-e.deltaY * 0.0015), at(e)); }, { passive: false });
  }

  /**
   * How it opens: the whole campus; or, turned east or west (the campus is long north–south, so across a portrait
   * screen it'd be a thin strip), zoomed in on you so the buildings stay a readable size. Drag, or slide the zoom
   * down, to see the rest.
   */
  private startZoom() {
    const side = this.up === 'E' || this.up === 'W';
    this.zoom = side ? 2.2 : 1;
    this.pan = { x: 0, z: 0 };
    if (side) { const f = fitAll(1, 1, 0, this.rot); this.pan = { x: this.you.x - f.cx, z: this.you.z - f.cz }; }
  }

  private panBy(dx: number, dy: number) {
    const v = this.view, a = toWorldXZ(v, { x: v.w / 2, y: v.h / 2 }), b = toWorldXZ(v, { x: v.w / 2 - dx, y: v.h / 2 - dy });
    this.pan.x += b.x - a.x; this.pan.z += b.z - a.z;
    this.draw();
  }
  /** Zoom by k, keeping the point under m (map pixels) where it is. */
  private zoomAt(k: number, m: { x: number; y: number }) {
    const z = Math.max(1, Math.min(8, this.zoom * k));
    if (z === this.zoom) return;
    const before = toWorldXZ(this.view, m);
    this.zoom = z;
    this.view = this.makeView();
    const after = toWorldXZ(this.view, m);
    this.pan.x += before.x - after.x; this.pan.z += before.z - after.z;
    this.draw();
  }

  private makeView(): View {
    const c = this.canvas, dpr = Math.min(2, devicePixelRatio || 1);
    const fit = fitAll(c.width, c.height, 40 * dpr, this.rot);
    if (this.zoom === 1) this.pan = { x: 0, z: 0 };
    // keep the middle of the map on campus, however far you drag
    const xs = PLACES.map((p) => p.pin.x), zs = PLACES.map((p) => p.pin.z);
    this.pan.x = Math.max(Math.min(...xs) - fit.cx, Math.min(Math.max(...xs) - fit.cx, this.pan.x));
    this.pan.z = Math.max(Math.min(...zs) - fit.cz, Math.min(Math.max(...zs) - fit.cz, this.pan.z));
    return { ...fit, cx: fit.cx + this.pan.x, cz: fit.cz + this.pan.z, scale: fit.scale * this.zoom };
  }

  private draw() {
    const canvas = this.canvas;
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    this.view = this.makeView();
    const g = this.g, v = this.view;
    drawCampus(g, v, this.stops, this.fieldZ);
    const fs = 11 * dpr;
    g.font = `600 ${fs}px 'JetBrains Mono', monospace`;
    g.textBaseline = 'middle';
    const labels = placeLabels(v, (n) => g.measureText(n).width, fs * 1.2, 9 * dpr, this.chosen?.id);
    PLACES.forEach((p) => {
      const m = toMap(v, p.pin), on = p === this.chosen;
      g.fillStyle = on ? COL.pinOn : COL.pin;
      g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2 * dpr;
      g.beginPath(); g.arc(m.x, m.y, (on ? 7 : 4.5) * dpr, 0, Math.PI * 2); g.fill(); g.stroke();
    });
    labels.forEach((l, i) => {
      if (!l.shown) return;
      const on = PLACES[i] === this.chosen;
      g.textAlign = l.align;
      g.lineWidth = 3.5 * dpr; g.strokeStyle = 'rgba(255,255,255,.92)'; g.strokeText(PLACES[i].name, l.x, l.y);
      g.fillStyle = on ? '#007a43' : COL.ink; g.fillText(PLACES[i].name, l.x, l.y);
    });
    drawYou(g, v, this.you, this.you.heading, 8 * dpr);
    // the compass: its needle points north; the letter says which way is up
    const zs = this.root.querySelector('.zoom') as HTMLInputElement | null;
    if (zs && document.activeElement !== zs) zs.value = String(Math.log2(this.zoom));
    const cmp = this.root.querySelector('.compass') as HTMLElement | null;
    if (cmp) {
      cmp.style.setProperty('--north', `${v.rot ?? 0}rad`);
      cmp.dataset.up = this.up;
      cmp.setAttribute('aria-label', this.mode === 'facing' ? `Map turned the way you face (${this.up} up); tap for north up` : 'North up; tap to turn the map the way you face');
      cmp.querySelector('.u')!.textContent = this.up;
    }
    const sub = this.root.querySelector('.sub');
    if (sub) sub.textContent = this.mode === 'facing' ? `${({ N: 'north', E: 'east', S: 'south', W: 'west' } as const)[this.up]} is up · the way you face` : 'north is up';
  }
}
