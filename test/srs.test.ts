import { describe, expect, it } from 'vitest';
import { freshState, grade, isDue, pickNext } from '../src/flashcards/srs.js';
import type { ReviewCard } from '../src/flashcards/types.js';

describe('SRS algorithm', () => {
  it('freshState starts due immediately', () => {
    const s = freshState(1_000);
    expect(s.due).toBeNull();
    expect(s.streak).toBe(0);
    expect(s.ease).toBe(2.5);
    expect(s.intervalDays).toBe(0);
    expect(s.reviews).toBe(0);
    expect(s.lastGrade).toBe(null);
  });

  it('Again resets streak, drops ease, and re-queues in 10 minutes', () => {
    const s = freshState(0);
    const next = grade(s, 0, 0);
    expect(next.streak).toBe(0);
    expect(next.ease).toBeLessThan(2.5);
    expect(next.intervalDays).toBe(0);
    expect(next.due).toBe(10 * 60 * 1000);
    expect(next.reviews).toBe(1);
    expect(next.lastGrade).toBe(0);
  });

  it('Good progresses 1 day → 6 days → scaling', () => {
    const s = freshState(0);
    const day = 24 * 60 * 60 * 1000;
    const s1 = grade(s, 2, 0);
    expect(s1.intervalDays).toBe(1);
    expect(s1.due).toBe(day);
    expect(s1.streak).toBe(1);

    const s2 = grade(s1, 2, 0);
    expect(s2.intervalDays).toBe(6);
    expect(s2.streak).toBe(2);

    const s3 = grade(s2, 2, 0);
    expect(s3.intervalDays).toBeGreaterThanOrEqual(6);
    expect(s3.streak).toBe(3);
  });

  it('Easy bumps ease; Hard drops it; Good holds', () => {
    const s = freshState(0);
    const easy = grade(s, 3, 0);
    expect(easy.ease).toBeGreaterThan(2.5);
    const hard = grade(s, 1, 0);
    expect(hard.ease).toBeLessThan(2.5);
    const good = grade(s, 2, 0);
    expect(good.ease).toBe(2.5);
  });

  it('ease is clamped to [1.3, 2.8]', () => {
    let s = freshState(0);
    for (let i = 0; i < 20; i++) s = grade(s, 1, 0);
    expect(s.ease).toBeGreaterThanOrEqual(1.3);
    let s2 = freshState(0);
    for (let i = 0; i < 20; i++) s2 = grade(s2, 3, 0);
    expect(s2.ease).toBeLessThanOrEqual(2.8);
  });

  it('isDue returns true when due is null or in the past', () => {
    expect(isDue({ ...freshState(0), due: null }, 1000)).toBe(true);
    expect(isDue({ ...freshState(0), due: 500 }, 1000)).toBe(true);
    expect(isDue({ ...freshState(0), due: 1500 }, 1000)).toBe(false);
  });

  it('pickNext returns the oldest-due card, or undefined if none due', () => {
    const cards: ReviewCard[] = [
      { card: { front: 'a', back: 'A' }, state: { ...freshState(0), due: 100 } },
      { card: { front: 'b', back: 'B' }, state: { ...freshState(0), due: 50 } },
      { card: { front: 'c', back: 'C' }, state: { ...freshState(0), due: 200 } },
    ];
    const next = pickNext(cards, 1000);
    expect(next?.card.front).toBe('b');
  });

  it('pickNext returns undefined when no cards are due', () => {
    const cards: ReviewCard[] = [
      { card: { front: 'a', back: 'A' }, state: { ...freshState(0), due: 5_000_000 } },
    ];
    expect(pickNext(cards, 1000)).toBeUndefined();
  });
});
