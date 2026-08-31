/**
 * Draw a random sample of `n` distinct items. Unlike `slice(0, n)`, each
 * call can return a different subset, so repeated sessions rotate through
 * the deck instead of replaying the same first N cards forever.
 */
export function sample<T>(items: readonly T[], n: number): T[] {
  if (n <= 0) return [];
  const pool = [...items];
  const count = Math.min(n, pool.length);
  // Partial Fisher-Yates: shuffle only the first `count` positions.
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }
  return pool.slice(0, count);
}
