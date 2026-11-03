# Spec: Epic 9 (Phase 2) — Hubs + progress surfaces: real data behind the retained pages

Status: ready-for-agent (delta-grill at kickoff)
Milestone: Phase 2 — post-deadline

> Authored 2026-11-03 in the Phase-2 batch pass (see [roadmap.md](../roadmap.md)). Grounded in final
> PRD FR-23/26/27/28/41/42 + FR-25's Phase-2 halves + the UX spines (EXPERIENCE.md hub patterns).
> **Delta-grill at kickoff** (post-cutover reality may have moved). Gate: epics 07+08 done.

## Problem Statement

Through Phase 1 and the cutover, the sidebar's four practice/progress surfaces stand on scaffold stand-ins: `/mistakes` `/planner` `/flashcards` `/quiz` mock or partial, Dashboard/Analytics/Achievements render demo data on the frozen `UserProgressContext`. The PRD's Phase-2 promise is the aggregation layer: every wrong answer findable (FR-23), each day assembling itself (FR-27), all decks and quiz history reachable (FR-41/42), per-plan analytics on real evidence (FR-26), real badge unlocks (FR-28), and the Dashboard + weekly goal re-pointed (FR-25). This epic also **completes the `UserProgressContext` retirement** epic-08 staged (A1).

## Solution — read model first, then six surface tickets

1. **Hub read model (T1):** the api-side aggregation queries one GraphQL field-set: mistakes grouped by plan/task, the Today assembly (AI-suggested ∥ due reviews ∥ manual tasks), flashcard/quiz histories, analytics series (per-node mastery, weekly accuracy trend, consistency), weekly-goal progress, badge-state rules. Server-side aggregation per AD-14's "domain owns rollups" spirit — the client renders, never aggregates.
2. **Mistakes hub (T2):** `/mistakes` re-point — grouped/filtered by plan and task, source location + user answer per entry, deep links into the reader anchor channel.
3. **Today hub (T3):** `/planner` becomes **今日学习** (label rule: 学习计划 stays reserved for Study Plan) — the FR-27 task list (durations, priorities, completion toggles, day-progress summary, light week strip), consuming epic-07's `dueItems`.
4. **Flashcards + Quiz hubs (T4):** `/flashcards` aggregate deck view (studyable from the hub; generation stays in-flow FR-19), `/quiz` history with results + **retake** producing fresh evidence (NFR-8 no-repeat-inflation).
5. **Analytics + Dashboard (T5):** `/analytics` re-point (node mastery bars, accuracy trend, consistency — the scaffold's recharts patterns, real series); `/dashboard` re-point (greeting, streak, KPI cards, quick actions, recent achievements) + the **weekly goal** in evidence-producing sessions (never minutes — SM-C3).
6. **Achievements (T6):** real unlocks from the scaffold's 12-badge taxonomy on evidence/streak/material events; points/level stay read-only garnish, nothing new built on them (FR-28 stance).

## User Stories

1. As a learner, every wrong answer is findable with its source and relaunchable into study.
2. As a learner, opening 今日学习 shows today's dues + AI suggestions + my own tasks, completable in place.
3. As a learner, hub-launched flashcard study and quiz retakes work without entering plan creation, and retakes produce real new evidence.
4. As a learner, Analytics tells the truth about my weak nodes and weekly accuracy.
5. As the codebase, `UserProgressContext` retires fully when T5/T6 land (A1 completion).

## Implementation Decisions

- Aggregation lives api-side behind the scoping context (FR-4); the web renders typed-hook results — no client-side cross-plan stitching.
- Retake = a **new** session seeded from the old one's scope/mode (never replay of graded answers); evidence records reference the new session.
- Badge rules are server-computed fields (eventual consistency fine — computed on read, v1); taxonomy = the scaffold's 12 badges, unlock conditions restated in the ticket.
- Weekly goal = count of evidence-producing sessions per ISO week; target user-settable in Settings' simple half (full Settings surfaces are epic-14).
- i18n: 今日学习 label rule + all new strings zh+en (AD-9); zh surface label literally 今日学习.

## Testing Decisions

- api: aggregation specs on factory evidence graphs (grouping, week boundaries, due-item join, badge triggers at boundaries); scoping on every new field.
- web: deterministic vitest per surface (factories via typed hooks mocked at the Apollo client level — the double pattern); retake-produces-fresh-evidence integration spec.
- Manual smoke: full hub walk in both languages/themes; `UserProgressContext` deletion verified by grep-guard.

## Out of Scope

Roadmap graph (10) · adaptive suggestions *generation* (10 — Today consumes whatever exists) · Notes (12) · Settings account surfaces (14) · Calendar-style history browsing (demoted per FR-27 — week strip only).

## Further Notes

- Delta-grill items: badge unlock thresholds (PRD gives taxonomy, not values — propose at kickoff), Today's AI-suggestion heuristic (v1 may ship dues + manual only, suggestions flagged partial).
- A1 note: T5+T6 close the staged `UserProgressContext` retirement from epic-08.
