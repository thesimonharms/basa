import { BaseComponent } from '@mudah-cli/tui';
import { detectCapabilities } from '@mudah-cli/terminal';
import { paint, visibleLength } from '@mudah-cli/ui';

export interface HeaderOptions {
  deckName: string;
  reviewed: number;
  total: number;
  width: number;
}

/** Deck name + progress bar. One row, centered. */
export class Header extends BaseComponent {
  readonly focusable = false;

  private readonly options: HeaderOptions;

  constructor(options: HeaderOptions) {
    super();
    this.options = options;
  }

  update(options: HeaderOptions): void {
    Object.assign(this.options, options);
  }

  render(): string[] {
    const lvl = detectCapabilities().colorLevel;
    const barWidth = Math.max(10, Math.min(40, this.options.width - 30));
    const ratio = this.options.total > 0 ? this.options.reviewed / this.options.total : 0;
    const filled = Math.round(ratio * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
    const left = paint('#e2e8f0', this.options.deckName, lvl);
    const right = paint('#94a3b8', ` ${this.options.reviewed}/${this.options.total}`, lvl);
    const progress = paint(ratio >= 1 ? '#4ade80' : '#60a5fa', bar, lvl);
    const line = `${left}  ${progress}${right}`;
    return [centerLine(line, this.options.width)];
  }
}

function centerLine(text: string, width: number): string {
  // `visibleLength` (from @mudah-cli/ui) knows about wide chars and ANSI.
  return ' '.repeat(Math.max(0, Math.floor((width - visibleLength(text)) / 2))) + text;
}
