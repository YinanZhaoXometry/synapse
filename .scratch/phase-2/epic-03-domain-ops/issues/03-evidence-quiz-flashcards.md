# 03: Evidence + quiz-session + flashcard operations

**What to build:** quiz-session create/persist carrying **question→nodeId attribution at generation time** (AD-6 — attribution always, node-*targeted* generation stays epic-10); attempt/grade recording writing EvidenceRecords (correct/partial/wrong-or-forfeit, timestamps); flashcard deck persistence + study-state writes (known/unknown flips as evidence-shaped records where Phase 1 treats them so); mistake-entry logging on wrong answers (feeds FR-23 later).

**Blocked by:** 2.

**Status:** ready-for-agent

**Bound by:** AD-12 (commands), AD-13 (scoping), AD-6 (attribution at generation, evidence-only mastery), ADR-0001's evidence vocabulary (weights 1/0.5/0 — this epic records outcomes, epic-04 scores them).

- [ ] Quiz session ops with node-attributed questions; replay-safe on client uuid
- [ ] Grade/attempt op writes EvidenceRecords in one transaction; failure typed
- [ ] Flashcard ops mirror the Phase-1 repository surface (diff list in Comments)
- [ ] Wrong answers produce MistakeEntry rows with source location + user answer
