# 01: `sectionMarkings` read query — the server half FR-15 never had

**What to build:** a GraphQL query `sectionMarkings(materialId: String!): [SectionMarking!]!` exposing the user's marking rows for one material, modeled on the `materialNodeMappings` precedent (schema.graphql:3468-3482): plain list, user-scoped, `NOT_FOUND` on a foreign material id, no pagination. Returns ALL rows (open + cleared), newest first; the client derives open claims (`clearedAt == null`) — history-preserving rows are the stored form, so the honest read is the rows themselves.

**Blocked by:** none.

**Status:** ready-for-agent

**Bound by:** AD-12 **as the house reads, not writes** — the verified precedent for read queries is **resolver-direct scoped reads** (`materialNodeMappings` = `query_type.rb:136-166`: `field` + `current_user!` + scoped AR `where(...).order(...)`; a foreign id raises NOT_FOUND). NO new command for the read — match the precedent exactly. AD-13 (user scoping — foreign ids NOT_FOUND, never empty), AD-15 (current_user context), the closed error enum. The claim/unclaim commands and the `SectionMarking` type are FROZEN — read-only epic.

- [ ] Query field on `QueryType` beside `material_node_mappings` (query_type.rb:136ff is the template): resolve the material through `current_user!`'s scope (foreign id → NOT_FOUND), return `current_user!.section_markings.where(material_id: material.id).order(...)` newest-first.
- [ ] `backend/schema.graphql` regenerated + committed (the cross-stack contract — the frontend codegen consumes it verbatim).
- [ ] Command spec: happy path (open + cleared rows, ordering), foreign material → NOT_FOUND, empty list for a material with no markings, scoping (another user's rows never leak).
- [ ] Request spec riding the shared graphql harness (the `GraphqlSpecHelpers` JWT_SECRET around-block covers `type: :request` — the 2026-11-06 lesson).
- [ ] `spec/requests/graphql_integration_walk_spec.rb` stays green unchanged; full rspec + rubocop green in an isolated compose project (`-p synapse-t15-t01`, fresh test DB via `db:drop db:create db:migrate` — never `db:prepare`); tear the stack down after.
- [ ] No frontend files touched.

## Comments

- **Assigned 2026-11-06** (night run, epic-15). Precedent files to copy the shape from: `app/commands/markings/claim_section_command.rb`, the `materialNodeMappings` query resolver + its request specs. Ordering: `claimed_at DESC` is the natural newest-first (secondary `cleared_at DESC NULLS FIRST` if needed for determinism — pin whatever the spec asserts).
