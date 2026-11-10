# T3 — Shared PageLoader on blank-render pages

Milestone: Phase 2 — post-deadline
Status: done
Epic: epic-28-ux-hardening
Blocked by: —

## Problem

Owner: 「页面加载的提示…让用户知道需要等待」. Audit (2026-11-10): every top-level
page renders `null` while its query is in flight — Dashboard:117, Materials:135,
Quiz:145, Flashcards:155, Mistakes:301, Planner:282, Achievements:102, Analytics:138,
PlansHome:60, PlanHome:158, TaskHome:76, Reader materialQuery:586. Reader parse
lifecycle (ParsingSkeleton) and the AI launchers/companion are ALREADY covered —
explicitly not touched.

## AC

1. New shared `PageLoader` (`frontend/src/components/shared/`): centered spinner in a
   glass card using theme tokens (`bg-background`/`--glass-*` — no raw whites),
   label `common.loading` (new key zh 「加载中…」 / en "Loading…"), respects
   reduce-motion (reuse the existing motion token posture), `aria-busy="true"` +
   `role="status"`.
2. Applied at every audited null-render above: `if (loading) return <PageLoader />`
   (combine multi-query pages: any query loading → loader; keep existing error and
   empty states exactly as they are).
3. Dark mode + at least one non-sunset palette spot-check (house theme rule).
4. Vitest: PageLoader renders + role/label; one representative page swaps null →
   PageLoader while loading (Apollo mock loading=true).
5. AI "thinking" surfaces verified-OK and documented in the ticket close note
   (companion StreamingBubble typing dots `CompanionPanel.tsx:268-270`; quiz
   `QuizLauncher.tsx:110-115` generating phase; flashcards
   `FlashcardLauncher.tsx:44-53`) — no code change.

## Close note (2026-11-11)

AC 1–4 landed in b08a375. The audit's "no page has a loader" missed five MORE
pinned loading-contract tests beyond the planner's (Achievements, Dashboard,
Flashcards, Materials, Mistakes, Quiz each pinned "renders nothing while
loading") — swept in 8b36be7 with the same clause swap: the loader replaces
the `innerHTML === ""` assertion, the never-stale-copy assertions stay.
All six + planner now pin the same first-paint contract.

AC3 (theme spot-check): the loader uses semantic tokens only
(--glass-4/border-border/text-muted-foreground/text-accent-ink) — dark mode
correct by construction; the visual ride-along happens at PR review
(owner verification).
