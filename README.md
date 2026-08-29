# basa

A TUI language-learning flashcard app built on [Mudah](https://github.com/thesimonharms/mudah). Decks are plain YAML or JSON files you can edit, commit, and share. Each side of a card can be a string, or a list of `text` / `image` / `audio` fields — handy for scripts your terminal can't render reliably.

## Quick start

```sh
# Run without installing — uses npx and the scoped package.
npx @thesimonharms/basa --help
npx @thesimonharms/basa list
npx @thesimonharms/basa study spanish-101

# Or install globally and use the short `basa` command.
npm install -g @thesimonharms/basa
basa list
basa study spanish-101
```

Requires Node.js 26 or later.

## Install

```sh
npm install -g @thesimonharms/basa
```

That puts a `basa` command on your `PATH`. To use a specific deck directory, set the `BASA_DECKS_DIR` env var.

For local development:

```sh
git clone https://github.com/thesimonharms/basa
cd basa
npm install
npm run study spanish-101
```

## Usage

```sh
# List bundled and user decks, with due-card counts.
basa list

# Open a study session. Without an argument, opens the only deck in
# ~/basa/decks.
basa study
basa study spanish-101

# Create an empty deck scaffold (YAML by default; --format=json for JSON).
basa new italian-101
basa new italian-101 --format=json
```

While studying:

| Key                 | Action                                                  |
| ------------------- | ------------------------------------------------------- |
| `space` / `enter`   | Reveal the back of the card (with a type-on animation)   |
| `1` … `4`           | Grade: Again / Hard / Good / Easy                       |
| type                | Buffer your answer; submit by grading                   |
| `n`                 | Skip the card (shown again in 30 seconds, no progress)  |
| `esc` / `ctrl+c`    | Save and quit                                           |

The first time you grade `Easy` you'll get a confetti burst; grading `Again`
makes the card shake. Right or wrong plays a short tone if your system has
`paplay`, `pw-play`, or `aplay` on `PATH`. No audio? Nothing happens — no
errors.

## Deck format

Decks live in `~/basa/decks/*.yml` (or `.yaml`/`.json`) by default. Override
with the `BASA_DECKS_DIR` env var or by editing `config/app.ts`.

Sample decks live in the [GitHub repo](https://github.com/thesimonharms/basa/tree/main/decks) — they're not shipped in the npm package.

### Minimal

```yaml
name: Spanish 101
description: First-year Spanish vocab
cards:
  - front: hola
    back: hello
  - front: adiós
    back: goodbye
```

### With image and audio fields

Any field can be a list of `{text?, image?, audio?}` blocks. The renderer
walks the list top-to-bottom, leaving a blank line between fields. Images
are decoded with ImageMagick (`magick` on `PATH`) and rendered as ANSI
half-block cells in truecolor — works in any modern terminal, no
Kitty/SIXEL required.

```yaml
name: Japanese greetings
cards:
  - front:
      - text: こんにちは
      - image: ./assets/konnichiwa.png
    back: hello / good afternoon
    hint: spelled K-O-N-N-I-CHI-W-A
  - front: ありがとう
    back: thank you
    audio: ./assets/aratou.wav
```

`./assets/...` is resolved relative to the deck file's directory.

### Why images for scripts?

Terminal font coverage for CJK, Arabic, Devanagari, and other complex
scripts is uneven — boxes, missing glyphs, or wrong widths are common. The
`image:` field lets you point at a PNG/JPEG of the rendered text and
guarantee a beautiful card on every machine. Pre-render with `magick
-font /usr/share/fonts/... -pointsize 64 label:'こんにちは' out.png` or
whatever font pipeline you like.

## Storage

Progress is stored in a sibling file next to each deck: `spanish-101.yml.progress.json`.
It holds SRS state per card, keyed by index. Delete it to start over.

## Sound

| Setting | Effect                                                  |
| ------- | ------------------------------------------------------- |
| `on`    | Always try to play (still degrades to silent if no tool) |
| `off`   | Never play                                              |
| `auto`  | Default. Probe `pw-play` / `paplay` / `aplay` on `PATH`  |

Override per-invocation with `--no-sound`, or globally in `config/app.ts` by
setting `sound: 'off'`.

## Structure

- `bin/basa.js` — executable entrypoint
- `src/flashcards/` — pure logic (types, SRS, deck I/O, sound, image, render)
- `src/tui/` — the TUI widgets (CardView, Header, Footer, StudyApp, effects)
- `src/commands/` — one `*.command.ts` per CLI command
- `decks/` — sample decks (GitHub only; not in the npm tarball)
- `test/` — vitest unit tests
- `config/app.ts` — schema-validated defaults

## Development

```sh
npm test             # vitest run
npm run typecheck    # tsc --noEmit
```

## Adding a command

```sh
node bin/basa.js make command quiz
```

## License

[MIT](./LICENSE) © Simon Harms.
