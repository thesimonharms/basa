/**
 * Open flashcard format.
 *
 * A deck is a single file (YAML or JSON) with this shape:
 *
 *   name: "Spanish 101"
 *   description: "First-year Spanish vocabulary"
 *   cards:
 *     - front: "hola"
 *       back: "hello"
 *     - front: "perro"
 *       back: "dog"
 *     - front:
 *         text: "ありがとう"
 *         image: "./assets/thanks.png"   # optional
 *       back:
 *         text: "thank you"
 *
 * Each side is either a plain string (a single text field) or a list of
 * fields, where each field is `{ text?, image?, audio? }`. The renderer walks
 * the list top-to-bottom, leaving a blank line between fields. An `image`
 * field is rendered with half-block cells (universal truecolor); a `text`
 * field is rendered verbatim. An `audio` field is a relative path to a WAV
 * that the user can play with `p` while reviewing.
 */

export interface Field {
  text?: string;
  image?: string;
  audio?: string;
}

export type Side = string | Field[];

export interface Card {
  front: Side;
  back: Side;
  /**
   * Optional per-card hints. The SRS engine reads `tags` for filtering; the
   * UI reads `hint` to show a small prompt after a wrong answer.
   */
  tags?: string[];
  hint?: string;
}

export interface Deck {
  name: string;
  description?: string;
  cards: Card[];
}

export interface SrsState {
  /** Next due time, ms since epoch. `null` means "not started". */
  due: number | null;
  /** Number of successful reviews in a row. Resets to 0 on `again`. */
  streak: number;
  /** SM-2 ease factor, 1.3 .. 2.8. */
  ease: number;
  /** Current interval in days. */
  intervalDays: number;
  /** Total times this card has been shown. */
  reviews: number;
  /** Last grade given (0..3). */
  lastGrade: 0 | 1 | 2 | 3 | null;
}

/** A card together with its review state. */
export interface ReviewCard {
  card: Card;
  state: SrsState;
}

/** SM-2-style grades. */
export type Grade = 0 | 1 | 2 | 3;

export const GRADE_LABELS: readonly string[] = ['Again', 'Hard', 'Good', 'Easy'];

/**
 * What a user actually answered. The text input is free-form; the rating bar
 * is graded. We capture both so the UI can show "you typed X, the answer was Y".
 */
export interface AnswerRecord {
  typed: string;
  grade: Grade;
}
