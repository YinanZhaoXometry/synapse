# 01: Mistake lifecycle — resolved flag + resolve mutation on the wire

**What to build:** a mistake entry can be marked resolved (and un-resolved) by its owner through a proper command and mutation; both read surfaces expose the flag; the targeting mistake bonus provably does not change.

**Blocked by:** None (epic gate).

**Status:** ready-for-agent

**Bound by:** AD-12 (command-layer; client-supplied uuid replay-before-write; closed error enum — no new values), AD-13 (user scoping via the roster), decision 4/5/6 of the spec (user-marked boolean; forfeited resolvable; bonus stays any-entry), the AD-6/ADR-0001 fence (nothing touches `evidence_records` or Mastery).

- [ ] Migration: `mistake_entries.resolved` (bool, default false, null:false); schema re-dumped; strong-migrations discipline honored
- [ ] `Mistakes::SetMistakeEntryResolvedCommand` (`app/commands/mistakes/`): input = client uuid, mistake entry id, resolved bool; replay-before-write — the owned client uuid returns the row's current state without rewriting; foreign/unknown entry → `NOT_FOUND`; scoping via `current_user`; failures as typed values per the command skeleton
- [ ] GraphQL: mutation (naming per existing command-mutation conventions) + `resolved` readable on `MistakeEntryType` and `HubMistakeEntryType`; `backend/schema.graphql` re-dumped (NO `synapse-db:v1` literal anywhere)
- [ ] `backend/app/lib/ai/targeting_candidates.rb` gains a comment citing spec decision 5 (bonus rides any entry; open-only consciously deferred to epic-21; cite the ticket-05 hook + this epic's ruling)
- [ ] Request specs: resolve, un-resolve, replay idempotent (same uuid → same state, no error), foreign id → NOT_FOUND, unknown id → NOT_FOUND, user-scoping context; `resolved` round-trips on `mistakesHub` and `planMistakeEntries` reads; a forfeited entry resolves like any other
- [ ] api gates green (rubocop + full rspec; seed baseline 1384 must grow)

## Comments

- (none yet)
