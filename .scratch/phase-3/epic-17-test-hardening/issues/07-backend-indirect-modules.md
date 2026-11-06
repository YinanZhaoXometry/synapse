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

**Status:** ready-for-agent

**Bound by:** suite idioms — query-count via ActiveSupport::Notifications
(graphql_mastery_scores_spec.rb:131-146 is the pattern), factories over fixtures,
verify_partial_doubles on (stub only real methods); plan_creation/reading_locators stay
host-covered if assessment shows they're thin (record the call in Comments — no
spec-for-spec's-sake).

- [ ] prompts_spec: language matrix (zh/en), header invariants, placeholder-free assertion, determinism check
- [ ] targeting_candidates_spec: assembly order / tie-break / mistake-join pinned against factories
- [ ] evidence_records_source_spec: 1-query batching assertion + foreign-node exclusion assertion
- [ ] document_validation_spec: table-driven, one row per VALIDATION_FAILED leg (host-class include)
- [ ] section_validation_spec: same table-driven shape
- [ ] plan_creation/reading_locators assessed; verdict recorded (covered-or-specced)
- [ ] Full backend gates green

## Comments

- (none yet)
