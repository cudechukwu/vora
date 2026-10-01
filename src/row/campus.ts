import { BoxGeometry, CanvasTexture, CylinderGeometry, Group, Mesh, MeshLambertMaterial, SRGBColorSpace } from 'three';
import { lambert } from './kit';
import { Person, randomLook } from './people';
import { Cart, cartHeading } from './cart';
import { LINE, truckSpot } from './foodtruck';
import type { Crossing } from './layout';

// ─── Campus life: Physical Plant's golf cart, the burrito truck + its line ──
// Rules live in cart.ts / foodtruck.ts; this only draws and walks people.

function box(parent: Group, w: number, h: number, d: number, color: number, x: number, y: number, z: number, mat?: MeshLambertMaterial) {
  const m = new Mesh(new BoxGeometry(w, h, d), mat ?? lambert(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** A white utility golf cart, canopy on top, tools in the back, a Physical Plant driver. */
export class GolfCartView {
  readonly root = new Group();
  private driver: Person;
  private wheels: Mesh[] = [];

  constructor() {
    const g = this.root, white = 0xeeeee8;
    box(g, 1.3, 0.45, 2.5, white, 0, 0.55, 0); // body
    box(g, 1.3, 0.5, 0.5, white, 0, 0.85, 1.0); // front cowl
    box(g, 1.2, 0.12, 0.7, 0x2b2f33, 0, 0.88, 0.05); // seat
    box(g, 1.2, 0.5, 0.1, 0x2b2f33, 0, 1.1, -0.3); // seat back
    for (const x of [-0.6, 0.6]) for (const z of [0.85, -0.35]) box(g, 0.05, 1.3, 0.05, 0x9aa0a4, x, 1.55, z); // canopy posts
    box(g, 1.4, 0.06, 1.5, white, 0, 2.2, 0.25); // canopy
    box(g, 1.2, 0.3, 0.9, 0x5a5e62, 0, 0.92, -0.85); // cargo bed
    box(g, 0.5, 0.25, 0.3, 0xc8302a, -0.25, 1.15, -0.85); // toolbox
    box(g, 0.05, 0.05, 1.3, 0x8a6a4a, 0.35, 1.25, -0.8).rotation.x = 0.25; // rake handle
    box(g, 0.55, 0.12, 0.02, 0x3d6b4f, 0, 0.95, 1.26); // green "Physical Plant" plate
    const wheel = new CylinderGeometry(0.24, 0.24, 0.2, 12).rotateZ(Math.PI / 2);
    for (const x of [-0.62, 0.62]) for (const z of [0.85, -0.85]) {
      const w = new Mesh(wheel, lambert(0x161616));
      w.position.set(x, 0.24, z);
      g.add(w);
      this.wheels.push(w);
    }
    this.driver = new Person({ skin: 0xa8693f, hair: 0x3a2516, hairStyle: 'cap', top: 0x3d6b4f, legs: 0x4a4238, pack: null, sleeves: true });
    this.driver.root.position.set(0.3, 0, 0.1);
    this.driver.sit(0.95);
    g.add(this.driver.root);
  }

  update(c: Cart, dt: number) {
    this.root.position.set(c.x, 0, c.z);
    // swing round smoothly at the ends
    const want = cartHeading(c);
    const d = Math.atan2(Math.sin(want - this.root.rotation.y), Math.cos(want - this.root.rotation.y));
    this.root.rotation.y += d * Math.min(1, dt * 3);
    for (const w of this.wheels) w.rotation.x += (c.speed * dt) / 0.24;
    this.driver.sitIdle(dt);
  }
}

function menuTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 192;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1d1a16'; g.fillRect(0, 0, 256, 192);
  g.fillStyle = '#f2c14e'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center';
  g.fillText('BURRITOS', 128, 44);
  g.fillText('QUESADILLAS', 128, 82);
  g.fillStyle = '#f6f1e6'; g.font = '20px sans-serif';
  g.fillText('bowls · chips · horchata', 128, 120);
  g.fillStyle = '#d9822b'; g.font = 'italic 18px sans-serif';
  g.fillText('ask for the green sauce', 128, 160);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

interface InLine { p: Person; x: number; z: number; tx: number; tz: number; th: number; state: 'line' | 'leaving' | 'joining' | 'gone'; slot: number }

/** The white food truck, its cooler, and the students lined up at it. */
export class FoodTruckView {
  readonly group = new Group();
  readonly people: Person[] = [];
  readonly spot: ReturnType<typeof truckSpot>;
  private line: InLine[] = [];
  private wasOpen: boolean | null = null;
  private exitAt: { x: number; z: number };

  constructor(walkway: Crossing, private busy: (p: Person) => boolean = () => false) {
    const s = (this.spot = truckSpot(walkway));
    this.exitAt = { x: -1.5, z: walkway.z };
    const t = new Group();
    t.position.set(s.x, 0, s.z);
    const white = 0xf4f3ee, half = s.len / 2;
    box(t, s.len - 1.6, 2.6, s.wid, white, -0.8, 1.75, 0); // box body
    box(t, 1.6, 1.9, s.wid, white, half - 0.8, 1.4, 0); // cab (east end, toward High St)
    box(t, 0.06, 0.8, s.wid - 0.3, 0x2a333a, half + 0.01, 1.85, 0); // windshield
    box(t, s.len, 0.12, s.wid + 0.04, 0xbcbab2, 0, 0.5, 0); // skirt
    // the serving hatch on the walkway side, an awning over it, a little counter
    box(t, 2.6, 1.1, 0.06, 0x2b2b2b, 0.6, 2.1, s.wid / 2 + 0.01);
    box(t, 2.6, 0.08, 0.35, 0xd8d2c4, 0.6, 1.5, s.wid / 2 + 0.17);
    const awning = box(t, 2.9, 0.06, 0.9, 0xc8302a, 0.6, 2.85, s.wid / 2 + 0.4);
    awning.rotation.x = -0.35;
    const menu = new Mesh(new BoxGeometry(1.4, 1.05, 0.04), [
      lambert(0x1d1a16), lambert(0x1d1a16), lambert(0x1d1a16), lambert(0x1d1a16),
      new MeshLambertMaterial({ map: menuTexture() }), lambert(0x1d1a16),
    ]);
    menu.position.set(-1.6, 2.1, s.wid / 2 + 0.03);
    t.add(menu);
    const wheel = new CylinderGeometry(0.42, 0.42, 0.3, 14).rotateZ(Math.PI / 2);
    for (const x of [-half + 1.1, half - 1.0]) for (const z of [-s.wid / 2 + 0.1, s.wid / 2 - 0.1]) {
      const w = new Mesh(wheel, lambert(0x161616));
      w.rotation.y = Math.PI / 2;
      w.position.set(x, 0.42, z);
      t.add(w);
    }
    this.group.add(t);
    // the cooler on the ground: snacks, hot sauce
    const cooler = new Group();
    cooler.position.set(s.cooler.x, 0, s.cooler.z);
    box(cooler, 0.8, 0.45, 0.5, 0x2f6fb0, 0, 0.23, 0);
    box(cooler, 0.84, 0.08, 0.54, 0xf1f1ee, 0, 0.49, 0);
    for (const [x, c] of [[-0.2, 0xc8302a], [0, 0x3d6b4f], [0.2, 0xe8b33a]] as const) box(cooler, 0.07, 0.2, 0.07, c, x, 0.63, 0); // hot sauce
    this.group.add(cooler);

    for (let i = 0; i < LINE + 3; i++) {
      const p = new Person(randomLook(900 + i * 7));
      const at = s.slot(i);
      const inLine = i < LINE;
      this.line.push({ p, x: at.x, z: at.z, tx: at.x, tz: at.z, th: at.heading, state: inLine ? 'line' : 'gone', slot: inLine ? i : -1 });
      p.root.visible = inLine;
      this.people.push(p);
      this.group.add(p.root);
    }
  }

  /** The front of the line has their food: off they go; everyone steps up; someone new joins. */
  serve() {
    const front = this.line.find((q) => q.state === 'line' && q.slot === 0);
    if (front) { front.state = 'leaving'; front.slot = -1; front.tx = this.exitAt.x; front.tz = this.exitAt.z; }
    for (const q of this.line) if ((q.state === 'line' || q.state === 'joining') && q.slot > 0) this.goTo(q, q.slot - 1);
    const fresh = this.line.find((q) => q.state === 'gone');
    if (fresh) {
      Object.assign(fresh, { x: this.exitAt.x, z: this.exitAt.z + 1.2, state: 'joining' });
      fresh.p.root.visible = true;
      this.goTo(fresh, LINE - 1);
    }
  }

  private goTo(q: InLine, slot: number) {
    const at = this.spot.slot(slot);
    q.slot = slot; q.tx = at.x; q.tz = at.z; q.th = at.heading;
  }

  update(dt: number, open: boolean) {
    if (open !== this.wasOpen) {
      this.wasOpen = open;
      this.group.visible = open;
      // opening: a full line again
      this.line.forEach((q, i) => {
        const at = this.spot.slot(i);
        Object.assign(q, { x: at.x, z: at.z, tx: at.x, tz: at.z, th: at.heading, state: i < LINE ? 'line' : 'gone', slot: i < LINE ? i : -1 });
        q.p.root.visible = open && i < LINE;
        q.p.root.position.set(at.x, 0, at.z);
        q.p.face(at.heading);
      });
    }
    if (!open) return;
    for (const q of this.line) {
      if (q.state === 'gone') continue;
      if (this.busy(q.p)) { // knocked over (or getting back up): carry on from wherever they are
        q.x = q.p.root.position.x; q.z = q.p.root.position.z;
        continue;
      }
      const dx = q.tx - q.x, dz = q.tz - q.z, d = Math.hypot(dx, dz);
      if (d > 0.05) {
        const step = Math.min(d, 1.3 * dt);
        q.x += (dx / d) * step; q.z += (dz / d) * step;
        q.p.face(Math.atan2(dx, dz));
        q.p.walk(dt, 1.3);
      } else {
        if (q.state === 'leaving') { q.state = 'gone'; q.p.root.visible = false; continue; }
        if (q.state === 'joining') q.state = 'line';
        q.p.face(q.th);
        q.p.walk(dt, 0);
      }
      q.p.root.position.set(q.x, 0, q.z);
    }
  }

  /** How many people are standing in line right now. */
  get inLine() { return this.line.filter((q) => q.state === 'line').length; }
}
