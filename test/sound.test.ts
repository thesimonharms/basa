import { describe, expect, it } from 'vitest';
import { BasaFx } from '../src/flashcards/sound.js';

describe('BasaFx', () => {
  it('opens without error even with no audio backend available', async () => {
    const fx = await BasaFx.open();
    expect(typeof fx.isLive).toBe('boolean');
    await fx.dispose();
  });

  it('isLive is false in CI environments', async () => {
    const fx = await BasaFx.open();
    if (process.env.CI !== undefined) {
      expect(fx.isLive).toBe(false);
    }
    await fx.dispose();
  });

  it('playCorrect and playIncorrect are no-ops on silent instance', async () => {
    const fx = await BasaFx.open();
    // Both must not throw regardless of backend availability.
    await fx.playCorrect(2);
    await fx.playCorrect(3);
    await fx.playIncorrect();
    await fx.dispose();
  });
});
