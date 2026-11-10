# Phase 4 roadmap — the learning-engine season board

Status: planned (opened 2026-11-11; owner nomination「与 Synapse 进行特定功能的深度对比、提取掌握门控的设计，形成一个新的 phase 来实施」)
Milestone: Phase 4 — learning-engine season

This file is the phase-level index over `.scratch/phase-4/epic-*/`. Phase 4 turns Synapse's Mastery Score from a **display** into a **learning engine**: gates that consume the score, review that adapts, grading that refuses to guess. The design source is [deeptutor-comparison.md](deeptutor-comparison.md) (HKUDS/DeepTutor v1.7.2 extraction, 2026-11-11) — every epic grills against that doc's §3 mechanics and §5 mapping, and imports **design, not code**. No new PRD rewrite: the phase operationalizes what the PRD already promises (FR-15 marking honesty, FR-24 re-queue, NFR-8 freshness, "100% = exam readiness"); ADR-0001 amendments land with their owning epics, both stacks together (AD-14).

**Product constraints carried into every epic** (from the PRD/brief — non-negotiable at grill): evidence-only mastery, materials-sourced generation, plan-first IA, bilingual zh/en from the first ticket, self-directed study (gates order and certify — they never lock sequencing).

## The board

| # | Epic | Scope (one line) | Gate (must be done first) | State |
| --- | --- | --- | --- | --- |
| 29 | `epic-29-mastery-gates` | gates that consume the score: evidence **independence** flag (hints/assistance → attempt recorded but non-evidence), **defer** escape hatch with `mastery_source` provenance (deferred ≠ mastered), gate-aware **next-objective cursor** (Today hub ordering + roadmap spine "next" state — mastered nodes skipped, the cursor recomputed per read, never a lock), i18n gate copy incl. the confidence-cap explainer (comparison §3.8) | **epic-28-roadmap-parity merge** (the vertical spine its gate states render on) | queued |
| 30 | `epic-30-qualitative-gate` | explain-to-clear: node typing (**2-type grill decision** — explain-type vs practice-type; 4 types rejected, comparison §2), Companion explain-assess op with confidence-gated verdict (≥0.8 final, else ungraded-no-penalty), quality mapping pass=1.0 / fail caps 0.4 (comparison §3.3), wrong-direction discipline (quiz on an explain-node moves the number, never the gate — and the UI says so), marking flow branches by node type | 29 (gate semantics + typing decision land first) | queued |
| 31 | `epic-31-adaptive-review` | requeue upgraded **in place** (one scheduler, no sprawl — comparison §3.7): ease/streak adaptivity over existing mistake outcomes + flashcard self-ratings, mistake **stickiness** (`is_mistake` survives good/easy, `first_wrong_at` for analytics) + **re-open on wrong review**, forgetting-risk queue ordering (`1−retrievability + overdue + error-bonus`), same-session guard, optional tail ticket: **Anki export** (GUID = content hash → update-not-duplicate) | none — code-disjoint from 29/30 (requeue + flashcards + mistakes); may run the parallel lane | queued |
| 32 | `epic-32-grading-integrity` | judging that refuses to guess: Open-answer verdicts carry **confidence** (<0.8 → ungraded tier, no penalty, question preserved), unreadable choice ≠ wrong, **void/repair** a bad generated question (attempts excluded from evidence/mistakes, idempotent), previous-stems dedup feedback into generation | none in phase; **file-coupled with 29** (both touch the quiz-attempt fold — sequence against whichever runs first) | queued |

## Parking lot (rejected/parked with reasons — comparison §5 tail)

- Memory L1/L2/L3 — real gap, wrong season (no retention data; per-plan Companion threads cover the visible need). Revisit post-phase-4.
- Reading hardening pair — verify-quote moved-correction + annotate fail-closed; server-side citation re-resolution. Small tickets for a quiet slot.
- Review-strategy presets (exam-cramming etc.) — settings sugar; only after 31 proves the core scheduler.
- Question-bank full mirroring (explanation archive per attempt) — storage-heavy; mistakes hub covers the learning loop.
- Book engine / living books — product divergence, wontfix.

## Sequence notes

- **Two lanes**: 29 → 30 (gate lane, spine-coupled, waits on p3-28-roadmap-parity merging) and 31 ∥ 32 (review/grading lane, starts anytime). 32 shares the quiz-attempt fold with 29 — within-phase serialization note on the board row.
- **Freshness posture stays ours** (comparison §2 verdict): ADR-0001's 14d freshness cap is kept; DeepTutor's separate SRS decay state is NOT imported as a second mastery read. Epic-31's due reviews exist to re-certify *before* the cap bites — same net effect through the existing invariant.
- **ADR-0001 amendments owed by this phase**: evidence independence + defer provenance (29), evidence sources beyond quiz + fail-cap mapping (30). Both amend the ADR first, then TS+Ruby together, vectors regenerated (the amendment ritual from P2-4).
- Every epic opens with a delta-grill whose first exhibit is comparison §3 (mechanics) — the grill decides what adapts vs drops; this board records the defaults.

## Owner-side (ready-for-human) items

| When | Item | Feeds |
| --- | --- | --- |
| before epic-29 | merge p3-28-roadmap-parity (vertical spine + Study Mark columns; sole holder of 28 now — ux-hardening merged as PR #27 @ `4c6722d`) | epic-29 gate states render on the spine |
| any time | confirm/drop the 2-type node-typing default before epic-30's grill | epic-30 scope |
