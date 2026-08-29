## What's in 0.1.0

Initial public release of **basa** — a TUI language-learning flashcard app for the terminal.

### Install

```sh
# Try it without installing
npx @thesimonharms/basa study spanish-101

# Or install globally
npm install -g @thesimonharms/basa
basa study spanish-101
```

Requires Node.js 26 or later.

### Features

- **SRS scheduling** — Anki-style spaced repetition with per-card state persisted next to the deck.
- **Plain-text or rich cards** — each side is a string, or a list of `text` / `image` / `audio` blocks.
- **Half-block ANSI image rendering** — preview scripts your terminal can't render (CJK, Arabic, Devanagari) by pointing at a PNG. No Kitty graphics or SIXEL required.
- **TUI keymap** — `space`/`enter` to reveal, `1`–`4` to grade, `n` to skip, `esc`/`ctrl+c` to save and quit. Shake on `Again`, confetti on `Easy`.
- **Optional sound effects** — auto-probes `pw-play` / `paplay` / `aplay`. Falls back to silent if none are on `PATH`.
- **YAML or JSON deck format** — edit, commit, share. Sample decks in the GitHub repo at `decks/`.

### Sample decks

`spanish-101`, `japanese-greetings`, and `japanese-with-images` are available in the GitHub repo. They're not shipped in the npm tarball.

### License

[MIT](https://github.com/thesimonharms/basa/blob/main/LICENSE) © Simon Harms.
