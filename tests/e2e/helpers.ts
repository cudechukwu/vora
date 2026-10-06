import { Page, expect, test } from '@playwright/test';
import { ROW_ENTRY, layoutRow } from '../../src/row/layout';
export { expect, test };
export type { Page };
export { ROW_ENTRY, byId, layoutRow } from '../../src/row/layout';
export { DRIVEWAYS, HOME_SPAWN } from '../../src/row/house/plan';
export { LANES, PED_GAP } from '../../src/row/traffic';
export { EXIT_AT } from '../../src/row/house/portal';

// Shared by every browser test file (tests/e2e/*.spec.ts): opening the game, reading its state, holding keys.
// End-to-end: the real page, real WebGL (SwiftShader), real input.
// window.__vora is a read-only debug hook exposed by src/row/main.ts.

export const { stops, crossings } = layoutRow();

/**
 * Open the game. Most tests are about College Row, so unless the query says where to stand (x/z),
 * this starts you at the north end of the walk, looking down the row — pass `home` to start where the
 * game really does: outside your house.
 */
export async function open(page: Page, query = '', home = false) {
  if (!home) {
    if (!/(^|&)x=/.test(query)) query += `&x=${ROW_ENTRY.x}`;
    if (!/(^|&)z=/.test(query)) query += `&z=${ROW_ENTRY.z}`;
  }
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.goto(`/?intro=0&lite=1&${query}`); // lite: no shadows or antialiasing, so tests run faster
  await page.waitForFunction(() => (window as any).__vora?.frames > 5, null, { timeout: 30_000 });
  return errors;
}

export const state = (page: Page) => page.evaluate(() => {
  const v = (window as any).__vora;
  return { x: v.pos.x as number, z: v.pos.z as number, yaw: v.yaw as number, mode: v.mode as string, night: v.night as number, light: v.light as string, frames: v.frames as number };
});

/** Hold a key for roughly `seconds` of *game* time (frames × 50ms cap), so slow CI GPUs don't flake. */
export async function hold(page: Page, key: string, metres: number) {
  const start = await state(page);
  await page.keyboard.down(key);
  // wait until we've moved `metres`, or stopped moving for 8 frames that actually rendered
  // (count frames, not wall-clock time: a loaded machine can render only a few frames a second)
  let last = start, still = 0;
  for (let i = 0; i < 600 && still < 8; i++) {
    await page.waitForTimeout(100);
    const s = await state(page);
    const moved = Math.hypot(s.x - start.x, s.z - start.z);
    if (moved >= metres) break;
    if (s.frames > last.frames) still = Math.hypot(s.x - last.x, s.z - last.z) < 1e-3 ? still + 1 : 0;
    last = s;
  }
  await page.keyboard.up(key);
  return state(page);
}

export const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export const SPAWN_Z = ROW_ENTRY.z;
export const mover = (page: Page) => page.evaluate(() => {
  const v = (window as any).__vora;
  return { mode: v.mover.mode as string, speed: v.mover.speed as number, riding: v.mover.riding as number | null, running: v.running as boolean, action: v.action as string };
});

export const HX0 = 28, HZC = -276;
export const hw = (u: number, v: number) => `x=${HX0 + u}&z=${HZC + v}`;
export const house = (page: Page) => page.evaluate(() => {
  const v = (window as any).__vora;
  return { level: v.level as number, indoors: v.indoors as boolean, where: v.where as string, up: v.upstairsShown as boolean, sitting: v.sitting as string | null, action: v.action as string, hour: v.hour as number };
});

export const drv = (page: Page) => page.evaluate(() => {
  const v = (window as any).__vora;
  const c = v.garage.cars.find((x: any) => x.id === v.driving);
  return { driving: v.driving as number | null, x: v.pos.x as number, z: v.pos.z as number, action: v.action as string, car: c ? { x: c.x, z: c.z, owner: c.owner, stolen: c.stolen } : null };
});

export const sounds = (page: Page) => page.evaluate(() => (window as any).__vora.sound as { started: boolean; muted: boolean; log: string[] });
