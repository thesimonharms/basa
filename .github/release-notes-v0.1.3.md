## What's in 0.1.3

Patch release that adds a `--size` flag to `study` for capping how many cards a session covers.

### What's new

`study --size=N` (where `N` is a positive integer) limits the session to the first `N` cards in the loaded deck. The SRS progress file is untouched — only the in-memory card list is trimmed before the TUI starts, so the header progress bar reads `reviewed/N` for the session and the full deck's due schedule is preserved across sessions.

```sh
# Work through 10 cards from a deck today, then stop
npx -y @thesimonharms/basa@0.1.3 study --size=10 spanish-101
```

Invalid values (zero, negative, non-numeric) are rejected with a `usageError`; the flag is optional and the previous full-deck behavior is unchanged when omitted.

### Install

```sh
npx -y @thesimonharms/basa@0.1.3 study --size=10 spanish-101
# or
npm install -g @thesimonharms/basa
basa study --size=10 spanish-101
```