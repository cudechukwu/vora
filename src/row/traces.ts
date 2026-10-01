import {
  CatmullRomCurve3, CircleGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial,
  PerspectiveCamera, Quaternion, Vector3,
} from 'three';

// ─── Traces ────────────────────────────────────────────────────────────
// The answer to density collapse (brief R/01): even when nobody is online,
// the row shows who was here. Friends leave footstep trails that shrink as
// they age out over 24h, spots remember who sat there, and people can pin
// a note to a place. All data below is DEMO — in the real thing it comes
// from the server, scoped to your friends.

export interface Trail { who: string; color: number; ago: string; pts: [number, number][] }
export interface Note { who: string; ago: string; text: string; x: number; z: number }
export interface Spot { text: string; x: number; z: number }

// ─── Floating labels ───────────────────────────────────────────────────
interface Label { el: HTMLElement; pos: Vector3; range: number; follow?: () => Vector3; when?: () => boolean; anywhere: boolean }

export class Labels {
  private list: Label[] = [];
  private root = document.getElementById('labels')!;
  private v = new Vector3();
  /** Which world you're in: labels belong outside unless added with `anywhere`. */
  where: 'out' | 'in' = 'out';

  add(html: string, pos: Vector3, range = 38, onTap?: () => void, follow?: () => Vector3, when?: () => boolean, anywhere = false): HTMLElement {
    const el = document.createElement('div');
    el.className = 'tag' + (onTap ? ' tap' : '');
    el.innerHTML = `<span class="b">${html}</span>`;
    if (onTap) {
      el.addEventListener('pointerdown', (e) => { e.stopPropagation(); onTap(); });
    }
    this.root.appendChild(el);
    this.list.push({ el, pos, range, follow, when, anywhere });
    return el;
  }

  /** Take a label away for good. */
  remove(el: HTMLElement) {
    this.list = this.list.filter((l) => l.el !== el);
    el.remove();
  }

  update(cam: PerspectiveCamera, from: Vector3, w: number, h: number) {
    for (const l of this.list) {
      if ((!l.anywhere && this.where === 'in') || (l.when && !l.when())) { l.el.style.opacity = '0'; continue; }
      const p = l.follow ? l.follow() : l.pos;
      const d = p.distanceTo(from);
      const fade = 1 - Math.min(1, Math.max(0, (d - l.range * 0.6) / (l.range * 0.4)));
      this.v.copy(p).project(cam);
      if (fade <= 0 || this.v.z > 1 || Math.abs(this.v.x) > 1.2) {
        l.el.style.opacity = '0';
        continue;
      }
      const sx = (this.v.x * 0.5 + 0.5) * w;
      const sy = (-this.v.y * 0.5 + 0.5) * h;
      const scale = Math.max(0.75, Math.min(1.05, 14 / d));
      l.el.style.opacity = fade.toFixed(2);
      l.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%) scale(${scale.toFixed(2)})`;
    }
  }
}

/** Footstep trails: one instanced mesh of little ovals, oldest steps smallest. */
export function buildTrails(trails: Trail[], labels: Labels): Group {
  const g = new Group();
  const steps: { m: Matrix4; c: Color }[] = [];
  const q = new Quaternion(), up = new Vector3(0, 1, 0), s = new Vector3();
  for (const t of trails) {
    const curve = new CatmullRomCurve3(t.pts.map(([x, z]) => new Vector3(x, 0, z)));
    const len = curve.getLength();
    const n = Math.floor(len / 0.62);
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const p = curve.getPointAt(u);
      const tan = curve.getTangentAt(u);
      const side = i % 2 ? 1 : -1;
      const perp = new Vector3(-tan.z, 0, tan.x).multiplyScalar(0.14 * side);
      const age = 0.35 + 0.65 * u; // newest at the end of the trail
      q.setFromAxisAngle(up, Math.atan2(tan.x, tan.z));
      const m = new Matrix4().compose(p.add(perp).setY(0.06), q, s.set(0.11 * age, 1, 0.2 * age));
      steps.push({ m, c: new Color(t.color) });
    }
    const [ex, ez] = t.pts[t.pts.length - 1];
    labels.add(
      `<span class="sw" style="background:#${t.color.toString(16).padStart(6, '0')}"></span>${t.who}<em>walked here · ${t.ago}</em>`,
      new Vector3(ex, 0.9, ez), 30,
    );
  }
  const geo = new CircleGeometry(1, 10).rotateX(-Math.PI / 2);
  const mesh = new InstancedMesh(geo, new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }), steps.length);
  steps.forEach((st, i) => { mesh.setMatrixAt(i, st.m); mesh.setColorAt(i, st.c); });
  mesh.renderOrder = 1;
  g.add(mesh);
  return g;
}
