# 02: Mistakes hub — `/mistakes` re-point (FR-23)

**What to build:** the retained Mistakes page consumes the read model: all wrong answers (Choice + Open) with Material, section, and the user's answer; grouped/filtered by Study Plan and Study Task; deep links into the reader via the position-anchor channel (`?page=N`/`#section-id`); entries relaunch study (re-quiz the section).

**Blocked by:** 1.

**Status:** ready-for-agent

**Bound by:** FR-23 (grouping, source location, task entries under their task), AD-8 (reader anchor channel — the only cross-feature command), AD-9 (bilingual, keyboard-complete).

- [ ] Every wrong answer from factory evidence renders with source + user answer
- [ ] Plan/task grouping + filtering; empty state honest (no mock fallbacks)
- [ ] Deep link lands the reader at the entry's position; re-quiz path produces new evidence
