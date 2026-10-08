// ─── What you should hear, where (pure) ────────────────────────────────
// The always-on beds of sound — birds, crickets, wind, the hum of High
// Street, the murmur of people, room tone indoors, your engine — as target
// loudnesses (0..1) for a moment in the game. audio.ts makes the noise;
// this decides the mix, so it can be tested.

export interface Listen {
  hour: number;
  where: 'out' | 'in' | 'usdan' | 'casper';
  /** metres to the middle of High Street */
  roadDist: number;
  /** vehicles on High Street within 40 m, weighted closer = more */
  traffic: number;
  /** people within ~15 m of you */
  people: number;
  /** in a car: its speed (m/s, signed); null on foot */
  car: number | null;
  /** your car's gas pedal, 0..1 */
  gas: number;
  surface: 'tar' | 'paving' | 'grass';
  skidding: boolean;
}

export interface Mix {
  birds: number;
  crickets: number;
  wind: number;
  road: number;
  crowd: number;
  room: number;
  engine: number;
  /** engine pitch, Hz */
  rpm: number;
  tyres: number;
  /** tyre noise filter centre, Hz: grass and gravel are lower and rougher than tar */
  tyreTone: number;
  skid: number;
}

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** 0 at night … 1 in the day, with a soft dawn and dusk. */
export const daylight = (h: number) => smooth(5.5, 7, h) * (1 - smooth(19, 20.5, h));

export function mixAt(l: Listen): Mix {
  const day = daylight(l.hour), out = l.where === 'out';
  const near = clamp(1 - l.roadDist / 70) ** 2; // the road fades out over ~70 m
  const indoorsMuffle = out ? 1 : 0.18;
  const rolling = l.car === null ? 0 : Math.abs(l.car);
  return {
    birds: out ? day * 0.45 * (1 - near * 0.6) : 0,
    crickets: out ? (1 - day) * 0.35 : 0,
    wind: out ? 0.14 : 0,
    road: (0.08 + near * 0.32 + clamp(l.traffic) * 0.3) * indoorsMuffle,
    crowd: l.where === 'usdan' || l.where === 'casper' ? 0.32 + clamp(l.people / 20) * 0.2 : out ? clamp(l.people / 12) * 0.28 : clamp(l.people / 6) * 0.12,
    room: out ? 0 : l.where === 'usdan' || l.where === 'casper' ? 0.12 : 0.06,
    engine: l.car === null ? 0 : 0.18 + l.gas * 0.12,
    rpm: 38 + (rolling % 9) * 9 + rolling * 2.2 + l.gas * 14, // climbs, drops a little as it "shifts" every ~9 m/s
    tyres: l.car === null ? 0 : clamp(rolling / 14) * (l.surface === 'tar' ? 0.12 : 0.24),
    tyreTone: l.surface === 'grass' ? 260 : l.surface === 'paving' ? 520 : 900,
    skid: l.skidding && l.surface !== 'grass' ? 0.25 : 0,
  };
}

/** Should a driver who's been held up for `waited` s honk now? First at ~1.5 s, then every few seconds. */
export function honkNow(waited: number, lastHonkAt: number): boolean {
  if (waited < 1.5) return false;
  return lastHonkAt < 0 || waited - lastHonkAt > 3.5;
}

/** How loud a sound at distance `d` metres is (1 at your ear, fading to 0 by `range`). */
export const falloff = (d: number, range = 60) => clamp(1 - d / range) ** 1.6;
