import { describe, expect, it } from 'vitest';
import { isExactMatch, isFuzzyMatch, normalizeAnswer } from '../src/flashcards/match.js';

describe('normalizeAnswer', () => {
  it('strips accents, case, punctuation, and extra whitespace', () => {
    expect(normalizeAnswer('  Héllo,  Wörld!  ')).toBe('hello world');
  });

  it('keeps letters and numbers', () => {
    expect(normalizeAnswer('¡Hola! 123')).toBe('hola 123');
  });
});

describe('isExactMatch', () => {
  it('matches after normalization', () => {
    expect(isExactMatch('Héllo', 'hello')).toBe(true);
  });

  it('rejects empty input', () => {
    expect(isExactMatch('  ', 'x')).toBe(false);
  });
});

describe('isFuzzyMatch', () => {
  it('accepts an exact match after normalization', () => {
    expect(isFuzzyMatch('Héllo', 'hello')).toBe(true);
  });

  it('accepts answers one edit apart', () => {
    expect(isFuzzyMatch('hola', 'holá')).toBe(true);
    expect(isFuzzyMatch('perro', 'pero')).toBe(true);
  });

  it('rejects answers two or more edits apart', () => {
    expect(isFuzzyMatch('perro', 'gato')).toBe(false);
  });

  it('rejects empty input', () => {
    expect(isFuzzyMatch('', 'x')).toBe(false);
  });
});
