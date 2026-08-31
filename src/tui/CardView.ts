import { BaseComponent } from '@mudah-cli/tui';
import { detectCapabilities, type KeyEvent } from '@mudah-cli/terminal';
import { paint, visibleLength } from '@mudah-cli/ui';
import type { Grade, ReviewCard } from '../flashcards/types.js';
import { renderSide, type RenderContext, type RenderedSide } from '../flashcards/render.js';
import {
  confettiRows,
  shakeRows,
  typeOnRows,
  type ConfettiSpec,
  type ShakeState,
  type TypeOnState,
} from './effects.js';

export interface CardViewOptions {
  deckPath: string;
  cellsWidth: number;
  cellsHeight: number;
  onGraded: (grade: Grade, typed: string) => void;
  onSkip: () => void;
  onDone?: () => void;
}

export interface SessionStats {
  reviewed: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
}

interface EffectFrame {
  /** Centered, padded text content. */
  rows: string[];
  /** Image rows to draw below the text. */
  imageRows: string[];
}

/**
 * The flashcard face. Renders the front; on space, animates the back in.
 * Keys 1-4 grade. `n` skips (no grade recorded). `enter` submits typed answer.
 *
 * Owns its own animation state — tick() is called by the host every frame.
 */
export class CardView extends BaseComponent {
  readonly focusable = true;
  private typed = '';

  private front: RenderedSide = { text: [], imageRows: [] };
  private back: RenderedSide = { text: [], imageRows: [] };
  private doneStats: SessionStats | null = null;

  private revealed = false;
  private revealAnim: TypeOnState = { durationFrames: 8, frame: 0 };
  private shake: ShakeState | null = null;
  private confetti: ConfettiSpec | null = null;

  private readonly ctx: RenderContext;
  private current: ReviewCard | undefined;

  private readonly options: CardViewOptions;

  constructor(options: CardViewOptions) {
    super();
    this.options = options;
    this.ctx = {
      deckPath: options.deckPath,
      cellsWidth: options.cellsWidth,
      cellsHeight: options.cellsHeight,
      imageCache: new Map(),
    };
  }

  /** Update the active card. Resets reveal + animation state. */
  async setCard(card: ReviewCard | undefined, stats?: SessionStats): Promise<void> {
    this.current = card;
    this.revealed = false;
    this.typed = '';
    this.shake = null;
    this.confetti = null;
    this.revealAnim = { durationFrames: 8, frame: 0 };
    if (card === undefined) {
      this.doneStats = stats ?? null;
      this.front = { text: this.doneViewText(), imageRows: [] };
      this.back = { text: [], imageRows: [] };
      this.options.onDone?.();
      return;
    }
    this.doneStats = null;
    this.front = await renderSide(card.card.front, this.ctx);
    this.back = await renderSide(card.card.back, this.ctx);
  }

  private doneViewText(): string[] {
    if (this.doneStats === null) {
      return ['All caught up!', 'Press Esc to quit.'];
    }
    const s = this.doneStats;
    return [
      '',
      '   ╭───────────────────────────────────────╮',
      '   │                                       │',
      '   │        session complete!              │',
      '   │                                       │',
      `   │   reviewed  ${pad(s.reviewed, 3)} cards                    │`,
      `   │   again  ${pad(s.again, 3)}   hard  ${pad(s.hard, 3)}   good  ${pad(s.good, 3)}   easy  ${pad(s.easy, 3)}    │`,
      '   │                                       │',
      '   │        press esc to exit              │',
      '   │                                       │',
      '   ╰───────────────────────────────────────╯',
      '',
    ];
  }

  /** Drive animations. Called by the host once per repaint. */
  tick(): void {
    if (this.revealed && this.revealAnim.frame < this.revealAnim.durationFrames) {
      this.revealAnim.frame++;
    }
    if (this.shake !== null && this.shake.frame < this.shake.durationFrames) {
      this.shake.frame++;
      if (this.shake.frame >= this.shake.durationFrames) this.shake = null;
    }
    if (this.confetti !== null && this.confetti.frame < this.confetti.durationFrames) {
      this.confetti.frame++;
      if (this.confetti.frame >= this.confetti.durationFrames) this.confetti = null;
    }
  }

  /** Resize the rendering area (after a terminal resize). */
  resize(cellsWidth: number, cellsHeight: number): void {
    this.ctx.cellsWidth = cellsWidth;
    this.ctx.cellsHeight = cellsHeight;
    this.ctx.imageCache.clear();
    if (this.current !== undefined) {
      // Re-render in the background. Until the new rows arrive, the existing
      // rows still display — no flicker, no jump.
      void this.setCard(this.current);
    }
  }

  override onKey(event: KeyEvent): boolean {
    // ctrl+u clears the typed answer (readline-style).
    if (event.ctrl === true && (event.name === 'u' || event.name === 'ctrl+u')) {
      this.typed = '';
      return true;
    }
    if (event.name === 'space' || event.name === 'enter') {
      this.revealed = true;
      this.revealAnim = { durationFrames: 8, frame: 0 };
      return true;
    }
    if (event.name === 'backspace') {
      this.typed = this.typed.slice(0, -1);
      return true;
    }
    if (this.revealed) {
      switch (event.name) {
        case '1':
          this.grade(0);
          return true;
        case '2':
          this.grade(1);
          return true;
        case '3':
          this.grade(2);
          return true;
        case '4':
          this.grade(3);
          return true;
      }
    }
    if (event.name === 'n') {
      this.options.onSkip();
      return true;
    }
    if (event.ch !== undefined && event.ch >= ' ' && event.ch !== 'n' && (event.ch < '0' || event.ch > '9')) {
      this.typed += event.ch;
      return true;
    }
    return false;
  }

  private grade(g: Grade): void {
    this.options.onGraded(g, this.typed);
    if (g === 0) {
      this.shake = { durationFrames: 10, frame: 0 };
    } else if (g === 3) {
      this.confetti = {
        frame: 0,
        durationFrames: 24,
        seed: Math.floor(Math.random() * 1e6),
        width: this.options.cellsWidth,
        palette: ['\x1b[38;5;213m', '\x1b[38;5;215m', '\x1b[38;5;220m', '\x1b[38;5;156m', '\x1b[38;5;123m'],
      };
    }
    this.typed = '';
  }

  render(): string[] {
    const out: string[] = [];

    // Header line: prompt + type input
    const lvl = detectCapabilities().colorLevel;
    const promptText = this.revealed
      ? paint('#fbbf24', 'Type your answer, then press 1-4 to grade', lvl)
      : paint('#94a3b8', 'Press Space to reveal', lvl);
    const typed = this.typed.length > 0 ? paint('#e2e8f0', ` > ${this.typed}▏`, lvl) : '';
    out.push(centerLine(`${promptText}${typed}`, this.options.cellsWidth));

    // Spacer
    out.push('');

    // Card front
    const frontRows = this.front.text;
    const centeredFront = frontRows.map((row) => centerLine(row, this.options.cellsWidth));
    out.push(...this.applyEffects(centeredFront, 'front'));

    // Spacer
    out.push('');

    // Divider
    if (this.revealed) {
      out.push(centerLine(paint('#475569', '─'.repeat(Math.min(60, this.options.cellsWidth - 4)), lvl), this.options.cellsWidth));
      out.push('');

      const backRows = this.back.text;
      const typedBack = this.revealed ? typeOnRows(this.revealAnim, backRows) : [];
      const centeredBack = typedBack.map((row) => centerLine(row, this.options.cellsWidth));
      out.push(...this.applyEffects(centeredBack, 'back'));

      // Hint, if any
      if (this.current?.card.hint !== undefined && this.revealed) {
        out.push('');
        out.push(centerLine(paint('#64748b', `hint: ${this.current.card.hint}`, lvl), this.options.cellsWidth));
      }
    }

    // Image rows (always rendered below the text).
    const imageRows = this.revealed
      ? [...this.front.imageRows, ...this.back.imageRows]
      : this.front.imageRows;
    for (const row of imageRows) {
      out.push(centerLine(row, this.options.cellsWidth));
    }

    // Confetti overlay
    if (this.confetti !== null) {
      const overlay = confettiRows(this.confetti, Math.min(8, this.options.cellsHeight));
      for (let i = 0; i < overlay.length; i++) {
        out[out.length - overlay.length + i] = overlay[i] ?? '';
      }
    }

    // Pad / truncate to fit the cell height so the screen layout is stable.
    while (out.length < this.options.cellsHeight) out.push('');
    if (out.length > this.options.cellsHeight) out.length = this.options.cellsHeight;

    return out;
  }

  private applyEffects(rows: string[], seedKey: string): string[] {
    let out = rows;
    if (this.shake !== null) {
      out = shakeRows(this.shake, out, hashString(`${seedKey}:${this.current?.card.front ?? ''}`));
    }
    return out;
  }
}

function centerLine(text: string, width: number): string {
  const visible = visibleLength(text);
  if (visible >= width) return text;
  const pad = Math.floor((width - visible) / 2);
  return ' '.repeat(pad) + text;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, ' ');
}
