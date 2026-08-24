#!/usr/bin/env bash
# Bootstrap a fresh checkout (Claude Code cloud environments, CI, new machines).
# Idempotent: safe to run repeatedly. Runs from the repo root regardless of cwd.
set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || dirname "$0")/."
log() { printf '[setup] %s\n' "$*"; }

# --- Node --------------------------------------------------------------------
# asdf is optional; honor it when present (mirrors the local dev convention).
if command -v asdf >/dev/null 2>&1; then
  [ -d "$HOME/.asdf/shims" ] && export PATH="$HOME/.asdf/shims:$PATH"
  [ -f .tool-versions ] && asdf install >/dev/null 2>&1 || true
fi
command -v node >/dev/null 2>&1 || { log "node not found; install Node >=20 first"; exit 1; }
log "node $(node --version)"

# --- pnpm --------------------------------------------------------------------
# package.json pins "packageManager": "pnpm@X"; corepack resolves that exact
# version so cloud and local installs use the same lockfile semantics.
PNPM_SPEC="$(sed -n 's/.*"packageManager": *"\(pnpm@[^"]*\)".*/\1/p' package.json)"
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    log "enabling pnpm via corepack (${PNPM_SPEC:-latest})"
    corepack enable >/dev/null 2>&1 || true
    corepack prepare "${PNPM_SPEC:-pnpm@latest}" --activate
  else
    log "installing ${PNPM_SPEC:-pnpm} via npm"
    npm install -g "${PNPM_SPEC:-pnpm}"
  fi
fi
log "pnpm $(pnpm --version)"

# --- Dependencies ------------------------------------------------------------
# One install at the root covers every workspace package (engine/, web/).
# --frozen-lockfile fails loudly if pnpm-lock.yaml is out of date instead of
# silently rewriting it in a headless session.
log "pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile

# --- Env files ---------------------------------------------------------------
# Copy any tracked *.env.example to .env if the real file is absent.
for example in .env.example */.env.example; do
  [ -f "$example" ] || continue
  target="${example%.example}"
  if [ ! -f "$target" ]; then
    cp "$example" "$target"
    log "created $target from $example"
  fi
done

# --- Smoke check -------------------------------------------------------------
# The vitest suite is the only automated gate (sub-second). Skip with
# DUSTMAKER_SKIP_TESTS=1 when you only want dependencies.
if [ "${DUSTMAKER_SKIP_TESTS:-0}" != "1" ]; then
  log "pnpm test"
  pnpm test
fi

log "done"
