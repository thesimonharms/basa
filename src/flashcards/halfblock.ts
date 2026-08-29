import type { RgbaImage } from './image.js';

/**
 * Encode an RGBA pixel buffer as ANSI truecolor half-block cells. Each
 * terminal cell represents two vertical pixels using `▀` with the top pixel
 * as the foreground and the bottom as the background. Works in any
 * truecolor terminal — no Kitty/SIXEL needed.
 */
export function halfBlockLines(image: RgbaImage): string[] {
  const { width, height, pixels } = image;
  const out: string[] = [];
  let row = 0;
  while (row < height) {
    let line = '';
    for (let col = 0; col < width; col++) {
      const top = pixelAt(pixels, width, height, col, row);
      const bottom = row + 1 < height ? pixelAt(pixels, width, height, col, row + 1) : top;
      line += `\x1b[38;2;${top.r};${top.g};${top.b};48;2;${bottom.r};${bottom.g};${bottom.b}m▀`;
    }
    line += '\x1b[0m';
    out.push(line);
    row += 2;
  }
  return out;
}

function pixelAt(pixels: Uint8Array, width: number, height: number, x: number, y: number): { r: number; g: number; b: number } {
  if (x < 0 || y < 0 || x >= width || y >= height) return { r: 0, g: 0, b: 0 };
  const offset = (y * width + x) * 4;
  return {
    r: pixels[offset] ?? 0,
    g: pixels[offset + 1] ?? 0,
    b: pixels[offset + 2] ?? 0,
  };
}

/** Pick a width and height in pixels that fit a given cell budget. */
export function fitToCells(
  sourceWidth: number,
  sourceHeight: number,
  maxCellsWidth: number,
  maxCellsHeight: number,
): { width: number; height: number } {
  if (sourceWidth === 0 || sourceHeight === 0) return { width: 1, height: 1 };
  const aspect = sourceWidth / sourceHeight;
  // Half-block makes 1 cell represent 2 vertical pixels → effective aspect per cell is 0.5.
  const cellAspect = (maxCellsWidth / maxCellsHeight) * 0.5;
  let cellsH = maxCellsHeight;
  let cellsW = Math.round(cellsH * aspect / 0.5);
  if (cellsW > maxCellsWidth) {
    cellsW = maxCellsWidth;
    cellsH = Math.round(cellsW * 0.5 / aspect);
  }
  return { width: cellsW, height: cellsH * 2 };
}
