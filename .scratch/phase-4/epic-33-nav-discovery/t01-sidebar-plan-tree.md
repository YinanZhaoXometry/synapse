# 01: Sidebar plan tree (records in the 学习 group)

**What to build:** The sidebar's 学习 group gains the user's plans as navigation rows below the three fixed links — the sidebar stops being a pure page list and holds the user's records (DeepTutor pattern: records in the nav, `LearningNavigation.tsx`; gap: every session today costs Plans Home → card two hops). Rows come from `usePlansQuery` (cache-first), capped at 6 with a 查看全部 row → `/plans`. Each row shows topic + the SERVER mastery field as a compact chip (AD-14 — render, never recompute) and links to `/plan/:id`. When a plan has Companion activity, the row is expandable with the Companion conversation as its child (Q2 in the epic doc: one nullable read field allowed; if it grows past trivial, ship rows-only and park the child). The same tree renders in the mobile drawer; the bottom nav is untouched.

**Blocked by:** None (can start immediately; code-disjoint from epics 29-32).

**Status:** ready-for-agent

- [ ] 学习 group renders up to 6 recent plans from `usePlansQuery` (createdAt desc — Q1), each linking to `/plan/:id`, plus a 查看全部 row → `/plans`
- [ ] Plan row shows the plan topic and the server `masteryScore` chip; nothing recomputes mastery client-side (AD-14)
- [ ] The currently open plan's row is highlighted (route-derived, exact match on `/plan/:id` including nested `/quiz` / `/flashcards`)
- [ ] Expandable Companion child per Q2: only when the cheap signal exists; hidden rows never cost extra queries on sidebar mount beyond the plans read
- [ ] Mobile drawer renders the same tree (swipe/gesture behavior untouched); rail (md–lg) stays icon-only
- [ ] i18n: new dotted keys zh/en in `i18n-dictionary.ts` (full-parity test green); verified in light + dark
- [ ] Empty state: plans list absent → group renders exactly as today (no empty stub); loading never blocks the fixed links
- [ ] Tests: userEvent interaction tests for row navigation, cap + 查看全部, active-row highlight, drawer tree
- [ ] Gates green: codegen, tsc -b, eslint, vitest --coverage, vite build
