import type { Grade, SrsState } from './types.js';

/** A relaxed SM-2 implementation. Reasonable defaults, no anki-parity goal. */

const DAY_MS = 24 * 60 * 60 * 1000;

export function freshState(): SrsState {
  // `due: null` means "due immediately" — see `isDue`.
  return {
    due: null,
    streak: 0,
    ease: 2.5,
    intervalDays: 0,
    reviews: 0,
    lastGrade: null,
  };
}

/**
 * Apply a grade to a card's state and return the next state.
 * Pure function — no I/O, no randomness — so it's trivially testable.
 */
export function grade(state: SrsState, grade: Grade, now: number = Date.now()): SrsState {
  const next: SrsState = {
    due: state.due,
    streak: state.streak,
    ease: state.ease,
    intervalDays: state.intervalDays,
    reviews: state.reviews + 1,
    lastGrade: grade,
  };

  if (grade === 0) {
    // Again: reset streak, ease drops, see it again in 10 minutes.
    next.streak = 0;
    next.ease = Math.max(1.3, state.ease - 0.2);
    next.intervalDays = 0;
    next.due = now + 10 * 60 * 1000;
    return next;
  }

  next.streak = state.streak + 1;
  // SM-2 ease adjustment for non-failing grades. Hard (1) drops ease slightly;
  // Easy (3) bumps it; Good (2) holds.
  const easeDelta = grade === 1 ? -0.15 : grade === 3 ? 0.15 : 0;
  next.ease = clamp(state.ease + easeDelta, 1.3, 2.8);

  if (next.streak === 1) {
    next.intervalDays = 1;
  } else if (next.streak === 2) {
    next.intervalDays = 6;
  } else {
    next.intervalDays = Math.max(1, Math.round(state.intervalDays * next.ease));
  }

  next.due = now + next.intervalDays * DAY_MS;
  return next;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

/** Cards that are due now or earlier. `null` `due` is treated as "due immediately". */
export function isDue(state: SrsState, now: number = Date.now()): boolean {
  if (state.due === null) return true;
  return state.due <= now;
}

/** Pick the next due card, ordered by oldest-due first, with new cards last. */
export function pickNext<T extends { state: SrsState }>(
  cards: readonly T[],
  now: number = Date.now(),
): T | undefined {
  const due = cards.filter((c) => isDue(c.state, now));
  if (due.length === 0) return undefined;
  const sorted = [...due].sort((a, b) => {
    const ad = a.state.due ?? 0;
    const bd = b.state.due ?? 0;
    return ad - bd;
  });
  return sorted[0];
}
