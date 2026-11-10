---
status: accepted
date: 2026-11-11
---

# Study Mark is orthogonal to mastery

Owner decision 2026-11-11 (epic-28 grill rounds 3–4). Amends — narrowly and explicitly — the posture recorded under FR-6/epic-16 that manual progress marking is rejected outright ("a manual mark-done would be a honesty violation"). That posture remains TRUE for mastery; this ADR carves out a separate concept that never touches it.

## Context

The owner asked for roadmap.sh's Learning/Done/Skip check-in affordance on the roadmap (verified live on their site: hover a node → three status chips → click to mark → a colored corner badge). Our glossary bans the word "done" for mastery, and ADR-0001/AD-6/AD-14 make the Mastery Score strictly evidence-derived: only quiz EvidenceRecords move it. A self-declared "I finished this" cannot move a score without breaking the product's honesty spine — silently dropping the owner's request is not the answer either: self-tracking ("where am I?") is a real learner need distinct from certification ("what can I prove I know?").

## Decision

Introduce **Study Mark** as a new, separate concept: a nullable per-node, per-user string `learning | finished | skipped`, set/cleared by the user from the roadmap's hover chips or the node sheet, persisted server-side (`knowledge_nodes.study_mark`). UI copy is 学习中 / 已完成 / 已跳过 — never "Done" (glossary avoid-word).

**Orthogonality is the contract.** In v1 NOTHING computational reads the mark: not the Mastery Score, not node states, not plan readiness, not adaptive targeting, not quiz generation, not the streak, not badges, not the Today hub. It renders — a corner chip on the roadmap node, a row in the sheet — and nothing else. The plan progress bar keeps counting evidence-derived mastered nodes only; a separate text line counts marks so the self-tracked state stays visible without polluting the evidence number. The mastery-vector anti-drift suite (which would fail if any mastery math changed) passing untouched is the standing proof.

Rendering keeps the two vocabularies visually distinct: the mark is a colored corner chip (blue/green/gray); mastery stays the glyph vocabulary (✦◐○) with node fills never encoding mastery.

## The fuse (what would have to be true to let marks feed computations)

Any future change that lets a mark influence a computation must amend THIS ADR first with the owner's explicit sign-off, and only for one of:
1. **Today hub manual tasks** — "marks drive my daily list" is a plausible v2; it consumes marks for task suggestions but still never touches scores.
2. **Targeting hints** — a skipped mark could down-weight a node in Quick Test targeting; this changes study-surface behavior and needs its own honesty review (a skipped node silently disappearing from quizzes is a readiness lie).
Anything that would move a Mastery Score or a readiness number is PERMANENTLY out — that path goes through evidence (a quiz), never through a declaration.

## Alternatives considered

- **Reject the feature entirely** (the epic-16 posture): keeps the model pure but ignores a direct owner request for a real affordance; self-tracking and certification are genuinely different jobs.
- **Map marks onto mastery states** (learning→partial etc.): rejected — that is precisely the dishonesty the ban existed for; a declaration would masquerade as evidence.
- **localStorage-only marks**: rejected — marks would not follow the account across devices, contradicting the Phase-2 server-truth posture, and a later server migration would cost more than the nullable column now.

## Consequences

- One nullable column + one command + one GraphQL op (epic-28 T1); the schema and the closed error enum are untouched otherwise.
- Every future consumer of `studyMark` must justify itself against this ADR's fuse list in review.
- The glossary carries the term with the orthogonality line; the PRD carries FR-47 with the same contract.
