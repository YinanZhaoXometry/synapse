# Epic 18 (Phase 3) — hub tails: Materials server backing, mistake lifecycle, generation-backed Today suggestions

Status: ready-for-agent (spec'd + ticketed 2026-11-06, one pass under the standing decide-all delegation; grill round 1 self-answered — see spec "Implementation decisions" + delta review below)
Milestone: Phase 3 — optimization season

## Parent

[roadmap.md](../roadmap.md) row 18 · closes the §6.2 survivor rows of the spine Deferred table (Materials hub server backing + Hub state-field tails) · ADR-0001 + AD-6/14 (evidence-only; the fence asserted untouched) · AD-12 (command-layer, client-supplied uuid, closed error enum) · AD-16 (server-side AI, one SSE surface — this epic adds NO stream op) · AD-17 (schema + codegen in the same change) · [spec.md](spec.md).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-mistake-lifecycle.md](issues/01-mistake-lifecycle.md) | — | `mistake_entries.resolved` + SetMistakeEntryResolvedCommand + GraphQL mutation/read fields (lifecycle data half) |
| 2 | [02-today-suggestion-generation.md](issues/02-today-suggestion-generation.md) | — | `today_suggestions` table + GenerateTodaySuggestionCommand (replay/cap-honest) + mutation (generation half; independent of T1) |
| 3 | [03-materials-hub-repoint.md](issues/03-materials-hub-repoint.md) | — | `/materials` re-pointed to `useAllMaterialsQuery` — server rows, kind filter, real scope chips, honest parse-failure surfacing (frontend-only; independent of T1/T2) |
| 4 | [04-lifecycle-and-suggestion-ui.md](issues/04-lifecycle-and-suggestion-ui.md) | 1, 2 | MistakesPage resolve toggle + filter; PlannerPage on-demand AI suggestion card with cap-honest states |
| 5 | [05-e2e-and-close.md](issues/05-e2e-and-close.md) | 3, 4 | e2e for server-live flows, dual-theme smoke, spine rows closed/annotated, board + baselines |

## Definition of done

Materials hub renders only server rows (demo-data imports gone from the page) · parse failures visible on rows · mistake entries resolvable both ways with ownership scoping and replay idempotence · targeting bonus provably unchanged (spec + spine annotation) · Today heuristic specs pass untouched · AI suggestion costs at most one cap-counted call per (plan, UTC day), never on load, and fails honestly while v1 stays · codegen fresh both stacks · `just spec` + new e2e green · baselines recorded on the board.

## Coordination notes

- T1 and T2 are independent backend tickets (serial lane regardless — single-implementer cadence).
- The 16-node/e2e harness is untouched except T5's additions; the suggestion generation is AI-gated and stays e2e-uncovered by convention.
- Guards to respect: architecture.guard.test.ts (frontend), no_keep_alive_spec.rb + user-scoping roster (backend auto-covers `today_suggestions` once the model has `belongs_to :user` + factory).

## Kickoff delta review — 2026-11-06 (grill round 1 self-answered; owner may veto any line asynchronously)

Grounded in the recon notes (main @ 1bc23de). Decisions 1–12 in the spec carry the rulings; the
three with real weight:

1. **Upload-from-hub rejected** (decision 1) — attach needs a plan/task owner + client-side
   extraction; PlanHome owns the UX. The hub becomes the library view; upload is a pointer.
2. **Targeting bonus stays any-entry** (decision 5) — epic-10-T5's revisit hook gets an explicit
   ruling instead of a silent ride-along: the lifecycle flag is display-only this epic; the
   open-only quota variant is deferred to epic-21 where targeting behavior changes are measured.
   Spine row annotated at T5.
3. **Today = generation-backed ADDITION with a never-on-load spend rule** (decisions 7–10) —
   explicit button, deterministic per-(plan, UTC-day) replay uuid, persisted row, v1 card as the
   permanent fallback. The «AI 建议» card deep-links the exact nodeId consumer shape epic-10-T5
   documented.
