# T2: Local store (synapse-db:v1) + plans/nodes repositories + Query wiring

> Migrated from GitHub issue #9 (closed 2026-11-02). Original: https://github.com/YinanZhaoXometry/comp5241-project/issues/9

Status: done
Blocked by: 01

## Parent

[Epic 1](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

The local store and the first repositories: the single versioned `synapse-db:v1` localStorage document with adapter-owned migrations, the typed AppError, the StudyPlan/KnowledgeNode repository, centralized query keys, and the first read/write Query hooks — TanStack Query stops being an idle provider. A plan with its nodes survives a write→read cycle in jsdom localStorage, and a prior-version document migrates instead of corrupting.

## Acceptance criteria

- [x] One localStorage document with a `version` field; full-document synchronous writes; write→read round-trip tested through the repository's public API
- [x] Migration path owned by the adapter; a test migrates a previous document shape forward
- [x] Plan + node CRUD via repository only; ids are UUIDs, dates ISO 8601 strings (spine conventions)
- [x] Query keys centralized; plan/node hooks go through the repository — no direct localStorage access from hooks (AD-3)
- [x] Adapter failures throw typed AppError { code, messageKey? } — failure path tested
- [x] Reset clears the document's data while keeping the version field — tested
- [x] Gates green: `npx tsc -b`, `npm run lint`, `npm run test`

Bound by: AD-3, AD-4, spine Consistency Conventions.
