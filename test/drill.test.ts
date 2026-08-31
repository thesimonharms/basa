import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudyApp } from '../src/tui/StudyApp.js';
import { freshState, grade } from '../src/flashcards/srs.js';
import type { BasaFx } from '../src/flashcards/sound.js';
import type { Deck, ReviewCard } from '../src/flashcards/types.js';

/** Minimal fx stand-in: BasaFx without an audio backend. */
function silentFx(): BasaFx {
  return { isLive: false, detection: null } as unknown as BasaFx;
}

function stubDeck(name: string): Deck {
  return {
    name,
    cards: [
      { front: 'a', back: 'A' },
      { front: 'b', back: 'B' },
    ],
  };
}

function stubCards(deck: Deck): ReviewCard[] {
  return deck.cards.map((card) => ({ card, state: freshState() }));
}

describe('drill mode', () => {
  it('persists nothing, even after grading every card', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'basa-drill-'));
    const deckPath = join(dir, 'deck.yml');
    try {
      await writeFile(
        deckPath,
        'name: drill\ncards:\n  - front: a\n    back: A\n  - front: b\n    back: B\n',
        'utf8',
      );
      const deck: Deck = stubDeck('drill');
      const cards = stubCards(deck);

      const app = new StudyApp({
        deck,
        deckPath,
        cards,
        width: 80,
        height: 24,
        fx: silentFx(),
        drill: true,
      });

      // Grade everything "Good" — a normal session would persist this.
      for (let i = 0; i < cards.length; i++) {
        const idx = app.cards.findIndex((rc) => rc === cards[i]);
        if (idx >= 0) app.cards[idx] = { ...cards[idx]!, state: grade(cards[idx]!.state, 2, 1_000 + i) };
      }
      await app.persist();

      const progressPath = `${deckPath}.progress.json`;
      await expect(access(progressPath)).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('a normal (non-drill) session does persist', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'basa-drill-'));
    const deckPath = join(dir, 'deck.yml');
    try {
      await writeFile(
        deckPath,
        'name: normal\ncards:\n  - front: a\n    back: A\n',
        'utf8',
      );
      const deck: Deck = stubDeck('normal');
      const cards = stubCards(deck);

      const app = new StudyApp({
        deck,
        deckPath,
        cards,
        width: 80,
        height: 24,
        fx: silentFx(),
      });

      app.cards[0] = { ...app.cards[0]!, state: grade(app.cards[0]!.state, 2, 1_000) };
      await app.persist();

      const raw = await readFile(`${deckPath}.progress.json`, 'utf8');
      const parsed = JSON.parse(raw) as { states: Record<string, { lastGrade: number }> };
      expect(parsed.states['0']?.lastGrade).toBe(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('fresh state is due immediately with null due', () => {
    const state = freshState();
    expect(state.due).toBeNull();
    expect(state.streak).toBe(0);
    expect(state.ease).toBe(2.5);
  });
});
