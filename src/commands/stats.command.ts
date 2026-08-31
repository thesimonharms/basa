import { Command } from '@mudah-cli/mudah';
import { defaultDecksDir, listDecks, loadDeck, loadReviewCards } from '../flashcards/deck.js';
import { isDue } from '../flashcards/srs.js';
import { renderTable, type TableColumn } from '@mudah-cli/ui';

export default class StatsCommand extends Command {
  signature = 'stats [--dir=] [--deck=] [--json]';
  description = 'Per-deck card, review, and accuracy summary';

  async handle(): Promise<number> {
    const flag = this.option('dir');
    const dir = typeof flag === 'string' && flag.length > 0
      ? flag
      : (this.app.config().get<string>('app.decksDir') ?? defaultDecksDir());
    const paths = await listDecks(dir);
    if (paths.length === 0) {
      this.output.muted(`No decks found in ${dir}.`);
      this.output.hint('Create one with `basa new <name>`, or pass --dir=<path>.');
      return 0;
    }

    const now = Date.now();
    const deckFilter = this.option('deck');
    const asJson = this.option('json') === true;
    const columns: TableColumn[] = [
      { header: 'Deck', align: 'left' },
      { header: 'Cards', align: 'right' },
      { header: 'Reviews', align: 'right' },
      { header: 'Accuracy', align: 'right' },
      { header: 'Due', align: 'right' },
    ];
    const rows: string[][] = [];
    const jsonRows: Array<{
      deck: string;
      cards: number;
      reviews: number;
      accuracy: string;
      due: number;
    }> = [];
    let totalReviews = 0;
    let totalCorrect = 0;

    for (const path of paths) {
      const deck = await loadDeck(path);
      const cards = await loadReviewCards(deck, path);
      const graded = cards.filter((c) => c.state.lastGrade !== null);
      const correct = graded.filter((c) => c.state.lastGrade !== 0).length;
      totalReviews += graded.length;
      totalCorrect += correct;
      const due = cards.filter((c) => isDue(c.state, now)).length;
      const accuracy = graded.length > 0 ? `${Math.round((correct / graded.length) * 100)}%` : '—';
      rows.push([deck.name, String(cards.length), String(graded.length), accuracy, String(due)]);
      jsonRows.push({ deck: deck.name, cards: cards.length, reviews: graded.length, accuracy, due });
    }

    if (asJson) {
      this.output.raw(JSON.stringify(jsonRows, null, 2));
      this.output.raw('');
    } else {
      this.output.raw(renderTable(columns, rows, { level: 0, unicode: true }));
    }
    this.output.raw('');
    if (totalReviews > 0) {
      const pct = Math.round((totalCorrect / totalReviews) * 100);
      this.output.muted(
        `${totalReviews} graded reviews across ${paths.length} deck(s) — ${pct}% correct overall.`,
      );
    } else {
      this.output.muted('No graded reviews yet — study a deck to see accuracy here.');
    }
    return 0;
  }
}
