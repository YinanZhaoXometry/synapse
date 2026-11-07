# Synapse root entrypoint — frontend/ + backend/ + this file (AD-17).
#
# nvm-shim lesson (2026-11-03): `just` runs recipes in a non-interactive shell
# where nvm's PATH additions are absent, so a bare node/npm crash with
# "node: command not found". We put the pinned Node (frontend/.nvmrc) on PATH
# ourselves; recipes call npm (2026-11-07 owner decision: pnpm → npm for
# simpler new-user setup — package-lock.json is the only lockfile, `npm ci`
# is the frozen install).
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
export PATH := node_bin + ":" + env_var("PATH")

compose := "docker compose -f backend/.dockerdev/compose.yaml"

# List the available targets.
default:
    @just --list

# Frontend package install + MinIO image bootstrap + backend dev image build —
# run this when a session starts (the MinIO step only builds once per machine).
setup:
    cd frontend && npm ci
    just minio-image
    {{compose}} build

# Fresh-machine bootstrap for the pinned MinIO image: no registry carries it
# (community distribution archived late 2025 — full grave report in
# .dockerdev/Dockerfile.minio). Builds the pinned server release + mc client
# from source inside Docker (no host Go needed — mirrors ci.yml's e2e job)
# and tags it exactly what compose.yaml expects. Idempotent: skips when the
# image already exists locally. Filtered-network knobs (both no-ops when
# unset, details in Dockerfile.minio's network note):
#   SYNAPSE_GOPROXY=https://goproxy.cn,direct      — Go module mirror
#   SYNAPSE_DOCKER_MIRROR=docker.m.daocloud.io     — base-image mirror (bare
#     host, no scheme — it's spliced into an image reference)
minio-image:
    #!/usr/bin/env bash
    set -euo pipefail
    tag=minio/minio:RELEASE.2025-10-15T17-29-55Z
    if docker image inspect "$tag" >/dev/null 2>&1; then
      echo "minio image already present: $tag (skipping the source build)"
      exit 0
    fi
    build_args=""
    if [ -n "${SYNAPSE_DOCKER_MIRROR:-}" ]; then
      build_args="$build_args --build-arg GO_IMAGE=$SYNAPSE_DOCKER_MIRROR/library/golang:1.25-bookworm --build-arg RUN_IMAGE=$SYNAPSE_DOCKER_MIRROR/library/ubuntu:24.04"
    fi
    if [ -n "${SYNAPSE_GOPROXY:-}" ]; then
      build_args="$build_args --build-arg GOPROXY=$SYNAPSE_GOPROXY"
    fi
    # shellcheck disable=SC2086
    docker build $build_args -t "$tag" -f backend/.dockerdev/Dockerfile.minio backend/.dockerdev

# Frontend Vite dev server (host Node toolchain, hot reload). The SPA proxies
# /graphql to localhost:3000 — bring the backend stack up first (`just up`).
dev:
    cd frontend && npm run dev

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
    (cd frontend && npm run codegen)
    git diff --exit-code -- frontend/src/types/graphql.ts
    (cd frontend && npx tsc -b)
    (cd frontend && npx eslint .)
    (cd frontend && npx vitest run --coverage)
    (cd frontend && npx vite build)
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
    (cd frontend && npm run generate:mastery-vectors)
    jq 'del(.meta.generatedAtSourceCommit)' "$fixture" > "$regenerated"
    diff -u "$committed" "$regenerated"
    cmp -s "$fixture" "$snapshot" || cp "$snapshot" "$fixture"
    {{compose}} run --no-deps --entrypoint "" -e RAILS_ENV=test backend sh -c 'bundle check || bundle install && bundle exec rubocop'
    {{compose}} run -e RAILS_ENV=test -e DATABASE_URL=postgres://postgres:postgres@db:5432/backend_test backend sh -c 'bundle exec rspec'

# Stop the backend stack (images stay cached).
down:
    {{compose}} down

# The Playwright e2e suite (frontend/e2e, from frontend/: `npm run test:e2e`): flips
# the backend to the stub AI provider (compose.e2e.yaml — no provider key, no live
# AI), runs the critical-flow specs, then ALWAYS restores the demo stack on
# the way out — a forgotten restore would silently point the demo's AI at the
# stub. `just dev` may run or not (Playwright reuses or starts Vite).
e2e:
    #!/usr/bin/env bash
    set -euo pipefail
    restore() {
      docker compose -f backend/.dockerdev/compose.yaml up -d --wait
    }
    trap restore EXIT
    # A stub generation left over from a previous run (its process lingered
    # past playwright's cleanup) answers the new run's healthz probe, then
    # dies mid-suite — the api's stream then faults to terminal INTERNAL and
    # every creation-flow spec dies with it (proved 2026-11-06). Sweep the
    # port so playwright always starts a fresh, healthy generation.
    lsof -tiTCP:8791 | xargs kill 2>/dev/null || true
    sleep 1
    docker compose -f backend/.dockerdev/compose.yaml -f backend/.dockerdev/compose.e2e.yaml up -d --wait
    (cd frontend && npx playwright test)

# Follow the backend stack's logs.
logs:
    {{compose}} logs -f
