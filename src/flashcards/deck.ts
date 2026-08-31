import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import yaml from 'js-yaml';
import type { Deck, SrsState, ReviewCard } from './types.js';
import { freshState } from './srs.js';

export class DeckLoadError extends Error {
  readonly path: string;
  constructor(message: string, path: string) {
    super(`${path}: ${message}`);
    this.path = path;
  }
}

/** Resolve a leading `~` to the user's home directory. */
export function expandHome(p: string): string {
  if (p.startsWith('~/')) return join(homedir(), p.slice(2));
  if (p === '~') return homedir();
  return p;
}

/** The default location for user decks: `~/basa/decks`. */
export function defaultDecksDir(): string {
  return join(homedir(), 'basa', 'decks');
}

/** Find every supported deck file in a directory (non-recursive). */
export async function listDecks(dir: string): Promise<string[]> {
  const path = expandHome(dir);
  if (!existsSync(path)) return [];
  const entries = await readdir(path, { withFileTypes: true });
  return entries
    // `<deck>.yml.progress.json` is SRS state, not a deck — skip it.
    .filter((e) => e.isFile() && /\.(ya?ml|json)$/i.test(e.name) && !e.name.endsWith('.progress.json'))
    .map((e) => join(path, e.name))
    .sort();
}

/**
 * Write a deck to disk as YAML or JSON. Creates parent directories and
 * refuses to clobber an existing file (that's what `createDeck` is for).
 */
export async function saveDeck(path: string, deck: Deck, format: 'yaml' | 'json' = 'yaml'): Promise<string> {
  const file = isAbsolute(path) ? path : expandHome(path);
  const body = format === 'json'
    ? JSON.stringify(deck, null, 2) + '\n'
    : yaml.dump(deck, { lineWidth: 120 });
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, body, 'utf8');
  return file;
}

export async function loadDeck(file: string): Promise<Deck> {
  const path = isAbsolute(file) ? file : expandHome(file);
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    throw new DeckLoadError(
      `cannot read file: ${(err as NodeJS.ErrnoException).message}`,
      path,
    );
  }
  let parsed: unknown;
  const ext = extname(path).toLowerCase();
  try {
    if (ext === '.json') {
      parsed = JSON.parse(raw);
    } else {
      parsed = yaml.load(raw);
    }
  } catch (err) {
    throw new DeckLoadError(
      `parse error: ${(err as Error).message}`,
      path,
    );
  }
  return validateDeck(parsed, path);
}

function validateDeck(value: unknown, path: string): Deck {
  if (value === null || typeof value !== 'object') {
    throw new DeckLoadError('deck must be a mapping (name + cards)', path);
  }
  const obj = value as Record<string, unknown>;
  if (typeof obj.name !== 'string' || obj.name.length === 0) {
    throw new DeckLoadError('deck.name must be a non-empty string', path);
  }
  if (!Array.isArray(obj.cards)) {
    throw new DeckLoadError('deck.cards must be an array', path);
  }
  const cards = obj.cards.map((c, i) => validateCard(c, path, i));
  return {
    name: obj.name,
    description: typeof obj.description === 'string' ? obj.description : undefined,
    tags: Array.isArray(obj.tags) ? obj.tags.filter((t): t is string => typeof t === 'string') : undefined,
    cards,
  };
}

function validateCard(value: unknown, path: string, index: number): Deck['cards'][number] {
  if (value === null || typeof value !== 'object') {
    throw new DeckLoadError(`card #${index + 1} must be a mapping`, path);
  }
  const obj = value as Record<string, unknown>;
  if (obj.front === undefined || obj.back === undefined) {
    throw new DeckLoadError(`card #${index + 1} is missing front or back`, path);
  }
  return {
    front: validateSide(obj.front, `card #${index + 1}.front`, path),
    back: validateSide(obj.back, `card #${index + 1}.back`, path),
    tags: Array.isArray(obj.tags) ? obj.tags.filter((t): t is string => typeof t === 'string') : undefined,
    hint: typeof obj.hint === 'string' ? obj.hint : undefined,
  };
}

function validateSide(value: unknown, where: string, path: string): Deck['cards'][number]['front'] {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((f, i) => validateField(f, `${where}[${i}]`, path));
  if (value !== null && typeof value === 'object') {
    return [validateField(value, where, path)];
  }
  throw new DeckLoadError(`${where} must be a string, mapping, or list of fields`, path);
}

function validateField(value: unknown, where: string, path: string): { text?: string; image?: string; audio?: string } {
  if (value === null || typeof value !== 'object') {
    throw new DeckLoadError(`${where} must be a mapping`, path);
  }
  const field = value as Record<string, unknown>;
  const out: { text?: string; image?: string; audio?: string } = {};
  if (typeof field.text === 'string') out.text = field.text;
  if (typeof field.image === 'string') out.image = field.image;
  if (typeof field.audio === 'string') out.audio = field.audio;
  if (out.text === undefined && out.image === undefined && out.audio === undefined) {
    throw new DeckLoadError(`${where} has no text, image, or audio`, path);
  }
  return out;
}

/** Sibling file where SRS state is persisted, keyed by absolute deck path. */
function progressPathFor(deckPath: string): string {
  return `${deckPath}.progress.json`;
}

/** Load SRS state for every card, defaulting to a fresh state. */
export async function loadReviewCards(deck: Deck, deckPath: string): Promise<ReviewCard[]> {
  const path = progressPathFor(deckPath);
  let saved: Record<string, SrsState> = {};
  if (existsSync(path)) {
    try {
      const raw = await readFile(path, 'utf8');
      const parsed = JSON.parse(raw) as { states?: Record<string, SrsState> };
      if (parsed && typeof parsed === 'object' && parsed.states) saved = parsed.states;
    } catch {
      // Corrupt progress file: ignore and start fresh.
    }
  }
  return deck.cards.map((card, i) => {
    const key = String(i);
    const state = saved[key] ?? freshState();
    return { card, state };
  });
}

/** Persist SRS state for every card. Stable across deck reorders by index. */
export async function saveReviewCards(
  deckPath: string,
  cards: readonly ReviewCard[],
): Promise<void> {
  const path = progressPathFor(deckPath);
  const states: Record<string, SrsState> = {};
  cards.forEach((c, i) => {
    states[String(i)] = c.state;
  });
  await writeFile(path, JSON.stringify({ version: 1, states }, null, 2) + '\n', 'utf8');
}

/** Create an empty deck file at the given path. Auto-creates parent directories. */
export async function createDeck(file: string, name: string): Promise<string> {
  const path = isAbsolute(file) ? file : expandHome(file);
  if (existsSync(path)) {
    throw new DeckLoadError('file already exists', path);
  }
  await mkdir(dirname(path), { recursive: true });
  const stub: Deck = {
    name,
    description: 'A new Basa deck.',
    tags: [],
    cards: [
      { front: 'hello', back: 'a greeting' },
      { front: 'thanks', back: 'an expression of gratitude' },
    ],
  };
  if (path.endsWith('.json')) {
    await writeFile(path, JSON.stringify(stub, null, 2) + '\n', 'utf8');
  } else {
    await writeFile(path, yaml.dump(stub, { lineWidth: 120 }), 'utf8');
  }
  return path;
}

/** Resolve a deck name or path. With a `dir`, looks for `dir/<name>.{yml,yaml,json}`. */
export async function resolveDeckPath(dir: string, nameOrPath: string | undefined): Promise<string> {
  if (nameOrPath === undefined) {
    const decks = await listDecks(dir);
    if (decks.length === 0) {
      throw new Error(
        `No decks found in ${expandHome(dir)}. Create one with \`basa new <name>\`.`,
      );
    }
    if (decks.length === 1) return decks[0]!;
    throw new Error(
      `Multiple decks in ${expandHome(dir)} — pass a deck name (e.g. \`basa study ${basename(decks[0]!, extname(decks[0]!))}\`).`,
    );
  }
  // If it's a path that exists, use it directly.
  const direct = isAbsolute(nameOrPath) ? nameOrPath : expandHome(nameOrPath);
  if (existsSync(direct)) return direct;
  // Otherwise try `dir/<name>.{yml,yaml,json}`.
  const base = join(expandHome(dir), nameOrPath);
  for (const ext of ['.yml', '.yaml', '.json']) {
    const candidate = base + ext;
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Deck not found: ${nameOrPath} (looked in ${expandHome(dir)})`);
}

/** A relative `image` or `audio` path is resolved against the deck file's directory. */
export function resolveMediaPath(deckPath: string, ref: string): string {
  if (isAbsolute(ref) || ref.startsWith('~')) return expandHome(ref);
  return resolve(dirname(deckPath), ref);
}
