import { BoxGeometry, CylinderGeometry, Group, Mesh, Object3D } from 'three';
import { lambert, PAL } from './kit';
import { Mobility, RideKind, SLOT_GAP } from './mobility';

// ─── Drawing bikes, scooters and racks ─────────────────────────────────
// Everything faces +z locally; mobility.ts owns where they are.

const bikeWheel = new CylinderGeometry(0.34, 0.34, 0.05, 16).rotateZ(Math.PI / 2);
const scootWheel = new CylinderGeometry(0.1, 0.1, 0.06, 12).rotateZ(Math.PI / 2);
const tyre = lambert(0x161616);
const steel = lambert(0x9aa3a8);
const TYRE = -1, STEEL = -2; // colour stand-ins for the shared materials

function part(parent: Object3D, geo: BoxGeometry | CylinderGeometry, color: number, x: number, y: number, z: number, rx = 0) {
  const m = new Mesh(geo, color === TYRE ? tyre : color === STEEL ? steel : lambert(color));
  m.position.set(x, y, z);
  m.rotation.x = rx;
  m.castShadow = true;
  parent.add(m);
  return m;
}

function bike(color: number) {
  const g = new Group();
  const wheels = [part(g, bikeWheel, TYRE, 0, 0.34, 0.55), part(g, bikeWheel, TYRE, 0, 0.34, -0.55)];
  part(g, new BoxGeometry(0.05, 0.05, 0.75), color, 0, 0.82, 0.02); // top tube
  part(g, new BoxGeometry(0.05, 0.05, 0.78), color, 0, 0.6, 0.18, 0.72); // down tube
  part(g, new BoxGeometry(0.05, 0.6, 0.05), color, 0, 0.62, -0.28, 0.25); // seat tube
  part(g, new BoxGeometry(0.16, 0.05, 0.26), 0x1e1e22, 0, 0.94, -0.36); // saddle
  part(g, new BoxGeometry(0.05, 0.4, 0.05), PAL.iron, 0, 0.86, 0.42, -0.2); // stem
  part(g, new BoxGeometry(0.52, 0.04, 0.04), PAL.iron, 0, 1.05, 0.46); // bars
  return { g, wheels };
}

function scooter(color: number) {
  const g = new Group();
  const wheels = [part(g, scootWheel, TYRE, 0, 0.1, 0.42), part(g, scootWheel, TYRE, 0, 0.1, -0.42)];
  part(g, new BoxGeometry(0.17, 0.06, 0.92), color, 0, 0.15, 0); // deck
  part(g, new BoxGeometry(0.05, 1.0, 0.05), 0x2a2f33, 0, 0.62, 0.44, -0.12); // stem
  part(g, new BoxGeometry(0.46, 0.04, 0.04), 0x2a2f33, 0, 1.1, 0.5); // bars
  part(g, new BoxGeometry(0.12, 0.12, 0.08), color, 0, 0.98, 0.5); // head / light
  return { g, wheels };
}

const FRAMES: Record<RideKind, number[]> = {
  bike: [0xc8302a, 0x2b3a66, 0x3d6b4f, 0xe8b33a, 0xf1ead9],
  scooter: [0x2fa66a, 0x2fa66a, 0x1e8fd0],
};

export class RideView {
  readonly group = new Group();
  private items: { g: Group; wheels: Mesh[]; r: number }[] = [];

  constructor(mob: Mobility) {
    for (const v of mob.rideables) {
      const palette = FRAMES[v.kind];
      const color = palette[v.id % palette.length];
      const built = v.kind === 'bike' ? bike(color) : scooter(color);
      this.items.push({ ...built, r: v.kind === 'bike' ? 0.34 : 0.1 });
      this.group.add(built.g);
    }
    // racks: a row of steel hoops, one between each pair of slots
    for (const r of mob.racks) {
      for (let i = 0; i <= r.slots; i++) {
        const z = r.z + (i - r.slots / 2) * SLOT_GAP;
        const hoop = new Group();
        for (const dx of [-0.35, 0.35]) part(hoop, new BoxGeometry(0.05, 0.85, 0.05), STEEL, dx, 0.425, 0);
        part(hoop, new BoxGeometry(0.75, 0.05, 0.05), STEEL, 0, 0.85, 0);
        hoop.position.set(r.x, 0, z);
        this.group.add(hoop);
      }
    }
    this.update(mob, null, 0, 0);
  }

  /** Sync to the rules state; spin the ridden one's wheels. */
  update(mob: Mobility, riding: number | null, speed: number, dt: number) {
    mob.rideables.forEach((v, i) => {
      const it = this.items[i];
      it.g.position.set(v.x, 0, v.z);
      it.g.rotation.y = v.heading;
      if (v.id === riding) for (const w of it.wheels) w.rotation.x += (speed * dt) / it.r;
    });
  }
}
