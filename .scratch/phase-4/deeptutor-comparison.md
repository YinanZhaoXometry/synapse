# DeepTutor × Synapse — feature comparison & mastery-gate extraction

Status: research artifact for the Phase 4 kickoff grills · 2026-11-11
Source: local snapshot `../DeepTutor-main` (HKUDS/DeepTutor v1.7.2, Apache-2.0). All `deeptutor/…` paths below are under that snapshot; all `backend/…`/`frontend/…` paths are Synapse main @ `6dcdb16`. Facts on the Synapse side were re-verified in-repo today, not from memory.

Why this exists: the owner nominated a DeepTutor-parity learning-engine phase (2026-11-11). This doc is the comparison + the extracted design that the phase-4 epics grill against. It is **not** a spec — each epic specs at its own kickoff (delta-grill-at-kickoff convention).

---

## 1. What DeepTutor is, in one paragraph

An agent-native learning workspace (Python + Next.js, ~200k lines) built around a two-layer plugin model — single-shot **Tools** the LLM calls, multi-stage **Capabilities** that own a turn — with Chat, Books, Mastery Path, Immersive Reading, Practice, a three-layer memory, and IM-connected Partners. License Apache-2.0: design import is unproblematic; we import **design, not code** (different stack, and Synapse's constraints differ).

## 2. Feature-by-feature comparison

| Capability | DeepTutor | Synapse today | Verdict |
| --- | --- | --- | --- |
| **Mastery score** | Recency-weighted mean (weights .5/.7/.85/.95/1.0 over last 5), confidence caps {1 attempt: 0.5, 2: 0.8}, per-KP; `deeptutor/learning/mastery.py:17-37` | Plain mean of last 5, cap 99 below 3 evidence, mastered ≥80 & ≥3, floored rollup (100 ⇔ all mastered), 14d freshness cap — ADR-0001 | **Parity in spirit, divergent mechanics.** Both are evidence-only with anti-inflation caps. DeepTutor weights recency; Synapse weights evidence count. Don't churn the formula — Synapse's is golden-vectored cross-stack (AD-14). |
| **Mastery gating (enforcement)** | The differentiator: hard per-type gates that decide advancement, tool access, and review scope; "the gate IS the cursor" (`learning/policy.py:10-16,287-293`) | **None.** Score displays; nothing is blocked, ordered, or required below threshold. Node `state` is derived display, not enforcement. | **Steal the semantics, adapt the enforcement** → epic-29. |
| **Node/objective typing** | 4 types (memory/concept/procedure/design) with per-type gates, SRS ladders, cold-start difficulty (`learning/models.py:25-29`, `scheduler.py:17-55`) | Nodes are untyped | Import a **2-type split first** (explain-type vs practice-type) → epic-30 grill decision; 4 types is over-modelling for us. |
| **Evidence independence** | `independent` flag: hints/assistance exclude an attempt from mastery entirely (`learning/service.py:620`, `models.py:123-147`) | No concept — companion hints, quick-test reveals, quiz retakes all count equally | **Steal** → epic-29. Small schema change, big honesty win, fits FR-15's claim+confirm ethos. |
| **Qualitative (Feynman) gate** | Concept/design KPs open only via `mastery_assess` — explain in your own words, tutor judges, confidence-gated; quiz answers on a qualitative KP explicitly never open it (`capabilities/mastery/tools.py:1497-1517,2045-2052`) | Marking = claim + confirm quiz only; ADR-0001 pins quiz-only evidence | **Steal as an extension** (claim → explain, not just claim → quiz) → epic-30; requires ADR amendment. |
| **Escape hatches** | defer / repair-void / learner-override — all non-crediting, with `mastery_source` provenance (`policy.py:140-147`) | None (only retake) | **Steal defer + provenance** → epic-29; repair-void rides epic-32. |
| **Quiz generation** | Agentic explore→plan→generate→repair pipeline, topic dedup, previous-stems fed back, incremental emission (`agents/question/pipeline.py`) | In-flow generation, materials-sourced (FR-36), recently hardened (quote repair + tag salvage, `22a0e6e`/`8ae6dcc`) | Parity on robustness goals; **steal previous-stems dedup feedback** → epic-32 ticket. |
| **Grading integrity** | Deterministic-first fail-closed; semantic fallback only at confidence ≥0.8, else ungraded-no-penalty; unreadable choice ≠ wrong (`learning/grading.py:13-49`, `semantic_assessment.py:50-60`, `tools.py:463-479`) | Choice graded exact; open answers AI-graded from model JSON (drift-hardened but **no confidence gate, no ungraded tier**) | **Steal the confidence gate + ungraded-no-penalty tier** → epic-32, the phase's grading core. |
| **Mistakes lifecycle** | Auto-capture trigger on any wrong answer → review state (due +1d); `is_mistake` sticky after first wrong (history for analytics); `again` re-opens `resolved` (`services/practice/storage.py:61-89,257-290`) | MistakeEntry + resolved/reviewed flags (epic-18), wrong quiz answers feed mistakes + targeting weight | **Steal stickiness + re-open-on-wrong** → epic-31; verify current resolved-flip behavior in grill. |
| **Review scheduling** | THREE schedulers: question-level SM-2-style (again/hard/good/easy, ease 2.5, 10-min again), KP-level exponential forgetting (stability/difficulty, per-type ladders, forgetting-risk ordering, desired retention 0.9), note-flashcard doubling ladder | ONE scheduler: RequeueSchedule fixed ladders (mistake floor 1d cap 7d; flashcard ladder by self-rating), correct-on-wake scan (`backend/app/commands/requeue.rb:14-23`, `backend/app/models/requeue_schedule.rb`) | **Cautionary tale + upgrade.** DeepTutor's scheduler sprawl is a defect, not a feature. Synapse keeps ONE scheduler (requeue) and upgrades it in place: ease/streak adaptivity + forgetting-risk ordering → epic-31. |
| **Freshness/decay posture** | Mastery score never decays; decay lives in separate SRS state surfacing as due reviews (`scheduler.py` — `retrievability=exp(−t/stability)`) | 14d freshness cap **on the score itself** (ADR-0001 amendment 4) | **Keep ours.** The freshness cap composes with the 100⇔mastered invariant and is already golden-vectored. Epic-31's due reviews *feed* re-certification before the cap bites — same net effect, less machinery. |
| **Question bank mirroring** | Every graded attempt lands in the bank best-effort + idempotently, explanation travels from pose-time (`tools.py:345-409`) | Mistakes hub is the closest analogue (wrong answers only, no per-question explanation archive) | Partial steal: quiz attempt archive w/ explanation → park (nice-to-have, storage-heavy). |
| **Flashcards** | Self-graded flip cards (front≤300/back≤600/hint≤200), doubling-ladder review, Anki export with GUID=content-hash (update-not-duplicate) (`notes/review.py:55-74`, `notes/anki_export.py:149-167`) | Ratings persisted, never evidence (ADR-0001), 再学一轮 same queue, requeue due dates | Anki export = cheap high-value ticket → epic-31. |
| **Reading + annotations** | Locator abstraction (page/chapter/slide/section/segment), quote verify exact→normalised→moved, annotate fail-closed, W3C selectors + rects, revision migration flips `unresolved/ambiguous` | Zero-dep char-offset annotation engine, dual render paths (epic-13), anchor channel, citation chips | **Parity / we're fine.** Two hardening patterns worth a park ticket: verify-quote's moved-correction and annotate fail-closed (`reading/service.py:155-174`, `capabilities/reading/tools.py:491-584`). |
| **Citations** | Revision-bound numeric source rows re-resolved server-side per turn, fail-closed on drift (`reading/references.py:99-162`) | Citation chips via SSE events (epic-12) | Parity in intent; their server-side re-resolution is the sturdier shape — park. |
| **Memory (L1/L2/L3)** | File-backed 3-layer with footnote evidence edges, consolidator budgets, idempotent preferences (`services/memory/`) | **None** | **Park.** Real product gap but wrong season: no retention data, and Synapse's per-plan Companion threads cover the visible 80%. Revisit post-phase-4. |
| **Books / living books** | Typed-block compiler (quiz/flashcard/timeline/interactive/concept-graph blocks) | Diverges: plans + roadmap + materials are Synapse's spine | **Reject** — product divergence, not a gap. |
| **Stack** | Python + Next.js + SQLite-per-workspace + Typer CLI + WS | Rails 8.1 GraphQL + Vite SPA + Postgres + R2 | N/A — design import only. |

## 3. The mastery-gating design, extracted

The load-bearing mechanics, with DeepTutor file:line refs. §3.7–3.9 are the parts Synapse does not have at all.

### 3.1 Axioms (stated in their code, worth stating in ours)

1. **Split the intelligence from the gate**: "the intelligence lives at the loop's exit … the gate that decides whether the learner may advance is a deterministic engine call" (`capabilities/mastery/capability.py:18-21`). Synapse already believes this (AD-6/AD-14: one pure function) — the missing half is that nothing *consumes* the gate.
2. **The gate is the cursor, not a lock**: no stage machine; `next_objective()` recomputes from what is mastered each turn, skipping mastered KPs (`policy.py:10-16, 287-293`). Free navigation + gated credit. This maps to Synapse's self-directed ethos far better than locked sequencing would.
3. **Engine, not impression**: "until `mastery_grade` reports `mastered: true`, it has not cleared … The gate is decided by the engine, not by your impression" (`capabilities/mastery/prompts/en/mastery_loop.yaml:19-25`) — an anti-LLM-sycophancy rule, relevant to our Companion.
4. **Escape hatches never write mastery**: defer/void/override all bypass *routing*, none mark mastered; provenance (`mastery_source: system|learner`) labels every bypass (`policy.py:140-158`).

### 3.2 Score formula (`learning/mastery.py`)

- Weights over last 5, oldest→newest: **0.5, 0.7, 0.85, 0.95, 1.0** (line 17).
- Confidence cap by attempt count: **{1: 0.5, 2: 0.8, ≥3: none}** (line 21) — a single lucky answer maxes at 50%, two at 80%.
- Input: `correctness = 0.5 if partial else is_correct`, over attempts **where `not voided and independent`** (`service.py:522-529`). Hints/assistance set `independent=false` at grade time (`service.py:620`); source-page exposure before the card also flips it (`service.py:89-111`).
- Net effect: **minimum 3 independent correct attempts clear a quantitative gate** — structurally identical guarantee to Synapse's ≥3-evidence cap, reached via weights+caps instead of a count gate. (Synapse keeps its own formula — golden vectors — and imports only the *independence filter*.)

### 3.3 Per-type gates (`learning/policy.py`)

- `QUANTITATIVE_GATE = {memory: 0.9, procedure: 0.9}` (lines 36-39; "~0.9 mirrors Alpha School's 90% before you advance").
- `QUALITATIVE_TYPES = {concept, design}` — boolean gate: `progress.qualitative_mastery[kp_id]` flips true only via tutor-judged explanation (`models.py:754-758`).
- Two-store shape on one progress object: `mastery_levels: dict[kp,float]` + `qualitative_mastery: dict[kp,bool]`. Display unifies at 1.0 (line 51).
- **Wrong-direction discipline** (the subtle part): quizzing a qualitative KP moves the number but never the gate, and the tool *says so* ("grading their answers will not open their qualitative gate, however right they are" — `tools.py:1497-1517`); the mirror call is refused outright ("`{name}` is a {type} type — gate it with mastery_quiz + mastery_grade, not mastery_assess" — `tools.py:2045-2052`); post-grade `next_move` warns the loop "more questions cannot clear it however many the learner gets right" (`tools.py:1815-1843`). A qualitative KP can otherwise sit at `mastery 1.0 / threshold 1.0 / mastered false` — the exact confusion this prevents.
- Qualitative verdict write-back: pass floors the KP at 1.0, **fail caps it at 0.4** (`service.py:2917-2920`); idempotency via `uuid5` over session+turn+kp (`service.py:2911-2916`).

### 3.4 The four gating mechanisms (what "blocked" means)

None block navigation; all block **credit or tool actions**:

1. **Advancement cursor** — `next_objective()` precedence: open pending question → due review → first non-mastered KP in module/list order (mastered skipped = "test out") → complete (`policy.py:281-388`). Action verb differs by state: `probe` (untouched) / `teach` / `assess` (qualitative below gate) / `practice` (quantitative below gate).
2. **Session-mode tool gate** — outline vs study vs review; tool calls refused **at call time** with a message that names the exact alternative ("Call mastery_mode with mode='study' first — tell the learner what you are switching to and why", `capabilities/mastery/mode.py:148-164`, `tools.py:625-640`). A conversation with no recorded mode enforces nothing (back-compat).
3. **Review-scope gate** — review mode re-tests **only mastered** KPs; the refusal copy is the product thesis in one sentence: "Review re-tests what the learner has already proven; teaching something new is what 'study' is for" (`tools.py:557-587`).
4. **Refusal copy pattern** (steal this for Companion + i18n): every refusal = what's blocked + why + **the exact alternative action**. Never a bare denial.

### 3.5 Grading pipeline (integrity rules)

1. **Deterministic first, fail-closed**: choice = exact key match; short = exact or `SequenceMatcher ≥ 0.85` (≤30 chars); open = keyword overlap ≥ 0.6 (`learning/grading.py:13-49`). No stored key → recorded wrong, never right (`service.py:592-597`).
2. **Unreadable ≠ wrong**: a choice submission the grader can't parse asks again and explicitly does not grade ("Could not tell which option 'x' picks, so it was NOT graded", `tools.py:463-479`).
3. **Semantic fallback gated on confidence ≥ 0.8**: a verdict is final only if `result != ungraded AND confidence ≥ 0.8`; otherwise needs-clarification, **no mastery penalty, question preserved** ("Do not turn uncertainty into a wrong answer", `semantic_assessment.py:50-60`, `tools.py:1842-1843`).
4. **Post-grade fold** (one transaction): attempt → evidence row → recompute mastery → schedule review → rebuild queue (`service.py:574-666`).
5. **Void/repair**: a bad question gets its attempts voided (excluded from mastery/mistakes/SRS) or re-keyed + re-graded, idempotently (`tools.py:2184-2300`).

### 3.6 Evidence model (shapes worth copying)

- `QuizAttempt`: `{question_id, kp_id, is_correct, result: correct|partial|incorrect, user_answer, error_type, independent, voided+reason, visual_context, timestamp}` (`models.py:123-147`).
- `LearningEvidence` (durable, cross-surface): `{source: mastery_path|deep_question|immersive_reading|book|partner_chat|import, assessment_type: quiz|qualitative|review, result, quality 0..1, hints_used, confidence, response_time}` (`models.py:173-199`). Quality mapping: correct=1.0 (0.6 if retry), hinted-correct ≤0.6, qualitative pass=1.0/fail=0.2 (`service.py:641-690`).
- **Server-held answer keys**: the expected answer never round-trips through the client or the model; grading reads the store (`models.py:375-465` `pending.py`). Synapse's `releaseGrading` seam is the same posture — keep.
- Concurrency: CAS revision bumps + one path lease (single mutating turn) + append-only event log + one-active-interaction unique index (`storage.py:56-108,553-637`). Postgres gives us this cheaply if needed.

### 3.7 Review/decay, done right (and their mistake)

- Decay is **separate state** (stability/difficulty/retrievability), never mutating the mastery score; it surfaces as due reviews + a `forgetting_risk` score = `1−retrievability + min(overdue/7,.25) + .2·active-error + min(.1·lapses,.2)` used for queue ordering (`scheduler.py:141-144, 386-411`).
- Same-session guard: repeats within 0.25d refresh recall but never grow stability/postpone due (`scheduler.py:314-335`).
- `desired_retention` per path (default 0.9) + strategy presets (exam-cramming 0.95 etc., frozen snapshot per path — `review_strategy.py:70-114`).
- **Their mistake**: three independent schedulers (question SM-2 / KP forgetting model / note-flashcard ladder), each with own state — sprawl. Synapse keeps **one** scheduler (requeue) and upgrades it in place.

### 3.8 i18n status copy (what the user sees — 11 locales)

- `"Quantitative gate: {{pct}}%"` / `"Qualitative gate: explain it in your own words"` / `"Practice questions do not open this gate — it opens when you explain the idea in your own words and your tutor records that. Your answers here still count as practice."` (`web/locales/en/app.json:3536-3628`).
- Confidence-cap explainer: `"Even with {{correct}}/{{total}} correct so far, mastery also weighs evidence volume, difficulty, and recent consistency. One more discriminating practice can raise it further."` — the copy that makes a capped 99% feel honest rather than broken. Direct template for our zh/en dictionary.

### 3.9 Question-bank mirroring

Every graded attempt (incl. group leaves and repairs) syncs to the bank best-effort (5s timeout), idempotent on `(origin_type, origin_ref, turn_id, question_id)`, with the **explanation captured at pose time** traveling into the record (`tools.py:345-409`, `learning/assessment.py:76-113`).

## 4. Synapse baseline (verified 2026-11-11)

- **ADR-0001** (`docs/adr/0001-mastery-computation.md`): last-5 plain mean ×100, half-up round at node, cap 99 below 3 evidence, mastered = ≥80 & ≥3; plan rollup = floored mean with uncovered=0 (100 ⇔ every node mastered); 14d freshness cap on latest evidence (stale → cap 99, never mastered); quiz-only evidence sources; all constants in `MASTERY_CONFIG` (window 5, gate 3, threshold 80, partial 0.5, freshness 14); TS + Ruby golden vectors (AD-14).
- **Requeue** (epic-07, FR-24): `RequeueSchedule` = materialized due-date cache for mistakes + flashcards, correct-on-wake scan recomputes from source rows; **fixed** ladders — mistake floor 1d/cap 7d, flashcard ladder keyed by self-rating (`backend/app/commands/requeue.rb:14-23`). DueItems feed Today.
- **Mistakes**: MistakeEntry + resolved/reviewed lifecycle (epic-18); wrong answers feed targeting weight `w = 1+(100−score)/50 + 错题 + 1`, cap 4 (epic-10).
- **Flashcards**: ratings persisted, zero evidence by design, same-queue rerun; no Anki export (`frontend/src/features/flashcards/FlashcardStudy.tsx` header).
- **Marking** (FR-15): claim + confirm quiz → evidence; no independence concept, no defer, no void.
- **Gating**: none — no advancement cursor, no gate-aware ordering anywhere, no refusal copy.

## 5. Gap analysis → phase-4 mapping

What the comparison says to build, in priority order (full board in `roadmap.md`):

1. **Gates that consume the score** (epic-29): independence flag on evidence (hints/assistance → non-evidence), defer escape hatch with provenance, gate-aware next-objective cursor in Today + roadmap spine, i18n gate copy. ADR-0001 amendment: evidence independence + defer semantics. *Enforcement adapted to Synapse: cursor + copy + completion semantics — never locked sequencing.*
2. **Explain-to-clear (qualitative gate)** (epic-30): node typing (2-type grill decision), Companion explain-assess op with confidence-gated verdict (≥0.8 else ungraded-no-penalty), quality mapping (pass 1.0 / fail 0.2-cap), marking flow branches by node type. ADR amendment: evidence sources expand beyond quiz.
3. **Adaptive review** (epic-31): requeue upgraded in place — ease/streak adaptivity (again/hard/good/easy mapping over existing flashcard self-rating + mistake outcomes), mistake stickiness + re-open-on-wrong, forgetting-risk queue ordering, same-session guard, optional Anki export ticket. One scheduler, no sprawl.
4. **Grading integrity** (epic-32): judge-confidence gate + ungraded tier for Open questions, unreadable-choice-never-wrong, void/repair question, previous-stems dedup feedback into generation.

**Rejected/parked** (with reasons, so the parking lot doesn't re-litigate): memory L1-L3 (no retention data; Companion threads cover the visible need), book engine (product divergence), 4-type node taxonomy (2 types first, extend only with evidence), KP-level second scheduler (would recreate DeepTutor's sprawl), question-bank full mirroring (storage-heavy, mistakes hub covers the loop), reading verify-quote hardening + server-side citation re-resolution (good patterns, small tickets, park for a quiet slot), review-strategy presets (settings sugar — after 31 proves the core).
