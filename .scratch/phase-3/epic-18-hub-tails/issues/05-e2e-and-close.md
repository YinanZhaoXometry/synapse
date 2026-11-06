# 05: E2E + close — server-live flow coverage, smoke, spine rows, board

**What to build:** the hub tails are provably working end to end and honestly recorded: e2e for the server-live flows, dual-theme smoke, the two spine Deferred rows closed/annotated, the board row + baselines.

**Blocked by:** 3, 4.

**Status:** done (2026-11-06; e2e 19 → 21 passed (hub-tails.spec.ts: materials-hub server row + mistake lifecycle, no new stub shapes), live browser smoke 12 shots self-reviewed (light+dark+twilight+reduced-motion, screenshots outside the repo), spine rows closed/annotated (ca0fbcb), all gates green — rspec 1452 / vitest 917 / codegen zero-diff / mastery anti-drift / rubocop / tsc / eslint / build)

**Bound by:** the e2e harness conventions (deterministic stub provider, self-isolating users; AI-gated surfaces stay e2e-uncovered — the suggestion generation is AI-gated and gets NO stub reply), the spine-maintenance discipline (rows closed where the decision was made), scope exception: THIS ticket edits `.scratch/phase-3/` + the two spine rows in `docs/architecture/architecture-synapse/architecture-synapse.md` only.

- [ ] E2e: materials hub — register fresh → attach a material inside a plan (existing flow) → `/materials` shows the server row (title/kind/size/scope chip) → Open lands in the reader; mistake lifecycle — run a quiz to a wrong answer → `/mistakes` shows the entry → resolve toggle → reload → stays resolved; resolved filter works
- [ ] E2e hygiene: no new stub-provider prompt shapes (suggestion generation stays AI-gated/uncovered — assert nothing about it in e2e)
- [ ] Live browser smoke: /materials + /mistakes + /planner on the real stack, both themes + one non-default palette + reduced-motion; honest caveats recorded (the IAB rAF lesson applies)
- [ ] Spine (`architecture-synapse.md` Deferred): Materials-hub row → closed (server backing landed, epic-18); Hub state-field tails row → annotated (lifecycle landed; Today = v1 + on-demand generation card, heuristic specs untouched; **targeting bonus consciously deferred to epic-21** — spec decision 5 ruling cited)
- [ ] Board (`.scratch/phase-3/roadmap.md`): row 18 → done with baselines; epic.md + ticket statuses → done
- [ ] Full gates: `just spec` (both stacks) green — rspec ≥ the T2 baseline, vitest ≥ the T4 baseline, codegen fresh, mastery-vector anti-drift green (assert untouched: no mastery math touched); new e2e specs green
- [ ] Memory notes updated (coordinator archives the smoke verdicts; implementer reports them)

## Comments

- (none yet)
