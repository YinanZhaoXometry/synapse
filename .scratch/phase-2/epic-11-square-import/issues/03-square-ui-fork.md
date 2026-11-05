# 03: Square UI + fork-with-attribution (FR-39 web half, OQ-12)

**What to build:** browse/preview/adopt surface (placement per delta-grill against the UX spine); adopt = **fork command**: copy structure into the adopter's plan with attribution to the source; adopter attaches their own materials; adopted plan is a normal plan (identical behavior). Attribution visible on the forked plan.

**Blocked by:** 2.

**Status:** done (2026-11-05 — branch `epic/p2-11-t03-fork`; gates: rspec 1117 / rubocop clean / vitest 676 / tsc + eslint + build green)

**Bound by:** FR-39 (adopt = normal plan; adopter's materials/progress theirs alone), OQ-12 (fork with attribution), AD-9 (bilingual floor).

- [ ] Fork spec: structure copied; materials/annotations/scores NOT; attribution row present; idempotent on client uuid
- [ ] UI walk: browse → preview → adopt → my plans (both languages/themes)
- [ ] No adopter data written back to source plan (asserted)

## Comments

Implementation landed 2026-11-05 (branch `epic/p2-11-t03-fork`, on `afa994e`; placement + modeling
per the kickoff delta review decisions 3/4/5).

**Migration (delta decision 4).** `study_plans` gains nullable `forked_from_plan_id` (self-FK,
`ON DELETE SET NULL` — the source vanishing never breaks the fork) + `forked_from_topic` (the
fork-time topic snapshot; a COPY, not a reference — later source renames never rewrite the
adopted plan's line). Two-step strong_migrations dance (`validate: false` + the validate
migration right behind); the FK's index builds `algorithm: :concurrently` with
`disable_ddl_transaction!` (the attachment-scope precedent). Model: `belongs_to :forked_from`
(optional, `inverse_of: false`) documents the self-reference; the association-integrity roster
pins it for free.

**`Plans::ForkPlanCommand` (AUTHENTICATED — delta decision 5).** Mirrors the plan-creation
discipline (does not bypass it): the delta-3 idempotency triad hand-copied (same-user client-uuid
replay → Success; foreign uuid → VALIDATION_FAILED; non-uuid → shape refusal), with the replay
check BEFORE source resolution — a replay answers even after the source flips private (the
preview-to-fork race on retry). The source resolves ONLY through `StudyPlan.publicly_visible`
after the malformed-address guard: private / foreign-private / unknown / malformed ids all
answer the SAME NOT_FOUND (no existence leak). STRUCTURE ONLY copies into a new plan owned by
the adopter — topic + goal verbatim, nodes' title/stage/order verbatim (order is the source's
stored key, never re-derived from copy position) — the copy starts PRIVATE (publishing is the
adopter's FR-38 call). Materials/annotations/evidence/mappings/markings/notes/mistakes/questions
are asserted empty on the fork AND untouched on the source (source `updated_at` pinned). The
pinned ruling — see below — refuses zero-node sources with VALIDATION_FAILED. The triad is the
SIXTH hand-copy (ForkPlanCommand arrived before epic-12's annotations); the extract-a-concern
rule now stands open for epic-12.

**Pinned empty-source ruling (recorded):** a ZERO-NODE public plan REFUSES the fork with
VALIDATION_FAILED ("an empty plan cannot be forked") — adopting an empty shell is meaningless,
and the Square cards already show node counts, so the refusal is visible before the click. Both
command and wire specs pin it.

**Wire.** `forkSquarePlan(sourcePlanId, clientUuid)` — verb-first next to createPlan — returns
`{ plan: StudyPlan!, nodes: [KnowledgeNode!]! }` (the createPlan payload shape). `StudyPlanType`
grows `forkedFromTopic: String` (null on non-forks) — the attribution LINE on the wire; the
source's id deliberately stays OFF the wire (the public path is structure-only and the source may
have gone private since). Auth roster +1 in `auth_surface_spec.rb`; schema +63 lines, re-dumped,
byte-identity green in-suite. Request spec: UNAUTHORIZED posture (the standard guard — NOT the
T2 public exception), happy path + plans-list read-back, the NOT_FOUND matrix, empty-shell and
uuid refusals, idempotent replay.

**Frontend (delta decision 3 — the Square is a TAB, no sidebar slot).** `squarePlans` /
`squarePlan` / `forkSquarePlan` documents (`src/lib/graphql/square.graphql` — T2's recorded
codegen no-op resolves; `forkedFromTopic` also rides the Plans/Plan selections) → codegen →
committed types. Hooks (`src/api/queries/square-queries.ts`): `useSquarePlansQuery`,
`useSquarePlanQuery`, `useForkSquarePlanMutation` (plans-list read-back sweep — the 我要学 list
shows the adopted plan immediately). PlansHome gains the 我的计划 / 广场 pill pair (aria-pressed
toggle; the mine tab renders exactly what shipped before — create-step and visibility controls
untouched); the Square tab is `SquareSection` (cards: topic, goal snippet, node count + stage
chips, created date, per-card 改编; card body links `/square/:planId`). `SquarePlanPage` (the
addressable preview route in App.tsx, inside the shell): topic/goal header, stage-ordered node
lists off the reduced public set, 改编并开始 CTA → fork → 「已改编到你的计划」 toast → navigate
to `/plan/:newId` (the normal plan flow takes over). Attribution: PlanHome header renders
「改编自公开计划：{topic}」 (`square.adaptedFrom`) when the snapshot is set; PlansHome plan cards
render a fork glyph + source topic. NOT_FOUND on the preview answers the honest gone-private
copy. i18n `square.*` namespace zh+en (parity pinned); semantic tokens only; keyboard-complete
(buttons/links, focus rings ride the shared classes). Demo absence: the empty Square renders the
publish-path copy — no fabricated cards (asserted).

**Fixture note:** every StudyPlan wire fixture feeding Plan/Plans documents across the suite
gained `forkedFromTopic: null` — the selection grew, and Apollo 4's cache write fails a result
missing a selected field (surfaced as the node-row live-update test's stuck state).

**Test-env note:** backend gates on isolated compose project `-p synapse-t11t03` + /tmp
`!override` port-unpublishing file (the shared dev stack owns 3000/9000); no repo files touched
for it; stack torn down after.

- **Two-axis review (2026-11-05, inline):** PASS/PASS — fork copies structure only (empty
  associations asserted both directions; source `updated_at` pinned); attribution row + snapshot
  semantics pinned incl. FK SET NULL survival; idempotency triad verbatim (replay-first);
  uniform NOT_FOUND preserved; Square = PlansHome tab + addressable preview (no sidebar growth).
