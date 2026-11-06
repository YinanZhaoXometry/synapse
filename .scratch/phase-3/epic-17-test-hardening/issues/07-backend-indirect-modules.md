# 07: Backend indirect modules — direct specs for the five no-direct-coverage units

**What to build:** first spec references for five modules that today run only inside other specs'
shadows. `spec/lib/ai/prompts_spec.rb` pins the prompt-template contract: zh/en language switch,
the fixed section headers, no unresolved placeholders for representative inputs, deterministic
output for fixed input. `spec/lib/ai/targeting_candidates_spec.rb` pins candidate assembly:
ordering, tie-breaks, the mistake-count join (the pure weight math next door in Ai::Targeting is
already specced — this covers the DB-facing half). A new
`spec/graphql/dataloader_sources/evidence_records_source_spec.rb` pins the two unasserted
contracts: batching (N nodes → one query, Notifications counter) and the explicit user_id filter
(foreign node ids contribute nothing — the documented leak guard).
`spec/commands/import/document_validation_spec.rb` and
`spec/commands/materials/section_validation_spec.rb` table-drive every VALIDATION_FAILED leg
through an anonymous host class that includes the module (import's validation is ~15 legs wide;
today only a handful run inside the import spec).

**Blocked by:** —.

**Status:** done (2026-11-06)

**Bound by:** suite idioms — query-count via ActiveSupport::Notifications
(graphql_mastery_scores_spec.rb:131-146 is the pattern), factories over fixtures,
verify_partial_doubles on (stub only real methods); plan_creation/reading_locators stay
host-covered if assessment shows they're thin (record the call in Comments — no
spec-for-spec's-sake).

- [x] prompts_spec: language matrix (zh/en), contract invariants, placeholder-free assertion, determinism check
- [x] targeting_candidates_spec: assembly order / Mastery-string form / mistake-join / user scoping pinned against factories
- [x] evidence_records_source_spec: 1-query batching (load_all) + foreign-user exclusion + request-order/empty shape
- [x] document_validation_spec: table-driven, every VALIDATION_FAILED leg (host-class include)
- [x] section_validation_spec: same shape, boundary-inclusive cap pinned
- [x] plan_creation/reading_locators assessed; verdict recorded in Comments
- [x] Full backend gates green (1346/0; rubocop 464 files clean; line coverage 97.97% → 98.41%)

## Comments

- Five new files, 42 examples, suite 1304 → **1346, 0 failures**, line coverage **98.41%**.
- `spec/lib/ai/prompts_spec.rb` (13 examples): [system, user] shape + sourcing/JSON law
  (wrap-safe substrings — the SYSTEM heredoc line-wraps), zh/en switch, open/choice/mix mode
  rules, quota/attribution/coverage blocks present-or-absent, note word band + [[enrich|kind|]]
  marker contract, ladder flip on escalation, plan_companion hint-first + inline citations,
  grade's keyword-count rule verbatim, annotation vocabulary, never-drop mapping law, proposal
  tag contract + goal line + 2–5/3–8 bounds, truncation honesty, byte-identical determinism.
- `spec/lib/ai/targeting_candidates_spec.rb` (5): node order (the first tie-break), the String!
  percent form == a direct Mastery call, mistake join, and the scoping leak-detector (3 own
  correct vs 3 foreign wrong — a leak would drag 100 → 50; at the ≥3-evidence bar no cap hides
  it), empty plan → [].
- `spec/graphql/dataloader_sources/evidence_records_source_spec.rb` (4): request-order results,
  empty → [], foreign-user exclusion (the documented leak guard), batching via
  `with_dataloading` + `load_all` == ONE query. graphql-ruby 2.5 API notes: `with_dataloading`
  takes NO args and passes the dataloader as the block argument; bare `load` inside a job
  resolves its own batch per call (2 queries) — `load_all` is the one-batch contract.
- `spec/commands/import/document_validation_spec.rb` (15): the ApplicationCommand-host pattern
  (`Class.new(ApplicationCommand) { include mixins }.new` — brings the Failure factory free)
  table-drives every leg: id shape/dup, plan topic, material title/kind/parse-state/
  failure-reason, section id/cap, session vocab + exactly-one-scope, question fields/kind,
  evidence outcome, flashcard fields/difficulty, locator shapes on mistakes/progress/citations
  (pdf needs a positive page, markdown a section id), position-text cap, chat role/text/id,
  and the linkage law incl. the both-rows-bear-the-task duplicate case.
- `spec/commands/materials/section_validation_spec.rb` (6): clean nil, blank-id refusal, over-cap
  refusal WITHOUT server truncation, cap boundary inclusive, first-failure-wins, jsonb shape.
- **Assessment verdict:** `reading_locators` — now directly exercised through the
  document_validation host's locator group (pdf/markdown/citation legs), no dedicated file needed.
  `plan_creation` — thin over its three host commands (create_plan/confirm_proposal/fork specs
  already walk every branch); stays host-covered, no spec-for-spec's-sake.
