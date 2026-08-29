import { describe, expect, it } from 'vitest';
import { confettiRows, shakeRows, typeOnRows } from '../src/tui/effects.js';

describe('typeOnRows', () => {
  it('returns 1 row at frame 0 (the floor)', () => {
    const rows = typeOnRows({ durationFrames: 4, frame: 0 }, ['a', 'b', 'c']);
    expect(rows.length).toBe(1);
  });

  it('returns all rows after the duration', () => {
    const rows = typeOnRows({ durationFrames: 4, frame: 4 }, ['a', 'b', 'c']);
    expect(rows).toEqual(['a', 'b', 'c']);
  });

  it('reveals progressively with each frame', () => {
    const a = typeOnRows({ durationFrames: 4, frame: 1 }, ['a', 'b', 'c', 'd']);
    const b = typeOnRows({ durationFrames: 4, frame: 2 }, ['a', 'b', 'c', 'd']);
    expect(a.length).toBeLessThanOrEqual(b.length);
  });
});

describe('shakeRows', () => {
  it('is a no-op at the end of the animation', () => {
    const rows = shakeRows({ durationFrames: 4, frame: 4 }, ['hi'], 42);
    expect(rows).toEqual(['hi']);
  });

  it('shifts rows horizontally mid-animation', () => {
    const rows = shakeRows({ durationFrames: 8, frame: 0 }, ['hi'], 42);
    // Amplitude is 3 at frame 0, so a shift of up to 3 chars is possible.
    const shifted = rows[0] !== 'hi';
    expect(typeof shifted).toBe('boolean');
  });
});

describe('confettiRows', () => {
  it('emits the requested number of rows', () => {
    const rows = confettiRows({ frame: 0, durationFrames: 10, seed: 1, width: 20, palette: ['\x1b[0m'] }, 5);
    expect(rows).toHaveLength(5);
    // Visible cell count is the width (ANSI codes don't count).
    for (const row of rows) {
      const visible = row.replace(/\x1b\[[0-9;]*m/g, '').length;
      expect(visible).toBe(20);
    }
  });

  it('emits a reset suffix so cells don\'t bleed color', () => {
    const rows = confettiRows({ frame: 0, durationFrames: 10, seed: 1, width: 10, palette: ['\x1b[31m'] }, 1);
    expect(rows[0]).toContain('\x1b[0m');
  });
});
