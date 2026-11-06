# Spec: Epic 18 (Phase 3) — hub tails: Materials hub server backing, mistake lifecycle, generation-backed Today suggestions

Status: ready-for-agent
Milestone: Phase 3 — optimization season

> Authored 2026-11-06 under the standing decide-all delegation (grill round 1 self-answered, all
> rulings in "Implementation decisions" and the epic's kickoff delta review). Closes the §6.2
> survivor rows of the spine Deferred table: Materials hub server backing + Hub state-field tails.
> Owner nomination 2026-11-06 ("这几个全都一次安排做完"). Recon: /tmp/synapse-phase3-notes/epic-18-recon.md
> (main @ 1bc23de).

## Problem statement

Three retained-surface tails lie about state:

1. `/materials` renders five hard-coded demo rows (course/notes/exam tags, fake page counts, toast
   stub buttons) while the server materials surface (`materials()` without args, full
   MaterialSummaryParts fields) has existed since the epic-3 cutover — the one retained page whose
   server-backing ticket never existed.
2. `MistakeEntry` is write-only: quiz grading lands entries, nothing can ever mark one reviewed —
   no lifecycle, no closure signal, and epic-10-T5's recorded targeting-bonus revisit hook has
   been waiting for exactly this moment.
3. The Today hub's suggestion slot is heuristic v1 (weakest node by server score) with the flag
   chip 「按掌握度推荐 · v1」 — epic-10-T5 documented the consumer shape for a real
   generation-backed slot that has never been built.

## Solution — five tickets

1. **T1 (backend) mistake lifecycle:** `mistake_entries.resolved` (bool, default false) + the
   `Mistakes::SetMistakeEntryResolvedCommand` (AD-12 client-supplied uuid, replay-before-write,
   ownership-scoped, toggle both ways) + GraphQL mutation + `resolved` on both read types; the
   targeting mistake bonus consciously STAYS riding any entry (ruled below; spine annotated).
2. **T2 (backend) generation-backed Today suggestions:** `today_suggestions` table (user, plan,
   node, reason, client_uuid unique, timestamps) + `Ai::GenerateTodaySuggestionCommand` in the
   GenerateNote family shape (server-assembled context from the plan's weakest nodes + open
   mistakes; ONE cap-counted provider call; replay-before-spend on a deterministic per-(plan,
   UTC-day) client uuid; CAP_REACHED honest; zero usable nodes → INTERNAL) + GraphQL mutation
   returning the suggestion. The heuristic v1 slot is untouched and stays the always-present base.
3. **T3 (frontend) Materials hub re-point:** the page leaves `demo-data` for
   `useAllMaterialsQuery` — server-real row meta (kind · sizeBytes · createdAt · parseState with
   honest failure surfacing), kind filter replaces the tag row, real per-row scope chips (plan/
   task title via the label-lookup reads MistakesPage already uses), Open → the existing reader
   deep link, upload → an honest pointer to attach-in-plan (the i18n copy already says this).
4. **T4 (frontend) lifecycle + suggestion UI:** MistakesPage gains the resolve toggle + open/
   resolved filter; PlannerPage gains the on-demand 「AI 建议」card (explicit generate button —
   no provider call on hub load; cap-honest states; v1 card always visible as fallback).
5. **T5 e2e + close:** e2e for the server-live flows (materials hub read, mistake resolve),
   dual-theme smoke, spine Deferred rows closed/annotated, board + baselines.

## User stories

1. As a learner, I want my materials library to show MY uploaded materials, so the hub page
   reflects reality instead of sample rows.
2. As a learner, I want a failed parse to say so on the library row, so I know a material needs
   re-attachment instead of silently showing stale text.
3. As a learner, I want to mark a mistake as reviewed, so the mistakes hub becomes a queue I can
   work down instead of an append-only log.
4. As a learner, I want an AI-suggested "what to study next on this plan" with a reason, so the
   recommendation explains itself beyond "lowest score".
5. As a learner on a capped day, I want the AI suggestion to fail honestly (cap reached) while the
   mastery-based v1 suggestion stays, so the hub never goes empty because the AI did.
6. As the owner, I want every rule of ADR-0001 untouched, so none of these tails can move a
   Mastery Score.

## Implementation decisions (grill round 1 — self-answered under delegation)

1. **Materials hub = read/open/filter only.** No upload-from-hub: the attach flow needs a plan/
   task owner + client-side extraction, PlanHome owns that UX, and duplicating it behind an
   owner-picker would fork the attach flow. The upload button becomes an honest pointer CTA to
   attach-in-plan (existing `uploadHint`/`uploadToast` copy already carries this message; reworded
   i18n, not new flow).
2. **Demo columns die, nothing fakes them back.** No wire `pages`/bilingual-title/relative-
   `updated`/tags — the row renders wire truth: `kind` (pdf/markdown) · formatted `sizeBytes` ·
   `createdAt` date · `parseState` chip (only `failed` is emphasized, with `parseFailureReason` on
   hover/title). The course/notes/exam tag row is replaced by a kind filter (all / pdf / markdown).
   Search keeps matching titles (wire title is a plain string).
3. **Scope chip becomes real and per-row:** plan or task title resolved through the same
   label-lookup list reads MistakesPage uses (`usePlansQuery`/`useTasksQuery`); unresolvable →
   chip hidden (never raw ids on this page).
4. **Mistake lifecycle = user-marked, single boolean `resolved` (default false).** No auto-resolve
   by later correct answers (a correct answer elsewhere is not a review). Forfeited entries are
   resolvable like any other (a forfeit is still a mistake worth reviewing). Toggle both ways;
   replay-before-write via client-supplied uuid per AD-12.
5. **The targeting mistake bonus STAYS riding any entry in this epic** — the flag is lifecycle +
   display only; quiz quotas do not change. epic-10-T5's revisit hook is honored by an explicit
   ruling (this spec line + the spine annotation), and the open-only variant is consciously
   deferred to epic-21 where generation behavior changes are measured. `targeting_candidates.rb`
   gains a comment citing the ruling.
6. **AD-6/ADR-0001 fence (unchanged, asserted):** `Mastery` reads evidence records only;
   `recordEvidence` remains the only score-moving path; no migration touches `evidence_records`;
   the mistake flag cannot appear in any mastery/targeting input.
7. **Today: generation-backed ADDITION, not replacement.** The heuristic v1 card stays exactly as
   shipped (delta decision 2's "server score stays the only truth" posture; 「按掌握度推荐 · v1」
   chip kept). The AI suggestion is an extra card per plan, produced only by an explicit 「生成 AI
   建议」 action — **never a provider call on hub load** (no surprise spend).
8. **Generation rides the plain synchronous mutation pattern** (the `GenerateStudyFocusCommand`/
   `GenerateNoteCommand` family — assemble context server-side, ONE cap-counted provider call,
   persist the reply). SSE is for streamed text and stays untouched; STREAM_OPS does not grow.
9. **Replay-before-spend with a deterministic client uuid = `uuid5(user-scoped namespace, planId,
   UTC date)`** — regeneration within the same UTC day replays the persisted row for free; a new
   day spends again. The row is `today_suggestions` (user_id FK — the scoping roster auto-covers
   it; unique client_uuid; plan + node + reason + day). CAP_REACHED passes through honestly;
   zero usable nodes (no non-mastered mapped node) → INTERNAL with an honest message.
10. **The AI card carries an 「AI 建议」 chip + the reason line** and deep-links the same
    `nodeQuickTestHref(planId, nodeId)` the v1 card uses — epic-10-T5's documented consumer shape
    (the nodeId variant) is honored unchanged. On CAP_REACHED/INTERNAL the v1 card remains — the
    slot never goes empty because the AI failed.
11. **Cap law applies:** suggestion generation counts against the 50/day GLM cap like every
    provider call (no exemption).
12. **Codegen discipline:** T1/T2 re-dump `backend/schema.graphql` + regenerate
    `frontend/src/types/graphql.ts` in the same change (AD-17); no `synapse-db:v1` literal in any
    schema description.

## Testing decisions

- External behavior only: what the mutation accepts/replays/refuses, what the hub queries return,
  what the pages render — never internal call shapes.
- api (rspec): lifecycle — request specs for the resolve mutation (resolve, un-resolve, replay
  idempotent, foreign id NOT_FOUND, unknown NOT_FOUND, user-scoping) + `resolved` readable on
  both read types; suggestions — command specs (deterministic-uuid replay no-second-spend, cap
  consumption counted, CAP_REACHED, INTERNAL on zero usable, ownership) + request spec for the
  mutation + todayHub unchanged (v1 heuristic specs keep passing untouched). Seed 1384 baseline
  must grow.
- web (vitest): MaterialsPage re-pinned onto the Apollo stub harness with wire-shaped fixtures
  (the demo-page harness retires) — server rows, kind filter, scope chips, failed-parse surfacing,
  empty/error states; MistakesPage resolve toggle + filter; PlannerPage AI card (generate click →
  suggestion renders; cap → honest toast + v1 stays; v1 chip unchanged). i18n zh/en for every new
  key. Baseline 875 must grow.
- e2e (T5): server-live flows only — materials hub rows + open; mistake resolve toggle. The
  suggestion generation is AI-gated (stub provider answers provider calls; adding a canned reply
  for a new prompt shape is NOT done — AI-gated surfaces stay e2e-uncovered per harness
  convention); its vitest coverage carries the states.
- Gates: `just spec` green (codegen freshness, mastery-vector anti-drift asserted untouched);
  backend rubocop; new e2e specs green.

## Out of scope

- Materials upload/attach from the hub (stays in-plan; pointer only).
- Auto-resolving mistakes from later quiz outcomes; mistake lifecycle affecting mastery or
  targeting (bonus change deferred to epic-21).
- AnyToday-heuristic change (v1 stays verbatim; its specs must pass untouched).
- SSE/streamed suggestions; exempting suggestion generation from the daily cap.
- Editor/positions (epic-22); touch gestures (epic-20); bundle work (epic-19).

## Further notes

- Spine updates (T5): Materials-hub row closed (server backing landed); Hub state-field tails row
  annotated (mistake lifecycle landed; Today slot = v1 + on-demand generation card, heuristic
  specs untouched; targeting bonus consciously deferred to epic-21 per ruling 5).
- Baselines at kickoff: rspec 1384 / vitest 875 / e2e 19+1 (post-epic-16/17 main `b27062d`).
