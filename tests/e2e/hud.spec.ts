// Buttons, pedals, jump, tyre marks, reload where you were.
// (Helpers are in ./helpers.ts. Run just this file: npm run test:e2e -- tests/e2e/hud.spec.ts)
import {
  expect, test, open, state, hold, hw,
} from './helpers';

test('the door button goes away as soon as you\'ve gone out (house and Usdan) (regression)', async ({ page }) => {
  await open(page, `t=12&${hw(1.7, 4)}&yaw=${-Math.PI / 2}`); // in the hall, by the front door
  await expect(page.locator('#act')).toHaveAttribute('aria-label', 'Go outside');
  await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => (window as any).__vora.where)).toBe('out');
  await expect(page.locator('#act')).not.toHaveClass(/show/);
  await open(page, `t=12&x=-58.6&z=-197&yaw=${Math.PI / 2}`); // in Usdan's plaza entrance
  await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => (window as any).__vora.where)).toBe('usdan');
  await expect(page.locator('#act')).toHaveAttribute('aria-label', 'Go outside');
  await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => (window as any).__vora.where)).toBe('out');
  await expect(page.locator('#act')).not.toHaveClass(/show/);
});

test('buttons are icons (no emoji): a steering wheel for any car, a door to get out', async ({ page }) => {
  await open(page, `${hw(5, 12.8 + 2.4)}&yaw=${-Math.PI / 2}`); // by kofi's car
  const act = page.locator('#act');
  await expect(act).toHaveAttribute('aria-label', 'Drive');
  expect(await act.locator('svg').count()).toBe(1);
  expect(await act.textContent()).toBe(''); // just the icon
  await page.keyboard.press('f');
  await expect(act).toHaveAttribute('aria-label', 'Get out');
  expect(await page.locator('#toast').textContent()).not.toMatch(/stole|took|carjack/);
});

test('drive with the pedal buttons @smoke: gas to go, the dial reads mph, brake to stop; pedals only show in the car', async ({ page }) => {
  await open(page, `t=16&${hw(5, -12.8 + 2.4)}&yaw=${-Math.PI / 2}`);
  await expect(page.locator('#gas')).not.toHaveClass(/show/);
  await expect(page.locator('#jump')).toHaveClass(/show/);
  await page.keyboard.press('f');
  await expect(page.locator('#gas')).toHaveClass(/show/);
  await expect(page.locator('#brake')).toHaveClass(/show/);
  await expect(page.locator('#jump')).not.toHaveClass(/show/);
  await expect(page.locator('#speedo')).toHaveClass(/show/);
  const gas = (await page.locator('#gas').boundingBox())!;
  await page.mouse.move(gas.x + gas.width / 2, gas.y + gas.height / 2);
  await page.mouse.down();
  await page.waitForFunction(() => (window as any).__vora.speedo >= 5, null, { timeout: 60_000 });
  await page.mouse.up();
  const brake = (await page.locator('#brake').boundingBox())!;
  await page.mouse.move(brake.x + brake.width / 2, brake.y + brake.height / 2);
  await page.mouse.down();
  await page.waitForFunction(() => (window as any).__vora.speedo === 0, null, { timeout: 60_000 });
  await page.mouse.up();
  expect(await page.locator('#speedo .tick.major').count()).toBeGreaterThan(4); // a real dial
  await page.keyboard.press('f');
  await expect(page.locator('#gas')).not.toHaveClass(/show/);
});

test('jump: Space (or the button) and you leave the ground, then land', async ({ page }) => {
  await open(page);
  await page.keyboard.press(' ');
  await page.waitForFunction(() => (window as any).__vora.jumpY > 0.2, null, { timeout: 20_000 });
  await page.waitForFunction(() => (window as any).__vora.jumpY === 0, null, { timeout: 20_000 });
  await page.locator('#jump').click();
  await page.waitForFunction(() => (window as any).__vora.jumpY > 0.2, null, { timeout: 20_000 });
});

test('driving across grass leaves tyre marks', async ({ page }) => {
  // your car, out on the open grass of Andrus Field (west of the football pitch, clear of the ball diamond), pointing
  // south down it: nothing gets built there, so nothing will ever stand in its way (the lawn by the row has trees)
  await open(page, `t=16&x=-148.3&z=-100&yaw=${Math.PI}`);
  await page.evaluate(() => { const v = (window as any).__vora; const c = v.garage.cars[0]; Object.assign(c, { x: -150, z: -100, heading: 0 }); v.pos.set(-148.3, 0, -100); });
  await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => (window as any).__vora.driving)).toBe(0);
  await page.keyboard.down('w');
  await page.waitForFunction(() => (window as any).__vora.marks > 6, null, { timeout: 60_000 });
  await page.keyboard.up('w');
});

test('reload mid-play (or iOS drops the tab) and you are back where you were, not at your house @smoke', async ({ page }) => {
  // a first visit: you start at home; walk off a bit
  await open(page, 't=12', true);
  const s = await hold(page, 'w', 4);
  await page.waitForTimeout(3500); // the game notes where you are every few seconds
  await page.goto('/?t=12');
  await page.waitForFunction(() => (window as any).__vora?.frames > 5, null, { timeout: 30_000 });
  const back = await state(page);
  expect(Math.hypot(back.x - s.x, back.z - s.z)).toBeLessThan(1.5);
  // inside Usdan, too: reload and you're still inside
  await page.goto('/?t=12&intro=0&x=-58.6&z=-197&yaw=1.5708');
  await page.waitForFunction(() => (window as any).__vora?.frames > 5, null, { timeout: 30_000 });
  await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => (window as any).__vora.where)).toBe('usdan');
  await page.evaluate(() => (window as any).dispatchEvent(new Event('pagehide'))); // what Safari fires when it drops the page
  await page.goto('/?t=12');
  await page.waitForFunction(() => (window as any).__vora?.frames > 5, null, { timeout: 30_000 });
  expect(await page.evaluate(() => (window as any).__vora.where)).toBe('usdan');
});

test('in the car, just turning the wheel (no gas) creeps you forward and round', async ({ page }) => {
  await open(page, `t=16&${hw(5, -12.8 + 2.4)}&yaw=${-Math.PI / 2}`);
  await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => (window as any).__vora.driving)).toBe(0);
  const h0 = await page.evaluate(() => (window as any).__vora.garage.cars[0].heading);
  await page.keyboard.down('d');
  await page.waitForFunction((h) => Math.abs((window as any).__vora.garage.cars[0].heading - h) > 0.2, h0, { timeout: 60_000 });
  await page.keyboard.up('d');
});
