import { describe, expect, it } from 'vitest';
import { normalizeAnswer, isExactMatch, isFuzzyMatch } from '../src/flashcards/match.js';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadDeck, saveDeck } from '../src/flashcards/deck.js';

describe('tag management', () => {
  it('adds and removes deck-level tags round-trip through the file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'basa-tags-'));
    const file = join(dir, 'tagged.yml');
    try {
      await writeFile(
        file,
        'name: tagged\ntags: [spanish, verbs]\ncards:\n  - front: hola\n    back: hello\n',
        'utf8',
      );
      const deck = await loadDeck(file);
      expect(deck.tags).toEqual(['spanish', 'verbs']);

      deck.tags = (deck.tags ?? []).filter((t) => t !== 'spanish');
      await saveDeck(file, deck, 'yaml');
      const reloaded = await loadDeck(file);
      expect(reloaded.tags).toEqual(['verbs']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('filters cards by tag', () => {
    const cards = [
      { front: 'hola', back: 'hello', tags: ['spanish'] },
      { front: 'bonjour', back: 'hello', tags: ['french'] },
    ];
    const spanish = cards.filter((c) => c.tags?.includes('spanish') === true);
    expect(spanish).toHaveLength(1);
    expect(spanish[0]?.front).toBe('hola');
  });
});

describe('answer matching (used by tag-aware typed mode)', () => {
  it('normalizes accents and case', () => {
    expect(normalizeAnswer('  Héllo,  Wörld!  ')).toBe('hello world');
    expect(isExactMatch('Héllo', 'hello')).toBe(true);
  });

  it('accepts one-edit typos for long answers only', () => {
    expect(isFuzzyMatch('gracias', 'gracais')).toBe(true);
    expect(isFuzzyMatch('sí', 'si')).toBe(false);
  });
});
