# Epic 15 (Phase-2 delta) — FR-15 Mastery Marking UI: the web consumes the marking ops

Status: done (2026-11-06 night run — 3 tickets done + inline two-axis reviews PASS/PASS ×3; just spec green on the integration tip (rspec 1290 / vitest 833); live smoke claim→persist→unmark PASS in a real browser against the real stack; unlocks the §6.2 diff-check's FR-15 survivor)
Milestone: Phase 2 — post-deadline

## Parent

[roadmap.md](../roadmap.md) · PRD FR-15 ([prd-synapse.md](../../../docs/product/prd-synapse/prd-synapse.md) §4.2; OQ-7 resolution) · the spine Deferred row FR-15 (trigger: "the owner picks its placement — then a small web ticket consumes the live ops") · [epic-13's recorded finding](../epic-13-reader-depth/issues/02-quick-test.md) (grep-verified zero consumption again 2026-11-06) · §6.2 walk table survivor 2 ([epic-14 epic.md](../epic-14-small-tail/epic.md)) · AD-6 (attribution), AD-7 (client-side rendering), AD-12 (command layer), AD-14 (server-scored mastery — rendering reads, never recomputes).

## The gap (verified 2026-11-06)

- **Write ops live:** `claimSection` ([schema.graphql:2767](../../../backend/schema.graphql)) / `unclaimSection` (:3182) — commands `Markings::ClaimSectionCommand` / `UnclaimSectionCommand` (epic P2-3 T4), claim law spec-pinned at both layers (claim ≠ evidence, evidence counts unchanged across claim/re-claim/unmark).
- **Read op missing entirely:** no query and no `Material` field exposes `SectionMarking` rows — the web can write claims it can never read back. The write-only surface is why FR-15 never shipped: epic-13 T2's finding said "server ops exist" (true — the writes) but the read half never existed either.
- **Zero web surface:** no `.graphql` operation documents, no hooks, no UI. `frontend/src/domain/entities.ts:194-200` carries a dormant `SectionMarking` interface, consumed by nothing.

## Placement decision (owner-delegated, 2026-11-06 — standing decide-all)

**Reader section-level.** The reader is where sections exist as study objects; PRD FR-15 speaks of marking "a section" while reading. Concretely:

1. A per-section affordance at the section start (markdown: heading-anchored control; PDF: page control) to claim/unclaim.
2. Open claims render green using the **existing** `--mastered-tint` / `--mastered-ink` tokens (defined in `:root` + `.dark`, untouched by the sunset/twilight/aurora palette switcher — verified palette-surviving). No new theme tokens.
3. **v1 green scope, honest:** a green treatment anchored at the section start (heading/page tint strip + mastered-ink icon + edge bar), NOT a full-section background — the markdown renderer has no per-section wrapper element (the heading carrying the rehype-slug id IS the anchor; `markdown-view.tsx:46-63`), and restructuring it is out of scope. Range-paint via the annotation engine's dual path is the recorded future polish.
4. **Confirm-quiz launcher:** a claimed section offers a confirm quiz — the Quick Test flow scoped to exactly that sectionId (`QUICK_TEST_TARGET_COUNT = 4`, `mode: "mix"`), riding the existing `quick-test-seam` dispatch. Mastery moves only via evidence (server law, already pinned); the claim row itself is untouched by quizzes.

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-section-markings-read-query.md](issues/01-section-markings-read-query.md) | — | `sectionMarkings(materialId:)` query server-side: command + resolver + schema regen + specs |
| 2 | [02-marking-web-seam.md](issues/02-marking-web-seam.md) | 1 | `section-markings.graphql` docs → codegen → typed hooks (`useSectionMarkingsQuery`, claim/unclaim mutation tuples) → dormant domain interface wired |
| 3 | [03-reader-marking-ui.md](issues/03-reader-marking-ui.md) | 2 | reader claim/unclaim affordance, green display, confirm-quiz launcher, i18n (zh+en), both-mode verified |

## Definition of done

- PRD FR-15's three testable consequences hold end-to-end: persistence across sessions (server rows, read back on load); green displays immediately as a claim; the Mastery Score moves only via quiz evidence (re-proven by the existing spec pins — no new mastery write path); unmark clears the claim, evidence trail intact.
- Gates green in every ticket worktree (web + api per touched surface); `just spec` green on the integration branch before close.
- schema.graphql + committed codegen output regenerate cleanly (CI freshness gates pass).
- Two-axis inline review per ticket (compliance + contract), single fix round each, tracker closed with evidence.

## Coordination notes

- Night-run discipline (2026-11-06 rule): **no merge to main without its own green CI run** — epic-14 reached main CI-unverified and the latent spec bug proved it.
- Integration worktree: `../project-new-p2-15` (branch `epic/p2-15-marking` off main `d74647b`). Per-ticket worktrees off it; implementer subagents with isolated compose projects (`-p synapse-t15-tNN`); tear down what you boot.
- The main checkout (`/Users/zhaoyinan/document/Polyu/COMP5241 软工/project-new`) is another session's territory — this epic never touches it.
- Close-out flips the spine Deferred row FR-15 (shipped) + the §6.2 walk-table survivor line + roadmap row.
