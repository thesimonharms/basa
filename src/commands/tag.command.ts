import { Command } from '@mudah-cli/mudah';
import { loadDeck, saveDeck, expandHome, resolveDeckPath } from '../flashcards/deck.js';
import { join } from 'node:path';

export default class TagCommand extends Command {
  signature = 'tag {deck} {action} {tag?}';
  description = 'Manage deck-level tags (add | rm | list)';

  async handle(): Promise<number> {
    const deckArg = this.arg('deck');
    const action = this.arg('action');
    const tag = this.arg('tag');
    if (deckArg === undefined || action === undefined) {
      this.output.hint('Usage: basa tag <deck> <add|rm|list> [tag]');
      return 1;
    }

    const path = await resolveDeckPath(this.decksDir(), deckArg);
    const deck = await loadDeck(path);
    deck.tags = deck.tags ?? [];

    switch (action) {
      case 'add': {
        if (tag === undefined) throw new Error('A tag is required: basa tag <deck> add <tag>');
        if (!deck.tags.includes(tag)) deck.tags.push(tag);
        await saveDeck(path, deck, this.deckFormat(path));
        this.output.success(`Added tag "${tag}" to ${deck.name}.`);
        return 0;
      }
      case 'rm': {
        if (tag === undefined) throw new Error('A tag is required: basa tag <deck> rm <tag>');
        const before = deck.tags.length;
        deck.tags = deck.tags.filter((t) => t !== tag);
        await saveDeck(path, deck, this.deckFormat(path));
        if (deck.tags.length === before) {
          this.output.muted(`Deck ${deck.name} had no tag "${tag}".`);
        } else {
          this.output.success(`Removed tag "${tag}" from ${deck.name}.`);
        }
        return 0;
      }
      case 'list': {
        if (deck.tags.length === 0) {
          this.output.muted(`${deck.name} has no tags.`);
        } else {
          for (const t of deck.tags) this.output.raw(`#${t}`);
        }
        return 0;
      }
      default:
        throw new Error(`Unknown tag action: ${action} (use add, rm, or list)`);
    }
  }

  private decksDir(): string {
    const flag = this.option('dir');
    if (typeof flag === 'string' && flag.length > 0) return expandHome(flag);
    return join(process.env.HOME ?? '.', 'basa', 'decks');
  }

  private deckFormat(path: string): 'yaml' | 'json' {
    return /\.json$/i.test(path) ? 'json' : 'yaml';
  }
}
