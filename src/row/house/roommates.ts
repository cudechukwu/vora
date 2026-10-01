import { Group, Vector3 } from 'three';
import { Look, Person } from '../people';
import type { Labels } from '../traces';
import { Level, ROOMMATES, RoommateId, UPSTAIRS_Y, inStairs, insideHouse, stairY, toWorld } from './plan';
import { Spot, assignments, nearestNode, walkTo } from './routine';

// ─── Your roommates, moving through their day ──────────────────────────

const LOOKS: Record<RoommateId, Look> = {
  jules: { skin: 0xc68642, hair: 0x2b1d14, hairStyle: 'bun', top: 0x5a8a9e, legs: 0x2b2b30, pack: null },
  kofi: { skin: 0x6b3e26, hair: 0x121212, hairStyle: 'short', top: 0xe8b33a, legs: 0x3b4a6b, pack: null },
  ines: { skin: 0xf1c27d, hair: 0x6b4a2f, hairStyle: 'long', top: 0x9a5fa0, legs: 0x1d2226, pack: null },
  nico: { skin: 0xe0ac69, hair: 0x1b1511, hairStyle: 'cap', top: 0x3d6b4f, legs: 0x4a4238, pack: null },
  ama: { skin: 0x8d5524, hair: 0x121212, hairStyle: 'puff', top: 0xf1ead9, legs: 0x6b7a8a, pack: null },
};

const SPEED = 1.4;

interface RM {
  id: RoommateId;
  p: Person;
  bubble: HTMLElement;
  sayUntil: number;
  u: number; v: number; level: Level;
  target: Spot;
  path: { u: number; v: number; level: Level }[];
  arrived: boolean;
}

export class Roommates {
  /** People outside (porch, coming and going) live in the street's scene; the rest in the house's. */
  readonly outdoor = new Group();
  readonly indoor = new Group();
  readonly list: RM[] = [];
  private upstairsShown = true;

  /** `viewer` tells us where you are, so name tags only show for people in the same world (and on your floor, inside). */
  constructor(hour: number, labels: Labels, viewer: () => { level: Level; indoors: boolean }) {
    const now = assignments(hour);
    for (const r of ROOMMATES) {
      const p = new Person(LOOKS[r.id]);
      const t = now[r.id];
      const rm: RM = { id: r.id, p, u: t.u, v: t.v, level: t.level, target: t, path: [], arrived: true, bubble: null!, sayUntil: 0 };
      this.settle(rm);
      this.place(rm);
      this.list.push(rm);
      labels.add(`${r.id}<em>roommate</em>`, new Vector3(), 11, undefined,
        () => p.root.position.clone().setY(p.root.position.y + 2.15),
        () => {
          const v = viewer(), home = insideHouse(rm.u, rm.v);
          return p.root.visible && (v.indoors ? home && rm.level === v.level : !home);
        }, true);
      // a speech bubble, shown for a few seconds when they say something
      rm.bubble = labels.add('', new Vector3(), 16, undefined,
        () => p.root.position.clone().setY(p.root.position.y + 2.75),
        () => p.root.visible && performance.now() < rm.sayUntil, true);
      rm.bubble.classList.add('say');
    }
  }

  /** Is anyone (visible) within `r` metres of a world point? */
  near(x: number, z: number, r: number): boolean {
    return this.list.some((m) => m.p.root.visible && Math.hypot(m.p.root.position.x - x, m.p.root.position.z - z) < r);
  }

  /** Have someone say something (a bubble over their head) for a few seconds. */
  say(id: RoommateId, text: string, seconds = 3.5) {
    const m = this.list.find((x) => x.id === id);
    if (!m) return;
    m.bubble.querySelector('.b')!.textContent = text;
    m.sayUntil = performance.now() + seconds * 1000;
  }

  /** Seat ids that are taken or about to be. */
  seatsTaken(): Set<string> {
    return new Set(this.list.map((m) => m.target.id));
  }

  private place(m: RM) {
    const w = toWorld(m.u, m.v);
    const y = inStairs(m.u, m.v) ? stairY(m.u) : m.level === 1 ? UPSTAIRS_Y : 0;
    m.p.root.position.set(w.x, y, w.z);
    const world = insideHouse(m.u, m.v) ? this.indoor : this.outdoor;
    if (m.p.root.parent !== world) world.add(m.p.root);
    const hidden = m.arrived && m.target.pose === 'hidden';
    m.p.root.visible = !hidden && (m.level === 0 || this.upstairsShown);
  }

  private settle(m: RM) {
    m.p.face(m.target.heading);
    if (m.target.pose === 'sit') m.p.sit(m.target.y);
  }

  update(dt: number, hour: number, upstairsShown: boolean) {
    this.upstairsShown = upstairsShown;
    const now = assignments(hour);
    for (const m of this.list) {
      const t = now[m.id];
      if (t.id !== m.target.id) {
        m.target = t;
        m.path = walkTo(nearestNode({ u: m.u, v: m.v, level: m.level }), t);
        m.arrived = false;
      }
      if (!m.arrived) {
        let left = SPEED * dt;
        while (left > 0 && m.path.length) {
          const n = m.path[0];
          const du = n.u - m.u, dv = n.v - m.v, d = Math.hypot(du, dv);
          if (d <= left) {
            m.u = n.u; m.v = n.v; m.level = n.level;
            m.path.shift();
            left -= d;
          } else {
            m.u += (du / d) * left; m.v += (dv / d) * left;
            m.p.face(Math.atan2(du, dv));
            left = 0;
            if (inStairs(m.u, m.v)) m.level = stairY(m.u) > UPSTAIRS_Y / 2 ? 1 : 0;
          }
        }
        if (!m.path.length) { m.arrived = true; this.settle(m); }
        else m.p.walk(dt, SPEED);
      } else if (m.target.pose === 'stand') {
        m.p.walk(dt, 0);
      } else if (m.target.pose === 'sit') {
        m.p.sitIdle(dt);
      }
      this.place(m);
    }
  }
}
