import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import type { Field, Side } from './types.js';
import { isImagePath, loadRgba } from './image.js';
import { halfBlockLines } from './halfblock.js';

export interface RenderContext {
  deckPath: string;
  /** Max width in cells available for the card face. */
  cellsWidth: number;
  /** Max height in cells. */
  cellsHeight: number;
  /** Reused so we don't reload + re-resize the same image every frame. */
  imageCache: Map<string, Promise<string[] | null>>;
}

export interface RenderedSide {
  /** Plain text rows (no images). Always present, useful for animations. */
  text: string[];
  /** Pre-rendered image rows (already half-block ANSI strings). Empty if no images. */
  imageRows: string[];
}

/**
 * Render a `Side` to text + image rows. Text rows are returned synchronously
 * (so card reveals are instant). Image rows resolve asynchronously and
 * populate the cache.
 */
export async function renderSide(side: Side, ctx: RenderContext): Promise<RenderedSide> {
  const fields = normalizeSide(side);
  const textRows: string[] = [];
  const imageRows: string[] = [];

  for (const field of fields) {
    if (field.text !== undefined) {
      for (const row of wrapText(field.text, ctx.cellsWidth)) {
        textRows.push(row);
      }
    }
    if (field.image !== undefined) {
      const rendered = await renderImageField(field.image, ctx);
      if (rendered !== null) {
        // Leave a blank line before an image if we already have text.
        if (textRows.length > 0) textRows.push('');
        imageRows.push(...rendered);
      } else {
        textRows.push(`[image missing: ${field.image}]`);
      }
    }
  }

  return { text: textRows, imageRows };
}

function normalizeSide(side: Side): Field[] {
  if (typeof side === 'string') return [{ text: side }];
  return side;
}

function wrapText(text: string, width: number): string[] {
  if (width <= 0) return [text];
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph.length === 0) {
      out.push('');
      continue;
    }
    // Greedy wrap on whitespace; preserves CJK by breaking on any char.
    const isWide = /[\u3000-\u9fff\uff00-\uffef]/.test(paragraph);
    if (isWide) {
      for (let i = 0; i < paragraph.length; i += width) {
        out.push(paragraph.slice(i, i + width));
      }
    } else {
      const words = paragraph.split(/(\s+)/);
      let line = '';
      for (const word of words) {
        if (line.length + word.length > width && line.length > 0) {
          out.push(line);
          line = word.trimStart();
          if (line.length > width) {
            // Long word: hard-split.
            for (let i = 0; i < line.length; i += width) {
              out.push(line.slice(i, i + width));
            }
            line = '';
          }
        } else {
          line += word;
        }
      }
      if (line.length > 0) out.push(line);
    }
  }
  return out;
}

async function renderImageField(ref: string, ctx: RenderContext): Promise<string[] | null> {
  const cached = ctx.imageCache.get(ref);
  if (cached !== undefined) return cached;
  const promise = (async () => {
    if (!isImagePath(ref)) return null;
    const resolved = resolveRef(ctx.deckPath, ref);
    if (!existsSync(resolved)) return null;
    const size = pickImageSize(ctx.cellsWidth, ctx.cellsHeight);
    const rgba = await loadRgba(resolved, size.width, size.height);
    if (rgba === null) return null;
    return halfBlockLines(rgba);
  })();
  ctx.imageCache.set(ref, promise);
  return promise;
}

function resolveRef(deckPath: string, ref: string): string {
  if (ref.startsWith('~')) return ref.replace(/^~/, process.env.HOME ?? '');
  if (isAbsolute(ref)) return ref;
  return resolve(dirname(deckPath), ref);
}

function pickImageSize(cellsWidth: number, cellsHeight: number): { width: number; height: number } {
  // ImageMagick does the resize for us, so we just hand it the cell size.
  return { width: cellsWidth, height: cellsHeight * 2 };
}
