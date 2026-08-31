import { describe, expect, it } from 'vitest';
import { sample } from '../src/flashcards/sample.js';

describe('sample', () => {
  const cards = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

  it('returns exactly N distinct cards', () => {
    for (let round = 0; round < 20; round++) {
      const picked = sample(cards, 4);
      expect(picked).toHaveLength(4);
      expect(new Set(picked).size).toBe(4);
      for (const card of picked) expect(cards).toContain(card);
    }
  });

  it('rotates: not always the same first N across rounds', () => {
    const firsts = new Set<string>();
    for (let round = 0; round < 30; round++) {
      const picked = sample(cards, 3);
      firsts.add(picked.join(','));
    }
    // With random sampling, 30 rounds should produce more than one distinct
    // trio. (Deterministic failure mode of the old `slice(0, N)` behavior.)
    expect(firsts.size).toBeGreaterThan(1);
  });

  it('handles N larger than the deck', () => {
    const picked = sample(['x', 'y'], 5);
    expect(picked).toHaveLength(2);
  });

  it('handles empty decks', () => {
    expect(sample([], 3)).toEqual([]);
  });
});
