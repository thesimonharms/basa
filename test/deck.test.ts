import { describe, expect, it } from 'vitest';
import { loadDeck, saveReviewCards, loadReviewCards, createDeck, DeckLoadError, listDecks, defaultDecksDir } from '../src/flashcards/deck.js';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { freshState, grade } from '../src/flashcards/srs.js';

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'basa-test-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('deck loading', () => {
  it('loads a YAML deck with string sides', async () => {
    await withTempDir(async (dir) => {
      const file = join(dir, 'greetings.yml');
      await writeFile(
        file,
        'name: greetings\ncards:\n  - front: hola\n    back: hello\n  - front: adios\n    back: goodbye\n',
        'utf8',
      );
      const deck = await loadDeck(file);
      expect(deck.name).toBe('greetings');
      expect(deck.cards).toHaveLength(2);
      expect(deck.cards[0]?.front).toBe('hola');
      expect(deck.cards[0]?.back).toBe('hello');
    });
  });

  it('loads a JSON deck with field-list sides', async () => {
    await withTempDir(async (dir) => {
      const file = join(dir, 'jp.json');
      await writeFile(
        file,
        JSON.stringify({
          name: 'jp',
          cards: [
            {
              front: [{ text: 'こんにちは' }, { image: './konnichiwa.png' }],
              back: 'hello',
            },
          ],
        }),
        'utf8',
      );
      const deck = await loadDeck(file);
      const first = deck.cards[0];
      expect(Array.isArray(first?.front)).toBe(true);
      const fields = first?.front as Array<Record<string, string>>;
      expect(fields[0]?.text).toBe('こんにちは');
      expect(fields[1]?.image).toBe('./konnichiwa.png');
    });
  });

  it('rejects a deck without a name', async () => {
    await withTempDir(async (dir) => {
      const file = join(dir, 'bad.yml');
      await writeFile(file, 'cards: []\n', 'utf8');
      await expect(loadDeck(file)).rejects.toBeInstanceOf(DeckLoadError);
    });
  });

  it('rejects a card missing back', async () => {
    await withTempDir(async (dir) => {
      const file = join(dir, 'bad.yml');
      await writeFile(file, 'name: x\ncards:\n  - front: hi\n', 'utf8');
      await expect(loadDeck(file)).rejects.toThrow(/missing front or back/);
    });
  });

  it('rejects a field with no text/image/audio', async () => {
    await withTempDir(async (dir) => {
      const file = join(dir, 'bad.json');
      await writeFile(file, JSON.stringify({ name: 'x', cards: [{ front: [{}], back: 'b' }] }), 'utf8');
      await expect(loadDeck(file)).rejects.toThrow(/has no text, image, or audio/);
    });
  });

  it('persists and re-loads SRS state', async () => {
    await withTempDir(async (dir) => {
      const file = join(dir, 'd.yml');
      await writeFile(file, 'name: d\ncards:\n  - front: a\n    back: A\n  - front: b\n    back: B\n', 'utf8');
      const deck = await loadDeck(file);
      const initial = await loadReviewCards(deck, file);
      const reviewed = initial.map((rc, i) => ({
        ...rc,
        state: grade(rc.state, 2 as const, 1_000 + i * 1000),
      }));
      await saveReviewCards(file, reviewed);

      const reloaded = await loadReviewCards(deck, file);
      expect(reloaded[0]?.state.streak).toBe(1);
      expect(reloaded[0]?.state.reviews).toBe(1);
      expect(reloaded[1]?.state.streak).toBe(1);
    });
  });

  it('corrupt progress file is ignored, fresh state returned', async () => {
    await withTempDir(async (dir) => {
      const file = join(dir, 'd.yml');
      await writeFile(file, 'name: d\ncards:\n  - front: a\n    back: A\n', 'utf8');
      const deck = await loadDeck(file);
      await writeFile(`${file}.progress.json`, '{ this is not json');
      const cards = await loadReviewCards(deck, file);
      expect(cards[0]?.state.streak).toBe(0);
    });
  });

  it('createDeck writes a scaffold file', async () => {
    await withTempDir(async (dir) => {
      const file = join(dir, 'new.yml');
      const path = await createDeck(file, 'New Deck');
      expect(path).toBe(file);
      const deck = await loadDeck(file);
      expect(deck.name).toBe('New Deck');
      expect(deck.cards.length).toBeGreaterThan(0);
    });
  });

  it('listDecks finds YAML and JSON files', async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, 'a.yml'), 'name: a\ncards: []\n', 'utf8');
      await writeFile(join(dir, 'b.yaml'), 'name: b\ncards: []\n', 'utf8');
      await writeFile(join(dir, 'c.json'), '{"name":"c","cards":[]}', 'utf8');
      await writeFile(join(dir, 'README.md'), 'ignored', 'utf8');
      const files = await listDecks(dir);
      expect(files).toHaveLength(3);
      expect(files.some((f) => f.endsWith('a.yml'))).toBe(true);
      expect(files.some((f) => f.endsWith('b.yaml'))).toBe(true);
      expect(files.some((f) => f.endsWith('c.json'))).toBe(true);
    });
  });

  it('listDecks skips SRS progress files', async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, 'a.yml'), 'name: a\ncards: []\n', 'utf8');
      await writeFile(join(dir, 'a.yml.progress.json'), '{"version":1,"states":{}}', 'utf8');
      const files = await listDecks(dir);
      expect(files).toHaveLength(1);
      expect(files[0]?.endsWith('a.yml')).toBe(true);
    });
  });
});

describe('defaultDecksDir', () => {
  it('returns a path under the home directory', () => {
    const dir = defaultDecksDir();
    expect(dir).toMatch(/\/basa\/decks$/);
  });
});
