import { Command } from '@mudah-cli/mudah';
import { importApkg } from '../flashcards/anki.js';
import { defaultDecksDir, expandHome, saveDeck } from '../flashcards/deck.js';
import { join } from 'node:path';

export default class ImportCommand extends Command {
  signature = 'import {file} [--name=] [--format=yaml] [--dir=]';
  description = 'Import an Anki .apkg file as a new deck';

  async handle(): Promise<number> {
    const file = this.arg('file');
    if (file === undefined) throw new Error('An .apkg file is required.');
    const name = (this.option('name') as string | undefined) ?? defaultDeckName(file);
    const format = ((this.option('format') as string | undefined) ?? 'yaml') === 'json' ? 'json' : 'yaml';
    const dirFlag = this.option('dir');
    const dir = typeof dirFlag === 'string' && dirFlag.length > 0
      ? expandHome(dirFlag)
      : defaultDecksDir();

    const deck = await importApkg(expandHome(file), name);
    const path = await saveDeck(join(dir, deck.name), deck, format);
    this.output.success(`Imported ${deck.cards.length} card(s) from ${file}`);
    this.output.hint(`Created ${path}`);
    this.output.muted(`Study it with \`basa study ${deck.name}\`.`);
    return 0;
  }
}

function defaultDeckName(file: string): string {
  const base = file.split('/').pop() ?? file;
  return base.replace(/\.(apkg|colpkg)$/i, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'imported';
}
