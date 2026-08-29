import { Container } from '@mudah-cli/tui';
import type { Deck, Grade, ReviewCard } from '../flashcards/types.js';
import { grade, pickNext } from '../flashcards/srs.js';
import { saveReviewCards } from '../flashcards/deck.js';
import { BasaFx } from '../flashcards/sound.js';
import { CardView } from './CardView.js';
import { Header } from './Header.js';
import { Footer } from './Footer.js';

export interface StudyAppOptions {
  deck: Deck;
  deckPath: string;
  cards: ReviewCard[];
  width: number;
  height: number;
  fx: BasaFx;
}

interface SessionStats {
  reviewed: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
}

/**
 * The study session. Owns SRS state, the focused card, the session stats.
 * Exposes a `Container` for the TUI program to mount, plus `tick()` and
 * `resize()` methods the host calls every frame and on terminal resize.
 */
export class StudyApp {
  readonly root: Container;
  private readonly cardView: CardView;
  private readonly header: Header;
  private readonly footer: Footer;
  private cards: ReviewCard[];
  private current: ReviewCard | undefined;
  private stats: SessionStats = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
  private width: number;
  private height: number;

  private readonly options: StudyAppOptions;

  constructor(options: StudyAppOptions) {
    this.options = options;
    this.cards = options.cards;
    this.width = options.width;
    this.height = options.height;

    const cardHeight = Math.max(8, options.height - 8);
    this.cardView = new CardView({
      deckPath: options.deckPath,
      cellsWidth: options.width,
      cellsHeight: cardHeight,
      onGraded: (g, typed) => void this.handleGrade(g, typed),
      onSkip: () => this.handleSkip(),
    });
    this.header = new Header({
      deckName: options.deck.name,
      reviewed: 0,
      total: this.cards.length,
      width: options.width,
    });
    this.footer = new Footer(options.width);

    this.root = new Container().add(this.header).add(this.cardView).add(this.footer);
    void this.advance();
  }

  /** Drive animations. Called by the host on every frame. */
  tick(): void {
    this.cardView.tick();
  }

  /** Apply a terminal resize. */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.header.update({
      deckName: this.options.deck.name,
      reviewed: this.stats.reviewed,
      total: this.cards.length,
      width,
    });
    this.footer.resize(width);
    const cardHeight = Math.max(8, height - 8);
    this.cardView.resize(width, cardHeight);
  }

  /** Persist state on shutdown. Safe to call multiple times. */
  async persist(): Promise<void> {
    await saveReviewCards(this.options.deckPath, this.cards).catch(() => {});
  }

  private async advance(): Promise<void> {
    this.current = pickNext(this.cards, Date.now());
    if (this.current === undefined) {
      await this.cardView.setCard(undefined, this.stats);
      return;
    }
    await this.cardView.setCard(this.current);
  }

  private async handleGrade(gradeValue: Grade, _typed: string): Promise<void> {
    if (this.current === undefined) return;
    const idx = this.cards.indexOf(this.current);
    if (idx < 0) return;
    const next = grade(this.current.state, gradeValue);
    this.cards[idx] = { card: this.current.card, state: next };
    this.stats = {
      reviewed: this.stats.reviewed + 1,
      again: this.stats.again + (gradeValue === 0 ? 1 : 0),
      hard: this.stats.hard + (gradeValue === 1 ? 1 : 0),
      good: this.stats.good + (gradeValue === 2 ? 1 : 0),
      easy: this.stats.easy + (gradeValue === 3 ? 1 : 0),
    };
    this.header.update({
      deckName: this.options.deck.name,
      reviewed: this.stats.reviewed,
      total: this.cards.length,
      width: this.width,
    });

    if (gradeValue === 0) {
      await this.options.fx.playIncorrect();
    } else {
      await this.options.fx.playCorrect(gradeValue);
    }

    // Persist after every grade so a crash doesn't lose progress.
    await saveReviewCards(this.options.deckPath, this.cards).catch(() => {});

    await this.advance();
  }

  private handleSkip(): void {
    if (this.current === undefined) return;
    const idx = this.cards.indexOf(this.current);
    if (idx < 0) return;
    this.cards[idx] = {
      card: this.current.card,
      state: { ...this.current.state, due: Date.now() + 30_000 },
    };
    void this.advance();
  }
}
