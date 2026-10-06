import type { XZ } from './collide';
import { FIELD_X, ROW_ENTRY, USDAN, byId, layoutRow } from './layout';
import { DOORS } from './usdan/plan';
import { HOME_SPAWN } from './house/plan';
import { FOOTBALL } from './plaza';
import { ALLBRITTON, ALLBRITTON_DOOR, FIELD_ROAD, FRANK, LINK_DOOR, OLIN } from './southend';

// ─── The campus map (pure) ─────────────────────────────────────────────
// Named places you can see on the map — and jump straight to, if you don't
// feel like walking. Each has a spot to land on (outside, on your feet) and
// a way to face. Add buildings here as the world grows.

export interface Place {
  id: string;
  name: string;
  /** where the pin goes on the map */
  pin: XZ;
  /** where you land if you jump there, and which way you face (0 = +z) */
  spawn: XZ & { heading: number };
}

const { stops, crossings } = layoutRow();
const at = (id: Parameters<typeof byId>[1]) => byId(stops, id);
const walkway = crossings[crossings.length - 1]; // Boger–South, by Usdan
const usdanDoor = DOORS.find((d) => d.id === 'walkway')!;
const usdanC = USDAN.reduce((a, p) => ({ x: a.x + p.x / USDAN.length, z: a.z + p.z / USDAN.length }), { x: 0, z: 0 });

export const PLACES: Place[] = [
  { id: 'home', name: 'Your house', pin: { x: HOME_SPAWN.x + 12, z: HOME_SPAWN.z }, spawn: { ...HOME_SPAWN } },
  { id: 'usdan', name: 'Usdan', pin: usdanC, spawn: { x: usdanDoor.x + usdanDoor.nx * 7, z: usdanDoor.z + usdanDoor.nz * 7, heading: Math.PI } },
  { id: 'boger', name: 'Boger Hall', pin: { x: at('boger').front - 9, z: at('boger').zc }, spawn: { ...ROW_ENTRY, heading: 0 } },
  { id: 'plaza', name: 'The plaza', pin: { x: -49, z: -222 }, spawn: { x: -55, z: -184, heading: Math.PI } },
  { id: 'south', name: 'South College', pin: { x: at('south').front - 8, z: at('south').zc }, spawn: { x: -1.2, z: at('south').doorZ, heading: 0 } },
  { id: 'north', name: 'North College', pin: { x: at('north').front - 9, z: at('north').zc }, spawn: { x: -1.2, z: at('north').doorZ, heading: 0 } },
  { id: 'chapel', name: 'Memorial Chapel', pin: { x: at('chapel').front - 16, z: at('chapel').zc }, spawn: { x: -1.2, z: at('chapel').doorZ, heading: 0 } },
  { id: 'judd', name: 'Judd Hall', pin: { x: at('judd').front - 9, z: at('judd').zc }, spawn: { x: -1.2, z: at('judd').doorZ, heading: 0 } },
  { id: 'allbritton', name: 'Allbritton', pin: { x: (ALLBRITTON.x0 + ALLBRITTON.x1) / 2, z: (ALLBRITTON.z0 + ALLBRITTON.z1) / 2 }, spawn: { x: ALLBRITTON_DOOR.x - 2, z: ALLBRITTON.z0 - 5, heading: 0 } },
  { id: 'field', name: 'Andrus Field', pin: { x: FIELD_X - 30, z: FOOTBALL.z }, spawn: { x: FIELD_X - 12, z: at('north').zc, heading: -Math.PI / 2 } },
  { id: 'frank', name: 'Frank Center', pin: { x: (FRANK.x0 + FRANK.x1) / 2, z: (FRANK.z0 + FRANK.z1) / 2 }, spawn: { x: LINK_DOOR.x, z: FIELD_ROAD.z1 - 1.5, heading: 0 } },
  { id: 'olin', name: 'Olin Library', pin: { x: OLIN.cx, z: OLIN.cz + 6 }, spawn: { x: OLIN.cx, z: FIELD_ROAD.z0 + 1.5, heading: 0 } },
  { id: 'walkway', name: 'Burrito truck', pin: { x: -22, z: walkway.z - 3 }, spawn: { x: -14, z: walkway.z, heading: -Math.PI / 2 } },
];

/** The map's view: what part of the world it shows, and how big. North (−z) is up, east (+x) right. */
export interface View { cx: number; cz: number; scale: number; w: number; h: number }

/** World → map pixels. */
export const toMap = (v: View, p: XZ) => ({ x: v.w / 2 + (p.x - v.cx) * v.scale, y: v.h / 2 + (p.z - v.cz) * v.scale });
/** Map pixels → world. */
export const toWorldXZ = (v: View, m: { x: number; y: number }): XZ => ({ x: v.cx + (m.x - v.w / 2) / v.scale, z: v.cz + (m.y - v.h / 2) / v.scale });

/** A view that fits the whole campus (all the places, with a margin) into w × h. */
export function fitAll(w: number, h: number, margin = 30): View {
  const xs = PLACES.flatMap((p) => [p.pin.x, p.spawn.x]), zs = PLACES.flatMap((p) => [p.pin.z, p.spawn.z]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const scale = Math.min((w - margin * 2) / (x1 - x0), (h - margin * 2) / (z1 - z0));
  return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, scale, w, h };
}

/** The place whose pin is nearest a tap (within `reach` map pixels), if any. */
export function placeAt(v: View, tap: { x: number; y: number }, reach = 26): Place | null {
  let best: Place | null = null, bd = reach;
  for (const p of PLACES) {
    const m = toMap(v, p.pin), d = Math.hypot(m.x - tap.x, m.y - tap.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
