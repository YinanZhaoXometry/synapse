# 01: Study Mark data — nullable self-declared status, command + GraphQL (FR-47 data half)

**What to build:** the server can store one self-declared per-node status (`learning | finished | skipped`, nullable, revocable) and expose it over GraphQL. After this ticket the data exists and round-trips — nothing renders it yet (T3/T4 build the UI), and nothing computes with it (orthogonality contract; the ADR records the fuse).

**Blocked by:** None (parallel with 02).

**Status:** ready-for-agent

**Bound by:** FR-47 (Study Mark — new), ADR-0001 + AD-6/14 untouched (the mark is NOT evidence, can never move a Mastery Score — the mastery-vector anti-drift suite must pass unchanged), AD-12/13 (command-layer-first, closed error enum), backend/AGENTS.md contract. UI copy is 学习中/已完成/已跳过 — the literal string "Done" is a glossary avoid-word and must not appear in any user-facing string or schema description.

- [ ] Migration: `knowledge_nodes.study_mark` nullable string (no DB-level enum constraint — application-layer validation per the closed-enum command; strong-migrations discipline; schema re-dumped)
- [ ] Command `Nodes::SetStudyMarkCommand` (app/commands/nodes/): inputs `current_user`, `node_id`, `mark` (string or nil = clear). Rules: non-uuid/unknown/foreign node → NOT_FOUND (uniform address rule); mark not in `learning|finished|skipped` (nil exempt) → VALIDATION_FAILED; set is idempotent (same value re-set succeeds, updated_at may move); clear (nil) is idempotent. Success payload: the updated node.
- [ ] GraphQL: `KnowledgeNodeType.study_mark` (String, nullable — "the user's self-declared study status: learning | finished | skipped; null = unmarked. ORTHOGONAL to mastery: never feeds any score"); mutation `Mutations::Nodes::NodeStudyMarkSet` (thin BaseMutation → command via command_result; argument `node_id` + nullable `mark`), registered in mutation_type; schema.graphql committed; `npm run codegen` fresh
- [ ] op-check / DB floor widened for the new operation (grep-guard keep-alive discipline if the floor is count-based)
- [ ] rspec (command + request): set/clear round-trip; idempotent re-set and re-clear; each rejected enum value; foreign-plan node → NOT_FOUND; unauthenticated → UNAUTHENTICATED; `studyMark` readable on the node payload and null by default; **assertion that mastery_score/state are untouched by a mark write** (the orthogonality tripwire)
- [ ] api gates green (rubocop + rspec; baseline grows)

## Comments

- (none yet)
