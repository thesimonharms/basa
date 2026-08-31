import { Command } from '@mudah-cli/mudah';
import { Program } from '@mudah-cli/tui';
import { loadDeck, loadReviewCards, resolveDeckPath, defaultDecksDir } from '../flashcards/deck.js';
import { sample } from '../flashcards/sample.js';
import { BasaFx } from '../flashcards/sound.js';
import { StudyApp } from '../tui/StudyApp.js';

export default class StudyCommand extends Command {
  signature = 'study {name?} [--no-sound] [--dir=] [--size=] [--drill] [--tag=]';
  description = 'Open a flashcard deck in the terminal';

  async handle(): Promise<number> {
    const decksDir = this.configDecksDir();
    const deckPath = await resolveDeckPath(decksDir, this.arg('name'));
    const deck = await loadDeck(deckPath);
    const allCards = await loadReviewCards(deck, deckPath);
    const size = this.parseSize(this.option('size'));
    // `--size` caps the number of cards per round, but each round draws a
    // fresh random sample — otherwise you'd see the same first N forever.
    const cards = size === undefined ? allCards : sample(allCards, size);

    // Drill mode ignores SRS entirely: grades are for self-assessment only
    // and nothing is persisted.
    const drill = this.option('drill') === true;
    const tagFilter = this.option('tag');
    const pool = typeof tagFilter === 'string' && tagFilter.length > 0
      ? allCards.filter((c) => c.card.tags?.includes(tagFilter) === true)
      : cards;

    const fx = await openFx(this.configSound());
    let study: StudyApp | undefined;
    let resizeListener: (() => void) | undefined;

    const width = (process.stdout as { columns?: number }).columns ?? 80;
    const height = (process.stdout as { rows?: number }).rows ?? 24;
    study = new StudyApp({
      deck,
      deckPath,
      cards: pool,
      width,
      height,
      fx,
      drill,
    });

    const program = new Program({ mouse: true, keyboard: true, stdin: process.stdin });

    // Repaint loop: Program repaints every 16ms via setInterval, but we
    // want the StudyApp to also tick (advance animations, swap card).
    const ticker = setInterval(() => {
      study?.tick();
      program.requestFrame();
    }, 16);

    // Handle terminal resize. Program's diff renderer adapts automatically
    // to the new column count, but we need to re-render images and layout.
    resizeListener = (): void => {
      const w = (process.stdout as { columns?: number }).columns ?? width;
      const h = (process.stdout as { rows?: number }).rows ?? height;
      study?.resize(w, h);
      program.requestFrame();
    };
    process.stdout.on('resize', resizeListener);

    let code = 0;
    try {
      code = await program.run();
    } finally {
      clearInterval(ticker);
      if (resizeListener !== undefined) process.stdout.off('resize', resizeListener);
      await study?.persist();
      await fx.dispose();
    }

    if (study !== undefined) {
      const s = study.summary;
      const acc = study.typedAccuracy;
      const parts = [`reviewed ${s.reviewed} card${s.reviewed === 1 ? '' : 's'}`];
      if (acc.total > 0) {
        const pct = Math.round((acc.correct / acc.total) * 100);
        parts.push(`typed answers ${pct}% correct (${acc.correct}/${acc.total})`);
      }
      this.output.muted(`Session recap — ${parts.join(' · ')}.`);
    }
    return code;
  }

  private configDecksDir(): string {
    const flag = this.option('dir');
    if (typeof flag === 'string' && flag.length > 0) return flag;
    return this.app.config().get<string>('app.decksDir') ?? defaultDecksDir();
  }

  private configSound(): 'on' | 'off' | 'auto' {
    const noSound = this.option('no-sound') === true;
    if (noSound) return 'off';
    const value = this.app.config().get<string>('app.sound');
    if (value === 'on' || value === 'off' || value === 'auto') return value;
    return 'auto';
  }

  private parseSize(raw: string | boolean | undefined): number | undefined {
    if (raw === undefined) return undefined;
    if (typeof raw !== 'string' || raw.length === 0 || !/^[1-9][0-9]*$/.test(raw)) {
      const got = typeof raw === 'string' ? raw : String(raw);
      throw this.usageError(`--size must be a positive integer (got "${got}")`);
    }
    return Number(raw);
  }
}

async function openFx(setting: 'on' | 'off' | 'auto'): Promise<BasaFx> {
  // BasaFx already handles all three settings via the same open() call:
  // it probes for an audio backend and falls back to silent if none is
  // available. The `setting` is reserved for future per-setting behavior
  // (e.g. a sound-test command, a "play even in CI" override).
  void setting;
  return BasaFx.open();
}
