import type { Box, XZ } from './collide';
import type { Crossing } from './layout';

// ─── The burrito truck (pure rules, no three.js) ───────────────────────
// A white food truck parked by the Boger–South walkway, beside Usdan, in
// the daytime. Students line up along the walkway for burritos and
// quesadillas; a cooler of snacks and hot sauce sits on the ground a few
// feet away. Every so often the front of the line gets their food and
// walks off, everyone shuffles up, and someone new joins the back.

export const OPEN = { from: 10.5, to: 15.5 } as const; // game hours
export const isOpen = (hour: number) => hour >= OPEN.from && hour < OPEN.to;

export const LINE = 5; // people in line
export const SERVE_EVERY = 11; // real seconds per order

/**
 * Where the truck goes, from the walkway it parks beside: on the grass on its north side
 * (toward Boger and Usdan), running along it, serving window facing the walkway.
 */
export function truckSpot(walkway: Crossing) {
  const len = 6.4, wid = 2.4;
  const z = walkway.z - walkway.w / 2 - 0.6 - wid / 2; // just off the walkway
  const x = -24;
  const window = { x: x + 0.6, z: z + wid / 2 }; // serving hatch, on the walkway side
  return {
    x, z, len, wid, window,
    /** The cooler of snacks + hot sauce, on the ground a few feet from the cab end. */
    cooler: { x: x + len / 2 + 1.4, z: z + 0.2 },
    /** Where the n-th person in line stands (0 = at the window), facing the front of the line. */
    slot: (i: number): XZ & { heading: number } => ({
      x: window.x + i * 0.95, z: window.z + 0.95,
      heading: i === 0 ? Math.PI : -Math.PI / 2, // first faces the hatch (−z), the rest face up the line (−x)
    }),
    box: { x0: x - len / 2, x1: x + len / 2, z0: z - wid / 2, z1: z + wid / 2 } as Box,
  };
}

export interface Order { t: number; served: number }
export const newOrder = (): Order => ({ t: 0, served: 0 });

/** Tick the line. Returns true when the person at the window just got their food. */
export function stepOrder(o: Order, dt: number, open: boolean): boolean {
  if (!open || !(dt > 0)) return false;
  o.t += dt;
  if (o.t < SERVE_EVERY) return false;
  o.t -= SERVE_EVERY;
  o.served++;
  return true;
}
