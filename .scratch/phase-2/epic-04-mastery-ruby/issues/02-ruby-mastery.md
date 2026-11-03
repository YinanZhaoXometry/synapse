# 02: The Ruby `Mastery` module — ADR-0001 verbatim

**What to build:** `app/models/concerns/` or `app/lib/mastery.rb` (placement at ticket time): node score (last-5 windowed mean, weights 1/0.5/0, ≥80 & ≥3 mastered, <3 caps at 99), plan rollup (mean-of-scores, uncovered=0, 100% only all-mastered), task single-node rollup, mastered predicate. RSpec consumes the committed fixtures with exact-equality (BigDecimal vs string decimals).

**Blocked by:** 1 (fixture shape frozen); epic gate: epic-01 done.

**Status:** ready-for-agent

**Bound by:** AD-14 (verbatim port; ambiguities → amend ADR-0001 first, both sides together), AD-6 (no second vocabulary).

- [ ] Fixture parity exact across the whole matrix — zero tolerance diffs
- [ ] No scoring logic anywhere else in api (grep-guard or convention note in backend/AGENTS.md)
- [ ] RuboCop clean
