// Cars: yours, kofi's, carjacking, hitting people, not getting stuck; bikes' speed.
// (Helpers are in ./helpers.ts. Run just this file: npm run test:e2e -- tests/e2e/cars.spec.ts)
import {
  expect, test, byId, LANES, DRIVEWAYS, open, state, hold, SPAWN_Z, HX0, hw, drv, HZC, stops,
} from './helpers';
import { ROAD } from '../../src/row/layout';

test('your car is in your driveway: Drive, go, get out @smoke', async ({ page }) => {
  const errors = await open(page, `${hw(5, -12.8 + 2.4)}&yaw=${-Math.PI / 2}`); // beside it, driver's side
  await expect(page.locator('#act')).toHaveAttribute('aria-label', /Drive/);
  await page.keyboard.press('f');
  await expect.poll(async () => (await drv(page)).driving).toBe(0);
  const start = await drv(page);
  expect(start.car!.stolen).toBe(false);
  await expect(page.locator('#act')).toHaveAttribute('aria-label', /Get\ out/);
  // the car's parked facing the street: hold the gas (W) and it pulls out of the driveway
  await page.keyboard.down('w');
  await page.waitForFunction((x) => (window as any).__vora.pos.x < x, start.x - 5, { timeout: 45_000 });
  await page.keyboard.up('w');
  await page.keyboard.press('f');
  await expect.poll(async () => (await drv(page)).driving).toBeNull();
  // the car stayed where you left it, and you're standing beside it
  const after = await page.evaluate(() => { const v = (window as any).__vora; const c = v.garage.cars[0]; return { cx: c.x, cz: c.z, x: v.pos.x, z: v.pos.z }; });
  expect(after.cx).toBeLessThan(start.x - 4);
  expect(Math.hypot(after.x - after.cx, after.z - after.cz)).toBeGreaterThan(1.2);
  expect(Math.hypot(after.x - after.cx, after.z - after.cz)).toBeLessThan(3);
  expect(errors).toEqual([]);
});

test('nothing solid (trees, lamps) stands in either driveway or its mouth', async ({ page }) => {
  await open(page);
  const blocked = await page.evaluate(([drives, roadX1]) => {
    const v = (window as any).__vora;
    return (drives as any[]).filter((d: any) => v.obstacles.some((b: any) => b.x1 > (roadX1 as number) && b.x0 < d.x1 && b.z1 > d.z0 - 1 && b.z0 < d.z1 + 1));
  }, [DRIVEWAYS.map((d) => ({ x1: HX0 + d.u1, z0: HZC + d.v0, z1: HZC + d.v1 })), ROAD.x1] as const); // (the far side of High Street)
  expect(blocked).toEqual([]);
});

test('parked cars are solid: you walk into one and stop', async ({ page }) => {
  await open(page, `${hw(5, -12.8 + 3)}&yaw=${Math.PI}`); // looking +z… so S walks you −z, into your car
  await hold(page, 's', 3);
  const s = await state(page);
  expect(s.z).toBeGreaterThan(HZC - 12.8 + 1.2); // stopped at its side (half its width + your radius)
});

test("taking kofi's car is stealing it — and he notices when you get home", async ({ page }) => {
  await open(page, `t=21.5&${hw(5, 12.8 + 2.4)}&yaw=${-Math.PI / 2}`);
  await expect(page.locator('#act')).toHaveAttribute('aria-label', /Drive/);
  await page.keyboard.press('f');
  await expect.poll(async () => (await drv(page)).car?.stolen).toBe(true);
  const start = await drv(page);
  await page.keyboard.down('w');
  await page.waitForFunction((x) => (window as any).__vora.pos.x < x, start.x - 5, { timeout: 45_000 });
  await page.keyboard.up('w');
  await page.keyboard.press('f');
  await expect.poll(async () => (await drv(page)).driving).toBeNull();
  // go home (teleport to the porch, as the walk is covered elsewhere) and in
  await page.evaluate(([x, z]) => (window as any).__vora.pos.set(x, 0, z), [HX0 - 1.3, HZC + 4]);
  await expect(page.locator('#act')).toHaveAttribute('aria-label', /Go\ inside/);
  await page.keyboard.press('f');
  await expect.poll(() => page.locator('.tag.say').allTextContents().then((t) => t.join(' ')), { timeout: 10_000 }).toMatch(/car/);
});

test('carjack: step out in front of a car, it stops, you pull the driver out and drive off in it @smoke', async ({ page }) => {
  const errors = await open(page, `x=${LANES[0].x}&z=-200`); // standing in the near lane
  // don't wait for traffic to happen along: put a car (not a truck or bike) in your lane, rolling up from 16 m behind,
  // and clear anything else out of that stretch of lane
  await page.evaluate(() => {
    const v = (window as any).__vora, z = v.pos.z, cars = v.traffic.vehicles.filter((c: any) => c.lane === 0);
    const car = cars.find((c: any) => c.kind === 'car') ?? cars[0];
    for (const c of cars) if (c !== car && Math.abs(c.z - z) < 40) c.z = z + 60;
    Object.assign(car, { z: z - 16, speed: 5 });
  });
  await page.waitForFunction(() => (window as any).__vora.action.startsWith('jack-'), null, { timeout: 60_000 });
  const before = await page.evaluate(() => {
    const v = (window as any).__vora;
    const car = v.traffic.vehicles.find((x: any) => `jack-${x.id}` === v.action);
    return { color: car.color as number, n: v.traffic.vehicles.length as number };
  });
  await expect(page.locator('#act')).toHaveAttribute('aria-label', /Drive/);
  await page.keyboard.press('f');
  await expect.poll(async () => (await drv(page)).driving).not.toBeNull();
  const jacked = await page.evaluate(() => {
    const v = (window as any).__vora;
    const c = v.garage.cars.find((x: any) => x.id === v.driving);
    return { n: v.traffic.vehicles.length, color: c.color, owner: c.owner, fleeing: v.fleeing };
  });
  expect(jacked.n).toBe(before.n - 1);
  expect(jacked.color).toBe(before.color);
  expect(jacked.owner).toBeNull();
  expect(jacked.fleeing).toBe(1);
  // the driver yells at you
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.tag.say')]
    .some((el) => /car|serious|stop|washed|groceries/.test(el.textContent ?? '') && parseFloat(el.style.opacity) > 0)), { timeout: 5000 }).toBe(true);
  // and it drives: W is down the road (+z)
  const s0 = await drv(page);
  await page.keyboard.down('w');
  await page.waitForFunction((z) => (window as any).__vora.pos.z > z, s0.z + 6, { timeout: 45_000 });
  await page.keyboard.up('w');
  expect(errors).toEqual([]);
});

test('drive into people on the walk: they go flying, yell, then pick themselves up @smoke', async ({ page }) => {
  const errors = await open(page, `yaw=${Math.PI}`);
  // your car, parked on the walk just ahead; get in and floor it down the row
  await page.evaluate(() => { const v = (window as any).__vora; const c = v.garage.cars[0]; Object.assign(c, { x: 0.6, z: v.pos.z + 4, heading: 0 }); v.pos.set(-1.3, 0, c.z); });
  await expect(page.locator('#act')).toHaveAttribute('aria-label', /Drive/);
  await page.keyboard.press('f');
  await page.keyboard.down('w');
  await page.waitForFunction(() => (window as any).__vora.knocked > 0, null, { timeout: 50_000 });
  await page.keyboard.up('w');
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.tag.say')]
    .some((el) => parseFloat(el.style.opacity) > 0)), { timeout: 5000 }).toBe(true);
  // nobody stays down
  await page.waitForFunction(() => (window as any).__vora.knocked === 0, null, { timeout: 30_000 });
  expect(errors).toEqual([]);
});

test('a car steered into a building never gets stuck in it (regression)', async ({ page }) => {
  await open(page, `yaw=${Math.PI}`);
  const north = byId(stops, 'north');
  await page.evaluate(([x, z]) => { const v = (window as any).__vora; const c = v.garage.cars[0]; Object.assign(c, { x, z, heading: 0 }); v.pos.set(x + 2, 0, z); }, [north.front + 2.2, north.z1 + 6]);
  await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => (window as any).__vora.driving)).toBe(0);
  // hard right, into the facade (the row's on your right), for a while
  await page.keyboard.down('d');
  await page.keyboard.down('w');
  await page.waitForTimeout(4000);
  await page.keyboard.up('w');
  await page.keyboard.up('d');
  const stuckAt = await page.evaluate(() => ({ x: (window as any).__vora.pos.x, z: (window as any).__vora.pos.z }));
  expect(stuckAt.x).toBeGreaterThan(north.front + 0.8);
  // and it gets away: back up (brake = reverse once stopped), steering away from the wall
  await page.keyboard.down('s');
  await page.keyboard.down('a');
  await page.waitForFunction((p) => Math.hypot((window as any).__vora.pos.x - p.x, (window as any).__vora.pos.z - p.z) > 3, stuckAt, { timeout: 40_000 });
  await page.keyboard.up('a');
  await page.keyboard.up('s');
});

test('on a bike: the speedometer shows, and your speed builds the longer you pedal', async ({ page }) => {
  await open(page, `x=-2.4&z=${SPAWN_Z + 5}`); // by the rack at the start
  await expect(page.locator('#speedo')).not.toHaveClass(/show/);
  await expect.poll(async () => (await page.evaluate(() => (window as any).__vora.action)) as string).toMatch(/^ride-/);
  await page.keyboard.press('f');
  await expect(page.locator('#speedo')).toHaveClass(/show/);
  await page.keyboard.down('w');
  await page.waitForFunction(() => (window as any).__vora.mover.speed > 3, null, { timeout: 30_000 });
  const early = await page.evaluate(() => (window as any).__vora.mover.speed);
  await page.waitForFunction((s) => (window as any).__vora.mover.speed > s + 3, early, { timeout: 30_000 });
  await page.keyboard.up('w');
  const shown = parseInt(await page.locator('#speedo .n').textContent() ?? '0', 10);
  expect(shown).toBeGreaterThan(10); // mph
});
