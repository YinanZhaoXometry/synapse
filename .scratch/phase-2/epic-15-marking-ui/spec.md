# Spec — Epic 15: FR-15 Mastery Marking UI

Status: ready-for-agent (grounded 2026-11-06 by an Explore sweep with file:line evidence — see epic.md "The gap")

> PRD FR-15 (§4.2): "The user can mark a section as mastered and unmark it; marked sections render with a green background. Marking is a **claim, not evidence**: it invites a short confirm quiz, and only quiz results can raise the node's Mastery Score *(owner decision Q3(c), 2026-11-01)*. Realizes UJ-3."
>
> Testable consequences (PRD verbatim): marking persists across sessions and the green marking displays immediately as a claim · the Mastery Score moves only when a quiz produces evidence, never from the marking itself · unmarking clears the claim; the evidence trail stays.

## Ground truth (verified, do not re-derive)

- Server writes: `claimSection(input: ClaimSectionInput!)` → `ClaimSectionPayload.sectionMarking` ([schema.graphql:541-571, 2763-2768](../../../backend/schema.graphql)); `unclaimSection(input: UnclaimSectionInput!)` → `UnclaimSectionPayload` (:4861-4891). Inputs: `materialId: String!`, `sectionId: String!`, optional `clientMutationId`. Claim law: open claim re-claim returns it unchanged; claim→unclaim→re-claim preserves history as rows; cross-user material → NOT_FOUND; unmark sets `clearedAt`, never deletes.
- `SectionMarking` type: `id`, `materialId`, `sectionId` (a section slug, not a uuid), `claimedAt: DateTime!`, `clearedAt: DateTime` (null while open).
- **Server read: DOES NOT EXIST.** No query field, no `Material` field (verified against the full `type Query` field list, schema.graphql:3368-3714). Ticket 01 adds it, modeled on `materialNodeMappings` (schema.graphql:3468-3482).
- Section addressing: markdown slugs from the exact react-markdown pipeline (rehype-slug; `parse-markdown.ts:1-14`), PDF `page-${n}` (`parse-pdf.ts:36-60`); ids match rendered anchors by construction (`markdown-view.tsx` heading ids; `PdfPageFlow.tsx:438` `data-page`).
- Web seam conventions: [frontend/src/api/index.ts](../../../frontend/src/api/index.ts) header — hooks are the only route features touch domain data; queries return `{ data: mapped view | undefined, loading, error, refetch }` (honest-empty); mutations return raw Apollo tuples with refetch sweeps; codegen config `frontend/codegen.ts`, documents `src/lib/graphql/*.graphql`, output committed, CI freshness-gated.
- Confirm-quiz machinery exists: `quick-test-seam.ts` (`registerQuickTestHandler` / `dispatchQuickTest`), `quick-test-flow.tsx` (`QUICK_TEST_TARGET_COUNT = 4`, the four-way xor `QuizStartInput`, `?quicktest=<sessionId>` takeover), gate `quick-test-gate.ts`.
- Theme: `--mastered-tint` / `--mastered-ink` (+ tailwind `bg-mastered-tint`, `text-mastered-ink`, `.tint-green`) exist in `:root` and `.dark` and are NOT overridden by the palette switcher — palette-safe by construction.

## Binding decisions (decide-all delegation, logged)

1. **Read shape (T1):** `sectionMarkings(materialId: String!): [SectionMarking!]!` — all rows for the material (open + cleared), newest first; client derives open claims (`clearedAt == null`). No pagination (per-user rows, low volume; consistent with `materialNodeMappings`). Foreign material id → `NOT_FOUND` (the scoping roster law). No new inputs beyond `materialId`.
2. **Green display (T3):** `--mastered-tint` background + `--mastered-ink` text/ink, anchored at the section start (markdown heading / PDF page). Full-section background is explicitly out of v1 scope (no per-section wrapper in the renderer) — recorded as future polish via the annotation engine's Range painting.
3. **Affordance (T3):** hover-revealed per-section control (compact, non-noisy while reading); the green state itself always visible. Unmark lives on the claimed state.
4. **Confirm quiz (T3):** launcher on the claimed section → Quick Test scoped to exactly that sectionId (mix, targetCount 4), via the existing seam — no new session machinery. After completion the reader refetches; mastery display stays server-scored (AD-14) and the claim row is untouched by quizzes.
5. **No backend writes change.** The claim law is spec-pinned since P2-3; this epic adds one read op and consumes the surface. If any spec suggests the law differs from PRD, stop and record — do not patch silently.

## Out of scope

- Full-section Range-painted backgrounds (future polish, recorded).
- Marking from outside the reader (plan home, materials list).
- Any migration, any change to the claim/unclaim commands, any mastery computation.
- MaterialsPage backing / mistake lifecycle flags (other §6.2 survivors — parked, owner unlock required).
