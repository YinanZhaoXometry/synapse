# 02: Square public read path — the AD-13 exception, structurally leak-proof

**What to build:** public-plan GraphQL surface: `squarePlans` listing (topic, stage/node summary) + `squarePlan(id)` preview — a **reduced type set** with no material/annotation/score fields at all; a dedicated public scope context (no current_user required for reads, but reads touch only public rows); authenticated-by-anyone semantics documented; listing ordered per delta-grill (v1 simple).

**Blocked by:** 1.

**Status:** done (2026-11-05 — branch `epic/p2-11-t02-squarepath`; gates: rspec 1095 / rubocop clean / vitest 657 / tsc + eslint + build green)

**Bound by:** AD-13 (the single sanctioned exception; structure only — NFR-7), FR-39 (listing by structure, not content).

- [ ] Reduced types literally lack content fields (schema-level assertion spec)
- [ ] Private plans absent from list + direct-id preview (404-shaped)
- [ ] Visibility flip propagates immediately (no cache staleness server-side)

## Comments

Implementation landed 2026-11-05 (branch `epic/p2-11-t02-squarepath`, on `d657066`).

**Reduced public types (the P2-4 forward-note honored at the type level).** New separate types —
`SquarePlanType` (id/topic/goal/visibility/createdAt + `nodeSummaries: [SquareNodeSummaryType!]!`)
and `SquareNodeSummaryType` (title/stage/order ONLY, deliberately not even the node uuid) — never
the shared authenticated types with fields toggled. Leak-proofing asserted three ways in
`spec/graphql/square_public_types_spec.rb`: exact field-set `contain_exactly` on both types; a
self-maintaining vocabulary diff (no field name from the 13 authenticated content types' union may
appear beyond the sanctioned set — new authenticated fields join the forbidden list automatically);
and a type-graph walk proving no public field unwraps into an authenticated object type (the only
object edge is SquarePlan → SquareNodeSummary). Wire half: content-field selections
(`masteryScore`/`materials`/`state`) fail validation in `spec/requests/graphql_square_spec.rb`.

**Queries + the auth opt-out.** `squarePlans` (newest-first, `created_at DESC, id DESC`, no
pagination v1) + `squarePlan(id:)` on QueryType. The house opt-out turned out to already exist:
`health` proves the pattern — a resolver that simply never calls `current_user!` (the
CurrentUserResolver under `context[:current_user]` is lazy, so anonymous requests pay zero auth
cost). No context gymnastics. Scoping is the stricter public-path posture: reads go through
`StudyPlan.publicly_visible` + the plan's own `knowledge_nodes` association, never a bare model
reach. Absence is the house uniform NOT_FOUND — private/foreign/unknown/malformed ids (and the
OWNER's own private plan, token in hand) all produce byte-identical NOT_FOUND responses, asserted
literally. Descriptions carry the AD-13/NFR-7 documentation; `auth_surface_spec.rb` records the
exception explicitly (with health, these two are the schema's ONLY unauthenticated-readable
queries; the mutation roster untouched). Flip propagation cross-linked to T1's setPlanVisibility
at the wire (public → appears for anonymous callers, back to private → gone, same example). No
N+1: `squarePlans` preloads nodes (1+1 queries regardless of plan count, asserted by a
differential query-count test), `node_summaries` sorts in memory (an `.order` there would re-query
preloaded associations).

**Schema:** +78 lines (2 query fields + 2 types), re-dumped; schema_dump_spec byte-identity green
inside the suite.

**Frontend:** codegen verified a byte-identical NO-OP — `codegen.ts` uses typescript-operations
(operations-reachable types only), so the server-only SquarePlan/SquareNodeSummary types ride
through when T3 adds the consuming documents, not before. `src/types/graphql.ts` unchanged; zero
frontend files touched.

**Test-env note:** gates ran on an isolated compose project (`-p synapse-t11t02`) with a /tmp
`!override` port-unpublishing file (the shared dev stack owns 3000/9000); no repo files touched
for it. First suite run hit the documented db:prepare auto-seed trap (the entrypoint seeded the
demo account into the fresh test DB, tripping `confirm_proposal_command_spec.rb`'s
`StudyPlan.count == 0` assertions) — redone with the gate sequence `db:drop db:create db:migrate`,
green after; the failures were environmental, not code. One vitest flake on the first frontend
run (1 of 657), two consecutive full greens after — no frontend diff exists in this ticket.

**For T3:** consume `squarePlans`/`squarePlan` via new documents in `src/lib/graphql/*.graphql`
(codegen will then emit the Square types); the fork command is an AUTHENTICATED mutation per
delta decision 5; `SquarePlanType#nodeSummaries` (title/stage/order) is the fork input shape.
