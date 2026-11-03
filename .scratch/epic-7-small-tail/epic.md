# Epic 7 — Small tail: deploy, store reset, plan-first sidebar ordering (FR-35 · FR-36)

Status: ready-for-human (T2/T3 done — smoke + review closed; T1 repo-side done, owner Cloudflare-dashboard setup + 3 live-site ACs pending)
Milestone: Phase 1 — Nov 6 core

## Parent

Phase-1 slicing table row 7 ([workflow.md](../../docs/agents/workflow.md):57). Scale-ladder row 1: **no spec chain** — straight to `/implement` per ticket. Bound by AD-4 (one versioned localStorage document), AD-8 (SPA-fallback routing), AD-9 (scaffold conventions), AD-11 (deployment: Cloudflare Pages, decided 2026-11-03), and FR-35/36 acceptance in the PRD.

> **Process note (deviation, deliberate):** workflow.md says create the epic doc when the spec run starts. Epic 7 has no spec run (scale-ladder row 1); this doc was created early (2026-11-03, owner request) to pin the coupling split below before epics 5/6 start, so the blocked scope is visible on the board and unblocks mechanically when its edges clear.

## Coupling map (owner request 2026-11-03 — what waits on what)

| Scope | Coupled to | Unblock condition | Ticket |
| --- | --- | --- | --- |
| FR-35 public deployment | **none** | do now | [01-deploy-fr35.md](issues/01-deploy-fr35.md) |
| Settings store reset | weak — none blocking | do now; re-verify key inventory at epic close (epic-5/6 add repos under the same `synapse-db:v1` document, which the wholesale clear already covers) | [02-settings-store-reset.md](issues/02-settings-store-reset.md) |
| FR-36 sidebar plan-first ordering (final pass) | **epic-5 tasks + epic-6 quiz/flashcards** | both epics `done` — task routes and real in-flow quiz/flashcard surfaces must exist before the sidebar's final ordering and the FR-36 consequences can be verified truthfully | [03-sidebar-plan-first-ordering.md](issues/03-sidebar-plan-first-ordering.md) |

Cross-epic `Blocked by:` edges reference directories, not local ticket numbers — the frontier scan can't resolve them automatically; the epic docs' `Status:` must be checked manually. **Both edges are cleared (verified 2026-11-03):** `.scratch/epic-5-tasks/` and `.scratch/epic-6-quiz-flashcards/` both read `Status: done`, so [03](issues/03-sidebar-plan-first-ordering.md) started and is implemented (final visual pass pending).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-deploy-fr35.md](issues/01-deploy-fr35.md) | — | public URL, SPA fallback, auto-deploy from main (FR-35; AD-11) |
| 2 | [02-settings-store-reset.md](issues/02-settings-store-reset.md) | — | reset wipes `synapse-db:v1` + UserProgress, keeps UI prefs (AD-4) |
| 3 | [03-sidebar-plan-first-ordering.md](issues/03-sidebar-plan-first-ordering.md) | epic-5 + epic-6 (cross-epic, whole-epic) | FR-36 consequences verified post-5/6; ordering final pass |

## Definition of done

FR-35 acceptance (shareable URL, live-demo-ready) · reset returns the app to first-run state · FR-36's three testable consequences pass **after** epics 5/6 land · gates green (`npx tsc -b`, `npm run lint`, `npm run test` — note pnpm layout: call binaries under `node_modules/.bin/`) · grandfathered scaffold surfaces untouched beyond what FR-36 re-points · every ticket cites its AD ids.

## Closure (2026-11-03)

Shipped T1–T3 (`f3b4d84` → `8baf500` → `bc9e569`) + review-fix pass (`834498f`) on the integration branch `epic/7-small-tail`. Two-axis review (spec-conformance + defects): **0 × P0, 4 × P1, 5 × P2 — all fixed** in `834498f` (reset handler unguarded `AppError` → try/catch + error toast, stale 「演示数据/刷新即重置」 section copy, stale epic/ticket/deploy-doc claims, deploy-doc build-command correction). Browser smoke (live dev server, orchestrator): first-run EntryGate → onboarding → `/plans` front door; reset flow lands on the first-run wizard with `synapse-db:v1` provably empty and prefs kept; sidebar order verified in dark/sunset + light×{sunset, twilight, aurora}; phone drawer + Pad rail + unchanged bottom-nav 5. 411/411 tests, tsc/eslint clean.

**Remaining for FR-35 (owner):** connect Cloudflare Pages to `github.com/YinanZhaoXometry/synapse` per [docs/deploy.md](../../docs/deploy.md) (~2 min, git integration — no wrangler needed), then tick the three live-site ACs in [01](issues/01-deploy-fr35.md) (public URL, deep-route refresh, fresh-profile persistence). Everything repo-side is done; later epics redeploy by pushing to `main`.

**Out-of-scope observation (owner):** AGENTS.md's storage-key names are stale — the language key on disk is `studyflow-lang` (not `synapse-lang`), and the theme keys (`synapse-theme`/`synapse-mode`/`synapse-motion`) are lazy-written (absent from storage until the user changes appearance). Docs-only fix, not taken in epic-7.
