import { describe, expect, it } from 'vitest';
import { SPOT_TTL, SavedSpot, loadSpot, saveSpot } from '../../src/row/save';

const now = 1_800_000_000_000;
const spot: SavedSpot = { where: 'usdan', x: -80.123, z: -203.456, heading: 1.2345, level: 0, at: now - 5000 };

describe('remembering where you were', () => {
  it('saves and loads your spot (rounded)', () => {
    const back = loadSpot(saveSpot(spot), now)!;
    expect(back.where).toBe('usdan');
    expect(back.x).toBeCloseTo(-80.12, 2);
    expect(back.z).toBeCloseTo(-203.46, 2);
    expect(back.heading).toBeCloseTo(1.2345, 3);
    expect(back.level).toBe(0);
  });

  it('upstairs at home too', () => {
    expect(loadSpot(saveSpot({ ...spot, where: 'in', level: 1 }), now)?.level).toBe(1);
  });

  it('nothing saved, junk, a bad place or numbers → start fresh', () => {
    for (const raw of [null, '', '{', 'null', '{"where":"moon","x":0,"z":0,"heading":0,"level":0,"at":1}',
      JSON.stringify({ ...spot, x: 'a' }), JSON.stringify({ ...spot, level: 3 }), JSON.stringify({ ...spot, z: NaN })]) {
      expect(loadSpot(raw, now)).toBeNull();
    }
  });

  it('too old (a new visit) → start fresh outside your house', () => {
    expect(loadSpot(saveSpot({ ...spot, at: now - SPOT_TTL - 1 }), now)).toBeNull();
    expect(loadSpot(saveSpot({ ...spot, at: now - SPOT_TTL + 60_000 }), now)).not.toBeNull();
  });

  it('out of the world → start fresh', () => {
    expect(loadSpot(saveSpot({ ...spot, x: -5000 }), now)).toBeNull();
    expect(loadSpot(saveSpot({ ...spot, z: 9999 }), now)).toBeNull();
  });

  it('the caller can veto a spot it can\'t stand on', () => {
    expect(loadSpot(saveSpot(spot), now, () => false)).toBeNull();
  });
});
