// Running, bikes and scooters, racks.
// (Helpers are in ./helpers.ts. Run just this file: npm run test:e2e -- tests/e2e/mobility.spec.ts)
import {
  expect, test, open, state, SPAWN_Z, mover,
} from './helpers';

test('keep the stick pushed and you break into a run', async ({ page }) => {
  await open(page);
  await page.keyboard.down('w');
  await page.waitForFunction(() => (window as any).__vora.running, null, { timeout: 45_000 });
  await page.waitForFunction(() => (window as any).__vora.mover.speed > 5, null, { timeout: 20_000 });
  await page.keyboard.up('w');
  await page.waitForFunction(() => !(window as any).__vora.running && (window as any).__vora.mover.speed === 0, null, { timeout: 20_000 });
});

test('a Ride button appears next to the rack by the start, and F gets you on a bike @smoke', async ({ page }) => {
  await open(page, `x=-2.4&z=${SPAWN_Z + 5}`);
  const act = page.locator('#act');
  await expect(act).toHaveClass(/show/);
  await expect(act).toHaveAttribute('aria-label', /Ride/);
  await page.keyboard.press('f');
  await expect.poll(async () => (await mover(page)).mode).toMatch(/bike|scooter/);
  await expect(act).toHaveAttribute('aria-label', /Park in rack|Get off/);
});

test('riding is much faster than walking, and you can leave it anywhere', async ({ page }) => {
  await open(page, `x=-2.4&z=${SPAWN_Z + 3.5}`);
  await expect(page.locator('#act')).toHaveAttribute('aria-label', /Ride bike/);
  await page.locator('#act').click(); // tap the button like a thumb would
  await expect.poll(async () => (await mover(page)).mode).toBe('bike');
  await page.keyboard.down('w');
  await page.waitForFunction(() => (window as any).__vora.mover.speed > 9, null, { timeout: 45_000 });
  await page.keyboard.up('w');
  await page.waitForFunction(() => (window as any).__vora.mover.speed === 0, null, { timeout: 20_000 });
  const m = await mover(page);
  const bikeId = m.riding!;
  const at = await state(page);
  await expect(page.locator('#act')).toHaveAttribute('aria-label', /Get\ off/);
  await page.locator('#act').click();
  await expect.poll(async () => (await mover(page)).mode).toBe('foot');
  const bike = await page.evaluate((id) => (window as any).__vora.mob.rideables[id], bikeId);
  expect(bike.rack).toBeNull();
  expect(Math.hypot(bike.x - at.x, bike.z - at.z)).toBeLessThan(0.01); // left right where you stopped
});

test('get off next to a rack with space and it clicks into the rack', async ({ page }) => {
  await open(page, `x=-2.4&z=${SPAWN_Z + 3.5}`);
  await page.keyboard.press('f');
  await expect.poll(async () => (await mover(page)).mode).not.toBe('foot');
  const id = (await mover(page)).riding!;
  await expect(page.locator('#act')).toHaveAttribute('aria-label', /Park\ in\ rack/);
  await page.keyboard.press('f');
  await expect.poll(async () => (await mover(page)).mode).toBe('foot');
  const v = await page.evaluate((i) => (window as any).__vora.mob.rideables[i], id);
  expect(v.rack).toBe(0);
});
