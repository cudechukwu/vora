// Your house: in and out, the stairs, sitting, sleeping, roommates.
// (Helpers are in ./helpers.ts. Run just this file: npm run test:e2e -- tests/e2e/house.spec.ts)
import {
  expect, test, EXIT_AT, open, state, wrap, HX0, hw, house, HZC,
} from './helpers';

test('walk in the front door: you are taken into the house, its own world @smoke', async ({ page }) => {
  const errors = await open(page, `t=12&${hw(-2, 4)}&yaw=${-Math.PI / 2}`);
  expect((await house(page)).where).toBe('out');
  await page.keyboard.down('w');
  await page.waitForFunction(() => (window as any).__vora.where === 'in', null, { timeout: 45_000 });
  await page.keyboard.up('w');
  const h = await house(page);
  expect(h.indoors).toBe(true);
  expect(h.up).toBe(false); // downstairs: the upstairs is hidden so you can see the room
  await expect(page.locator('#act')).toHaveAttribute('aria-label', /Go\ outside/);
  expect(errors).toEqual([]);
});

test('walk back out the door: you land at the foot of the porch steps, facing High Street', async ({ page }) => {
  await open(page, `t=12&${hw(1.7, 4)}&yaw=${-Math.PI / 2}`);
  expect((await house(page)).where).toBe('in');
  await page.keyboard.down('s');
  await page.waitForFunction(() => (window as any).__vora.where === 'out', null, { timeout: 45_000 });
  await page.keyboard.up('s');
  const s = await state(page);
  expect(s.x).toBeCloseTo(HX0 + EXIT_AT.u, 0);
  expect(s.z).toBeCloseTo(HZC + EXIT_AT.v, 0);
  expect(Math.abs(wrap(s.yaw - Math.PI / 2))).toBeLessThan(0.3); // camera looks −x: out at the street
});

test('the door buttons: Go inside from the porch, Go outside from the hall', async ({ page }) => {
  await open(page, `t=12&${hw(-1.3, 4)}&yaw=${-Math.PI / 2}`);
  await expect(page.locator('#act')).toHaveAttribute('aria-label', /Go\ inside/);
  await page.locator('#act').click();
  await expect.poll(async () => (await house(page)).where).toBe('in');
  await expect(page.locator('#act')).toHaveAttribute('aria-label', /Go\ outside/);
  await page.locator('#act').click();
  await expect.poll(async () => (await house(page)).where).toBe('out');
});

test('climb the stairs to the upstairs', async ({ page }) => {
  await open(page, `t=12&${hw(1.4, 8.2)}&yaw=${-Math.PI / 2}`);
  await page.keyboard.down('w');
  await page.waitForFunction(() => (window as any).__vora.level === 1, null, { timeout: 45_000 });
  await page.keyboard.up('w');
  const h = await house(page);
  expect(h.up).toBe(true);
  expect(await page.evaluate(() => (window as any).__vora.pos.y)).toBeGreaterThan(1.5);
});

test('sit on the couch, then get up', async ({ page }) => {
  await open(page, `t=12&${hw(5.9, -4.7)}&yaw=0`); // midday: everyone's out, the couch is free
  await expect.poll(async () => (await house(page)).action).toMatch(/^sit-couch/);
  await expect(page.locator('#act')).toHaveAttribute('aria-label', /Sit/);
  await page.keyboard.press('f');
  await expect.poll(async () => (await house(page)).sitting).toMatch(/^couch/);
  await expect(page.locator('#act')).toHaveAttribute('aria-label', /Get\ up/);
  await page.keyboard.press('f');
  await expect.poll(async () => (await house(page)).sitting).toBeNull();
});

test('sleep in your bed and wake up in the morning', async ({ page }) => {
  await open(page, `t=23&${hw(2.5, -7.0)}&yaw=0&level=1`);
  await expect.poll(async () => (await house(page)).action).toBe('sleep');
  await page.keyboard.press('f');
  await expect(page.locator('#fade')).toContainText('morning');
  await expect.poll(async () => (await house(page)).hour, { timeout: 10_000 }).toBeCloseTo(7.5, 1);
});

test('a nap in the afternoon: you wake up at night', async ({ page }) => {
  await open(page, `t=13&${hw(2.5, -7.0)}&yaw=0&level=1`);
  await expect.poll(async () => (await house(page)).action).toBe('sleep');
  await page.keyboard.press('f');
  await expect(page.locator('#fade')).toContainText('night');
  await expect.poll(async () => (await house(page)).hour, { timeout: 10_000 }).toBeCloseTo(21, 1);
});

test('roommates are on the couch at night, and their name tags only show on your floor', async ({ page }) => {
  await open(page, `t=21.5&${hw(5, -1.5)}&yaw=0`);
  const onCouch = await page.evaluate(() => (window as any).__vora.roommates.list.filter((m: any) => m.target.id.startsWith('couch') && m.arrived).length);
  expect(onCouch).toBeGreaterThanOrEqual(3);
  const visibleTags = () => page.evaluate(() => [...document.querySelectorAll('.tag')].filter((t) => t.textContent!.includes('roommate') && Number((t as HTMLElement).style.opacity) > 0.3).length);
  await expect.poll(visibleTags).toBeGreaterThanOrEqual(3);
  // upstairs, the people on the couch below aren't tagged through the floor
  await page.goto(`/?intro=0&t=21.5&${hw(2.5, -2.5)}&yaw=0&level=1`);
  await page.waitForFunction(() => (window as any).__vora?.frames > 8);
  await page.waitForTimeout(500);
  expect(await visibleTags()).toBe(0);
});

test("up the stairs and back down again without getting stuck (regression)", async ({ page }) => {
  await open(page, `t=12&${hw(1.4, 7.85)}&yaw=${-Math.PI / 2}`); // hugging the side wall, where it used to trap you
  await page.keyboard.down('w');
  await page.waitForFunction(() => (window as any).__vora.level === 1, null, { timeout: 45_000 });
  await page.waitForTimeout(600);
  await page.keyboard.up('w');
  await page.keyboard.down('s');
  await page.waitForFunction(() => (window as any).__vora.level === 0, null, { timeout: 45_000 });
  await page.waitForFunction((x) => (window as any).__vora.pos.x < x, HX0 + 2.6, { timeout: 45_000 }); // all the way to the bottom
  await page.keyboard.up('s');
});

test("walking in shows who's home, and someone says hi", async ({ page }) => {
  await open(page, `t=21.5&${hw(-1.3, 4)}&yaw=${-Math.PI / 2}`);
  await page.keyboard.press('f');
  await expect(page.locator('#welcome')).toHaveClass(/show/);
  await expect(page.locator('#welcome .s')).toContainText('home');
  await expect.poll(() => page.evaluate(() => (window as any).__vora.roommates.list.some((m: any) => m.sayUntil > performance.now())), { timeout: 5000 }).toBe(true);
});
