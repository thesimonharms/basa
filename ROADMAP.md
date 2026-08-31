# Basa Roadmap

Living list of feature ideas. Checked items are shipped; everything else is
up for grabs. Add to it, argue with it, cross things off.

## Study modes

- [ ] **Drill mode** (`basa study --drill`) — hammer a deck with zero SRS
  bookkeeping: no grading persistence, no due dates, no progress file. Your
  right to ignore the algorithm entirely.
- [ ] **Typed-answer mode** (`--typed`) — require typing the back instead of
  pressing 1-4. Reuses `isExactMatch` / `isFuzzyMatch` from `match.ts`; a
  near-miss shakes the card.
- [ ] **Cram mode** — review a filtered set (by tag or size) without touching
  SRS state.
- [ ] **Sampled sessions** — `--size=N` picks a *random sample* of N cards
  each round instead of always the first N, so small decks rotate.

## Import / export

- [ ] **Anki import** (`basa import deck.apkg`) — read `.apkg` (a zip holding
  a SQLite collection), map notes to `front`/`back` + tags, write a YAML
  deck. Pure TS: zip parsing via the central directory, deflate via
  `node:zlib`, SQLite via `node:sqlite`.
- [ ] **CSV / TSV import** — two-column front/back, `#tag` columns merged.
- [ ] **Export** — deck to CSV/TSV for round-tripping with other tools.

## Tags

- [ ] **Tag filtering** — `basa list --tag=japanese`, `basa study --tag=x`.
  Cards carry `tags?: string[]`; decks carry deck-level tags too.
- [ ] **Tag management via CLI** —
  `basa tag <deck> add <tag>`, `basa tag <deck> rm <tag>`,
  `basa tag <deck> list`. Edits the deck file in place.

## Stats

- [ ] **Per-deck stats** (`basa stats --deck=<name>`) — cards, reviews,
  accuracy, due count for one deck.
- [ ] **`--json` output** — `list --json` and `stats --json` for scripting.
- [ ] **Leech detection** — cards graded `again` past a threshold get flagged
  in `stats`.

## Plumbing

- [ ] **Media validation** (`basa doctor`) — warn about image/audio
  references that don't resolve.
- [ ] **Config schema surfacing** — `config/app.ts` is the single place
  defaults live; document it.
