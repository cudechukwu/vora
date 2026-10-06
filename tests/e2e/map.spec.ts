// The campus map.
// (Helpers are in ./helpers.ts. Run just this file: npm run test:e2e -- tests/e2e/map.spec.ts)
import {
  expect, test, open, state, hw,
} from './helpers';

test('the eye button is gone; the mini map is there, and tapping it opens the campus map @smoke', async ({ page }) => {
  await open(page, 't=13', true);
  expect(await page.locator('#look').count()).toBe(0);
  await expect(page.locator('#minimap')).toBeVisible();
  await page.locator('#minimap').click();
  await expect(page.locator('#mapfull')).toHaveClass(/show/);
  await page.locator('#mapfull .close').click();
  await expect(page.locator('#mapfull')).not.toHaveClass(/show/);
});

test('jump anywhere from the map: pick Usdan, Go, and you are there — even from inside your house', async ({ page }) => {
  await open(page, `t=13&${hw(5, -1.5)}&yaw=0`); // in the living room
  expect(await page.evaluate(() => (window as any).__vora.where)).toBe('in');
  await page.locator('#minimap').click();
  await page.evaluate(() => (window as any).__vora.mapPick('usdan'));
  await expect(page.locator('#mapfull .bar')).toContainText('Usdan');
  await page.locator('#mapfull .go').click();
  await expect.poll(() => page.evaluate(() => (window as any).__vora.where)).toBe('out');
  await expect.poll(async () => { const s = await state(page); return Math.hypot(s.x - -65.3, s.z - -170.4) < 2; }, { timeout: 20_000 }).toBe(true); // by Usdan's walkway entrance
  await expect(page.locator('#passing .v')).toHaveText('Usdan University Center', { timeout: 20_000 });
});
