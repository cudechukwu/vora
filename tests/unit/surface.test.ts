import { describe, expect, it } from 'vitest';
import { leavesMark, surfaceAt } from '../../src/row/surface';
import { BACK_PATH, FIELD_X, PLAZA, ROAD, layoutRow } from '../../src/row/layout';
import { drivewaySpot } from '../../src/row/cars';
import { JUMP_V, airborne, newJump, newMover, startJump, stepJump } from '../../src/row/mobility';

const { crossings } = layoutRow();

describe('what\'s under your wheels', () => {
  it('High Street and the back path are tar; the walk, plaza, walkways and driveway are paving; the field and lawns are grass', () => {
    expect(surfaceAt({ x: (ROAD.x0 + ROAD.x1) / 2, z: -100 }, crossings)).toBe('tar');
    expect(surfaceAt({ x: (BACK_PATH.x0 + BACK_PATH.x1) / 2, z: -100 }, crossings)).toBe('tar');
    expect(surfaceAt({ x: 0, z: -100 }, crossings)).toBe('paving');
    expect(surfaceAt({ x: (PLAZA.x0 + PLAZA.x1) / 2, z: -200 }, crossings)).toBe('paving');
    expect(surfaceAt({ x: -30, z: crossings[0].z }, crossings)).toBe('paving');
    expect(surfaceAt(drivewaySpot('you'), crossings)).toBe('paving');
    expect(surfaceAt({ x: FIELD_X - 30, z: -60 }, crossings)).toBe('grass');
    expect(surfaceAt({ x: -8, z: -100 }, crossings)).toBe('grass'); // the lawn in front of the row
  });

  it('grass always takes marks; tar only when you skid', () => {
    expect(leavesMark('grass', 3, 0, false)).toBe(true);
    expect(leavesMark('grass', 0.2, 0, false)).toBe(false); // barely moving
    expect(leavesMark('tar', 15, 0, false)).toBe(false); // cruising
    expect(leavesMark('tar', 15, 1, false)).toBe(true); // hard turn at speed
    expect(leavesMark('tar', 12, 0, true)).toBe(true); // hard braking
  });
});

describe('jumping', () => {
  it('up a little under a metre, and back down in about 0.6s', () => {
    const j = newJump(), m = newMover();
    expect(startJump(j, m)).toBe(true);
    let peak = 0, t = 0;
    while (airborne(j) && t < 3) { stepJump(j, 1 / 60); peak = Math.max(peak, j.y); t += 1 / 60; }
    expect(peak).toBeGreaterThan(0.8);
    expect(peak).toBeLessThan(1.1);
    expect(t).toBeCloseTo((2 * JUMP_V) / 20, 1);
    expect(j.y).toBe(0);
  });

  it('no double jumps, and not on a bike', () => {
    const j = newJump(), m = newMover();
    startJump(j, m);
    stepJump(j, 0.1);
    expect(startJump(j, m)).toBe(false);
    const b = newMover();
    b.mode = 'bike'; b.riding = 0;
    expect(startJump(newJump(), b)).toBe(false);
  });
});
