import { describe, expect, it } from 'vitest';
import { CardView } from '../src/tui/CardView.js';
import type { ReviewCard } from '../src/flashcards/types.js';
import { freshState } from '../src/flashcards/srs.js';
import type { KeyEvent } from '@mudah-cli/terminal';

function key(name: string, ch?: string): KeyEvent {
  return { name, ch, kind: 'press' };
}

function makeCard(front: string, back: string): ReviewCard {
  return { card: { front, back }, state: freshState(0) };
}

describe('CardView', () => {
  it('renders the front text and a "press space to reveal" prompt', async () => {
    const view = new CardView({
      deckPath: '/tmp/x.yml',
      cellsWidth: 60,
      cellsHeight: 16,
      onGraded: () => {},
      onSkip: () => {},
    });
    await view.setCard(makeCard('hola', 'hello'));
    const rows = view.render();
    const all = rows.join('\n');
    expect(all).toContain('hola');
    expect(all).toContain('reveal');
    expect(all).not.toContain('hello');
  });

  it('space reveals the back and renders the answer', async () => {
    let grade = -1;
    const view = new CardView({
      deckPath: '/tmp/x.yml',
      cellsWidth: 60,
      cellsHeight: 16,
      onGraded: (g) => { grade = g; },
      onSkip: () => {},
    });
    await view.setCard(makeCard('hola', 'hello'));
    view.onKey(key('space'));
    // Drive the reveal animation to completion.
    for (let i = 0; i < 20; i++) view.tick();
    const all = view.render().join('\n');
    expect(all).toContain('hello');
    expect(grade).toBe(-1);
  });

  it('keys 1..4 grade after reveal; 0 → Again, 3 → Easy', async () => {
    const grades: number[] = [];
    const view = new CardView({
      deckPath: '/tmp/x.yml',
      cellsWidth: 60,
      cellsHeight: 16,
      onGraded: (g) => grades.push(g),
      onSkip: () => {},
    });
    await view.setCard(makeCard('a', 'A'));
    view.onKey(key('space'));
    for (let i = 0; i < 20; i++) view.tick();
    view.onKey(key('1'));
    expect(grades).toEqual([0]);

    await view.setCard(makeCard('b', 'B'));
    view.onKey(key('space'));
    for (let i = 0; i < 20; i++) view.tick();
    view.onKey(key('4'));
    expect(grades).toEqual([0, 3]);
  });

  it('keys 1..4 grade after reveal even when the live KeyEvent carries ch (real parseKeys output)', async () => {
    // parseKeys emits digits as { name: '1', ch: '1', kind: 'press' } — see
    // @mudah-cli/terminal/keys.js. The keymap must not buffer the digit into
    // the typed-answer field before the grade switch has a chance to run.
    const grades: number[] = [];
    const typed: string[] = [];
    const view = new CardView({
      deckPath: '/tmp/x.yml',
      cellsWidth: 60,
      cellsHeight: 16,
      onGraded: (g, t) => { grades.push(g); typed.push(t); },
      onSkip: () => {},
    });
    await view.setCard(makeCard('a', 'A'));
    view.onKey(key('space'));
    for (let i = 0; i < 20; i++) view.tick();
    view.onKey({ name: '1', ch: '1', kind: 'press' });
    expect(grades).toEqual([0]);
    expect(typed).toEqual(['']);
  });

  it('keys 1..4 do nothing before reveal', async () => {
    const grades: number[] = [];
    const view = new CardView({
      deckPath: '/tmp/x.yml',
      cellsWidth: 60,
      cellsHeight: 16,
      onGraded: (g) => grades.push(g),
      onSkip: () => {},
    });
    await view.setCard(makeCard('a', 'A'));
    view.onKey(key('1'));
    expect(grades).toEqual([]);
  });

  it('typing buffers characters and backspace removes them', async () => {
    const view = new CardView({
      deckPath: '/tmp/x.yml',
      cellsWidth: 60,
      cellsHeight: 16,
      onGraded: () => {},
      onSkip: () => {},
    });
    await view.setCard(makeCard('a', 'A'));
    view.onKey(key('h', 'h'));
    view.onKey(key('e', 'e'));
    view.onKey(key('l', 'l'));
    view.onKey(key('l', 'l'));
    view.onKey(key('o', 'o'));
    let all = view.render().join('\n');
    expect(all).toContain('hello');

    view.onKey(key('backspace'));
    all = view.render().join('\n');
    expect(all).toContain('hell');
  });

  it('"n" skips without grading', async () => {
    let skipped = false;
    const view = new CardView({
      deckPath: '/tmp/x.yml',
      cellsWidth: 60,
      cellsHeight: 16,
      onGraded: () => {},
      onSkip: () => { skipped = true; },
    });
    await view.setCard(makeCard('a', 'A'));
    view.onKey(key('n'));
    expect(skipped).toBe(true);
  });

  it('setCard(undefined) shows the done view', async () => {
    const view = new CardView({
      deckPath: '/tmp/x.yml',
      cellsWidth: 60,
      cellsHeight: 16,
      onGraded: () => {},
      onSkip: () => {},
    });
    await view.setCard(undefined, { reviewed: 5, again: 1, hard: 1, good: 2, easy: 1 });
    const all = view.render().join('\n');
    expect(all).toContain('session complete');
    expect(all).toContain('reviewed');
    expect(all).toContain('5');
  });
});
