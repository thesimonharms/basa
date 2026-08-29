import { describe, expect, it } from 'vitest';
import { halfBlockLines, fitToCells } from '../src/flashcards/halfblock.js';
import { isImagePath } from '../src/flashcards/image.js';

describe('halfBlockLines', () => {
  it('emits one row per 2 pixels of height', () => {
    const pixels = new Uint8Array(4 * 4 * 4); // 4x4, all zero (black)
    const lines = halfBlockLines({ width: 4, height: 4, pixels });
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line).toContain('\x1b[0m');
      expect(line).toContain('▀');
    }
  });

  it('emits color codes per row when pixels differ', () => {
    const pixels = new Uint8Array(2 * 2 * 4);
    // Row 0 (top), col 0: red.
    pixels[0] = 255; pixels[1] = 0; pixels[2] = 0;
    // Row 0, col 1: green.
    pixels[4] = 0; pixels[5] = 255; pixels[6] = 0;
    // Row 1 (bottom), col 0: blue.
    pixels[8] = 0; pixels[9] = 0; pixels[10] = 255;
    // Row 1, col 1: yellow.
    pixels[12] = 255; pixels[13] = 255; pixels[14] = 0;
    const lines = halfBlockLines({ width: 2, height: 2, pixels });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('38;2;255;0;0');
    expect(lines[0]).toContain('48;2;0;0;255');
    expect(lines[0]).toContain('38;2;0;255;0');
    expect(lines[0]).toContain('48;2;255;255;0');
  });
});

describe('fitToCells', () => {
  it('respects a tall narrow source', () => {
    const { width, height } = fitToCells(100, 1000, 80, 24);
    expect(width).toBeLessThanOrEqual(80);
    expect(height).toBeLessThanOrEqual(48);
  });

  it('respects a wide short source', () => {
    const { width, height } = fitToCells(1000, 100, 80, 24);
    expect(width).toBeLessThanOrEqual(80);
    expect(height).toBeLessThanOrEqual(48);
  });

  it('returns sane defaults for a zero-size source', () => {
    const { width, height } = fitToCells(0, 0, 80, 24);
    expect(width).toBe(1);
    expect(height).toBe(1);
  });
});

describe('isImagePath', () => {
  it('accepts common image extensions', () => {
    expect(isImagePath('a.png')).toBe(true);
    expect(isImagePath('a.PNG')).toBe(true);
    expect(isImagePath('path/to/a.jpg')).toBe(true);
    expect(isImagePath('a.jpeg')).toBe(true);
    expect(isImagePath('a.gif')).toBe(true);
    expect(isImagePath('a.webp')).toBe(true);
    expect(isImagePath('a.svg')).toBe(true);
  });

  it('rejects non-image extensions', () => {
    expect(isImagePath('a.txt')).toBe(false);
    expect(isImagePath('README.md')).toBe(false);
    expect(isImagePath('a')).toBe(false);
  });
});
