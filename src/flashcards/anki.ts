import { inflateRawSync } from 'node:zlib';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Deck, Card } from './types.js';

/**
 * Anki `.apkg` import, with no dependencies beyond Node builtins.
 *
 * An `.apkg` is a zip archive containing `collection.anki2` (a SQLite
 * database). We parse the zip central directory by hand, inflate the entry
 * with `node:zlib`, write the collection to a temp file, and read notes
 * through `node:sqlite`.
 */

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

function u16(buf: Uint8Array, off: number): number {
  return buf[off]! | (buf[off + 1]! << 8);
}

function u32(buf: Uint8Array, off: number): number {
  return (buf[off]! | (buf[off + 1]! << 8) | (buf[off + 2]! << 16) | (buf[off + 3]! << 24)) >>> 0;
}

/** Find the End Of Central Directory record. Returns -1 if absent. */
function findEocd(buf: Uint8Array): number {
  const min = Math.max(0, buf.length - 22 - 65_536);
  for (let i = buf.length - 22; i >= min; i--) {
    if (u32(buf, i) === EOCD_SIG && buf.length - i >= 22) return i;
  }
  return -1;
}

/** Parse the central directory of a zip held in memory. */
export function readZipEntries(buf: Uint8Array): ZipEntry[] {
  const eocd = findEocd(buf);
  if (eocd < 0) throw new Error('not a zip file (no end-of-central-directory)');
  const count = u16(buf, eocd + 10);
  let off = u32(buf, eocd + 16); // central directory offset
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (u32(buf, off) !== CEN_SIG) throw new Error('corrupt zip central directory');
    const method = u16(buf, off + 10);
    const compressedSize = u32(buf, off + 20);
    const nameLen = u16(buf, off + 28);
    const extraLen = u16(buf, off + 30);
    const commentLen = u16(buf, off + 32);
    const localHeaderOffset = u32(buf, off + 42);
    const name = new TextDecoder().decode(buf.subarray(off + 46, off + 46 + nameLen));
    entries.push({ name, method, compressedSize, localHeaderOffset });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Extract one entry's bytes (stored or deflate). */
export function readZipEntry(buf: Uint8Array, entry: ZipEntry): Uint8Array {
  const lo = entry.localHeaderOffset;
  if (u32(buf, lo) !== LOC_SIG) throw new Error('corrupt zip local header');
  const nameLen = u16(buf, lo + 26);
  const extraLen = u16(buf, lo + 28);
  const dataStart = lo + 30 + nameLen + extraLen;
  const raw = buf.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return raw;
  if (entry.method === 8) return inflateRawSync(raw);
  throw new Error(`unsupported zip compression method: ${entry.method}`);
}

export interface AnkiNote {
  /** Fields joined by \x1f, as Anki stores them. */
  fields: string[];
  tags: string[];
}

/** Read all notes from an extracted `.anki2` database file. */
export function readAnkiNotes(dbPath: string): AnkiNote[] {
  const db = new DatabaseSync(dbPath);
  try {
    // Field count comes from the model definition; fall back to the row.
    const models = db.prepare('SELECT models FROM col').get() as { models: string } | undefined;
    let fieldCount = 1;
    if (models !== undefined) {
      const parsed: Array<{ flds: string; id: number }> = JSON.parse(models.models);
      const first = parsed[0];
      if (first !== undefined) fieldCount = first.flds.split('\x1f').length;
    }

    const rows = db.prepare('SELECT flds, tags FROM notes').all() as Array<{
      flds: string;
      tags: string | null;
    }>;
    return rows.map((row) => ({
      fields: splitAnkiFields(row.flds, fieldCount),
      tags: row.tags === null ? [] : row.tags.split(/\s+/).filter((t) => t.length > 0),
    }));
  } finally {
    db.close();
  }
}

/** Split Anki's \x1f-joined field string, padding to `fieldCount`. */
function splitAnkiFields(flds: string, fieldCount: number): string[] {
  const parts = flds.split('\x1f');
  while (parts.length < fieldCount) parts.push('');
  return parts;
}

/** Convert Anki notes to a Basa deck: field 0 is the front, field 1 the back. */
export function notesToDeck(name: string, notes: AnkiNote[], description?: string): Deck {
  const cards: Card[] = notes.map((note) => ({
    front: note.fields[0] ?? '',
    back: note.fields[1] ?? '',
    tags: note.tags,
  }));
  return { name, description, cards };
}

/**
 * Import an `.apkg` file and return a Basa deck. The extracted collection
 * lives only in a temp directory that is removed afterwards.
 */
export async function importApkg(file: string, name?: string): Promise<Deck> {
  const { readFile } = await import('node:fs/promises');
  const zipBuf = new Uint8Array(await readFile(file));
  const entries = readZipEntries(zipBuf);
  const collection = entries.find((e) => e.name === 'collection.anki2');
  if (collection === undefined) {
    throw new Error(`${file}: no collection.anki2 found (is this an Anki export?)`);
  }
  const dbBytes = readZipEntry(zipBuf, collection);
  const dir = await mkdtemp(join(tmpdir(), 'basa-anki-'));
  try {
    const dbPath = join(dir, 'collection.anki2');
    await writeFile(dbPath, dbBytes);
    const notes = readAnkiNotes(dbPath);
    return notesToDeck(name ?? 'imported', notes);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
