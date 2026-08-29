/**
 * Visual effect helpers. Each is a small mutable object that the card view
 * ticks every frame. They never touch the terminal directly — they just
 * transform strings the component is about to render.
 */

export interface TypeOnState {
  /** Total frames the effect should run for. */
  durationFrames: number;
  /** Frame counter, incremented by the host. */
  frame: number;
}

/** Reveal a string array row-by-row. 0 → 0 rows, 1 → all rows. */
export function typeOnRows(state: TypeOnState, rows: string[]): string[] {
  const t = Math.min(1, state.frame / Math.max(1, state.durationFrames));
  const visible = Math.max(1, Math.ceil(rows.length * t));
  return rows.slice(0, visible);
}

export interface ShakeState {
  durationFrames: number;
  frame: number;
}

/** Apply a per-row horizontal jitter that decays. The component pads each
 *  row with random leading spaces within a window that shrinks over time. */
export function shakeRows(state: ShakeState, rows: string[], seed: number): string[] {
  const t = Math.min(1, state.frame / Math.max(1, state.durationFrames));
  const amplitude = Math.round((1 - t) * 3);
  if (amplitude === 0) return rows;
  return rows.map((row, i) => {
    // Deterministic pseudo-random per row+frame so the diff renderer still works.
    const x = pseudo(seed + i * 7 + state.frame * 13);
    const offset = Math.floor(x * (amplitude * 2 + 1)) - amplitude;
    if (offset === 0) return row;
    if (offset > 0) return ' '.repeat(offset) + row;
    return row.slice(-offset);
  });
}

function pseudo(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export interface ConfettiSpec {
  /** Frame counter, incremented by the host. */
  frame: number;
  /** Total frames. */
  durationFrames: number;
  /** Pseudo-random seed. */
  seed: number;
  /** Width in cells. */
  width: number;
  /** Palette: 24-bit color codes as strings. */
  palette: string[];
}

/** Render a confetti overlay as N rows. Each row is a string. */
export function confettiRows(spec: ConfettiSpec, height: number): string[] {
  const out: string[] = [];
  for (let row = 0; row < height; row++) {
    let line = '';
    for (let col = 0; col < spec.width; col++) {
      const x = pseudo(spec.seed + row * 91 + col * 17 + spec.frame * 5);
      const visible = x > 0.65;
      if (!visible) {
        line += ' ';
        continue;
      }
      const colorIndex = Math.floor(pseudo(spec.seed + row + col + spec.frame * 3) * spec.palette.length);
      const color = spec.palette[colorIndex] ?? spec.palette[0]!;
      const glyphs = ['✦', '✧', '•', '·', '◆', '◇'];
      const glyph = glyphs[Math.floor(pseudo(spec.seed + col + row) * glyphs.length)] ?? '·';
      line += `${color}${glyph}\x1b[0m`;
    }
    out.push(line);
  }
  return out;
}
