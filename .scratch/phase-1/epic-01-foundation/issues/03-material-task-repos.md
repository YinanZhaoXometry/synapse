# T3: Material & Study Task repositories (session-only blobs, auto-node, reading/chat persistence)

> Migrated from GitHub issue #11 (closed 2026-11-02). Original: https://github.com/YinanZhaoXometry/comp5241-project/issues/11

Status: done
Blocked by: 02

## Parent

[Epic 1](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

Material and Study Task persistence: attach a Material whose file blob stays session-only while its metadata and bounded extracted per-section text persist; create a Study Task that auto-creates its single owned KnowledgeNode (planId null); persist ReadingProgress and the per-Material ChatThread. After a reload simulation, a re-uploaded Material restores its study surface from metadata + extracted text alone.

## Acceptance criteria

- [x] Material persists metadata + extracted per-section text with bounded section size; blob bytes never appear in the persisted document — tested
- [x] Study Task creation yields exactly one KnowledgeNode owned by the task (planId null) — tested (AD-6)
- [x] ReadingProgress round-trips; ChatThread anchors to its Material and round-trips
- [x] The onboarding-complete flag round-trips as a field of the store document (AD-8's entry-state flag)
- [x] Reload simulation: fresh adapter over the same localStorage restores everything except the blob
- [x] Gates green: `npx tsc -b`, `npm run lint`, `npm run test`

Bound by: AD-2, AD-3, AD-4 (owner-relaxed FR-29).
