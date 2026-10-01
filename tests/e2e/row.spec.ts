import { Page, expect, test } from '@playwright/test';
import { byId, layoutRow } from '../../src/row/layout';
import { LANES, PED_GAP } from '../../src/row/traffic';
import { EXIT_AT } from '../../src/row/house/portal';
import { DRIVEWAYS } from '../../src/row/house/plan';

// End-to-end: the real page, real WebGL (SwiftShader), real input.
// window.__vora is a read-only debug hook exposed by src/row/main.ts.

const { stops, crossings } = layoutRow();

async function open(page: Page, query = '') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.goto(`/row.html?intro=0&${query}`);
  await page.waitForFunction(() => (window as any).__vora?.frames > 5, null, { timeout: 30_000 });
  return errors;
}

const state = (page: Page) => page.evaluate(() => {
  const v = (window as any).__vora;
  return { x: v.pos.x as number, z: v.pos.z as number, yaw: v.yaw as number, mode: v.mode as string, night: v.night as number, light: v.light as string, frames: v.frames as number };
});

/** Hold a key for roughly `seconds` of *game* time (frames × 50ms cap), so slow CI GPUs don't flake. */
async function hold(page: Page, key: string, metres: number) {
  const start = await state(page);
  await page.keyboard.down(key);
  // 4 m/s; wait until we've moved `metres` or stopped changing for a while
  let last = start, still = 0;
  for (let i = 0; i < 400 && still < 8; i++) {
    await page.waitForTimeout(100);
    const s = await state(page);
    const moved = Math.hypot(s.x - start.x, s.z - start.z);
    if (moved >= metres) break;
    still = Math.hypot(s.x - last.x, s.z - last.z) < 1e-3 ? still + 1 : 0;
    last = s;
  }
  await page.keyboard.up(key);
  return state(page);
}

test('boots cleanly and draws a real scene', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('#hud')).toHaveClass(/show/);
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 5000 });
  const colours = await page.evaluate(() => (window as any).__vora.sample());
  expect(colours).toBeGreaterThan(25);
  await expect(page.locator('#presence')).toContainText('on the row');
  // nobody touched anything: you're exactly where you spawned (regression: a negative first frame once slid you backwards)
  const s = await state(page);
  expect(s.z).toBe(byId(stops, 'usdan').z1 - 8);
  expect(s.x).toBe(-0.6);
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

test('keyboard walks too (W forward)', async ({ page }) => {
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
  await page.goto(`/row.html?intro=0&t=15&x=0&z=${benches[3].z - 8}`);
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

test('the original Foss Hill greybox still boots', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveCount(1, { timeout: 15_000 });
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

test('you can walk by dragging anywhere — including bottom-right, where a right thumb rests', async ({ page }) => {
  await open(page);
  const before = await state(page);
  await page.mouse.move(320, 720);
  await page.mouse.down();
  await page.mouse.move(320, 660, { steps: 6 });
  await page.waitForFunction((z0) => (window as any).__vora.pos.z > z0 + 1.5, before.z, { timeout: 20_000 });
  await page.mouse.up();
});

/** Centre of the look button. */
async function lookButton(page: Page) {
  const b = (await page.locator('#look').boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

test('dragging the look button looks around without moving you', async ({ page }) => {
  await open(page);
  await expect(page.locator('#look')).toBeVisible();
  const before = await state(page);
  const c = await lookButton(page);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x - 90, c.y, { steps: 8 }); // drag left → view turns left (keeps working off the button)
  await page.mouse.up();
  await page.waitForTimeout(200);
  const after = await state(page);
  expect(wrap(after.yaw - before.yaw)).toBeGreaterThan(0.3);
  expect(after.x).toBeCloseTo(before.x, 6);
  expect(after.z).toBeCloseTo(before.z, 6);
});

test('tapping the look button looks behind you', async ({ page }) => {
  await open(page);
  const before = await state(page);
  const c = await lookButton(page);
  await page.mouse.click(c.x, c.y);
  await expect.poll(async () => Math.abs(wrap((await state(page)).yaw - before.yaw - Math.PI)), { timeout: 10_000 }).toBeLessThan(0.02);
  const after = await state(page);
  expect(after.z).toBeCloseTo(before.z, 6);
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

// ── getting around ──
const SPAWN_Z = byId(stops, 'usdan').z1 - 8;
const mover = (page: Page) => page.evaluate(() => {
  const v = (window as any).__vora;
  return { mode: v.mover.mode as string, speed: v.mover.speed as number, riding: v.mover.riding as number | null, running: v.running as boolean, action: v.action as string };
});

test('keep the stick pushed and you break into a run', async ({ page }) => {
  await open(page);
  await page.keyboard.down('w');
  await page.waitForFunction(() => (window as any).__vora.running, null, { timeout: 45_000 });
  await page.waitForFunction(() => (window as any).__vora.mover.speed > 5, null, { timeout: 20_000 });
  await page.keyboard.up('w');
  await page.waitForFunction(() => !(window as any).__vora.running && (window as any).__vora.mover.speed === 0, null, { timeout: 20_000 });
});

test('a Ride button appears next to the rack by the start, and F gets you on a bike', async ({ page }) => {
  await open(page, `x=-2.4&z=${SPAWN_Z + 5}`);
  const act = page.locator('#act');
  await expect(act).toHaveClass(/show/);
  await expect(act).toContainText('Ride');
  await page.keyboard.press('f');
  await expect.poll(async () => (await mover(page)).mode).toMatch(/bike|scooter/);
  await expect(act).toContainText(/Park in rack|Get off/);
});

test('riding is much faster than walking, and you can leave it anywhere', async ({ page }) => {
  await open(page, `x=-2.4&z=${SPAWN_Z + 3.5}`);
  await expect(page.locator('#act')).toContainText('🚲');
  await page.locator('#act').click(); // tap the button like a thumb would
  await expect.poll(async () => (await mover(page)).mode).toBe('bike');
  await page.keyboard.down('w');
  await page.waitForFunction(() => (window as any).__vora.mover.speed > 9, null, { timeout: 45_000 });
  await page.keyboard.up('w');
  await page.waitForFunction(() => (window as any).__vora.mover.speed === 0, null, { timeout: 20_000 });
  const m = await mover(page);
  const bikeId = m.riding!;
  const at = await state(page);
  await expect(page.locator('#act')).toContainText('Get off');
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
  await expect(page.locator('#act')).toContainText('Park in rack');
  await page.keyboard.press('f');
  await expect.poll(async () => (await mover(page)).mode).toBe('foot');
  const v = await page.evaluate((i) => (window as any).__vora.mob.rideables[i], id);
  expect(v.rack).toBe(0);
});

// ── your house ──
const HX0 = 28, HZC = -276;
const hw = (u: number, v: number) => `x=${HX0 + u}&z=${HZC + v}`;
const house = (page: Page) => page.evaluate(() => {
  const v = (window as any).__vora;
  return { level: v.level as number, indoors: v.indoors as boolean, where: v.where as string, up: v.upstairsShown as boolean, sitting: v.sitting as string | null, action: v.action as string, hour: v.hour as number };
});

test('walk in the front door: you are taken into the house, its own world', async ({ page }) => {
  const errors = await open(page, `t=12&${hw(-2, 4)}&yaw=${-Math.PI / 2}`);
  expect((await house(page)).where).toBe('out');
  await page.keyboard.down('w');
  await page.waitForFunction(() => (window as any).__vora.where === 'in', null, { timeout: 45_000 });
  await page.keyboard.up('w');
  const h = await house(page);
  expect(h.indoors).toBe(true);
  expect(h.up).toBe(false); // downstairs: the upstairs is hidden so you can see the room
  await expect(page.locator('#act')).toContainText('Go outside');
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
  await expect(page.locator('#act')).toContainText('Go inside');
  await page.locator('#act').click();
  await expect.poll(async () => (await house(page)).where).toBe('in');
  await expect(page.locator('#act')).toContainText('Go outside');
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
  await expect(page.locator('#act')).toContainText('Sit');
  await page.keyboard.press('f');
  await expect.poll(async () => (await house(page)).sitting).toMatch(/^couch/);
  await expect(page.locator('#act')).toContainText('Get up');
  await page.keyboard.press('f');
  await expect.poll(async () => (await house(page)).sitting).toBeNull();
});

test('sleep in your bed and wake up in the morning', async ({ page }) => {
  await open(page, `t=23&${hw(2.5, -7.0)}&yaw=0&level=1`);
  await expect.poll(async () => (await house(page)).action).toBe('sleep');
  await page.keyboard.press('f');
  await expect.poll(async () => (await house(page)).hour, { timeout: 10_000 }).toBeCloseTo(7.5, 1);
});

test('roommates are on the couch at night, and their name tags only show on your floor', async ({ page }) => {
  await open(page, `t=21.5&${hw(5, -1.5)}&yaw=0`);
  const onCouch = await page.evaluate(() => (window as any).__vora.roommates.list.filter((m: any) => m.target.id.startsWith('couch') && m.arrived).length);
  expect(onCouch).toBeGreaterThanOrEqual(3);
  const visibleTags = () => page.evaluate(() => [...document.querySelectorAll('.tag')].filter((t) => t.textContent!.includes('roommate') && Number((t as HTMLElement).style.opacity) > 0.3).length);
  await expect.poll(visibleTags).toBeGreaterThanOrEqual(3);
  // upstairs, the people on the couch below aren't tagged through the floor
  await page.goto(`/row.html?intro=0&t=21.5&${hw(2.5, -2.5)}&yaw=0&level=1`);
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

// ── cars: yours, kofi's, and whatever you take off High Street ──

const drv = (page: Page) => page.evaluate(() => {
  const v = (window as any).__vora;
  const c = v.garage.cars.find((x: any) => x.id === v.driving);
  return { driving: v.driving as number | null, x: v.pos.x as number, z: v.pos.z as number, action: v.action as string, car: c ? { x: c.x, z: c.z, owner: c.owner, stolen: c.stolen } : null };
});

test('your car is in your driveway: Drive, go, get out', async ({ page }) => {
  const errors = await open(page, `${hw(5, -12.8 + 2.4)}&yaw=${-Math.PI / 2}`); // beside it, driver's side
  await expect(page.locator('#act')).toContainText('Drive');
  await page.keyboard.press('f');
  await expect.poll(async () => (await drv(page)).driving).toBe(0);
  const start = await drv(page);
  expect(start.car!.stolen).toBe(false);
  await expect(page.locator('#act')).toContainText('Get out');
  // looking at the house (+x), S backs you toward High Street: out of the driveway, nose first
  await page.keyboard.down('s');
  await page.waitForFunction((x) => (window as any).__vora.pos.x < x, start.x - 5, { timeout: 45_000 });
  await page.keyboard.up('s');
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
  const blocked = await page.evaluate((drives) => {
    const v = (window as any).__vora;
    return drives.filter((d: any) => v.obstacles.some((b: any) => b.x1 > 20 && b.x0 < d.x1 && b.z1 > d.z0 - 1 && b.z0 < d.z1 + 1));
  }, DRIVEWAYS.map((d) => ({ x1: HX0 + d.u1, z0: HZC + d.v0, z1: HZC + d.v1 })));
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
  await expect(page.locator('#act')).toContainText("Steal kofi's car");
  await page.keyboard.press('f');
  await expect.poll(async () => (await drv(page)).car?.stolen).toBe(true);
  await expect(page.locator('#toast')).toContainText("kofi's car");
  const start = await drv(page);
  await page.keyboard.down('s');
  await page.waitForFunction((x) => (window as any).__vora.pos.x < x, start.x - 5, { timeout: 45_000 });
  await page.keyboard.up('s');
  await page.keyboard.press('f');
  await expect.poll(async () => (await drv(page)).driving).toBeNull();
  // go home (teleport to the porch, as the walk is covered elsewhere) and in
  await page.evaluate(([x, z]) => (window as any).__vora.pos.set(x, 0, z), [HX0 - 1.3, HZC + 4]);
  await expect(page.locator('#act')).toContainText('Go inside');
  await page.keyboard.press('f');
  await expect.poll(() => page.locator('.tag.say').allTextContents().then((t) => t.join(' ')), { timeout: 10_000 }).toMatch(/car/);
});

test('carjack: step out in front of a car, it stops, you pull the driver out and drive off in it', async ({ page }) => {
  const errors = await open(page, `x=${LANES[0].x}&z=-200`); // standing in the near lane
  await page.waitForFunction(() => (window as any).__vora.action.startsWith('jack-'), null, { timeout: 50_000 });
  const before = await page.evaluate(() => {
    const v = (window as any).__vora;
    const car = v.traffic.vehicles.find((x: any) => `jack-${x.id}` === v.action);
    return { color: car.color as number, n: v.traffic.vehicles.length as number };
  });
  await expect(page.locator('#act')).toContainText('Carjack');
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
  await expect(page.locator('#toast')).toContainText('carjacked');
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
