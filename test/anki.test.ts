import { describe, expect, it } from 'vitest';
import { readZipEntries, readZipEntry, readAnkiNotes, notesToDeck } from '../src/flashcards/anki.js';

describe('zip parsing', () => {
  it('finds the end-of-central-directory record', () => {
    // A minimal zip with one stored entry. EOCD sits 22 bytes from the end
    // when there is no comment.
    const zip = makeOneEntryZip('hello.txt', 'hi');
    const entries = readZipEntries(zip);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.name).toBe('hello.txt');
    expect(entries[0]?.method).toBe(0);
  });

  it('extracts a stored entry', () => {
    const zip = makeOneEntryZip('hello.txt', 'hi');
    const entries = readZipEntries(zip);
    const bytes = readZipEntry(zip, entries[0]!);
    expect(new TextDecoder().decode(bytes)).toBe('hi');
  });
});

describe('anki notes', () => {
  it('splits \x1f-joined fields into front and back', () => {
    const notes = [{ fields: ['hola', 'hello'], tags: ['spanish'] }];
    const deck = notesToDeck('test', notes);
    expect(deck.cards[0]?.front).toBe('hola');
    expect(deck.cards[0]?.back).toBe('hello');
    expect(deck.cards[0]?.tags).toEqual(['spanish']);
  });
});

/** Build a tiny in-memory zip with one stored (uncompressed) entry. */
function makeOneEntryZip(name: string, body: string): Uint8Array {
  const enc = new TextEncoder();
  const nameBytes = enc.encode(name);
  const bodyBytes = enc.encode(body);
  const crc = crc32(bodyBytes);

  const local = new Uint8Array(30 + nameBytes.length + bodyBytes.length);
  const dv = new DataView(local.buffer);
  dv.setUint32(0, 0x04034b50, true); // local file header signature
  dv.setUint16(4, 20, true); // version needed
  dv.setUint16(6, 0, true); // flags
  dv.setUint16(8, 0, true); // method: stored
  dv.setUint16(10, 0, true); // mod time
  dv.setUint16(12, 0, true); // mod date
  dv.setUint32(14, crc, true);
  dv.setUint32(18, bodyBytes.length, true); // compressed size
  dv.setUint32(22, bodyBytes.length, true); // uncompressed size
  dv.setUint16(26, nameBytes.length, true);
  dv.setUint16(28, 0, true); // extra len
  local.set(nameBytes, 30);
  local.set(bodyBytes, 30 + nameBytes.length);

  const central = new Uint8Array(46 + nameBytes.length);
  const cv = new DataView(central.buffer);
  cv.setUint32(0, 0x02014b50, true); // central directory signature
  cv.setUint16(4, 20, true);
  cv.setUint16(6, 20, true);
  cv.setUint16(8, 0, true);
  cv.setUint16(10, 0, true);
  cv.setUint16(12, 0, true);
  cv.setUint16(14, 0, true);
  cv.setUint32(16, crc, true);
  cv.setUint32(20, bodyBytes.length, true);
  cv.setUint32(24, bodyBytes.length, true);
  cv.setUint16(28, nameBytes.length, true);
  cv.setUint16(30, 0, true);
  cv.setUint16(32, 0, true);
  cv.setUint16(34, 0, true);
  cv.setUint16(36, 0, true);
  cv.setUint32(38, 0, true);
  cv.setUint32(42, 0, true); // local header offset
  central.set(nameBytes, 46);

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, 1, true); // entries on this disk
  ev.setUint16(10, 1, true); // entries total
  ev.setUint32(12, central.length, true);
  ev.setUint32(16, local.length, true); // central directory offset
  ev.setUint16(20, 0, true); // comment len

  const total = local.length + central.length + eocd.length;
  const out = new Uint8Array(total);
  out.set(local, 0);
  out.set(central, local.length);
  out.set(eocd, local.length + central.length);
  return out;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
