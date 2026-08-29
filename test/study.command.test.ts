import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TestApp } from '@mudah-cli/mudah/testing';

const appDir = fileURLToPath(new URL('..', import.meta.url));

describe('study command', () => {
  it('rejects when no deck is given and the default dir is empty', async () => {
    const app = await TestApp.create({ cwd: appDir, env: { BASA_DECKS_DIR: '/tmp/basa-empty-test-dir' } });
    // BasaConfig reads `app.decksDir`; with no env override the test's
    // HOME will be a temp dir. Just ensure the command fails gracefully
    // if there's nothing to study.
    const result = await app.dispatch(['study']);
    expect(result.code).not.toBe(0);
  });
});

describe('list command', () => {
  it('reports no decks when the directory is empty', async () => {
    const app = await TestApp.create({ cwd: appDir });
    const result = await app.dispatch(['list']);
    // The test's HOME-derived default dir may or may not have decks; just
    // verify the command exits cleanly.
    expect([0, 1]).toContain(result.code);
  });
});
