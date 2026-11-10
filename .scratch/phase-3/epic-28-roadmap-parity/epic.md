# Epic 28 (Phase 3) — Roadmap parity: full-page spine, roadmap.sh skin, Study Mark

Status: ready-for-agent
Milestone: Phase 3 — optimization season

## Parent

[roadmap.md](../roadmap.md) · reworks FR-5's rendering posture ([prd-synapse.md](../../../docs/product/prd-synapse/prd-synapse.md) §4.1) · adds FR-47 Study Mark (orthogonal to ADR-0001 evidence-only mastery) · AD-9 (accessibility floor) · NFR-6 (bundle discipline; the one new asset is a self-hosted OFL font) · amends epic-16 rulings per owner decision 2026-11-11 (manual marking → Study Mark; style parameters copied verbatim, content still banned — FR-43 wontfix stands) · live roadmap.sh teardown 2026-11-10/11 · [spec.md](spec.md).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-study-mark-data.md](issues/01-study-mark-data.md) | — | `study_mark` column + SetStudyMark command + GraphQL field/mutation + codegen + rspec (FR-47 data half) |
| 2 | [02-spine-layout.md](issues/02-spine-layout.md) | — (parallel with T1) | deterministic spine layout pure module + tests (FR-5 layout rework) |
| 3 | [03-fullpage-canvas-skin.md](issues/03-fullpage-canvas-skin.md) | 1, 2 | full-page scroll canvas (pan/zoom/pinch deleted), verbatim skin tokens + Balsamiq Sans, dual corner badges, legend rework (FR-5 rendering) |
| 4 | [04-chips-and-sheet.md](issues/04-chips-and-sheet.md) | 3 | hover chips (status row + actions), sheet status row + evidence bar + ask-AI companionAsk handoff |
| 5 | [05-e2e-docs-close.md](issues/05-e2e-docs-close.md) | 4 | e2e spine/mark flows, PRD+GLOSSARY+ADR, spine delta record, board update, old layout removal |

## Definition of done

Roadmap renders as a full-page spine browsable by scroll alone (no zoom/pan/pinch anywhere, no horizontal scroll at any width) · node/edge skin matches the measured roadmap.sh parameters verbatim in light and dark (tokens only, zero raw hex in components) · Balsamiq Sans scoped to the canvas with OFL license in-repo · Study Mark set/clear round-trips server-side and renders as a top-right chip without touching any mastery computation (anti-drift suite untouched = proof) · progress bar still mastered/total server states + mark-count line · hover chips + sheet carry the six actions with touch suppression · companionAsk prefills without sending · keyboard contract preserved (re-pointed arrows, Enter sheet, scroll-into-view) · `?node=` deep links scroll+open · list view untouched · `just spec` + `just e2e` green · PRD/GLOSSARY/ADR/spine-delta updated · worktree merged and deleted per discipline.

## Coordination notes

- Worktree: `../project-new-roadmap-parity`, branch `epic/p3-28-roadmap-parity` (cut @ `6dcdb16`). T1 (backend) and T2 (frontend pure module) can proceed in parallel; T3 integrates both; T4 rides T3's canvas; T5 closes.
- The existing graph test suite pins pan/zoom/pinch/wheel/fit behaviors **by design** — those blocks are deleted together with the features in T3; every aria/keyboard/deep-link assertion that survives the redesign must carry over. This is pinned behavior changing, not test rot (same precedent as epic-16's flip of epic-10's derived edges).
- mastery-vector anti-drift is the standing proof that Study Mark never touched mastery math; the suite must not change in this epic.
- i18n: every new user-facing string is a dotted key with zh+en (parity test enforces over the full table).
- Node/npm must be invoked via absolute paths in agent shells (nvm lazy-load shim); backend gates run in dev containers (`just spec` / compose; DATABASE_URL for container rspec: `postgres://postgres:postgres@db:5432/backend_test`).
