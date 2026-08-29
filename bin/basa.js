#!/usr/bin/env node
// Basa CLI shim. Boots the Mudah app kernel and points it at this
// package's own `dist/` for providers and commands, so a published
// install works from any working directory (not just the project root).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Application } from '@mudah-cli/core';
import { run } from '@mudah-cli/mudah';

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = dirname(here);
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));

// Application discovery defaults to <basePath>/src/{commands,providers}.
// The published package ships compiled output under dist/, so we pre-load
// the built providers and command modules from there and inject them via
// run({providers, commands}). This is the supported escape hatch for
// packages that don't follow the scaffolded-app layout.
const distDir = join(pkgDir, 'dist');
const commandModules = await loadModules(join(distDir, 'commands'));
const providerModules = await loadModules(join(distDir, 'providers'));

const manifest = {
  name: pkg.name,
  version: pkg.version,
  bin: 'basa',
  ui: { theme: 'auto' },
};

const app = new Application(pkgDir, manifest);
for (const mod of providerModules) {
  const value = mod.default ?? mod;
  if (typeof value === 'function') app.register(value);
}

const code = await run({
  app,
  cwd: process.cwd(),
  manifest,
  argv: process.argv.slice(2),
  stdout: process.stdout,
  stderr: process.stderr,
  stdin: process.stdin,
  commands: commandModules,
});

process.exitCode = code;

async function loadModules(dir) {
  const modules = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return modules;
  }
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(c?js|mjs)$/.test(entry.name)) continue;
    const file = join(dir, entry.name);
    const mod = await import(pathToFileURL(file).href);
    if (mod.default) modules.push(mod);
  }
  return modules;
}
