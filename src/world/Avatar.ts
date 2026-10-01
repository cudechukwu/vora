import { Container, Graphics, Text } from 'pixi.js';
import { COLORS, WALK_SPEED, ARRIVE_EPS } from '../config';
import { gridToWorld, depth } from '../iso';
import { rng } from '../noise';

// ─── Avatar ────────────────────────────────────────────────────────────
// A person on the hill. Varied appearance (skin, hair, outfit, backpack)
// so a crowd reads as human, and a real walk cycle — arms and legs swing,
// the body bobs. This is the atom of presence; built to be one of many.

const SKIN = [0xf2cda7, 0xe7b48c, 0xcf9468, 0xa9744a, 0x7a4f30, 0x5a3a22];
const HAIR = [0x1c130c, 0x3a2516, 0x5a3a1e, 0x8a5a2a, 0xc79a4a, 0xe6cd86, 0x9a9a9a, 0x7a2f1a];
const SHIRT = [COLORS.cardinal, 0xf2efe8, 0x2b3a66, 0x2f6e4f, 0x9c9488, 0xe0b03a, 0x35506e, 0x80323a, 0x47525c];
const SHORTS = [0x2b2b30, 0x36506e, 0x6a6258, 0xeae6dc, 0x53361f, 0x394b35];

export interface Appearance {
  skin: number;
  hair: number;
  hairStyle: 'short' | 'long' | 'bun' | 'cap';
  shirt: number;
  legs: number;
  shorts: boolean; // shorts vs pants
  backpack: number | null;
}

export function randomAppearance(seed: number): Appearance {
  const pick = <T>(arr: T[], s: number) => arr[Math.floor(rng(seed + s) * arr.length)];
  const styles: Appearance['hairStyle'][] = ['short', 'long', 'bun', 'cap'];
  return {
    skin: pick(SKIN, 1),
    hair: pick(HAIR, 2),
    hairStyle: pick(styles, 3),
    shirt: pick(SHIRT, 4),
    legs: pick(SHORTS, 5),
    shorts: rng(seed + 6) > 0.45,
    backpack: rng(seed + 7) > 0.5 ? pick(SHIRT, 8) : null,
  };
}

export class Avatar {
  readonly view: Container;
  wanders = false; // ambient NPCs that cross the hill
  gx: number;
  gy: number;
  private tx: number;
  private ty: number;
  private rig: Container;
  private legL: Graphics;
  private legR: Graphics;
  private armL: Graphics;
  private armR: Graphics;
  private phase = 0;
  private swing = 0;
  private facing = 1;

  constructor(
    public id: string,
    public name: string,
    gx: number,
    gy: number,
    private look: Appearance,
    private heightAt: (gx: number, gy: number) => number,
    isSelf = false,
  ) {
    this.gx = gx;
    this.gy = gy;
    this.tx = gx;
    this.ty = gy;

    this.view = new Container();
    this.view.addChild(new Graphics().ellipse(0, 0, 11, 5).fill({ color: 0x1a2a14, alpha: 0.26 }));

    this.rig = new Container();
    this.view.addChild(this.rig);

    const a = this.look;
    // backpack (behind body)
    if (a.backpack !== null) {
      this.rig.addChild(
        new Graphics().roundRect(-7, -33, 14, 17, 4).fill({ color: a.backpack }),
      );
    }
    // legs (animated) — hip pivot at each graphic's (0,0)
    this.legL = this.makeLeg();
    this.legR = this.makeLeg();
    this.legL.position.set(-3.2, -17);
    this.legR.position.set(3.2, -17);
    this.rig.addChild(this.legR, this.legL);

    // torso
    const torso = new Graphics();
    torso.roundRect(-7.5, -34, 15, 19, 4).fill({ color: a.shirt });
    torso.roundRect(-7.5, -34, 5, 19, 4).fill({ color: 0x000000, alpha: 0.13 }); // shade
    if (a.backpack !== null) {
      torso.rect(-5, -33, 1.6, 17).fill({ color: 0x000000, alpha: 0.25 });
      torso.rect(3.4, -33, 1.6, 17).fill({ color: 0x000000, alpha: 0.25 }); // straps
    }
    this.rig.addChild(torso);

    // arms (animated) — shoulder pivot
    this.armL = this.makeArm(a.shirt);
    this.armR = this.makeArm(a.shirt);
    this.armL.position.set(-7.5, -33);
    this.armR.position.set(7.5, -33);
    this.rig.addChild(this.armR, this.armL);

    // head + hair
    const head = new Graphics().circle(0, -41, 6).fill({ color: a.skin });
    this.rig.addChild(head);
    this.rig.addChild(this.makeHair(a));

    // name tag (does not flip with facing)
    const label = new Text({
      text: name,
      style: {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        fontWeight: '700',
        fill: isSelf ? COLORS.cardinal : COLORS.cream,
        stroke: { color: 0x1a140e, width: 3 },
      },
    });
    label.anchor.set(0.5, 1);
    label.position.set(0, -52);
    this.view.addChild(label);

    if (isSelf) {
      const ring = new Graphics().ellipse(0, 0, 13, 6).stroke({ color: COLORS.cardinal, width: 2 });
      this.view.addChildAt(ring, 1);
    }

    this.refresh();
  }

  private makeLeg(): Graphics {
    const a = this.look;
    const g = new Graphics();
    if (a.shorts) {
      g.roundRect(-2.6, 0, 5.2, 8, 2).fill({ color: a.legs }); // shorts
      g.roundRect(-2.4, 7, 4.8, 10, 2).fill({ color: a.skin }); // bare lower leg
    } else {
      g.roundRect(-2.6, 0, 5.2, 17, 2).fill({ color: a.legs }); // pants
    }
    g.roundRect(-3, 16, 6, 3.4, 1.6).fill({ color: 0x33271b }); // shoe
    return g;
  }

  private makeArm(sleeve: number): Graphics {
    const g = new Graphics();
    g.roundRect(-2, 0, 4, 11, 2).fill({ color: sleeve }); // sleeve
    g.roundRect(-2, 10, 4, 5, 2).fill({ color: this.look.skin }); // forearm/hand
    return g;
  }

  private makeHair(a: Appearance): Graphics {
    const g = new Graphics();
    if (a.hairStyle === 'cap') {
      g.arc(0, -42, 6.6, Math.PI, 0).fill({ color: a.hair }); // cap dome
      g.ellipse(3, -42, 7, 2.4).fill({ color: a.hair }); // brim
      return g;
    }
    g.arc(0, -42, 6.7, Math.PI, 0).fill({ color: a.hair }); // top
    g.rect(-6.7, -42, 13.4, 3).fill({ color: a.hair });
    if (a.hairStyle === 'long') {
      g.roundRect(-7, -42, 3, 14, 1.5).fill({ color: a.hair });
      g.roundRect(4, -42, 3, 14, 1.5).fill({ color: a.hair });
    } else if (a.hairStyle === 'bun') {
      g.circle(0, -49, 3.4).fill({ color: a.hair });
    }
    return g;
  }

  moveTo(gx: number, gy: number) {
    this.tx = gx;
    this.ty = gy;
  }
  setTarget(gx: number, gy: number) {
    this.tx = gx;
    this.ty = gy;
  }
  get moving(): boolean {
    return Math.hypot(this.tx - this.gx, this.ty - this.gy) > ARRIVE_EPS;
  }

  update(dt: number) {
    const dx = this.tx - this.gx;
    const dy = this.ty - this.gy;
    const dist = Math.hypot(dx, dy);

    if (dist > ARRIVE_EPS) {
      const step = (WALK_SPEED * dt) / 1000;
      const k = Math.min(1, step / dist);
      this.gx += dx * k;
      this.gy += dy * k;
      const sx = dx - dy; // screen-x direction
      if (Math.abs(sx) > 0.001) this.facing = sx > 0 ? 1 : -1;
      this.phase += step * 11;
      this.swing += (0.9 - this.swing) * 0.2;
    } else {
      this.gx = this.tx;
      this.gy = this.ty;
      this.swing += (0 - this.swing) * 0.15;
    }

    // animate limbs
    const s = Math.sin(this.phase) * this.swing;
    this.legL.rotation = s * 0.5;
    this.legR.rotation = -s * 0.5;
    this.armL.rotation = -s * 0.55;
    this.armR.rotation = s * 0.55;
    this.rig.scale.x = this.facing;
    this.rig.y = -Math.abs(Math.sin(this.phase)) * this.swing * 2.2;

    this.refresh();
  }

  private refresh() {
    const { x, y } = gridToWorld(this.gx, this.gy);
    const elev = this.heightAt(this.gx, this.gy);
    this.view.position.set(x, y - elev);
    this.view.zIndex = depth(this.gx, this.gy);
  }
}
