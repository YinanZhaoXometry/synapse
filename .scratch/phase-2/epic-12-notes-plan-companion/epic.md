# Epic 12 (Phase 2) — Notes with enrichment + plan-level Companion

Status: done (2026-11-05 — all three tickets done + two-axis reviewed; rspec 957 / vitest 572; OQ-11 = markers-only v1; /ai-tutor retired with T3)
Milestone: Phase 2 — post-deadline

## Parent

[roadmap.md](../roadmap.md) · PRD FR-40/22/46, UJ-5 ([prd-synapse.md](../../../docs/product/prd-synapse/prd-synapse.md)) · spine AD-16 (one SSE surface; adapter; cap), AD-5 (contract; features never raw-call AI), capability-map row "FR-46 + FR-44/45 node-scoped grounding" · [spec.md](spec.md).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-note-generation.md](issues/01-note-generation.md) | — (epic gate) | generateNote(scope) + Note entity + enrichment placement + export (FR-40) |
| 2 | [02-weak-spot-notes.md](issues/02-weak-spot-notes.md) | 1 | targeting: weakSpot variant via epic-10 (FR-22) |
| 3 | [03-plan-level-companion.md](issues/03-plan-level-companion.md) | — (needs epic-10 mapping) | plan-scope chat + citations + analyze-my-mistakes + /ai-tutor re-point (FR-46) |

## Definition of done

Notes generate/export for all three scopes with enrichment markers honored · weak-spot bias proven on crafted scores · plan-chat cites material+section without a Reading Position · mistake analysis grounded in the item's source · /ai-tutor on real grounding · gates green · every ticket cites FRs + AD ids.

## Coordination notes

- **Gate: epics 08+10 done** (mapping feeds plan-grounding + the weak-spot variant). T1 can start the Note entity + scope plumbing the moment 08 lands — only enrichment + T2/T3 need 10.
- Reuses epic-05's stream op (plan grounding mode) — contract additions go through epic-05's frozen-contract note, surfaced not absorbed.

## Kickoff delta review — 2026-11-05 (decide-all delegation, "全部按推荐")

Grounded in code recon @ `a2a20cc`: stream ops today = `companion` (material+ReadingPosition payload) + `proposal`; the payload shapes are epic-05 ticket 04's frozen contract; `/ai-tutor` is a 199-line demo-keyword page; OQ-11 sits deferred in the spine (row 350); no Notes surface exists anywhere yet.

1. **OQ-11 sourcing = curated/diagram-safe v1, markers-only.** The enrichment pipeline ships as AI-selected PLACEMENT markers: the model decides WHERE a visual aids understanding and emits `[[enrich|<kind>|<suggestion>]]` markers inside the Note markdown (kind: diagram | chart | image; suggestion = what the visual should show). v1 stores NO binary assets (generated imagery = cost/quality risk per the spec's own recommendation; a curated asset library does not exist) — the Note view renders markers as styled placeholder cards and export preserves them as markdown comments. The presigned-GET asset path (epic-06) is implemented behind the same marker renderer and activates the moment stored assets exist — the ticket's "(presigned GET if stored)" conditional is satisfied structurally. User-requested annotation = the same marker kind inserted at a user-chosen spot (the user picks the position; the AI fills the suggestion text).
2. **/ai-tutor retirement = with T3.** The page re-points to plan-grounded chat in the same ticket that lands the grounding; the demo keyword-response engine retires then (kept alive one ticket longer would mean maintaining a fake).
3. **Note list/home placement = plan-scoped, no new route.** Notes render in a "学习笔记" section on the plan home (list + generate button with scope picker plan|node|material + targeting toggle when T2 lands); note detail = an expandable view with export (download .md). No `/notes` sidebar destination (not in the retained ten; the PRD keeps Notes inside the study flow).
4. **Data model (pinned):** `notes` table — user, plan_id (nullable), node_id (nullable), material_id (nullable), `scope` string CHECK `plan|node|material`, title, body (markdown text), enrichment jsonb (marker array), targeting jsonb (T2's provenance; empty for v1), timestamps. One scope per note; the scope id must belong to the user (AD-13).
5. **generateNote = a synchronous mutation through the adapter** (same shape as generateQuiz: one cap-counted provider call, deterministic replay on clientUuid). Note generation is long but bounded by the same 8k context budget — no SSE needed (AD-16's one-SSE-surface rule applies to chat, and chat's new plan mode rides the existing tickets, decision 6).
6. **T3's stream extension = a THIRD op `plan_companion`** — new payload `{plan_id, question, language, mistake_entry_id?}` (string-keyed, TS-shape verbatim), recorded in epic-05 ticket 04's frozen-contract Comments (surfaced, not absorbed). Assembly = new `ContextAssembler.plan_grounding(plan)`: the bounded plan_scope text PLUS a confirmed-mapping block (section→node rows from T1 of epic-10) so node relationships are citable; with `mistake_entry_id`, the entry's question + its source section text ride first (companion_grounding's focus-section pattern) — "analyze my mistakes" grounds on the item's own source, cited.

