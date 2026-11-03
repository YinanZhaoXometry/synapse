# T7: Integration slice — the evidence loop across all three seams

> Migrated from GitHub issue #14 (closed 2026-11-02). Original: https://github.com/YinanZhaoXometry/comp5241-project/issues/14

Status: done
Blocked by: 03, 04, 06

## Parent

[Epic 1](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

The epic's demo, code-only: one integration suite walking the spine's evidence-loop diagram across all three seams — create a plan from a proposal, attach a Material (fixture parsed sections), generate a node-attributed quiz via CompanionService, answer it through recordEvidence (including one partial and one forfeit), and watch node scores, states, plan rollup, and streak come out exactly per ADR-0001. Wrong answers produce MistakeEntries in the same pass; a reload simulation preserves everything but the blob.

## Acceptance criteria

- [x] End-to-end test: plan + nodes → material sections → generated quiz → answers (incl. partial + forfeit) → stored EvidenceRecords → mastery/states/rollup/streak match ADR-0001 exactly
- [x] Wrong answers created MistakeEntries during the same pass
- [x] Reload simulation (fresh adapter over the same localStorage) preserves plans, materials' extracted text, evidence, chat, reading positions — not blobs
- [x] Epic hygiene: no grandfathered scaffold file modified (diff check against main); gates green: `npx tsc -b`, `npm run lint`, `npm run test`

Bound by: AD-1…AD-6 jointly; closes Epic 1 per workflow.md DoD.
