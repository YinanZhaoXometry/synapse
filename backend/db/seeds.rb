# frozen_string_literal: true

# The idempotent demo-account seed (epic P2-2 ticket 03). DemoSeed owns the
# whole contract — DEMO_EMAIL/DEMO_PASSWORD wiring, fail-fast rules, stable
# uuids, update-or-skip idempotency — see app/lib/demo_seed.rb.
DemoSeed.call
