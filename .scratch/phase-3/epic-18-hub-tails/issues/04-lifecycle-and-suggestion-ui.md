# 04: Lifecycle + suggestion UI — resolve toggle on /mistakes, AI card on /planner

**What to build:** the two frontend consumers of T1/T2: the mistakes hub gains the resolve lifecycle (toggle + open/resolved filter), the Today hub gains the on-demand AI suggestion card with cap-honest states and the v1 card as permanent fallback.

**Blocked by:** 1, 2.

**Status:** ready-for-agent

**Bound by:** decisions 4/7–10 of the spec (toggle both ways; v1 card untouched verbatim; explicit generate only — no provider call on load; cap-honest failure states; 「AI 建议」 chip + reason line; same `nodeQuickTestHref` deep link), AD-14 (client renders server fields, never recomputes), i18n-mandatory, the Apollo stub harness conventions.

- [ ] Codegen regenerated for the T1/T2 schema (committed output)
- [ ] `MistakesPage`: per-card resolve toggle (optimistic-off; mutation + refetch read-back per the scope-mutation posture); open/resolved filter added to the filter row (counts visible in the subtitle are optional); resolved cards visually quiet but still readable; forfeited entries resolve identically; replay-safe mutation calls (stable client uuid per entry)
- [ ] `PlannerPage`: per-plan 「生成 AI 建议」 button under the v1 suggestion slot — click → mutation with the DETERMINISTIC per-(plan, UTC-day) client uuid (derived client-side, derivation mirrored from the backend unit spec) → AI card renders (「AI 建议」 chip, node title, reason line, same quick-test deep link); same-day re-click → replay (no second spend, instant render); CAP_REACHED → honest toast + button disabled with a cap note; INTERNAL → honest toast; the v1 card and its 「按掌握度推荐 · v1」 chip are byte-identical to today when no AI card exists
- [ ] NO provider call on hub load (the button is the only trigger — a test pins that mounting the page fires no suggestion mutation)
- [ ] i18n zh/en for every new key (resolve toggle, filter, AI card, cap/error toasts)
- [ ] Vitest: MistakesPage resolve/replay/filter cases; PlannerPage generate → card, same-day replay renders without a second mutation call, cap toast + v1 stays, v1 untouched baseline (existing planner specs stay green); Apollo stub harness throughout
- [ ] web gates green (codegen zero-diff, tsc, eslint, vitest grown, build)

## Comments

- (none yet)
