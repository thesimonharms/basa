import { Container } from '@mudah-cli/tui';
import type { Deck, Grade, ReviewCard } from '../flashcards/types.js';
import { grade, pickNext } from '../flashcards/srs.js';
import { saveReviewCards } from '../flashcards/deck.js';
import { BasaFx } from '../flashcards/sound.js';
import { isFuzzyMatch, sideText } from '../flashcards/match.js';
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
  /** Drill mode: self-assessment only, nothing persisted. */
  drill?: boolean;
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
  /** Cards for this session (mutated in place as grades are applied). */
  readonly cards: ReviewCard[];
  private current: ReviewCard | undefined;
  private stats: SessionStats = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
  /** Whether each graded card's typed answer fuzzy-matched the back. */
  private typedResults: boolean[] = [];
  private width: number;
  private height: number;
  private readonly drill: boolean;

  private readonly options: StudyAppOptions;

  constructor(options: StudyAppOptions) {
    this.options = options;
    this.cards = options.cards;
    this.width = options.width;
    this.height = options.height;
    this.drill = options.drill === true;

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

  /** Persist state on shutdown. No-op in drill mode — SRS is ignored. */
  async persist(): Promise<void> {
    if (this.drill) return;
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

  private async handleGrade(gradeValue: Grade, typed: string): Promise<void> {
    if (this.current === undefined) return;
    const back = sideText(this.current.card.back);
    if (typed.length > 0) {
      this.typedResults.push(isFuzzyMatch(typed, back));
    }
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

  /** Snapshot of the session stats for the post-run recap. */
  get summary(): SessionStats {
    return { ...this.stats };
  }

  /** Accuracy of typed answers this session (0 total when none were typed). */
  get typedAccuracy(): { correct: number; total: number } {
    const total = this.typedResults.length;
    const correct = this.typedResults.filter(Boolean).length;
    return { correct, total };
  }
}
