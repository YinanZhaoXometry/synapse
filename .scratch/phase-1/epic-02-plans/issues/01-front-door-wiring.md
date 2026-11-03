# T1: Front-door wiring — entry guard, plan routes, onboarding completion, nav re-point

Status: done
Milestone: Phase 1 — Nov 6 core
Blocked by: None (can start immediately)

## Parent

[Epic 2](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

Opening the app becomes plan-first (AD-8, Q2/Q6). The root becomes a guard driven by the onboarding-complete flag: not onboarded → the existing onboarding wizard; onboarded → Plans Home. Completing onboarding persists the flag (the repository function exists but nothing calls it today) and the wizard's final CTA leads to Plans Home instead of the dashboard. Plans Home, plan creation, and Plan Home get their routes (empty shells are fine — later tickets fill them). The sidebar's 学习计划 entry points at Plans Home; the old Planner demo page stays reachable by URL but leaves the nav (FR-27 revives it in Phase 2). The guard decision is a pure function, tested.

## Acceptance criteria

- [x] First run: root shows the onboarding wizard; completing it persists the completion flag and lands on Plans Home (AD-8; the settings-reset slice later clears this flag with the store)
- [x] Second visit: root redirects straight to Plans Home — the wizard never repeats (Q6)
- [x] Routes exist for Plans Home, plan creation, and Plan Home inside the app shell (AD-8; quiz/flashcard sub-routes stay out — slice 6)
- [x] 学习计划 nav entry points at Plans Home; Planner demo route reachable by URL only; no other nav change (full FR-36 reorder = slice 7) (Q2)
- [x] Entry-state decision (onboarding-complete → destination) is a pure function with vitest coverage: first-run, returning, and post-completion cases (Q8)
- [x] All new user-facing strings in the i18n table, zh + en (NFR-5)
- [x] Gates green: `npx tsc -b`, `npm run lint`, `npm run test`; grandfathered scaffold surfaces untouched (AD-9)
