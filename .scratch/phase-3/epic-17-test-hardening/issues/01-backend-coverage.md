# 01: Backend coverage — SimpleCov line+branch on app/, CI summary + artifact, floor at measured−2

**What to build:** the backend suite reports coverage it currently only asserts. simplecov joins
the test group (the epic's only backend gem addition), starts at the very top of spec_helper
(before Rails boots — `.rspec` requires spec_helper first), tracks every file under `app/` whether
or not it was loaded (dead code must show as 0%, not vanish), groups by layer, and publishes: a
local HTML report, a CI step-summary line, and an uploaded artifact. A line floor pins the
measured baseline minus two points so regression is impossible; branch coverage is measured and
reported but not floored yet (10 revisits).

**Blocked by:** —.

**Status:** done (2026-11-06)

**Bound by:** backend/AGENTS.md gate contract (rubocop → rspec in dev containers; `DATABASE_URL` +
`RAILS_ENV=test` mandatory), AD-10.

- [x] `simplecov` added to the test group; Gemfile.lock updated inside the dev container (`bundle install`)
- [x] `backend/spec/spec_helper.rb`: `SimpleCov.start` at file top — `enable_coverage :branch`,
      `primary_coverage :line`, `track_files "app/**/*.rb"`, groups
      commands/graphql/models/lib/jobs/controllers, filters for non-app paths, and
      `minimum_coverage line: <measured−2>` pinned after the first full run
- [x] `backend/.gitignore`: `coverage/` (already present — pre-existing line, verified)
- [x] ci.yml api job: after rspec, parse `coverage/.last_run.json` into `$GITHUB_STEP_SUMMARY`;
      upload the HTML report via actions/upload-artifact@v4 (retention 7d, `if: always()`)
- [x] Full suite green in the dev container with coverage on (suite 24.8s → 29.2s with branch
      coverage; delta acceptable)
- [x] Measured baseline recorded in this ticket's Comments (line %, branch %, per-group lows)
- [x] rubocop + rspec gates green (458 files no offenses; 1290 examples 0 failures)

## Comments

- **Measured baseline (2026-11-06, local dev container): line 97.9% (4626/4725), branch 89.4%
  (1333/1491).** The naive pre-filter number (99.13% over 15,169 lines) was inflated by the
  suite's own spec lines — `track_files` only governs never-loaded files; loaded specs are
  included until filtered. After `add_filter /spec/|/config/|/db/`, the honest app+lib number is
  97.9%. Floor pinned at `minimum_coverage line: 95` (measured−2, epic decision 7). Branch is
  reported but unfloored (ticket 10 revisits).
- All 237 `app/` files are tracked (`track_files "app/**/*.rb"` works). Top uncovered files —
  all matching the audit's gap list: `import/document_validation.rb` 16/114,
  `ai/context_assembler.rb` 13/255, `graphql_controller.rb` 9/24 (`prepare_variables` branches),
  `lib/tasks/ai.rake` 10/13 (ai:probe, manual-only by design), `api/stream_controller.rb` 5/99
  (disconnect paths, accepted gap). Tickets 06/07 close the first two.
- `lib/tasks/*.rake` stay in the report (real, specced code); ai.rake's misses are the documented
  manual probe.
