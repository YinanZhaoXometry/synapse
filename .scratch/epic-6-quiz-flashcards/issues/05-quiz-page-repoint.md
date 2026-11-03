# T5: `/quiz` scaffold re-point — the "evidence logged" claim becomes true (FR-36 carve-out) — coupling tail

Status: ready-for-agent
Milestone: Phase 1 — Nov 6 core
Blocked by: 01-quiz-session-engine.md, 02-plan-flow-quiz-ui.md

## Parent

[Epic 6](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

The second owner-mandated coupling tail, executed only after its blockers
clear: the grandfathered `/quiz` demo loses everything that lies. The
hardcoded bilingual question bank, the fake generation timer, and the
hardcoded additive mastery deltas into the frozen scaffold context are all
removed. In their place the page becomes a real-seam demo outside plan
context (FR-36's carve-out): the learner picks a material, the page generates
a real quiz through the AI seam, plays it through the real runner with the
real attempt gate, records real evidence through the repository, and shows
real results — so its "evidence logged" claim is finally true. Retake starts
a fresh generated session with the same honest labeling as the plan flow.
Where the existing demo chrome doesn't lie, it may stay; nothing about the
scaffold's visual shell blocks the re-point.

## Acceptance criteria

- [ ] No hardcoded question bank, no fake generation timer, and no mastery writes to the frozen scaffold progress context remain on `/quiz`.
- [ ] Generation, session play, evidence recording, and results are all real and repository-backed, reached without any plan context (material picker → generate → run → evidence).
- [ ] The results screen's evidence claim matches reality: records exist in the store and node movement follows ADR-0001 through the domain seam.
- [ ] Retake creates a new generated session with honest near-identical labeling.
- [ ] i18n zh/en parity; semantic tokens only (AD-9); a test covers the demo loop end-to-end; gates green via direct `node_modules/.bin` binaries.
