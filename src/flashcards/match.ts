import type { Side } from './types.js';

/**
 * Answer-matching helpers. Pure functions, no I/O — trivially testable.
 */

/** Flatten a `Side` to plain text. Image-only fields contribute nothing. */
export function sideText(side: Side): string {
  if (typeof side === 'string') return side;
  return side
    .map((f) => f.text ?? '')
    .filter((t) => t.length > 0)
    .join('\n');
}

/**
 * Normalize a typed answer for comparison: strip accents (NFD + combining
 * marks), casefold, drop punctuation, and collapse whitespace runs.
 */
export function normalizeAnswer(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Exact match after normalization. Empty on either side never matches. */
export function isExactMatch(a: string, b: string): boolean {
  const na = normalizeAnswer(a);
  const nb = normalizeAnswer(b);
  if (na.length === 0 || nb.length === 0) return false;
  return na === nb;
}

/**
 * Damerau-Levenshtein distance (optimal string alignment) with an early
 * exit once `cap` is exceeded. Counts substitutions, insertions, deletions,
 * and adjacent transpositions as one edit each.
 */
export function levenshtein(a: string, b: string, cap: number = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  // Row i-2 (for transpositions), row i-1, and row i.
  let prev2: number[] = [];
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      // Adjacent transposition (e.g. "gracias" / "gracais") counts as one.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        const t = prev2[j - 2];
        if (t !== undefined) value = Math.min(value, t + 1);
      }
      cur.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > cap) return cap + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length] ?? cap + 1;
}

/**
 * Fuzzy equality: exact after normalization, or within one edit for
 * answers of at least four characters (so "hola"/"holá" passes but
 * "sí"/"si" still requires the accent).
 */
export function isFuzzyMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const na = normalizeAnswer(a);
  const nb = normalizeAnswer(b);
  if (na.length === 0 || nb.length === 0) return false;
  // Equal only after stripping accents/case: a real difference for short
  // answers ("sí" vs "si"), irrelevant once both sides are long enough.
  if (na === nb) return a.length >= 4 && b.length >= 4;
  return na.length >= 4 && nb.length >= 4 && levenshtein(na, nb) <= 1;
}
