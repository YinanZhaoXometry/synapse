# 03: spec_helper modernization — random order, focus filter, failure persistence, profiling

**What to build:** re-enable the generator's suggested block that was commented out wholesale
(`backend/spec/spec_helper.rb:49-93`): `filter_run_when_matching :focus`,
`example_status_persistence_file_path`, `disable_monkey_patching!`, single-file doc formatter,
`profile_examples 10`, `order = :random` + `Kernel.srand config.seed`. Random order is the point —
today order-dependent leakage is undetectable. Pre-check the two monkey-patch syntaxes that
`disable_monkey_patching!` would break (`.should`, bare `.stub`/`.mock`), then run the full suite
randomly, fix every leak it surfaces (expected hot spots: global singletons — LoginRateLimiter
already resets per-example; ENV mutations are around-restored), and confirm `--seed N` reproduces
a failure.

**Blocked by:** —.

**Status:** done (2026-11-06)

**Bound by:** backend/AGENTS.md gates; the suite's TimeHelpers discipline (no sleeps — random
order must not tempt anyone into adding them).

- [x] Pre-check greps: no `.should` / bare `stub(`/`mock(` usage that disable_monkey_patching! would break (fix stragglers if any)
- [x] spec_helper block re-enabled (rewritten cleanly, not just un-`=begin`ed), keeping
      verify_partial_doubles + chain-clauses settings
- [x] backend/.gitignore: `spec/examples.txt` (already present — pre-existing line, verified)
- [x] Full suite green under random order in the dev container (at least three different seeds,
      including one CI-shaped run)
- [x] Every surfaced order-dependency fixed at its root (no reordering tricks, no added sleeps)
- [x] Demonstrated: a failing example re-runs red under `--seed <n>` and is selectable via `--only-failures`
- [x] rubocop + rspec gates green (458 files clean; 1290/0)

## Comments

- **Zero order-dependency leaks surfaced.** Seeds 9434 (CI-shaped, `CI=true` → eager_load),
  25156, 52347 plus three unnamed local random runs: 1290/0 every time. The existing hygiene held:
  `LoginRateLimiter.reset!` runs per-example, ENV mutations are around-restored, transactional
  fixtures roll back everything else, and `user_scoping_spec` self-eager-loads before reading
  `ApplicationRecord.descendants`. The suite was already order-independent — it just had no way
  to prove it until now.
- Repro demonstration: a planted failing example ran red under seed 25156, then
  `rspec --seed 25156 --only-failures` selected exactly that one example from
  `spec/examples.txt` (135KB persistence file, gitignored). Temp spec removed after.
- Side-discovery for ticket 01's record: in a degenerate 1-example run, SimpleCov reports 8,330
  tracked lines at 0.28% — `track_files` shows never-loaded app files at 0%, confirming the
  dead-code honesty mechanism works (full-suite denominator is 4,725 because Rails autoloads
  everything the specs touch).
- SimpleCov skips its minimum_coverage check when the run already failed ("Stopped processing
  SimpleCov as a previous error...") — red suites report red, the floor never masks a real failure.
