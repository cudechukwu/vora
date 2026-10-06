// Sound.
// (Helpers are in ./helpers.ts. Run just this file: npm run test:e2e -- tests/e2e/sound.spec.ts)
import {
  expect, test, LANES, open, hw, sounds,
} from './helpers';

test('sound: starts on your first touch; doors, horns, a hit and a yell all make noise; mute sticks', async ({ page }) => {
  const errors = await open(page, `t=16&${hw(5, -12.8 + 2.4)}&yaw=${-Math.PI / 2}`); // by your car
  await page.keyboard.press('f'); // in (a key counts as your first touch)
  await expect.poll(async () => (await sounds(page)).log).toContain('carDoor');
  await page.keyboard.press('f'); // out
  // stand in High Street: the car that has to stop for you honks
  await open(page, `x=${LANES[0].x}&z=-200`);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await sounds(page)).log, { timeout: 90_000 }).toContain('horn');
  // mute: the button flips it, and it's remembered next time
  await page.locator('#mute').click();
  expect((await sounds(page)).muted).toBe(true);
  await expect(page.locator('#mute')).toHaveAttribute('aria-label', 'Sound off');
  await open(page);
  expect((await sounds(page)).muted).toBe(true);
  expect(errors).toEqual([]);
});

test('sound: hitting someone with your car — a thud, then they yell (spoken)', async ({ page }) => {
  await open(page, `t=13&yaw=${Math.PI}`);
  await page.evaluate(() => { const v = (window as any).__vora; const c = v.garage.cars[0]; Object.assign(c, { x: 0.6, z: v.pos.z + 4, heading: 0 }); v.pos.set(-1.3, 0, c.z); });
  await page.keyboard.press('f');
  await page.keyboard.down('w');
  await page.waitForFunction(() => (window as any).__vora.knocked > 0, null, { timeout: 60_000 });
  await page.keyboard.up('w');
  await expect.poll(async () => (await sounds(page)).log).toContain('thud');
  await expect.poll(async () => (await sounds(page)).log.some((l) => l.startsWith('say:'))).toBe(true);
});
