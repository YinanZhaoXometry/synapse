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

# Every gate for both stacks; any failure exits nonzero (shebang recipe: one
# bash script, `set -euo pipefail` — a failed step stops the run).
# Frontend: tsc -b → eslint → vitest run → vite build → mastery-vector
#   anti-drift (regenerate + stamp-insensitive diff)
#   (gate sequence: keep in sync with .github/workflows/ci.yml frontend job
#    and the frontend gates block in AGENTS.md)
# Backend: rubocop → rspec. RuboCop is DB-free: --no-deps + the dev entrypoint
# bypassed, with a bundle check/install guard keeping the run self-sufficient
# on a cold bundle-cache volume. RSpec is DB-backed since epic P2-1 ticket 02
# (the spine ER + model specs pin real rows): it runs WITH the db service and
# THROUGH the dev entrypoint, which bundle-installs and runs db:prepare against
# the test database selected by the DATABASE_URL override. Both runs force
# RAILS_ENV=test — the compose service default (development) would trip
# request specs' Host Authorization and other dev-only behavior.
spec:
    #!/usr/bin/env bash
    set -euo pipefail
    # Codegen + freshness (AD-17/AD-18, epic P2-8 T1): the committed typed
    # documents are runtime-load-bearing; regenerate from backend/schema.graphql
    # and fail on drift — schema changes must land with regenerated output.
    # Mirrors ci.yml's frontend job.
    pnpm --dir frontend run codegen
    git diff --exit-code -- frontend/src/types/graphql.ts
    pnpm --dir frontend exec tsc -b
    pnpm --dir frontend exec eslint .
    pnpm --dir frontend exec vitest run --coverage
    pnpm --dir frontend exec vite build
    # Mastery-vector anti-drift (AD-14): the TS domain (frontend/src/domain/
    # mastery.ts + streak.ts) is the golden-vector source of truth until the
    # cutover retires it — regenerate the committed fixture and require the
    # same pinned behavior. The diff is STAMP-INSENSITIVE (epic P2-4 review):
    # meta.generatedAtSourceCommit is advisory provenance, not contract — it is
    # self-referential (SOURCE_PATHS includes the generator; fixture commits
    # ride generator edits), so vector-extending commits provably land stale
    # stamps (7a6c4b3, f69f7aa). Strip the stamp from BOTH the committed and the
    # regenerated fixture (temp files out of the tree), diff those, and restore
    # the pre-regen file on success so a stamp-only rewrite leaves no residue.
    # Mirrors ci.yml's anti-drift step; retires with the TS side at cutover.
    fixture=backend/spec/fixtures/mastery_vectors.json
    snapshot="$(mktemp)"; committed="$(mktemp)"; regenerated="$(mktemp)"
    trap 'rm -f "$snapshot" "$committed" "$regenerated"' EXIT
    cp "$fixture" "$snapshot"
    jq 'del(.meta.generatedAtSourceCommit)' "$fixture" > "$committed"
    pnpm --dir frontend run generate:mastery-vectors
    jq 'del(.meta.generatedAtSourceCommit)' "$fixture" > "$regenerated"
    diff -u "$committed" "$regenerated"
    cmp -s "$fixture" "$snapshot" || cp "$snapshot" "$fixture"
    {{compose}} run --no-deps --entrypoint "" -e RAILS_ENV=test backend sh -c 'bundle check || bundle install && bundle exec rubocop'
    {{compose}} run -e RAILS_ENV=test -e DATABASE_URL=postgres://postgres:postgres@db:5432/backend_test backend sh -c 'bundle exec rspec'

# Stop the backend stack (images stay cached).
down:
    {{compose}} down

# The Playwright e2e suite (frontend/e2e, frontend/pnpm run test:e2e): flips
# the backend to the stub AI provider (compose.e2e.yaml — no GLM key, no live
# AI), runs the critical-flow specs, then ALWAYS restores the demo stack on
# the way out — a forgotten restore would silently point the demo's AI at the
# stub. `just dev` may run or not (Playwright reuses or starts Vite).
e2e:
    #!/usr/bin/env bash
    set -euo pipefail
    e2e_files="-f backend/.dockerdev/compose.yaml"
    restore_files="-f backend/.dockerdev/compose.yaml"
    if [ -f backend/.dockerdev/compose.override.yaml ]; then
      e2e_files="$e2e_files -f backend/.dockerdev/compose.override.yaml"
      restore_files="$restore_files -f backend/.dockerdev/compose.override.yaml"
    fi
    e2e_files="$e2e_files -f backend/.dockerdev/compose.e2e.yaml"
    restore() {
      # shellcheck disable=SC2086
      docker compose $restore_files up -d --wait
    }
    trap restore EXIT
    # shellcheck disable=SC2086
    docker compose $e2e_files up -d --wait
    pnpm --dir frontend exec playwright test

# Follow the backend stack's logs.
logs:
    {{compose}} logs -f
