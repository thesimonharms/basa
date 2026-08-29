## What's in 0.1.2

Patch release that fixes the **`Unknown command`** bug in 0.1.0 and 0.1.1.

### What was broken

0.1.0 and 0.1.1 shipped a `bin/basa.js` shim that set `Application.basePath` to the package's install dir, but `@mudah-cli/core`'s command and provider discovery look in `<basePath>/src/{commands,providers}` by default. The published package ships compiled output under `dist/` (no `src/`), so discovery returned empty and `npx @thesimonharms/basa study` reported "Unknown command".

### What changed

`bin/basa.js` now pre-loads every `dist/commands/*.js` and `dist/providers/*.js`, registers the providers with `app.register()`, and injects the command modules via `run({commands})`. The default discovery is harmless (it just finds nothing in the missing `src/`), and the injected modules take their place.

### Install

```sh
npx -y @thesimonharms/basa@0.1.2 study spanish-101
# or
npm install -g @thesimonharms/basa
basa study spanish-101
```

### Note on 0.1.0 and 0.1.1

Both 0.1.0 and 0.1.1 are now deprecated on npm. Their tarballs contain a working `basa` binary, but the `bin` field in the registry metadata is silently auto-corrected by npm (drops the `./` prefix) which can confuse tools that read the metadata before installing. The actual install path works, but please upgrade to 0.1.2 for the corrected behavior.
