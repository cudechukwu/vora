// Booting, walking, the clock, notes, High Street traffic, the camera.
// (Helpers are in ./helpers.ts. Run just this file: npm run test:e2e -- tests/e2e/basics.spec.ts)
import {
  expect, test, byId, HOME_SPAWN, LANES, PED_GAP, open, state, hold, wrap, crossings, stops,
} from './helpers';

test('boots cleanly and draws a real scene @smoke', async ({ page }) => {
  const errors = await open(page, '', true);
  await expect(page.locator('#hud')).toHaveClass(/show/);
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 5000 });
  const colours = await page.evaluate(() => (window as any).__vora.sample());
  expect(colours).toBeGreaterThan(25);
  await expect(page.locator('#presence')).toContainText('on the row');
  // nobody touched anything: you're exactly where you spawned — outside your house (regression: a negative first frame once slid you backwards)
  const s = await state(page);
  expect(s.z).toBe(HOME_SPAWN.z);
  expect(s.x).toBe(HOME_SPAWN.x);
  await expect(page.locator('#passing .v')).toHaveText('your house');
  expect(await page.evaluate(() => (window as any).__vora.where)).toBe('out');
  expect(errors).toEqual([]);
});

test('dragging up walks you forward and hides the hint', async ({ page }) => {
  await open(page);
  const before = await state(page);
  await page.mouse.move(100, 620);
  await page.mouse.down();
  await page.mouse.move(100, 560, { steps: 6 });
  await page.waitForFunction((z0) => (window as any).__vora.pos.z > z0 + 1.5, before.z, { timeout: 20_000 });
  await page.mouse.up();
  await expect(page.locator('#hint')).toHaveClass(/gone/);
  // and you stop when you let go (easing to a halt, then staying put)
  await page.waitForFunction(() => (window as any).__vora.mover.speed === 0, null, { timeout: 10_000 });
  const a = await state(page);
  await page.waitForTimeout(400);
  const b = await state(page);
  expect(b.z).toBeCloseTo(a.z, 5);
});

test('keyboard walks too (W forward) @smoke', async ({ page }) => {
  await open(page);
  const before = await state(page);
  const after = await hold(page, 'w', 3);
  expect(after.z).toBeGreaterThan(before.z + 2.5);
});

test('buildings are solid: you stop at the Boger facade', async ({ page }) => {
  const boger = byId(stops, 'boger');
  await open(page, `z=${boger.zc}&x=0`);
  const end = await hold(page, 'd', 40); // D = screen-right = toward the row at the start
  expect(end.x).toBeCloseTo(boger.front + 0.8, 3);
});

test('you can walk through a walkway onto Andrus Field', async ({ page }) => {
  const c = crossings[1];
  await open(page, `z=${c.z}&x=-10`);
  const end = await hold(page, 'd', 12);
  expect(end.x).toBeLessThan(stops[0].front - 1); // past the facade line, between buildings
});

test('game time flows on its own, starting mid-afternoon', async ({ page }) => {
  await open(page);
  const h0 = await page.evaluate(() => (window as any).__vora.hour as number);
  expect(h0).toBeGreaterThan(15.4);
  expect(h0).toBeLessThan(16);
  // ~1 game minute per real second (slower if frames are slow — dt is capped per frame)
  await page.waitForFunction((a) => (window as any).__vora.hour > a + 0.02, h0, { timeout: 30_000 });
  await expect(page.locator('#clock')).toContainText('PM');
});

test('tapping the clock skips ahead through the day, and night really is night', async ({ page }) => {
  await open(page);
  const clock = page.locator('#clock');
  const seen: string[] = [];
  for (let i = 0; i < 5; i++) {
    await clock.click();
    const s = await state(page);
    seen.push(s.mode);
    await expect(clock).toContainText(s.mode);
    if (s.mode === 'MIDDAY') expect(s.night).toBe(0);
    if (s.mode === 'NIGHT') expect(s.night).toBe(1);
  }
  expect(seen).toEqual(['GOLDEN', 'SUNSET', 'NIGHT', 'MORNING', 'MIDDAY']);
});

test('?t= freezes the clock (for screenshots)', async ({ page }) => {
  await open(page, 't=17.3');
  const a = await page.evaluate(() => (window as any).__vora.hour as number);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as any).__vora.hour as number)).toBe(a);
  expect(a).toBeCloseTo(17.3, 9);
});

test("tapping a pinned note opens it, and it closes", async ({ page }) => {
  await open(page, 'z=0');
  const benches = await page.evaluate(() => (window as any).__vora.benches as { x: number; z: number }[]);
  await page.goto(`/?intro=0&t=15&x=0&z=${benches[3].z - 8}`);
  await page.waitForFunction(() => (window as any).__vora?.frames > 5);
  const tag = page.locator('.tag.tap', { hasText: 'priya' });
  await expect.poll(async () => Number(await tag.evaluate((el) => getComputedStyle(el).opacity)), { timeout: 10_000 }).toBeGreaterThan(0.5);
  await tag.click();
  await expect(page.locator('#card')).toHaveClass(/show/);
  await expect(page.locator('#card .txt')).toContainText('chapel');
  await page.locator('#card button').click();
  await expect(page.locator('#card')).not.toHaveClass(/show/);
});

test('High Street traffic is moving and the signals cycle', async ({ page }) => {
  await open(page);
  const zs = () => page.evaluate(() => (window as any).__vora.traffic.vehicles.map((v: any) => v.z) as number[]);
  const a = await zs();
  await page.waitForFunction(() => (window as any).__vora.traffic.t > 3, null, { timeout: 30_000 });
  const b = await zs();
  expect(a.filter((z, i) => Math.abs(z - b[i]) > 2).length).toBeGreaterThan(a.length / 2);
  expect(['green', 'yellow', 'red']).toContain((await state(page)).light);
});

test('cars stop for you when you stand in the road', async ({ page }) => {
  const lane = LANES[0];
  await open(page, `t=15&x=${lane.x}&z=-60`);
  for (let i = 0; i < 20; i++) {
    const bad = await page.evaluate(([lx, gap]) => {
      const v = (window as any).__vora;
      return v.traffic.vehicles.filter((c: any) => {
        if (c.lane !== 0) return false;
        const front = c.z + c.len / 2, rear = c.z - c.len / 2;
        return rear < v.pos.z && front > v.pos.z - gap + 0.05 && Math.abs(v.pos.x - lx) < 2;
      }).length;
    }, [lane.x, PED_GAP] as const);
    expect(bad).toBe(0);
    await page.waitForTimeout(500);
  }
});

test('renders in landscape too', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const errors = await open(page, 't=22');
  expect((await state(page)).night).toBe(1);
  expect(await page.evaluate(() => (window as any).__vora.sample())).toBeGreaterThan(10);
  expect(errors).toEqual([]);
});

test('you can walk by dragging anywhere — including bottom-right, where a right thumb rests', async ({ page }) => {
  await open(page);
  const before = await state(page);
  await page.mouse.move(320, 720);
  await page.mouse.down();
  await page.mouse.move(320, 660, { steps: 6 });
  await page.waitForFunction((z0) => (window as any).__vora.pos.z > z0 + 1.5, before.z, { timeout: 20_000 });
  await page.mouse.up();
});

test('dragging the top strip looks around without moving you', async ({ page }) => {
  await open(page);
  const before = await state(page);
  await page.mouse.move(150, 150);
  await page.mouse.down();
  await page.mouse.move(250, 150, { steps: 8 }); // drag right → view turns right
  await page.mouse.up();
  await page.waitForTimeout(200);
  const after = await state(page);
  expect(wrap(after.yaw - before.yaw)).toBeLessThan(-0.3);
  expect(after.z).toBeCloseTo(before.z, 6);
});

test('arrow keys turn the view', async ({ page }) => {
  await open(page);
  const before = await state(page);
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction((y0) => Math.abs(Math.atan2(Math.sin((window as any).__vora.yaw - y0), Math.cos((window as any).__vora.yaw - y0))) > 0.8, before.yaw, { timeout: 20_000 });
  await page.keyboard.up('ArrowLeft');
  const after = await state(page);
  expect(wrap(after.yaw - before.yaw)).toBeGreaterThan(0.8); // left = +yaw
  expect(after.z).toBeCloseTo(before.z, 6);
});

test('walking back the way you came: the view swings round and you walk straight', async ({ page }) => {
  await open(page, 'z=-100');
  const before = await state(page);
  const after = await hold(page, 's', 14);
  expect(after.z).toBeLessThan(before.z - 10); // went back toward −z
  expect(Math.abs(after.x - before.x)).toBeLessThan(0.05); // in a straight line
  expect(Math.abs(wrap(after.yaw - 0))).toBeLessThan(0.6); // camera now looks −z, behind you
});

test('double-tapping the top strip snaps the view back behind you', async ({ page }) => {
  await open(page);
  await page.mouse.move(150, 150);
  await page.mouse.down();
  await page.mouse.move(250, 150, { steps: 8 });
  await page.mouse.up();
  const turned = await state(page);
  expect(Math.abs(wrap(turned.yaw - Math.PI))).toBeGreaterThan(0.3);
  await page.mouse.click(200, 120);
  await page.mouse.click(200, 120);
  // behind you again (you face +z) — applied on the next frame
  await expect.poll(async () => Math.abs(wrap((await state(page)).yaw - Math.PI)), { timeout: 10_000 }).toBeLessThan(0.05);
});
