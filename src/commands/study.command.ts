import { Command } from '@mudah-cli/mudah';
import { Program } from '@mudah-cli/tui';
import { loadDeck, loadReviewCards, resolveDeckPath, defaultDecksDir } from '../flashcards/deck.js';
import { BasaFx } from '../flashcards/sound.js';
import { StudyApp } from '../tui/StudyApp.js';

export default class StudyCommand extends Command {
  signature = 'study {name?} [--no-sound] [--dir=]';
  description = 'Open a flashcard deck in the terminal';

  async handle(): Promise<number> {
    const decksDir = this.configDecksDir();
    const deckPath = await resolveDeckPath(decksDir, this.arg('name'));
    const deck = await loadDeck(deckPath);
    const cards = await loadReviewCards(deck, deckPath);

    const fx = await openFx(this.configSound());
    let study: StudyApp | undefined;
    let resizeListener: (() => void) | undefined;

    const program = new Program({ mouse: true, keyboard: true, stdin: process.stdin });

    const width = (process.stdout as { columns?: number }).columns ?? 80;
    const height = (process.stdout as { rows?: number }).rows ?? 24;
    study = new StudyApp({
      deck,
      deckPath,
      cards,
      width,
      height,
      fx,
    });
    program.mount(study.root);

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

    try {
      return await program.run();
    } finally {
      clearInterval(ticker);
      if (resizeListener !== undefined) process.stdout.off('resize', resizeListener);
      await study?.persist();
      await fx.dispose();
    }
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
}

async function openFx(setting: 'on' | 'off' | 'auto'): Promise<BasaFx> {
  // BasaFx already handles all three settings via the same open() call:
  // it probes for an audio backend and falls back to silent if none is
  // available. The `setting` is reserved for future per-setting behavior
  // (e.g. a sound-test command, a "play even in CI" override).
  void setting;
  return BasaFx.open();
}
