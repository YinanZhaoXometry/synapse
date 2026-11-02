# Spec: Epic 1 — foundation (domain core + data/ai seams)

> Migrated from GitHub issue #6 (closed 2026-11-02) when the tracker moved to local markdown. Original: https://github.com/YinanZhaoXometry/comp5241-project/issues/6

Status: done

## Problem Statement

Today the app is a demo shell. A learner's study results vanish on reload (only language and theme prefs persist), the "mastery" numbers are hardcoded demo garnish computed inside a quiz page, the AI behaviors are inline canned fakes scattered across pages, and nothing representing a Study Plan, Study Task, or uploaded Material exists in code. Before any plan-first surface (FR-1/2/25/37) can ship, the product needs its core: durable evidence-based mastery, local persistence, and a single replaceable AI service.

## Solution

Build the foundation the architecture spine fixes (AD-1…AD-6): a pure TypeScript domain core (entity types + the one mastery function + streak rollup), a data layer of repositories over a single versioned local store document, and an AI layer — `CompanionService` with a deterministic simulated implementation (plan-structure proposal, materials-sourced quiz/flashcard generation, grounded chat, open-answer grading). No UI ships in this epic; every later epic consumes these three seams unchanged.

## User Stories

1. As a learner, I want each of my quiz answers stored as an EvidenceRecord tied to the Knowledge Node it evidences, so my Mastery Score reflects what I actually demonstrated.
2. As a learner, I want a node's score computed from my most recent answers, so early mistakes stop punishing me forever.
3. As a learner, I want one lucky answer not to mark a node mastered, so the number stays honest.
4. As a learner, I want a plan's rollup to read 100% only when every node is genuinely mastered, so "ready" means ready.
5. As a learner, I want an uncovered node (no evidence) to read as uncovered — never as weakly-mastered.
6. As a learner, I want my Study Plans, Study Tasks, Materials, evidence, chat, and reading positions to survive a reload.
7. As a learner, I want to re-upload a Material's file after a reload and find its metadata, extracted text, and all my progress still in place (blobs are session-only by owner decision).
8. As a learner, I want my Study Task to own its own single auto-created Knowledge Node, so task mastery works with no plan.
9. As a learner, I want my streak to count consecutive days with at least one evidence-producing session — never minutes, never logins.
10. As a learner, I want a forfeited question ("看答案") recorded as wrong evidence, so revealing answers never inflates my score.
11. As a learner, I want my open answers graded against my own material with a rationale and source citation, so I trust the verdict.
12. As a learner, I want to state a topic and receive a proposed staged node structure (8–12 nodes), streamed like a real conversation.
13. As a learner, I want the same topic to always propose the same structure, so the demo behaves predictably.
14. As a learner, I want quizzes generated from my actual attached materials' content, so practice matches what I'm studying.
15. As a learner, I want every generated question tagged to the node it evidences, so results move the right nodes.
16. As a learner, I want flashcards generated from my materials' sections, so review mirrors the source.
17. As a learner, I want Companion answers grounded in my current Reading Position with citations, hint-first with escalation always available.
18. As a learner, I want the Companion to say explicitly when my material can't answer a question, so it never bluffs (NFR-1).
19. As a learner, I want Companion replies in my active UI language, switching with the toggle.
20. As a learner, I want "reset demo data" to clear everything — store document and demo context together — so demos start clean.
21. As a developer, I want mastery as one pure function with all constants in one config, so every surface computes the same number (AD-6, ADR-0001).
22. As a developer, I want repositories + TanStack Query as the only domain-data path, so there is one ownership system (AD-3).
23. As a developer, I want a single versioned store document with adapter-owned migrations, so future shape changes don't corrupt user data (AD-4).
24. As a developer, I want all AI behind CompanionService, so the server-side implementation (FR-33) replaces an adapter, not a hunt through components (AD-5).
25. As a developer, I want typed errors (code + optional message key) from adapters, so features map failures to bilingual toasts and never fake success.
26. As a developer, I want deterministic simulated AI, so tests are stable and the live demo repeats.
27. As a backend integrator (future), I want the data and AI seams as my handoff surface, so the backend spine starts from interfaces, not archaeology.

## Implementation Decisions

- Three new modules, no UI, no route changes: **domain** (pure TS, zero React imports — AD-1/2), **data** (repositories + local adapter + query hooks), **ai** (service interface + simulated adapter). `UserProgressContext` stays untouched and frozen (AD-3).
- **Entity types owned by data per the spine's ER diagram**: StudyPlan, KnowledgeNode, Material, StudyTask, QuizSession, Question, EvidenceRecord, Flashcard, MistakeEntry, ReadingProgress, ChatThread, SectionMarking (type only — Phase 2 feature), plus the **ReadingPosition** domain type (locator: PDF page number | Markdown section id, + extracted text) consumed verbatim by reader tracking, persistence, and Companion grounding (AD-2). Study Task owns exactly one auto-created KnowledgeNode (`planId` null); plan rollups select nodes by `planId` (AD-6).
- **Mastery per ADR-0001**: outcomes {correct 1, partial 0.5, wrong/forfeit 0}; node score = round(100 × mean of last 5 outcomes on the node); mastered = score ≥80 AND ≥3 total EvidenceRecords; uncovered = none; rollup = round(mean of node scores, uncovered counting 0); task rollup = its single node's score. All constants in one exported `MASTERY_CONFIG`. Streak = consecutive days (calendar days by evidence timestamps) with ≥1 EvidenceRecord. Evidence sources Phase 1: quiz answers only — flashcard difficulty ratings persist on Flashcard records but never create EvidenceRecords. No time-based decay (Phase 2 freshness layers later).
- **Store**: single localStorage key `synapse-db:v1`, one JSON document with a `version` field, full-document synchronous writes, migrations owned by the local adapter. `onboardingComplete` is a field of the document (AD-8's entry-state flag). Material file blobs are the only session-only data; extracted per-section text persists with bounded section size (quota safety). IDs `crypto.randomUUID()`, dates ISO 8601 strings.
- **Repositories**: one repository per aggregate exposing CRUD + the evidence-recording mutation (`recordEvidence` batch on quiz completion); features consume them only through TanStack Query (`useQuery`/`useMutation` + key invalidation); query keys centralized; `use<Entity>Queries` hooks live in the data module (spine conventions). No new React contexts.
- **CompanionService** (interface in ai module): grounded chat on a ReadingPosition (streamed emission), plan-structure proposal from topic/goal (streamed, deterministic), quiz generation by mode from material refs → node-attributed questions, flashcard generation from material refs, open-answer grading → {outcome, rationale, citation}. Guardrail posture carried by a structured response contract (intent, rung, citations) per EXPERIENCE.md — the UI renders the contract, never guesses it. Plan-creation transcripts are ephemeral until the plan is confirmed (ChatThread anchors to a Material; AD-5). Methods accept the active UI language and return localized strings; domain entities stay language-neutral (AD-9).
- **Simulated implementation**: deterministic, keyword-routed, artificial delay, streamed emission. Plan generation picks from a small curated template library — software-engineering default (covers the COMP5241 demo) + generic 4-stage fallback (基础/核心/进阶/应用), 8–12 nodes, node names derived from the topic string. Quiz/flashcard generation templates over the materials' **parsed section text** (headings → "What is X?" choice questions; key sentences → cloze; flashcards = heading/definition pairs), 5–8 questions per quiz, node attribution round-robin across the plan's nodes. Open-answer grading = keyword-overlap against the question's source section text with rationale quoting the matched sentence.
- **Errors**: adapters throw typed `AppError { code, messageKey? }`; mapping to sonner toasts is a feature concern (not this epic).

## Testing Decisions

- Good tests assert external behavior only: mastery results from evidence arrays, repository round-trips through the public API against real jsdom localStorage, simulated-adapter outputs through the service interface. Never internal JSON layout, template internals, or config values re-asserted.
- **Seams (one per boundary, highest possible)**: domain functions called directly; data module exercised via repository API against real localStorage; ai module via CompanionService interface with fixture parsed-text. No React rendering tests — this epic has no UI.
- Mandated mastery suite (AD-10 + ADR-0001): uncovered-never-green; one correct answer ≠ mastered (gate); window aging (an early wrong drops out after 5 newer outcomes); rollup reaches 100 only with every node at 100; evidence-only movement (nothing but EvidenceRecords changes scores); forfeit = wrong. Streak: consecutive evidence days, gap breaks it, minutes/logins never count.
- Store suite: write→read round-trip; `version` migration from a prior shape; reset clears the document but keeps the version field; onboarding flag round-trip.
- Simulated-adapter suite: same topic → identical proposal (determinism); questions only from provided section text; every question node-attributed; grading outcomes match the overlap rule.
- Prior art: none — the repo has a single placeholder test; this epic establishes the vitest pattern per AD-10. Gates: `npx tsc -b` + `npm run lint` + `npm run test`.

## Out of Scope

- Any UI, route, navigation, or Onboarding changes (epics 2–7); the Settings reset **button** rewiring (epic 7 — the store's reset function lands here, the button calls it later).
- Reader parsing (pdfjs/react-markdown deps arrive with the reader epic; the ai adapter consumes parsed sections as data).
- Server-side AI (FR-33), accounts, sync, cost caps — the seams are the handoff, nothing more.
- Re-queue, time-based freshness decay, Mistakes hub, Flashcards/Quiz hubs, analytics (Phase 2).
- Tightening the TypeScript config or bulk-annotating existing scaffold files (AGENTS.md convention).

## Further Notes

- Decision record: architecture spine AD-1…AD-11 (final 2026-11-02), ADR-0001 (mastery computation), root GLOSSARY.md (engineering terms; PRD §3 remains product vocabulary), PRD memlog 2026-11-02 entry (OQ-9 resolution, FR-20 clarification, grill outcomes — owner accepted all recommendations).
- TanStack Query's mounted-but-idle provider starts being used here; no new dependencies in this epic.
- Definition of done per workflow.md: gates green, grandfathered surfaces untouched, every ticket cites its AD ids.
