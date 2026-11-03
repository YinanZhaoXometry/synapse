# T2: Task Home — `/task/:id`, single-material twin of Plan Home (FR-37; AD-6/8)

Status: done
Milestone: Phase 1 — Nov 6 core
Blocked by: 01-task-create-flow.md

## Parent

[Epic 5](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

The task's stable home address beyond the reader: a single-material twin of Plan
Home. A breadcrumb returns to Plans Home; the material row opens the reader and
offers re-upload when the session-only bytes are gone after a reload; the Mastery
Ring shows the task's own single-node score with the shared state vocabulary and
an evidence popover listing what moved it (AD-6, ADR-0001); quiz and flashcard
tiles are visible but disabled with a bilingual reason pointing at the next slice
(Plan Home placeholder parity). No upload zone — a task is strictly 1:1 with its
material. All numbers flow through pure display-shaping selectors in the tasks
feature; no component computes its own mastery arithmetic.

## Acceptance criteria

- [x] The task-home route exists under the app layout (AD-8); an unknown task id is handled gracefully (not-found behavior consistent with the app, never a blank screen).
- [x] Breadcrumb back to Plans Home is present and works.
- [x] The material row opens the reader; after a reload (bytes lost) it offers re-upload through the shared re-upload path; parse state remains honest.
- [x] The Mastery Ring renders the task rollup — exactly its single owned node's score via the domain seam (`computeTaskRollup`), never a share-of-mastered collapse (ADR-0001); state vocabulary uncovered/partial/mastered with glyph + label, never color alone.
- [x] The evidence popover lists the task node's real evidence records (what moved the number, including the cap-99-below-gate behavior).
- [x] Quiz/flashcard tiles are visible, disabled, and carry a bilingual reason pointing at the next slice (epic-6); Companion is reached via the reader — no duplicate companion surface here.
- [x] Mastery numbers render only via pure display-shaping selectors over real queries — no display arithmetic in components (AD-6; plans display-shaping precedent).
- [x] i18n zh/en parity; semantic tokens only (AD-9); basic responsive correctness at docked/overlay widths.
- [x] Selector unit tests assert exact ADR-0001 numbers (window 5, cap-99 below the evidence gate, mastered = ≥ 80 & ≥ 3) and component render tests cover the three node states + re-upload state; gates green via direct `node_modules/.bin` binaries.
