import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolveMediaPath } from './deck.js';

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']);

/** True if a path looks like a relative/absolute reference to an image file. */
export function isImagePath(ref: string): boolean {
  const lower = ref.toLowerCase();
  for (const ext of IMAGE_EXTS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

export interface RgbaImage {
  width: number;
  height: number;
  /** Row-major RGBA bytes. */
  pixels: Uint8Array;
}

/**
 * Decode an image to raw RGBA at a given pixel size, using ImageMagick if
 * available. The function does NOT throw if the tool is missing or the file
 * is broken — it returns `null` and the caller renders a placeholder.
 */
export async function loadRgba(file: string, width: number, height: number): Promise<RgbaImage | null> {
  if (!existsSync(file)) return null;
  const tool = findMagick();
  if (tool === null) return null;

  return new Promise<RgbaImage | null>((resolve) => {
    const args = [
      tool,
      file,
      '-resize',
      `${Math.max(1, width)}x${Math.max(1, height)}!`,
      '-depth',
      '8',
      'rgba:-',
    ];
    const child = spawn(args[0]!, args.slice(1), { stdio: ['ignore', 'pipe', 'ignore'] });
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;

    const finish = (value: RgbaImage | null) => {
      if (settled) return;
      settled = true;
      child.kill();
      resolve(value);
    };

    child.stdout!.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      total += chunk.length;
    });
    child.on('error', () => finish(null));
    child.on('close', (code) => {
      if (code !== 0) return finish(null);
      if (total !== width * height * 4) return finish(null);
      const buf = Buffer.concat(chunks, total);
      resolve({ width, height, pixels: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) });
    });
  });
}

function findMagick(): string | null {
  for (const candidate of ['magick', 'convert']) {
    if (probeOnPath(candidate)) return candidate;
  }
  return null;
}

function probeOnPath(cmd: string): boolean {
  const path = process.env.PATH ?? '';
  for (const dir of path.split(':')) {
    if (dir.length === 0) continue;
    if (existsSync(`${dir}/${cmd}`)) return true;
  }
  return false;
}

/** Auto-detect whether a `Side` is "complex enough" that image rendering helps. */
export function isLikelyComplexScript(text: string): boolean {
  // CJK, Hangul, Hiragana/Katakana, Devanagari, Arabic, Hebrew, Thai, Tibetan.
  // The user is learning one of these alphabets → render the card as an image
  // so the terminal fonts don't fight us. (This requires the user to supply
  // a font-rendered PNG of the text; the renderer falls back to plain text.)
  return /[\u3000-\u9fff\uac00-\ud7af\u0900-\u097f\u0600-\u06ff\u0590-\u05ff\u0e00-\u0e7f\u0f00-\u0fff]/.test(text);
}

/** Resolve a media reference against the deck file's directory. */
export function resolveDeckMedia(deckPath: string, ref: string): string {
  return resolveMediaPath(deckPath, ref);
}
