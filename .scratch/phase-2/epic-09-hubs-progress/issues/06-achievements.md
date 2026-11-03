# 06: Achievements — real badge unlocks (FR-28)

**What to build:** `/achievements` renders real unlock states from the read model's badge computation (scaffold's 12-badge taxonomy: quizzes/streaks/flashcards/materials/progress; thresholds per T1's recorded decisions); unlock moments surface once (toast/celebration within existing animation vocabulary); points/level display stays read-only garnish — nothing new builds on it.

**Blocked by:** 1.

**Status:** ready-for-agent

**Bound by:** FR-28 (taxonomy reference, no new points mechanics — stance binding), AD-9 (never-color-only states, reduced-motion collapse for celebrations).

- [ ] All 12 badges compute on factory evidence; boundary triggers tested
- [ ] Unlock surfacing respects reduced-motion + both themes
- [ ] Points/level untouched beyond read-only display; `UserProgressContext` deletion completes here with grep-guard
