import { join } from 'node:path';
import { Command } from '@mudah-cli/mudah';
import { createDeck, defaultDecksDir, expandHome } from '../flashcards/deck.js';

export default class NewCommand extends Command {
  signature = 'new {name} [--format=yaml] [--dir=]';
  description = 'Create a new empty deck';

  async handle(): Promise<number> {
    const name = this.arg('name');
    if (name === undefined) throw new Error('Deck name is required.');
    const format = (this.option('format') as string | undefined) ?? 'yaml';
    const flag = this.option('dir');
    const baseDir = typeof flag === 'string' && flag.length > 0
      ? flag
      : (this.app.config().get<string>('app.decksDir') ?? defaultDecksDir());
    const dir = expandHome(baseDir);
    const ext = format === 'json' ? '.json' : '.yml';
    const file = join(dir, `${name}${ext}`);
    const path = await createDeck(file, name);
    this.output.success(`Created ${path}`);
    this.output.hint(`Edit it, then run \`basa study ${name}\`.`);
    return 0;
  }
}
