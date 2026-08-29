#!/usr/bin/env node
// Basa CLI shim. Boots the Mudah app kernel and points it at this
// package's own `dist/` for providers and commands, so a published
// install works from any working directory (not just the project root).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Application } from '@mudah-cli/core';
import { run } from '@mudah-cli/mudah';

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = dirname(here);
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));

const manifest = {
  name: pkg.name,
  version: pkg.version,
  bin: 'basa',
  ui: { theme: 'auto' },
};

const app = new Application(pkgDir, manifest);

const code = await run({
  app,
  cwd: process.cwd(),
  manifest,
  argv: process.argv.slice(2),
  stdout: process.stdout,
  stderr: process.stderr,
  stdin: process.stdin,
});

process.exitCode = code;
