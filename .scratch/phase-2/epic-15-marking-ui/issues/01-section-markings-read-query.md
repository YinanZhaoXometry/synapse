# 01: `sectionMarkings` read query — the server half FR-15 never had

**What to build:** a GraphQL query `sectionMarkings(materialId: String!): [SectionMarking!]!` exposing the user's marking rows for one material, modeled on the `materialNodeMappings` precedent (schema.graphql:3468-3482): plain list, user-scoped, `NOT_FOUND` on a foreign material id, no pagination. Returns ALL rows (open + cleared), newest first; the client derives open claims (`clearedAt == null`) — history-preserving rows are the stored form, so the honest read is the rows themselves.

**Blocked by:** none.

**Status:** done (2026-11-06 — implementer subagent + inline two-axis review PASS/PASS; merged to the integration branch `800d205`)

**Bound by:** AD-12 **as the house reads, not writes** — the verified precedent for read queries is **resolver-direct scoped reads** (`materialNodeMappings` = `query_type.rb:136-166`: `field` + `current_user!` + scoped AR `where(...).order(...)`; a foreign id raises NOT_FOUND). NO new command for the read — match the precedent exactly. AD-13 (user scoping — foreign ids NOT_FOUND, never empty), AD-15 (current_user context), the closed error enum. The claim/unclaim commands and the `SectionMarking` type are FROZEN — read-only epic.

- [x] Query field on `QueryType` beside `material_node_mappings` (query_type.rb:136ff is the template): resolve the material through `current_user!`'s scope (foreign id → NOT_FOUND), return `current_user!.section_markings.where(material_id: material.id).order(...)` newest-first.
- [x] `backend/schema.graphql` regenerated + committed (the cross-stack contract — the frontend codegen consumes it verbatim).
- [x] Command spec: happy path (open + cleared rows, ordering), foreign material → NOT_FOUND, empty list for a material with no markings, scoping (another user's rows never leak).
- [x] Request spec riding the shared graphql harness (the `GraphqlSpecHelpers` JWT_SECRET around-block covers `type: :request` — the 2026-11-06 lesson).
- [x] `spec/requests/graphql_integration_walk_spec.rb` stays green unchanged; full rspec + rubocop green in an isolated compose project (`-p synapse-t15-t01`, fresh test DB via `db:drop db:create db:migrate` — never `db:prepare`); tear the stack down after.
- [x] No frontend files touched.

## Comments

- **Assigned 2026-11-06** (night run, epic-15). Precedent files to copy the shape from: `app/commands/markings/claim_section_command.rb`, the `materialNodeMappings` query resolver + its request specs. Ordering: `claimed_at DESC` is the natural newest-first (secondary `cleared_at DESC NULLS FIRST` if needed for determinism — pin whatever the spec asserts).

- **Two-axis review (2026-11-06, inline):** PASS/PASS — compliance: every AC landed with evidence (inline field beside `material_node_mappings`; schema regen = one +16-line hunk, exactly the new field; request spec 5 examples covering shapes/order/NOT_FOUND/empty/scoping; walk spec byte-unchanged green; zero frontend files). Contract: AD-12 sanctioned read (bare SELECT, no command — the `materialNodeMappings` shape verbatim, `scoped_material` pre-existing at query_type.rb:429 reused, not invented); AD-13 uniform NOT_FOUND on foreign/unknown/malformed ids; description states the claim law, no storage-key literals. Test honesty: 1285 → 1290 (+5 = the new spec); the one pre-regen failure was the schema-freshness guard catching contract drift, fixed by the dump, not by touching a test. Gates: rubocop clean 458 files; isolated compose `-p synapse-t15-t01` booted with a port-unpublishing override, fresh test DB `db:drop db:create db:migrate`, torn down `-v` after.
