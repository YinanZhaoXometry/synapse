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

**Status:** ready-for-agent

**Bound by:** backend/AGENTS.md gates; the suite's TimeHelpers discipline (no sleeps — random
order must not tempt anyone into adding them).

- [ ] Pre-check greps: no `.should` / bare `stub(`/`mock(` usage that disable_monkey_patching! would break (fix stragglers if any)
- [ ] spec_helper block re-enabled (rewritten cleanly, not just un-`=begin`ed), keeping
      verify_partial_doubles + chain-clauses settings
- [ ] backend/.gitignore: `spec/examples.txt`
- [ ] Full suite green under random order in the dev container (at least three different seeds,
      including one CI-shaped run)
- [ ] Every surfaced order-dependency fixed at its root (no reordering tricks, no added sleeps)
- [ ] Demonstrated: a failing example re-runs red under `--seed <n>` and is selectable via `--only-failures`
- [ ] rubocop + rspec gates green

## Comments

- (none yet)
