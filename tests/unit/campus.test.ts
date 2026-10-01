import { describe, expect, it } from 'vitest';
import { CART, Cart, cartLaneX, createCart, stepCart } from '../../src/row/cart';
import { LINE, OPEN, SERVE_EVERY, isOpen, newOrder, stepOrder, truckSpot } from '../../src/row/foodtruck';
import { BACK_PATH, USDAN, byId, inPoly, layoutRow } from '../../src/row/layout';
import { resolveMove } from '../../src/row/collide';

const { stops, crossings } = layoutRow();
const STEP = 1 / 60;
const run = (c: Cart, secs: number, people: { x: number; z: number }[] = []) => { for (let t = 0; t < secs; t += STEP) stepCart(c, STEP, people); };

describe("Physical Plant's golf cart", () => {
  it('putters along the back path, keeping right, inside the path', () => {
    const c = createCart(-170, 100);
    const z = c.z;
    run(c, 5);
    expect(c.z).toBeGreaterThan(z + 12);
    expect(c.x).toBe(cartLaneX(1));
    expect(c.x - CART.halfW).toBeGreaterThan(BACK_PATH.x0);
    expect(c.x + CART.halfW).toBeLessThan(BACK_PATH.x1);
  });

  it('stops for you, short of you, and goes again once you step aside', () => {
    const c = createCart(-170, 100);
    const you = { x: c.x, z: c.z + 15 };
    run(c, 10, [you]);
    expect(c.speed).toBeLessThan(0.01);
    expect(you.z - (c.z + CART.len / 2)).toBeGreaterThan(1);
    run(c, 3, [{ x: c.x + 3, z: you.z }]);
    expect(c.speed).toBeGreaterThan(2);
  });

  it('waits at the end of the path, turns round and comes back in the other lane', () => {
    const c = createCart(-170, -100);
    run(c, 30);
    expect(c.dir).toBe(-1);
    expect(c.x).toBe(cartLaneX(-1));
    const z = c.z;
    run(c, 4);
    expect(c.z).toBeLessThan(z - 5);
  });

  it('never leaves its stretch of path', () => {
    const c = createCart(-170, -60);
    for (let i = 0; i < 60 * 120; i++) {
      stepCart(c, STEP);
      expect(c.z - CART.len / 2).toBeGreaterThanOrEqual(-170 - 0.01);
      expect(c.z + CART.len / 2).toBeLessThanOrEqual(-60 + 0.01);
    }
  });
});

describe('the burrito truck', () => {
  const walkway = crossings[crossings.length - 1]; // Boger–South
  const t = truckSpot(walkway);

  it('is only there in the day', () => {
    expect(isOpen(12)).toBe(true);
    expect(isOpen(OPEN.from - 0.1)).toBe(false);
    expect(isOpen(22)).toBe(false);
  });

  it('parks beside the Boger–South walkway, by Usdan, off the walkway and clear of buildings', () => {
    expect(t.box.z1).toBeLessThan(walkway.z - walkway.w / 2); // off the walkway, on its Boger/Usdan side
    expect(t.box.z0).toBeGreaterThan(byId(stops, 'boger').z0); // not in Boger
    for (const p of [{ x: t.box.x0, z: t.box.z0 }, { x: t.box.x1, z: t.box.z1 }, t.cooler]) expect(inPoly(p, USDAN)).toBe(false);
    expect(t.box.x1).toBeLessThan(byId(stops, 'boger').front); // tucked back between the buildings
  });

  it('the line stands on the walkway side, facing the hatch, clear of the truck and cooler', () => {
    for (let i = 0; i < LINE; i++) {
      const s = t.slot(i);
      expect(s.z).toBeGreaterThan(t.box.z1 + 0.5);
      expect(Math.hypot(s.x - t.cooler.x, s.z - t.cooler.z)).toBeGreaterThan(0.8);
      // you can walk to every spot in line
      const at = resolveMove({ x: s.x, z: walkway.z }, s, stops);
      expect(at).toEqual({ x: s.x, z: s.z });
    }
    expect(t.slot(0).heading).toBe(Math.PI);
  });

  it('serves someone every so often, only while open', () => {
    const o = newOrder();
    let served = 0;
    for (let i = 0; i < 60 * SERVE_EVERY * 3 + 5; i++) if (stepOrder(o, STEP, true)) served++;
    expect(served).toBe(3);
    expect(stepOrder(o, 100, false)).toBe(false);
  });
});
