# 01: Backend coverage — SimpleCov line+branch on app/, CI summary + artifact, floor at measured−2

**What to build:** the backend suite reports coverage it currently only asserts. simplecov joins
the test group (the epic's only backend gem addition), starts at the very top of spec_helper
(before Rails boots — `.rspec` requires spec_helper first), tracks every file under `app/` whether
or not it was loaded (dead code must show as 0%, not vanish), groups by layer, and publishes: a
local HTML report, a CI step-summary line, and an uploaded artifact. A line floor pins the
measured baseline minus two points so regression is impossible; branch coverage is measured and
reported but not floored yet (10 revisits).

**Blocked by:** —.

**Status:** ready-for-agent

**Bound by:** backend/AGENTS.md gate contract (rubocop → rspec in dev containers; `DATABASE_URL` +
`RAILS_ENV=test` mandatory), AD-10.

- [ ] `simplecov` added to the test group; Gemfile.lock updated inside the dev container (`bundle install`)
- [ ] `backend/spec/spec_helper.rb`: `SimpleCov.start` at file top — `enable_coverage :branch`,
      `primary_coverage :line`, `track_files "app/**/*.rb"`, groups
      commands/graphql/models/lib/jobs/controllers, filters for non-app paths, and
      `minimum_coverage line: <measured−2>` pinned after the first full run
- [ ] `backend/.gitignore`: `coverage/`
- [ ] ci.yml api job: after rspec, parse `coverage/.last_run.json` into `$GITHUB_STEP_SUMMARY`;
      upload the HTML report via actions/upload-artifact@v4 (retention 7d, `if: always()`)
- [ ] Full suite green in the dev container with coverage on (verify the branch-coverage runtime
      delta is acceptable)
- [ ] Measured baseline recorded in this ticket's Comments (line %, branch %, per-group lows)
- [ ] rubocop + rspec gates green

## Comments

- (none yet)
