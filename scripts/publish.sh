#!/usr/bin/env bash
# Publish @thesimonharms/basa to npm.
#
# Usage:  ./scripts/publish.sh
#
# Pre-reqs (run once per machine):
#   npm login
#   # OR add a token to ~/.npmrc:
#   #   //registry.npmjs.org/:_authToken=npm_xxxxxxxxxxxxxxxx
#
# This script is intentionally chatty: it runs a dry-run pack, prints the
# tarball contents, asks for confirmation, then publishes. It will refuse
# to publish if you have uncommitted changes or if `npm whoami` fails.

set -euo pipefail

cd "$(dirname "$0")/.."

bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
red()   { printf '\033[31m%s\033[0m\n' "$*"; }
blue()  { printf '\033[34m%s\033[0m\n' "$*"; }

# 1. Sanity: npm auth.
bold "1. Checking npm auth…"
if ! npm whoami >/dev/null 2>&1; then
  red "  ✗ npm whoami failed — you are not logged in."
  echo "    Run:  npm login"
  echo "    or set a token in ~/.npmrc and re-run this script."
  exit 1
fi
NPM_USER=$(npm whoami)
green "  ✓ logged in as $NPM_USER"

# Refuse to publish unless the npm user owns the scope.
if [ "$NPM_USER" != "thesimonharms" ]; then
  red "  ✗ logged in as '$NPM_USER', but the package is scoped under @thesimonharms."
  red "    Re-run \`npm login\` as thesimonharms, or change the scope in package.json."
  exit 1
fi

# 2. Sanity: working tree clean.
bold "2. Checking working tree…"
if ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet HEAD 2>/dev/null; then
  red "  ✗ you have uncommitted or staged changes."
  echo "    Commit or stash them before publishing."
  git status --short
  exit 1
fi
green "  ✓ working tree clean"

# 3. Sanity: on main, in sync with origin.
bold "3. Checking branch…"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  red "  ✗ you are on '$BRANCH', expected 'main'."
  exit 1
fi
git fetch origin --quiet
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" != "$REMOTE" ]; then
  red "  ✗ local main ($LOCAL) is not in sync with origin/main ($REMOTE)."
  exit 1
fi
green "  ✓ on main, in sync with origin"

# 4. Sanity: tag matches package.json version.
bold "4. Checking version…"
VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"
if ! git rev-parse "$TAG" >/dev/null 2>&1; then
  red "  ✗ no git tag $TAG exists."
  echo "    Run:  git tag -a $TAG -m \"$TAG\" && git push origin $TAG"
  exit 1
fi
green "  ✓ package.json version ($VERSION) matches tag $TAG"

# 5. Tests + typecheck.
bold "5. Running tests and typecheck…"
if ! npm test --silent; then
  red "  ✗ tests failed."
  exit 1
fi
if ! npm run typecheck --silent; then
  red "  ✗ typecheck failed."
  exit 1
fi
green "  ✓ tests + typecheck clean"

# 6. Build: tsc → dist/. `prepublishOnly` will also run this when we
#    hit `npm publish`, but doing it now means the dry-run below
#    shows the right tarball contents.
#
#    We do NOT run `npm pkg fix` here on purpose. `npm pkg fix`
#    rewrites "./bin/basa.js" → "bin/basa.js" (strips the ./), which
#    npm then warns about and applies to the registry metadata view
#    while still shipping a working tarball. The rewrite is harmless
#    for the package, but it would force a confusing
#    `git diff package.json` step on every release. Skip it.
bold "6. Building…"
rm -rf dist
if ! npm run build --silent; then
  red "  ✗ tsc build failed."
  exit 1
fi
if [ ! -f dist/commands/study.command.js ]; then
  red "  ✗ build output looks wrong — dist/commands/study.command.js is missing."
  exit 1
fi
green "  ✓ dist/ built (commands and providers present)"

# 7. Pack dry-run: show what's about to be uploaded.
bold "7. Inspecting tarball…"
npm pack --dry-run

# 8. Confirm.
echo
blue "About to publish @thesimonharms/basa@$VERSION to the public npm registry."
blue "This is irreversible (you can deprecate or unpublish within 72 hours, but"
blue "a name that has been taken and then freed cannot be re-claimed the same way)."
echo
read -r -p "Type 'publish' to continue, anything else to abort: " CONFIRM
if [ "$CONFIRM" != "publish" ]; then
  red "Aborted."
  exit 1
fi

# 9. Publish.
bold "9. Publishing…"
npm publish --access public

# 10. Verify.
bold "10. Verifying…"
sleep 2
if npm view "@thesimonharms/basa@$VERSION" version >/dev/null 2>&1; then
  green "  ✓ @thesimonharms/basa@$VERSION is live on the registry."
  echo
  blue "Try it:"
  echo "    npx @thesimonharms/basa --help"
else
  red "  ✗ could not verify the published version. Check https://www.npmjs.com/package/@thesimonharms/basa manually."
  exit 1
fi
