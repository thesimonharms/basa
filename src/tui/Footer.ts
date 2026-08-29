import { BaseComponent } from '@mudah-cli/tui';
import { detectCapabilities } from '@mudah-cli/terminal';
import { paint } from '@mudah-cli/ui';

const KEYS: ReadonlyArray<{ key: string; label: string; tone: 'good' | 'meh' | 'bad' | 'neutral' }> = [
  { key: '1', label: 'Again', tone: 'bad' },
  { key: '2', label: 'Hard',  tone: 'meh' },
  { key: '3', label: 'Good',  tone: 'good' },
  { key: '4', label: 'Easy',  tone: 'good' },
];

const TONES: Record<'good' | 'meh' | 'bad' | 'neutral', string> = {
  good: '#4ade80',
  meh: '#fbbf24',
  bad: '#f87171',
  neutral: '#94a3b8',
};

/** The key legend. Centered, three rows: title, four key chips, hints. */
export class Footer extends BaseComponent {
  readonly focusable = false;

  private width: number;

  constructor(width: number) {
    super();
    this.width = width;
  }

  resize(width: number): void {
    this.width = width;
  }

  render(): string[] {
    const lvl = detectCapabilities().colorLevel;
    const chips = KEYS.map((k) => {
      const color = TONES[k.tone];
      return `${paint('#0f172a', ` ${k.key} `, lvl)}${paint(color, ` ${k.label} `, lvl)}`;
    }).join('  ');
    const row1 = centerLine(chips, this.width);
    const row2 = centerLine(
      paint('#64748b', 'space/enter: reveal   n: skip   esc: quit', lvl),
      this.width,
    );
    return ['', row1, row2];
  }
}

function centerLine(text: string, width: number): string {
  return ' '.repeat(Math.max(0, Math.floor((width - visibleOf(text)) / 2))) + text;
}

function visibleOf(text: string): number {
  let visible = 0;
  let inEscape = false;
  for (const ch of text) {
    if (ch === '\x1b') { inEscape = true; continue; }
    if (inEscape) {
      if (ch === 'm') inEscape = false;
      continue;
    }
    visible++;
  }
  return visible;
}
