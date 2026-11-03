# Synapse root entrypoint — frontend/ + backend/ + this file (AD-17).
#
# nvm-shim lesson (2026-11-03): `just` runs recipes in a non-interactive shell
# where nvm's PATH additions are absent, so a bare pnpm/node/npm crash with
# "node: command not found". We put the pinned Node (frontend/.nvmrc) on PATH
# ourselves; recipes call pnpm — never npm/npx (A4: pnpm is the only
# lockfile-honest package manager).
# Resolve the pinned Node (frontend/.nvmrc) to its bin dir, failing fast with a
# clear message when nothing is installed under that glob — an unexpanded glob
# would silently land on PATH and every recipe would die later with an opaque
# "node: command not found".
node_bin := `bin=$(echo "$HOME"/.nvm/versions/node/v"$(cat frontend/.nvmrc)"*/bin | head -n1)
if [ ! -d "$bin" ]; then
  echo "just: node v$(cat frontend/.nvmrc) (frontend/.nvmrc) is not installed under ~/.nvm/versions/node — run: nvm install $(cat frontend/.nvmrc)" >&2
  exit 1
fi
echo "$bin"`
export PATH := node_bin + ":" + env_var("HOME") + "/Library/pnpm:" + env_var("PATH")

compose := "docker compose -f backend/.dockerdev/compose.yaml"

# List the available targets.
default:
    @just --list

# Frontend package install + backend dev image build — run this when a session starts.
setup:
    pnpm --dir frontend install --frozen-lockfile
    {{compose}} build

# Frontend Vite dev server only (the backend has no web-facing behavior until cutover).
dev:
    pnpm --dir frontend dev

# Compose postgres + backend; returns once the backend actually answers the health query.
up:
    #!/usr/bin/env bash
    set -euo pipefail
    {{compose}} up -d --wait
    for i in $(seq 1 60); do
      if curl -sf -X POST http://localhost:3000/graphql -H 'Content-Type: application/json' -d '{"query":"{ health }"}' > /dev/null; then
        echo "backend is up: health query answered"
        exit 0
      fi
      sleep 1
    done
    echo "backend did not answer the health query within 60s" >&2
    exit 1

# Every gate for both stacks; any failure exits nonzero.
# Frontend: tsc -b → eslint → vitest run → vite build
#   (gate sequence: keep in sync with .github/workflows/ci.yml frontend job
#    and the frontend gates block in AGENTS.md)
# Backend: rubocop → rspec — DB-free, so the runs use --no-deps and bypass the dev
# entrypoint (its db:prepare would need postgres); a bundle check/install guard
# keeps the gate runs self-sufficient on a cold bundle-cache volume. Gate runs
# force RAILS_ENV=test — the compose service default (development) would trip
# request specs' Host Authorization and other dev-only behavior.
spec:
    pnpm --dir frontend exec tsc -b && \
    pnpm --dir frontend exec eslint . && \
    pnpm --dir frontend exec vitest run && \
    pnpm --dir frontend exec vite build && \
    {{compose}} run --no-deps --entrypoint "" -e RAILS_ENV=test backend sh -c 'bundle check || bundle install && bundle exec rubocop' && \
    {{compose}} run --no-deps --entrypoint "" -e RAILS_ENV=test backend sh -c 'bundle check || bundle install && bundle exec rspec'

# Stop the backend stack (images stay cached).
down:
    {{compose}} down

# Follow the backend stack's logs.
logs:
    {{compose}} logs -f
