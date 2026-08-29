import { Command } from '@mudah-cli/mudah';
import { defaultDecksDir, listDecks, loadDeck, loadReviewCards } from '../flashcards/deck.js';
import { isDue } from '../flashcards/srs.js';
import { renderTable, type TableColumn } from '@mudah-cli/ui';

export default class ListCommand extends Command {
  signature = 'list [--all] [--dir=]';
  description = 'List decks (and per-deck card counts)';

  async handle(): Promise<number> {
    const flag = this.option('dir');
    const dir = typeof flag === 'string' && flag.length > 0
      ? flag
      : (this.app.config().get<string>('app.decksDir') ?? defaultDecksDir());
    const paths = await listDecks(dir);
    if (paths.length === 0) {
      this.output.muted(`No decks found in ${dir}.`);
      this.output.hint(`Create one with \`basa new <name>\`, or pass --dir=<path>.`);
      return 0;
    }

    const showAll = this.option('all') === true;
    const now = Date.now();
    const rows: string[][] = [];
    let totalCards = 0;
    let totalDue = 0;

    for (const path of paths) {
      const deck = await loadDeck(path);
      const cards = await loadReviewCards(deck, path);
      const due = cards.filter((c) => isDue(c.state, now)).length;
      totalCards += cards.length;
      totalDue += due;
      const description = (deck.description ?? '').replace(/\s+/g, ' ').trim();
      rows.push([
        deck.name,
        String(cards.length),
        String(due),
        truncate(description, 50),
      ]);
    }

    if (showAll) {
      for (const path of paths) this.output.muted(`• ${path}`);
      this.output.raw('');
    }

    const columns: TableColumn[] = [
      { header: 'Deck', align: 'left' },
      { header: 'Cards', align: 'right' },
      { header: 'Due', align: 'right' },
      { header: 'Description', align: 'left' },
    ];

    this.output.raw(renderTable(columns, rows, { level: 0, unicode: true }));
    this.output.raw('');
    this.output.muted(`${totalDue} of ${totalCards} cards due across ${paths.length} decks.`);
    return 0;
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
