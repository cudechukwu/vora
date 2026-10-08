// Behind the row and the south end: the back path, the plaza, Usdan, the truck, the cart, the field road.
// (Helpers are in ./helpers.ts. Run just this file: npm run test:e2e -- tests/e2e/campus.spec.ts)
import {
  expect, test, open, state, hold, crossings,
} from './helpers';

test('behind the row: through the walkway south of Judd, across the back path and the plaza, up the bank to the Frank Center', async ({ page }) => {
  const c = crossings[0];
  await open(page, `x=-20&z=${c.z}&yaw=${Math.PI / 2}`); // looking −x, toward the field
  const s = await hold(page, 'w', 46);
  expect(s.x).toBeLessThan(-63);
});

test('the burrito truck by Usdan: a line in the day that moves, gone at night', async ({ page }) => {
  test.setTimeout(150_000); // an order takes 11s of game time; slow frames stretch that a lot
  const errors = await open(page, 't=12&x=-8&z=-169');
  await expect.poll(() => page.evaluate(() => (window as any).__vora.truckOpen)).toBe(true);
  expect(await page.evaluate(() => (window as any).__vora.inLine)).toBeGreaterThanOrEqual(4);
  await page.waitForFunction(() => (window as any).__vora.served >= 1, null, { timeout: 110_000 }); // someone gets their burrito
  await open(page, 't=22&x=-8&z=-169');
  await expect.poll(() => page.evaluate(() => (window as any).__vora.truckOpen)).toBe(false);
  expect(errors).toEqual([]);
});

test('Usdan sits behind Boger: "now passing" says so, and it is solid', async ({ page }) => {
  await open(page, `t=12&x=-54&z=-205&yaw=${Math.PI / 2}`); // on the plaza by Usdan's east face, looking at it (−x)
  await expect(page.locator('#passing .v')).toHaveText('Usdan University Center');
  const s = await hold(page, 'w', 10);
  expect(s.x).toBeGreaterThan(-61); // stopped at its wall
});

test("Physical Plant's golf cart drives the back path", async ({ page }) => {
  await open(page, 't=12&x=-40&z=-120');
  const z0 = await page.evaluate(() => (window as any).__vora.cart.z);
  await page.waitForFunction((z) => Math.abs((window as any).__vora.cart.z - z) > 4, z0, { timeout: 30_000 });
});

test('up the back path into the plaza between Usdan and Boger: people out at the tables @smoke', async ({ page }) => {
  const errors = await open(page, `t=16&x=-56&z=-160&yaw=0`); // on the back path, looking north toward Usdan
  const s = await hold(page, 'w', 40);
  expect(s.z).toBeLessThan(-195); // well into the plaza
  const sitting = await page.evaluate(() => (window as any).__vora.bodies.filter((b: any) => b.x < -32 && b.x > -60 && b.z < -163 && b.z > -240).length);
  expect(sitting).toBeGreaterThanOrEqual(5);
  expect(await page.evaluate(() => (window as any).__vora.sample())).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});

test('into Usdan from the plaza, across to the atrium, and back out @smoke', async ({ page }) => {
  // on the plaza, facing Usdan's east doors (−x)
  const errors = await open(page, `t=13&x=-58.6&z=-197&yaw=${Math.PI / 2}`);
  await expect(page.locator('#act')).toHaveAttribute('aria-label', /Go\ into\ Usdan/);
  await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => (window as any).__vora.where)).toBe('usdan');
  expect(await page.evaluate(() => (window as any).__vora.insiders)).toBeGreaterThan(15);
  expect(await page.evaluate(() => (window as any).__vora.sample())).toBeGreaterThan(20);
  // walk in (−x), past the lounge, into the atrium
  const s = await hold(page, 'w', 8);
  expect(s.x).toBeLessThan(-66);
  expect(await page.evaluate(() => (window as any).__vora.where)).toBe('usdan');
  // and back out the way you came: turn round, walk into the doorway
  await page.keyboard.down('s');
  await page.waitForFunction(() => (window as any).__vora.where === 'out', null, { timeout: 60_000 });
  await page.keyboard.up('s');
  const out = await state(page);
  expect(out.x).toBeGreaterThan(-60); // on the plaza
  expect(errors).toEqual([]);
});

test('walk up the path into the glass entrance off the walkway and you are inside Usdan', async ({ page }) => {
  const errors = await open(page, 't=13&x=-65.2&z=-168&yaw=0.1'); // on the path, looking at the entrance (north)
  await page.keyboard.down('w');
  await page.waitForFunction(() => (window as any).__vora.where === 'usdan', null, { timeout: 60_000 });
  await page.keyboard.up('w');
  const s = await state(page);
  expect(s.z).toBeLessThan(-178); // in the lobby
  expect(errors).toEqual([]);
});

test('the field road: up the stairs onto the bank to the Frank Center; down the back path to Allbritton at its end @smoke', async ({ page }) => {
  const errors = await open(page, `t=15&x=-82&z=-2&yaw=${Math.PI}`); // on the field road at the foot of the stairs, looking south (+z)
  const s = await hold(page, 'w', 30);
  expect(s.z).toBeGreaterThan(9.6); // up the stairs…
  expect(s.z).toBeLessThan(15); // …stopped by the glass connector's doors
  expect(await page.evaluate(() => (window as any).__vora.pos.y)).toBeCloseTo(2, 1); // up on the bank
  await expect(page.locator('#passing .v')).toHaveText('Frank Center');
  await open(page, `t=15&x=-54&z=42&yaw=${Math.PI}`); // on the back path, by the Frank Center's plaza
  const a = await hold(page, 'w', 40);
  expect(a.z).toBeGreaterThan(80); // walked right up to it
  await expect(page.locator('#passing .v')).toHaveText('Allbritton Center');
  expect(await page.evaluate(() => (window as any).__vora.sample())).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});

test('Church Street has traffic (turning at the signal with High Street), and professors and students walking about', async ({ page }) => {
  await open(page, 't=13&x=-150&z=118&yaw=0');
  const first = await page.evaluate(() => (window as any).__vora.churchTraffic.vehicles.map((v: any) => v.z));
  expect(first.length).toBeGreaterThanOrEqual(3);
  await expect.poll(async () => {
    const now = await page.evaluate(() => (window as any).__vora.churchTraffic.vehicles.map((v: any) => v.z));
    return now.some((z: number, i: number) => Math.abs(z - first[i]) > 5);
  }, { timeout: 30_000 }).toBe(true);
  const light = await page.evaluate(() => [(window as any).__vora.light, (window as any).__vora.churchLight]);
  expect(light[0] !== 'red' && light[1] !== 'red').toBe(false); // never green both ways
  const folk = await page.evaluate(() => (window as any).__vora.southWalkers);
  expect(folk.filter((w: any) => w.who === 'prof').length).toBeGreaterThanOrEqual(5);
  expect(folk.filter((w: any) => w.out).length).toBeGreaterThan(5);
});
