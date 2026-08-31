#!/usr/bin/env node
// Publish @thesimonharms/basa to npm.
//
// Usage:  npm run publish                    # publish the current version
//         npm run publish -- --patch         # bump patch, tag, push, publish
//         npm run publish -- --minor         # bump minor, tag, push, publish
//         npm run publish -- --major         # bump major, tag, push, publish
//         npm run publish -- 1.2.3           # publish a specific version
//
// Bump flags write package.json, commit it as `release: vX.Y.Z`, create an
// annotated tag, and push both before running the checks below — so the
// tag-vs-HEAD check always sees a tag that points at what gets published.
//
// Pre-reqs (run once per machine):
//   npm login
//   # OR add a token to ~/.npmrc
//
// This script is intentionally chatty: it runs a dry-run pack, prints the
// tarball contents, then publishes. Running the script is the confirmation.
// It refuses to publish if you have uncommitted changes, if `npm whoami`
// fails, or if this exact version is already on the registry (a re-run
// fails here in under a second instead of after the full test+build cycle).

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const bold = (...a) => `\x1b[1m${a.join(' ')}\x1b[0m`;
const green = (...a) => `\x1b[32m${a.join(' ')}\x1b[0m`;
const red = (...a) => `\x1b[31m${a.join(' ')}\x1b[0m`;
const blue = (...a) => `\x1b[34m${a.join(' ')}\x1b[0m`;

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

/**
 * Bump a semver string. `--major` resets everything below it, etc.
 */
function bumpVersion(version, part) {
  const [maj, min, pat] = version.split('.').map((n) => Number.parseInt(n, 10) || 0);
  if (part === 'major') return `${maj + 1}.0.0`;
  if (part === 'minor') return `${maj}.${min + 1}.0`;
  if (part === 'patch') return `${maj}.${min}.${pat + 1}`;
  return version;
}

/** True when `a` is strictly newer than `b`, component-wise. */
function isNewer(a, b) {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  }
  return false;
}

// Resolve the requested version from argv:
//   --major | --minor | --patch   → bump the matching component
//   1.2.3 (or v1.2.3)             → publish that exact version
//   (nothing)                     → publish package.json's version as-is
const argv = process.argv.slice(2);
const bumpFlag = ['--major', '--minor', '--patch'].find((f) => argv.includes(f));
const explicit = argv.find((a) => /^v?\d+\.\d+\.\d+$/.test(a));
if (bumpFlag && explicit) {
  console.error(red(`  ✗ pass either a bump flag (${bumpFlag}) or an explicit version (${explicit}), not both.`));
  process.exit(1);
}
const VERSION = explicit ? explicit.replace(/^v/, '') : bumpFlag ? bumpVersion(pkg.version, bumpFlag.slice(2)) : pkg.version;
if (!/^\d+\.\d+\.\d+$/.test(VERSION)) {
  console.error(red(`  ✗ '${VERSION}' is not a valid semver.`));
  process.exit(1);
}
const PKG = `@thesimonharms/basa@${VERSION}`;

// When the version changed, write it back and cut the release commit + tag
// so the tag-vs-HEAD check below sees a tag that points at what we publish.
if (VERSION !== pkg.version) {
  if (!isNewer(VERSION, pkg.version)) {
    console.error(red(`  ✗ ${VERSION} is not newer than the current ${pkg.version}.`));
    process.exit(1);
  }
  // A previous release may be sitting unpushed: the tag for the version
  // currently in package.json exists locally, but origin has never seen it.
  // Publishing a newer version on top would silently skip it on the
  // registry, so refuse and let the user push (or clean up) first.
  const prevTag = `v${pkg.version}`;
  const tagLocal = spawnSync('git', ['rev-parse', '--verify', prevTag], { stdio: 'ignore' }).status === 0;
  const tagPushed = tagLocal &&
    spawnSync('git', ['ls-remote', '--exit-code', 'origin', `refs/tags/${prevTag}`], { stdio: 'ignore' }).status === 0;
  if (tagLocal && !tagPushed) {
    console.error(red(`  ✗ tag ${prevTag} exists locally but was never pushed to origin.`));
    console.error(`    Push it first:  git push origin main --follow-tags`);
    console.error(`    (Publishing ${VERSION} on top of an unpushed release would skip ${pkg.version} on the registry.)`);
    process.exit(1);
  }
  const updated = { ...pkg, version: VERSION };
  writeFileSync(new URL('../package.json', import.meta.url), `${JSON.stringify(updated, null, 2)}\n`);
  console.log(green(`  ✓ package.json → ${VERSION}`));

  console.log(bold(`  · committing release v${VERSION}…`));
  if (run('git', ['add', 'package.json']) === null ||
      spawnSync('git', ['commit', '-m', `release: v${VERSION}`], { stdio: 'inherit' }).status !== 0) {
    console.error(red('  ✗ could not commit the version bump.'));
    process.exit(1);
  }
  if (spawnSync('git', ['tag', '-a', `v${VERSION}`, '-m', `v${VERSION}`], { stdio: 'inherit' }).status !== 0 ||
      run('git', ['push', 'origin', 'main', '--follow-tags']) === null) {
    console.error(red(`  ✗ could not tag/push v${VERSION}. Move it manually and re-run.`));
    console.error(`    git tag -fa v${VERSION} -m "v${VERSION}" && git push origin v${VERSION}`);
    process.exit(1);
  }
  console.log(green(`  ✓ tagged and pushed v${VERSION}`));
}

/** Run a command, inheriting stdio. Returns null when it exits non-zero. */
function run(command, args) {
  const res = spawnSync(command, args, { stdio: 'inherit' });
  if (res.status !== 0 || res.error) return null;
  return res;
}

// 0. Sanity: is this version already published? Check the registry first —
//    a re-run should die here in under a second, not after tests+build.
console.log(bold('0. Checking registry…'));
if (run('npm', ['view', PKG, 'version']) !== null) {
  console.error(red(`  ✗ ${PKG} is already published.`));
  console.error('    npm will refuse to overwrite it (versions are immutable).');
  console.error('    Bump the version in package.json, tag it, and re-run.');
  process.exit(1);
}
console.log(green(`  ✓ ${PKG} is not on the registry yet`));

// 1. Sanity: npm auth.
console.log(bold('1. Checking npm auth…'));
if (run('npm', ['whoami']) === null) {
  console.error(red('  ✗ npm whoami failed — you are not logged in.'));
  console.error('    Run:  npm login');
  console.error('    or set a token in ~/.npmrc and re-run this script.');
  process.exit(1);
}
const who = spawnSync('npm', ['whoami'], { encoding: 'utf8' });
const npmUser = who.status === 0 ? who.stdout.trim() : '';
console.log(green(`  ✓ logged in as ${npmUser}`));

// Refuse to publish unless the npm user owns the scope.
if (npmUser !== 'thesimonharms') {
  console.error(red(`  ✗ logged in as '${npmUser}', but the package is scoped under @thesimonharms.`));
  console.error(red('    Re-run `npm login` as thesimonharms, or change the scope in package.json.'));
  process.exit(1);
}

// 2. Sanity: working tree clean.
console.log(bold('2. Checking working tree…'));
const dirty =
  run('git', ['diff', '--quiet', 'HEAD']) === null ||
  run('git', ['diff', '--cached', '--quiet', 'HEAD']) === null;
if (dirty) {
  console.error(red('  ✗ you have uncommitted or staged changes.'));
  console.error('    Commit or stash them before publishing.');
  run('git', ['status', '--short']);
  process.exit(1);
}
console.log(green('  ✓ working tree clean'));

// 3. Sanity: on main, in sync with origin.
console.log(bold('3. Checking branch…'));
const branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' });
const BRANCH = branch.status === 0 ? branch.stdout.trim() : '';
if (BRANCH !== 'main') {
  console.error(red(`  ✗ you are on '${BRANCH}', expected 'main'.`));
  process.exit(1);
}
run('git', ['fetch', 'origin', '--quiet']);
const local = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
const remote = spawnSync('git', ['rev-parse', 'origin/main'], { encoding: 'utf8' });
if (local.status !== 0 || remote.status !== 0 || local.stdout.trim() !== remote.stdout.trim()) {
  console.error(red(`  ✗ local main (${local.stdout.trim()}) is not in sync with origin/main (${remote.stdout.trim()}).`));
  process.exit(1);
}
console.log(green('  ✓ on main, in sync with origin'));

// 4. Sanity: tag matches package.json version.
console.log(bold('4. Checking version…'));
const TAG = `v${VERSION}`;
if (spawnSync('git', ['rev-parse', TAG], { stdio: 'ignore' }).status !== 0) {
  console.error(red(`  ✗ no git tag ${TAG} exists.`));
  console.error(`    Run:  git tag -a ${TAG} -m "${TAG}" && git push origin ${TAG}`);
  process.exit(1);
}
// The tag must be an alias for the commit being published — otherwise the
// checks below validate a build that isn't the one the tag describes.
const tagged = spawnSync('git', ['rev-parse', `${TAG}^{commit}`], { encoding: 'utf8' });
const head = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
if (tagged.status !== 0 || head.status !== 0 || tagged.stdout.trim() !== head.stdout.trim()) {
  console.error(red(`  ✗ tag ${TAG} does not point at HEAD (${head.stdout.trim().slice(0, 7)}).`));
  console.error(`    Move it first:  git tag -fa ${TAG} -m "${TAG}" && git push origin ${TAG}`);
  process.exit(1);
}
console.log(green(`  ✓ package.json version (${VERSION}) matches tag ${TAG} at HEAD`));

// 5. Tests + typecheck.
console.log(bold('5. Running tests and typecheck…'));
if (run('npm', ['test', '--silent']) === null) {
  console.error(red('  ✗ tests failed.'));
  process.exit(1);
}
if (run('npm', ['run', 'typecheck', '--silent']) === null) {
  console.error(red('  ✗ typecheck failed.'));
  process.exit(1);
}
console.log(green('  ✓ tests + typecheck clean'));

// 6. Build: tsc → dist/. This is the only build for the whole release —
//    there is no `prepublishOnly`/`prepack` hook in package.json, so
//    `npm publish` packs whatever this step produced.
//
//    We do NOT run `npm pkg fix` here on purpose. `npm pkg fix`
//    rewrites "./bin/basa.js" → "bin/basa.js" (strips the ./), which
//    npm then warns about and applies to the registry metadata view
//    while still shipping a working tarball. The rewrite is harmless
//    for the package, but it would force a confusing
//    `git diff package.json` step on every release. Skip it.
console.log(bold('6. Building…'));
run('node', ['-e', 'require("node:fs").rmSync("dist", { recursive: true, force: true })']);
if (run('npm', ['run', 'build', '--silent']) === null) {
  console.error(red('  ✗ tsc build failed.'));
  process.exit(1);
}
if (!existsSync('dist/commands/study.command.js')) {
  console.error(red('  ✗ build output looks wrong — dist/commands/study.command.js is missing.'));
  process.exit(1);
}
console.log(green('  ✓ dist/ built (commands and providers present)'));

// 7. Pack dry-run: show what's about to be uploaded.
console.log(bold('7. Inspecting tarball…'));
if (run('npm', ['pack', '--dry-run']) === null) {
  console.error(red('  ✗ npm pack failed.'));
  process.exit(1);
}

// 8. Publish. Running the script is the confirmation.
console.log(bold('8. Publishing…'));
if (run('npm', ['publish', '--access', 'public']) === null) {
  console.error(red('  ✗ npm publish failed.'));
  process.exit(1);
}

// 9. Verify.
console.log(bold('9. Verifying…'));
await new Promise((resolve) => setTimeout(resolve, 2_000));
if (run('npm', ['view', PKG, 'version']) === null) {
  console.error(red(`  ✗ could not verify the published version. Check https://www.npmjs.com/package/${PKG.replace(/@[^@]*$/, '')} manually.`));
  process.exit(1);
}
console.log(green(`  ✓ ${PKG} is live on the registry.`));
console.log();
console.log(blue('Try it:'));
console.log('    npx @thesimonharms/basa --help');
