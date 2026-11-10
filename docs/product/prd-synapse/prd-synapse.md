---
title: Synapse — PRD
status: final
created: 2026-11-01
updated: 2026-11-09
finalized: 2026-11-01
---

# PRD: Synapse

*Built from the [product brief](../brief-synapse/brief-synapse.md) — the brief stays the source of truth for vision, problem, positioning, and scope boundary; this PRD carries the testable requirements. `[Phase 1]` = by the Nov 6 course deadline; `[Phase 2]` = after; `stretch` = pull into Phase 1 only if the core lands early.*

## 0. Document Purpose

This PRD is for Synapse's development sessions (human and agent): it turns the product brief's decisions into numbered, testable requirements that `/bmad-ux` and `/bmad-architecture` consume next, per `docs/agents/workflow.md`. Structure: Glossary-anchored vocabulary (§3), features grouped with globally numbered FRs (§4), cross-cutting NFRs (§5), phased MVP scope (§6), success metrics with counter-metrics (§7). The brief's Executive Summary, Problem, Differentiators, and Timeline remain authoritative for the "why" — this document does not duplicate them. Depth on the reader-experience concepts lives in the brief's [addendum](../brief-synapse/addendum.md); PRD-specific technical notes accumulate in [this run's addendum](addendum.md).

## 1. Vision

See the brief — [Executive Summary and Vision](../brief-synapse/brief-synapse.md#vision). One sentence for orientation: a bilingual AI-guided study platform that opens onto a Study Plan, grounds its Companion in the exact page you are reading, and tells you — as a percentage — when you are ready.

## 2. Target User

### 2.1 Jobs To Be Done

- When I study a course document, I want answers grounded in the exact page I'm on, so I don't pay a context tax re-explaining my material to a chatbot.
- When I start learning a topic, I want the app to give me the plan — what to master, in what order — so I don't wander; but I want to keep choosing my own materials, so the plan fits my course, not someone else's.
- When I wonder "do I know this yet?", I want a number, not a feeling — a mastery percentage per topic that tells me whether I'm ready for the exam or interview.
- When I hit something I don't understand, I want to turn it into a question or a quick test in one click, so confusion becomes action instead of a note to self.
- When I finish a study session, I want to see what I've mastered and what remains — on the page itself and on the plan — so my progress is visible without bookkeeping.
- When my weak spots show up in my scores, I want the AI to aim the next round of questions and notes at exactly those, so my study time compounds where it's weakest.

### 2.2 Non-Users (v1)

- Instructors: no instructor courses, no approval flows (brief Non-Goals).
- Study groups: no sharing or collaboration surfaces.

### 2.3 Key User Journeys

- **UJ-6. Wei just wants one PDF understood tonight.**
  - **Persona + context:** Wei, no plan, no course — a paper she must understand for tomorrow's meeting.
  - **Entry state:** opens the app; no Study Plans exist.
  - **Path:** chooses **Study Task** instead of creating a plan → uploads the PDF → reads with the Companion → takes a Mix Mode quiz on it → the task shows its own Mastery Score.
  - **Climax:** understanding lands without ceremony — no plan creation stood between her and the PDF.
  - **Resolution:** the task stays in her library; she can promote it to a Study Plan later if it grows into one.
- **UJ-5. Yinan opens the app and lands on a plan, not a menu.**
  - **Persona + context:** Yinan, preparing for a COMP5241 exam in five days.
  - **Entry state:** opens the deployed URL; lands on Study Plan selection (the front door).
  - **Path:** creates a plan ("COMP5241 exam") → the Companion proposes the Knowledge Node structure → he attaches three lecture PDFs and his Markdown summary → reads with the Immersive Reader → takes quizzes (Mix Mode) → the plan's Mastery Score climbs: 40% … 75% …
  - **Climax:** the plan reads **100%** — the readiness state. He knows he can walk into the exam.
  - **Resolution:** plan stays as evidence of what he covered; weak-spot notes remain for the final pass.
  - **Edge case:** a node's score won't move because quiz questions never covered it — the system flags uncovered nodes instead of silently counting them.
- **UJ-1. Yinan reads a lecture PDF with the Companion beside him.**
  - **Persona + context:** Yinan, the builder and first user, studying COMP5241 lecture slides he exported as PDF.
  - **Entry state:** on the Materials page, logged out is fine in Phase 1 (single-browser persistence).
  - **Path:** uploads the PDF → opens it in the Immersive Reader → reads to page 7 → types "why is integration testing different here?" → the Companion answers citing page 7's content.
  - **Climax:** the answer quotes the exact section he is looking at — no re-explaining, no copy-paste.
  - **Resolution:** he keeps reading; the chat history stays anchored to the Material.
- **UJ-2. Confusion becomes a Quick Test in one click.**
  - Yinan selects a paragraph he doesn't quite understand → clicks **Ask Companion** (gets a grounded explanation) or **Quick Test** (gets a 3–5 question mini-quiz on the selection) → wrong answers land in the Mistakes Notebook.
  - **Edge case:** the Companion cannot ground an answer in the current page — it says so explicitly instead of guessing (NFR-1).
- **UJ-3. Wei paints the page green before the exam.**
  - Wei, a classmate trying the deployed URL, re-reads a Markdown summary, marks each section mastered as she verifies she can reproduce it — mastered sections turn green, the rest stays plain — and the Roadmap nodes flip green in step with her quiz passes.
- **UJ-4. Yinan turns a week of highlights into a study plan.**
  - After highlighting exam-relevant parts across several sessions, Yinan asks for the Study Focus; the Companion generates the core study items from his Annotations, and he quizzes himself on them.

## 3. Glossary

*These terms are used verbatim in all FRs, UJs, and SMs. No synonyms elsewhere in this document or in downstream artifacts derived from it.*

- **Study Plan** — the top-level learning container: a structured set of Knowledge Nodes for one topic/goal; the app's entry point. The system provides the Study Plan; the user attaches Materials to it as context. One Study Plan has many Materials and many Knowledge Nodes. Created as **Public** or **Private**.
- **Study Task** — a plan-free standalone learning unit: one Material studied with the identical machinery (Immersive Reader, Companion, quizzes, Mastery Score) without a Study Plan.
- **Square (广场)** — the discovery surface where Public Study Plans are browsed and adopted; shares plan structure only.
- **Note** — an AI-authored Markdown study document generated from a Study Plan's or Study Task's Materials, optionally enriched with AI-selected images and charts.
- **Knowledge Node** — a unit of the knowledge structure within a Study Plan; carries a Mastery Score; the unit of the Roadmap.
- **Roadmap** — the interactive node-graph rendering of a Study Plan (roadmap.sh-style): nodes grouped by stage, edges for sequence, mastery states, click-through.
- **Material** — an uploaded study document (PDF or Markdown) attached to a Study Plan. The user finds Materials; the system hosts none.
- **Mastery Score** — the evidence-based percentage (0–100) of mastery for a Knowledge Node, rolled up to a Study Plan total; 100% is the readiness state (exam/interview confidence).
- **Study Mark (学习标记)** — the user's self-declared per-node status (学习中 / 已完成 / 已跳过), set from the Roadmap and revocable. ORTHOGONAL to the Mastery Score by contract: a mark says where the user *says they are*; only quiz evidence moves the Mastery Score. Nothing computational reads a mark. *(Added 2026-11-11, epic-28; owner decision.)*
- **Immersive Reader** — the in-app reading surface for a Material, with the Companion panel beside it.
- **Companion** — the AI tutor: answers grounded in the current Reading Position; guardrailed (guides before it answers); generates quizzes, flashcards, and Study Notes.
- **Reading Position** — the page (PDF) or section (Markdown) the user is currently viewing, including its text content.
- **Quick Test** — a short AI-generated mini-quiz (3–5 questions) about the current selection or section.
- **Open Question** — a quiz question answered in free text, graded by the Companion against the Material.
- **Choice Question** — a quiz question with options, single-select or multi-select, auto-graded.
- **Mix Mode** — a quiz containing both Open and Choice Questions.
- **Study Notes** — Companion-generated notes targeting the learner's demonstrated weak spots within a Study Plan.
- **Mastery Marking** — the user's manual act of marking a section mastered; rendered as a green background on that section.
- **Annotation** — a colored highlight or an underline the user places on text in the Immersive Reader.
- **Study Focus** — AI-generated core study items derived from a user's Annotations for one Material.
- **Flashcards Hub** — the top-level sidebar surface aggregating all the user's flashcards across plans/tasks, grouped by source; study-from-hub allowed, generation in-flow only.
- **Quiz Hub** — the top-level sidebar surface aggregating quiz history across plans/tasks, with results and retakes.
- **Mistakes Notebook** — the top-level sidebar surface logging all incorrectly answered questions, grouped by Study Plan / Study Task; feeds the Re-queue.
- **Today (今日学习)** — the top-level sidebar surface for each day's study: AI-suggested weak-spot tasks, due Re-queue reviews, and manual tasks with day progress. Replaces the former Calendar concept; the zh label 学习计划 is reserved for Study Plan.
- **Re-queue** — the spaced schedule that resurfaces flashcards and Mistakes Notebook items for review.

## 4. Features

### 4.1 Study Plans & Mastery (the front door)

**Description:** The app opens onto Study Plan selection — the owner names this the biggest highlight. The user chooses or creates a Study Plan; the system provides the plan's structure (Knowledge Nodes), never any learning content — the user attaches their own Materials as the plan's context. Mastery Scores accumulate against the plan from quiz evidence, so "am I ready?" always has a numeric answer. Realizes UJ-5, UJ-3.

**Functional Requirements:**

#### FR-1: Study Plan entry states `[Phase 1]`

On opening the app: with no Study Plans, the user sees an agent-style chat surface inviting plan creation; with existing plans, the user sees a continue prompt (into the most recent plan's detail page — "continue from where you left off") plus a create-new action.

**Consequences (testable):**
- A fresh user is guided to plan creation from the empty state in one step.
- A returning user can re-enter their latest plan with one click (continue → plan detail page).
- Plan creation is AI-generated from **one free-form creation message plus optional material attachments** *(owner amendment 2026-11-09 — supersedes Q4(a)'s topic/goal form and retires the goal-selection step; the message subsumes it)*: the user attaches up to **5 files (PDF / Markdown / PPTX, ≤ 20 MB each — FR-2's rules)** and writes any message; the AI tailors the proposed structure to the message and the attached materials' content (the proposal reads the materials' client-extracted text — parsing stays client-side, AD-7; after confirm the files attach to the created plan through the standard upload flow and are never re-uploaded). Materials attached at creation count toward FR-2's union. The empty state's agent-chat styling is a UX form decision → `/bmad-ux`.

#### FR-37: Study Task — plan-free study `[Phase 1]`

The user can start a Study Task: upload one Material and study it with the full machinery (Immersive Reader, Companion, quizzes, Mastery Score) without creating a Study Plan. Realizes UJ-6. *(Lives in §4.1 for cohesion; numbered globally. Phase 1 per the owner-confirmed slice.)*

**Consequences (testable):**
- A Study Task's capabilities are identical to in-plan study of one Material; no plan UI is required to reach them.
- A Study Task can later be promoted into a Study Plan `[Phase 2 · stretch]`.

#### FR-2: Multi-material plan context `[Phase 1]`

The user can attach multiple Materials (PDF or Markdown) to one Study Plan; all plan features (Companion grounding, quiz generation, mastery) draw on the union of attached Materials.

**Consequences (testable):**
- Non-PDF/Markdown uploads are rejected with a clear, bilingual message (PPT arrives in Phase 2 — owner Q6).
- A typical lecture PDF (≤ 20 MB) uploads without error.
- Generation asked from "the plan" uses all attached Materials. Default attachment is plan-wide; node-pinned attachment is FR-44 (Phase 2).

#### FR-3: Mastery Score `[Phase 1]`

The system computes and displays a Mastery Score (0–100%) per Knowledge Node from quiz evidence, and a rollup per Study Plan; 100% renders as the readiness state.

**Consequences (testable):**
- Each quiz result updates the affected nodes' Mastery Scores immediately after grading.
- A node's score, its basis (which evidence), and the plan rollup are visible to the user.
- Score computation and weighting: resolved at spec time (OQ-9, 2026-11-02) — evidence-windowed mean; values and rationale in [ADR-0001](../../adr/0001-mastery-computation.md); the PRD pins that scores are evidence-based and update on grading.

#### FR-4: Plan privacy `[Phase 2]`

A user's Study Plans, Materials, Annotations, and Mastery Scores are visible only to that user (requires accounts, FR-30).

**Consequences (testable):**
- One authenticated user cannot list or fetch another user's Study Plans or Materials by ID.

#### FR-5: Roadmap graph rendering `[Phase 2]`

A Study Plan renders as an interactive node graph in the roadmap.sh style: Knowledge Nodes grouped by stage, edges for sequence, click for detail. *(Form factor revised 2026-11-11, epic-28, owner decision: a full-page vertical-spine roadmap browsed by scrolling — stage headers as main nodes on a central spine, knowledge nodes fanning beside them, the roadmap.sh style parameters copied verbatim; no zoom or pan.)*

**Consequences (testable):**
- Nodes and edges reflect the Study Plan's structure; the graph renders for a 30+ node plan without unusable layout.

#### FR-47: Study Mark on the Roadmap `[Phase 2 · added 2026-11-11, epic-28]`

The user can mark a Knowledge Node on the Roadmap as 学习中 (learning), 已完成 (finished), or 已跳过 (skipped) — from a node's hover chips or its detail sheet — and revoke the mark by clicking the active status again. Marks persist per user account. **Orthogonal to mastery (ADR-0002):** the mark is self-declared tracking ("where I say I am"); it never feeds the Mastery Score, readiness, targeting, or any other computation (those stay evidence-only per ADR-0001/FR-6). The plan progress bar keeps counting evidence-derived mastery only; a separate line counts marks.

**Consequences (testable):**
- A mark survives reload and follows the account across devices.
- Marking 已完成 never changes the node's mastery state, the plan's progress bar, or any score.
- The UI copy never uses the word "Done" (glossary discipline — 已完成).

#### FR-6: Mastery-driven node state `[Phase 2]`

A Knowledge Node on the Roadmap displays its Mastery Score state — green at the mastered threshold, partial states below; updates live as quiz evidence lands.

#### FR-7: Node click-through `[Phase 2]`

Clicking a Knowledge Node opens the Immersive Reader at a related section (of an attached Material) or starts a Quick Test for that node.

#### FR-38: Plan visibility (Public/Private) `[Phase 2]`

At creation (and afterwards), the user sets a Study Plan as Public or Private. A Public plan's structure appears in the Square; a Private plan never does.

**Consequences (testable):**
- Visibility is changeable by the owner; flipping to Private removes the plan from the Square.
- Making a plan Public exposes its structure only — never the owner's Materials, Annotations, or Mastery Scores (NFR-7).

#### FR-39: Square (广场) — plan discovery `[Phase 2]`

The user can browse the Square to discover Public Study Plans shared by others, preview a plan's structure, and adopt it as their own (attaching their own Materials).

**Consequences (testable):**
- An adopted plan is a normal Study Plan for the adopting user; the adopter's materials and progress are theirs alone.
- Square listing is by structure (topic, nodes), not by any content of any user's Materials.

#### FR-40: Note generation with visual enrichment `[Phase 2]`

The user can generate a Note — an AI-authored Markdown study document — from a Study Plan's or Study Task's Materials. By default the Companion enriches the Note with images or charts at points where a visual aids understanding; the user can also request an image annotation at a chosen place.

**Consequences (testable):**
- The Note is standalone Markdown (exportable), covering the selected scope (whole plan, node, or Material).
- Enrichment placement is AI-selected by default; user-requested annotations land at the chosen spot.
- Image/chart sourcing (generated vs. curated) is an architecture decision — OQ-11.

#### FR-43: Roadmap.sh plan import `[Phase 2]`

The user can import an open-source roadmap.sh developer roadmap as a ready-made Study Plan — its nodes and stages become the plan's Knowledge Node structure *(owner decision Q4, 2026-11-01)*. For engineer-growth topics this replaces AI generation with a curated structure.

**Consequences (testable):**
- An imported plan behaves identically to a generated one (attach Materials, quiz, Mastery Score).
- Source-roadmap attribution is visible on the plan; license handling is a build-time concern → `/bmad-architecture`.

#### FR-44: Node-pinned material attachment `[Phase 2]`

Instead of attaching a Material to the whole plan, the user can pin it to a single Knowledge Node (fixed mode); its content then scopes to that node's grounding and quiz generation *(owner decision Q5 addition)*.

**Consequences (testable):**
- A pinned Material's content never feeds other nodes' quizzes unless re-attached plan-wide.
- Node-pinned and plan-wide attachments coexist on one plan.

#### FR-45: Material–node mapping `[Phase 2]`

When a Material attaches plan-wide, the AI maps the Material's sections to existing Knowledge Nodes and proposes new nodes for coverage gaps; the user confirms proposed nodes before they join the plan *(owner decision Q5(a): "plan 是骨架、材料是血肉" — the two calibrate each other, both stay under user control)*.

**Consequences (testable):**
- Every attached section maps to at least one node or produces a proposed node for confirmation.
- Unmapped content is surfaced to the user, never silently dropped.

### 4.2 Immersive Reader

**Description:** The flagship surface (brief: "Immersive reader (flagship)"): a Material rendered in-app with the Companion chat beside it, aware of the Reading Position. Realizes UJ-1, UJ-2, UJ-3, UJ-4.

**Functional Requirements:**

#### FR-8: PDF rendering `[Phase 1]`

The Immersive Reader renders a PDF Material page-by-page in-app.

**Consequences (testable):**
- Page navigation works; the current page number is known to the system.

#### FR-9: Markdown rendering `[Phase 1]`

The Immersive Reader renders a Markdown Material with its section (heading) structure intact.

**Consequences (testable):**
- Headings render hierarchically; sections are addressable (stable section IDs).

#### FR-10: Reading Position tracking `[Phase 1]`

The system tracks the Reading Position (current page or section, with its text content) and exposes it to the Companion.

**Consequences (testable):**
- Asking the Companion without naming a location yields an answer grounded in the current Reading Position.

#### FR-11: Companion side chat `[Phase 1]`

The user can chat with the Companion beside the Material; answers are grounded in the current Reading Position and cite their source location.

**Consequences (testable):**
- Each answer references the page/section it drew from.
- When the answer goes beyond the Material, the Companion says so explicitly (see NFR-1).

#### FR-12: Guardrailed tutoring behavior `[Phase 1]`

The Companion guides before it answers: hints, scaffolding questions, or step-by-step reasoning precede direct answers. *(Behavioral detail deferred to `/bmad-ux`; stance is NFR-2.)*

#### FR-13: Selection shortcuts `[Phase 2 · stretch]`

Selecting text offers two one-click actions: **Ask Companion** (grounded in the selection) and **Quick Test**. Realizes UJ-2.

#### FR-14: Quick Test `[Phase 2]`

The Companion generates a Quick Test (3–5 questions) on the current selection or section; results feed the Mistakes Notebook and Mastery Score evidence.

**Consequences (testable):**
- Wrong answers appear in the Mistakes Notebook with their source section.

#### FR-15: Mastery Marking — claim + confirm `[Phase 2]`

The user can mark a section as mastered and unmark it; marked sections render with a green background. Marking is a **claim, not evidence**: it invites a short confirm quiz, and only quiz results can raise the node's Mastery Score *(owner decision Q3(c), 2026-11-01)*. Realizes UJ-3.

**Consequences (testable):**
- Marking persists across sessions; the green marking displays immediately as a claim.
- The Mastery Score moves only when a quiz (confirm quiz or any quiz) produces evidence — never from the marking itself.
- Unmarking clears the claim; the evidence trail stays.

#### FR-16: Annotations `[Phase 2]`

The user can highlight text in multiple colors and underline it; Annotations persist and are removable. Realizes UJ-4.

#### FR-17: Study Focus `[Phase 2]`

The Companion generates a Study Focus (core study items) from the user's Annotations on one Material, regenerable as Annotations change. **Where and how it displays is an open UX decision (§8, OQ-1).** Realizes UJ-4.

### 4.3 Quizzes & Flashcards (embedded study aids)

**Description:** The Companion turns the Study Plan's attached Materials into practice — strictly those Materials (owner constraint: no quizzing from arbitrary user-authored content) and only two question shapes: Open Questions and Choice Questions, with Mix Mode combining them. Per the owner's IA decision, quizzes and flashcards are **aids inside the study flow, not top-level destinations** — the product's purpose is mastery of a topic, not a menu of tools (see FR-36).

**Functional Requirements:**

#### FR-18: Quiz generation `[Phase 1]`

Within a Study Plan, the user can generate a quiz drawn only from the plan's attached Materials, choosing a question mode: Open, Choice (single- or multi-select), or Mix.

**Consequences (testable):**
- Every generated question is answerable from the attached Materials' content (NFR-1 sourcing).
- Only Open and Choice questions are ever generated; no other question type appears.
- Choice Questions are auto-graded; Open Questions are graded by the Companion against the Material, with the grade rationale shown.
- Generated questions are tagged to the Knowledge Nodes they evidence `[Phase 2 for node-level tagging]`.

#### FR-19: Flashcard generation `[Phase 1]`

Within a Study Plan, the user can generate flashcards from the attached Materials and study them in a flip-card view, inside the study flow.

#### FR-20: Mastery evidence recording `[Phase 2]`

Quiz results (question, node, correctness) are recorded as mastery evidence and consumed by FR-3 (Mastery Score), FR-6 (node state), and FR-23 (Mistakes Notebook). *(Clarified 2026-11-02: the recording itself is Phase 1 — a prerequisite of FR-3, per architecture AD-6; this FR's `[Phase 2]` tag denotes its hub consumption by FR-6/FR-23.)*

#### FR-21: Adaptive weak-spot targeting `[Phase 2]`

Question generation biases toward Knowledge Nodes with low Mastery Scores and toward items in the Mistakes Notebook, based on the learner's demonstrated performance.

#### FR-22: Study Notes generation (Note variant) `[Phase 2]`

The Companion generates a weak-spot-targeted Note — a Study Note for a Knowledge Node or weak area from the attached Materials, aimed at what the learner has not yet demonstrated. A variant of Note generation (FR-40) with targeting behavior; Realizes UJ-5.

### 4.4 Mistakes Notebook & Re-queue

**Description:** The loop's memory: wrong answers and due reviews come back on a schedule.

**Functional Requirements:**

#### FR-23: Mistakes Notebook `[Phase 2]`

Incorrectly answered quiz questions are logged with their Material, section, and the user's answer. The Mistakes Notebook is a top-level sidebar surface showing all past mistakes, grouped/filtered by Study Plan (and Study Task).

**Consequences (testable):**
- Every wrong answer (Choice or Open) lands in the Notebook with its source location and the user's answer.
- The Notebook view groups or filters entries by Study Plan; entries from Study Tasks appear under their task.
- Re-queue (FR-24) pulls due items from the Notebook.

#### FR-24: Re-queue scheduling `[Phase 2]`

Flashcards and Mistakes Notebook items resurface on a spaced schedule; wrong answers resurface sooner. *(Algorithm and intervals deferred to the implementation spec.)*

### 4.5 Progress Surfaces

**Functional Requirements:**

#### FR-25: Plan overview (light) `[Phase 1]`

The plan home shows the Mastery Score rollup, continue-reading entry points, recent activity, a quick-actions grid, and a study streak (consecutive days with ≥1 evidence-producing session) *(streak + quick actions adopted from the scaffold dashboard)*. A weekly study goal joins in Phase 2, measured in evidence-producing sessions — never minutes (SM-C3). The full Roadmap graph also arrives in Phase 2. **Retained surface (owner round 2026-11-01):** the scaffold's Dashboard page (仪表盘， `/dashboard`) — greeting + streak pill, KPI stat cards, weekly-goal ring, quick-actions grid, recent achievements — stays as the post-login overview destination on demo data until the plan-first front door (FR-1) lands, then re-points at plan evidence.

#### FR-26: Analytics `[Phase 2]`

The user can see per-plan progress: **Mastery Score by Knowledge Node** (the scaffold's topic-strength chart pattern), quiz-accuracy trend over weeks, and study consistency. The scaffold's AI-vs-manual comparison charts are legacy of the removed dual-mode concept and are excluded. **Retained surface (owner round 2026-11-01):** the scaffold's Analytics page (数据分析， `/analytics`) — KPI mini-stats, weekly-study bars, accuracy-trend line, topic-strength bars (recharts, demo data) — stays as the Phase 1 surface; Phase 2 re-points it at real per-plan evidence per the spec above.

#### FR-27: Today (今日学习) `[Phase 2]`

The top-level sidebar surface for each day: a task list combining (a) AI-suggested tasks targeting weak Knowledge Nodes (FR-21), (b) due Re-queue reviews (FR-24), and (c) user-added manual tasks — each with duration estimate, priority, completion toggle, and a day-progress summary *(owner: adopts the scaffold Planner's task-list patterns, replacing the former Calendar concept; history/future browsing demoted to a light week strip or Analytics)*.

**Consequences (testable):**
- A due review appears as a completable task on its due date and links into the study flow.
- Every AI-suggested task traces to the mastery gap it targets (its node is visible).
- The zh surface label is **今日学习** — the label 学习计划 is reserved for Study Plan (term-collision rule).

#### FR-41: Flashcards Hub `[Phase 2]`

A top-level sidebar surface aggregating all the user's flashcards across Study Plans and Study Tasks, grouped/filterable by plan or task; studying a deck from the hub is allowed (it is a review surface), but decks originate only from in-flow generation (FR-19).

**Consequences (testable):**
- Every generated flashcard appears in the hub under its plan/task.
- Flip-card study can be launched from the hub without entering plan creation.

#### FR-42: Quiz Hub `[Phase 2]`

A top-level sidebar surface aggregating the user's quiz history across Study Plans and Study Tasks — past quizzes with results, retakable — grouped/filterable by plan or task. Generation stays in-flow (FR-18).

**Consequences (testable):**
- Every taken quiz appears in the hub with its score and per-question results.
- Retaking a past quiz from the hub produces fresh evidence (new Mastery Score input), per NFR-8's no-repeat-inflation stance.

#### FR-46: Plan-level Companion `[Phase 2]`

Outside the Immersive Reader — at the plan home and in the empty state (FR-1) — the user can chat with the Companion grounded in the whole plan's attached Materials instead of a Reading Position; answers cite their Material and section. Intent shortcuts follow the scaffold tutor's pattern (explain / quiz me / summarize / **analyze my mistakes** — the last explains a Mistakes Notebook item against its source section). **Standalone tutor page (revised, owner round 2026-11-01):** the scaffold's AI Tutor page (`/ai-tutor`) is retained as the plan-free chat destination — demo keyword responses in Phase 1; when server-side AI (FR-33) lands it inherits this FR's grounding and citation behavior. The Companion still lives at the empty state, the plan level, and the reader per the original intent.

**Consequences (testable):**
- Answers cite source Material + section even with no document open.
- "Analyze my mistake" on a Notebook item yields an explanation grounded in that item's source section.

#### FR-28: Achievements `[Phase 2]`

Simple achievement badges for study milestones — the scaffold's 12-badge taxonomy (quizzes / streaks / flashcards / materials / progress) is the reference set. **No new points/level mechanics** *(stance revised, owner round 2026-11-01)*: the scaffold's existing points/level display stays visible as read-only status garnish on retained surfaces (sidebar profile footer, Achievements page), matching the built demo app — but badges + evidence streak remain the only *earned* mechanics; nothing new is built on points, minutes, or logins (SM-C3). The scaffold's Achievements page (成就， `/achievements`, demo unlocks) is the retained Phase 1 surface.

### 4.6 Accounts & Data

**Functional Requirements:**

#### FR-29: Local persistence `[Phase 1]`

Phase 1 persists the single user's data in browser storage; a reload does not lose Study Plans, Materials, or progress.

#### FR-30: Accounts `[Phase 2]`

The user can sign in with email + password or Google OAuth.

#### FR-31: Per-user sync `[Phase 2]`

Authenticated users' data syncs across devices; FR-4 privacy applies.

### 4.7 Platform & AI Integration

**Functional Requirements:**

#### FR-32: Bilingual UI `[Phase 1]`

All user-facing strings render in 中文 and English via the i18n table; no hardcoded strings.

**Consequences (testable):**
- Language toggle switches every visible surface; both languages have parity.

#### FR-33: Server-side AI calls `[Phase 1]`

AI requests execute server-side only; no provider key reaches the client.

#### FR-34: Per-user cost cap `[Phase 2]`

AI usage is capped per user per day; the cap value is set at the architecture stage (NFR-4).

#### FR-35: Public deployment `[Phase 1]`

The app is deployed at a shareable public URL and works for a live demo.

#### FR-36: Generation in-flow, aggregation in the sidebar `[Phase 1]`

Quizzes and flashcards are *generated and launched* within a Study Plan's or Study Task's study flow — the Study Plan is the front door. The top-level sidebar carries **aggregated, cross-plan views** of study output: the Mistakes Notebook (FR-23), Today (FR-27), the Flashcards Hub (FR-41), and the Quiz Hub (FR-42). **Retained destinations (owner round 2026-11-01):** the sidebar additionally carries the scaffold's overview destinations — Dashboard (仪表盘， FR-25), AI Tutor (AI 导师， FR-46), Analytics (数据分析， FR-26), Achievements (成就， FR-28), plus Materials and Planner — and its footer shows the current-user profile (avatar, name, level·points line) with the Settings gear as the desktop entry to `/settings`. The plan-first ordering (front door + hubs) replaces the overview ordering as FR-1 lands.

**Consequences (testable):**
- Quiz/flashcard *generation* is only reachable from inside a plan/task context on the plan-first surfaces; the retained scaffold pages expose demo generation buttons outside plan context for the Nov 6 demo and re-point in-flow as FR-18/FR-19 land.
- All four aggregated surfaces are reachable from the sidebar from anywhere.
- The sidebar footer profile and its Settings entry are reachable from every page on desktop.

> **Platform note (updated 2026-11-01):** the dual-mode legacy (`LearningModeContext`, `aiOnly` nav gating, mode toggle, onboarding mode step) has been removed in the first implementation pass — the retirement this note originally scheduled is done (AI-vs-manual analytics charts went with it). The same owner round retained the scaffold's ten-page navigation (Dashboard, AI Tutor, Materials, Quiz, Flashcards, Mistakes, Planner, Achievements, Analytics + Settings via the profile footer) alongside the Study Plan-first IA (FR-1, FR-36): retained pages run on demo data and adopt plan-first behavior as their FRs land.

## 5. Non-Functional Requirements (Cross-Cutting)

- **NFR-1 Grounding honesty** — Companion answers cite their Reading Position source; when an answer draws on knowledge beyond the Material, the Companion says so explicitly. The platform never presents generated content as course authority.
- **NFR-2 Guardrail stance** — the Companion's default behavior biases guidance (hints, questions) over answer-dispensing, per the Bastani et al. finding (brief, Research grounding). Hint-first is a product rule, not a settings option.
- **NFR-3 Privacy** — Materials and derived data belong to one user; nothing is shared or crawlable.
- **NFR-4 Cost discipline** — AI usage is capped per user; the Companion's context window usage is bounded per request.
- **NFR-5 Language parity** — every string exists in both 中文 and English; adding a string without both is a bug.
- **NFR-6 Demo reliability** — the deployed URL loads and works without local setup, sign-up walls (Phase 1), or warm-up delays that would embarrass a live demo.
- **NFR-7 Sharing boundary** — Public Study Plans expose structure only; a user's Materials, Annotations, and Mastery Scores are never visible to other users through the Square or any sharing surface. The system provides plans, never content — including other people's content.
- **NFR-8 Recall before re-read** *(confirmed by owner, 2026-11-01)* — study surfaces ask before they tell: quiz and flashcard flows require an attempted recall before any answer is revealed; reading sessions close with a recall prompt (Quick Test or node question). Spaced repetition serves this: Re-queue items (FR-24) resurface due recall, and readiness requires freshness — a stale Mastery Score does not certify 100% (decay rule is OQ-9).

## 6. MVP Scope

### 6.1 In Scope — Phase 1 (by Nov 6, 2026)

FR-1, FR-2, FR-3, FR-8, FR-9, FR-10, FR-11, FR-12, FR-18, FR-19, FR-25, FR-29, FR-32, FR-33, FR-35, FR-36, FR-37 (entry states, Study Task path, reader + Companion, quiz with the two question shapes, working Mastery Score, embedded study aids, persistence, bilingual, server-side AI, deployment). Stretch candidates if the core lands early: FR-13, FR-14, FR-15 (selection shortcuts, Quick Test, Mastery Marking).

### 6.2 Out of Scope for MVP (Phase 1) — delivered in Phase 2

Accounts, plan privacy and sync (FR-4, FR-30, FR-31); Roadmap graph rendering and node states (FR-5, FR-6, FR-7; FR-5's form factor revised + FR-47 added 2026-11-11, epic-28); roadmap.sh import, node-pinned attachment, material–node mapping (FR-43, FR-44, FR-45); Square and plan visibility (FR-38, FR-39); Notes with enrichment (FR-40); PPT upload (owner Q6 — first candidate when Phase 2 opens); adaptive targeting (FR-21); plan-level Companion grounding (FR-46); in-reader Quick Test and Annotations/Study Focus beyond stretch (FR-13–17); Mistakes Notebook and Re-queue (FR-23, FR-24); full per-plan analytics, Today, real badge unlocks (FR-26, FR-27, FR-28); Flashcards Hub and Quiz Hub (FR-41, FR-42); cost cap (FR-34); Study Task → Plan promotion (FR-37 stretch half). Reason: the owner-confirmed Nov 6 slice protects the front door (entry states → plan or task → study) plus the flagship reader demo; the hubs, Square, Notes, and import need the fuller data model and accounts. **Scaffold retention (owner round 2026-11-01):** the scaffold's ten pages are formally retained as the Phase 1 demo app — Dashboard, AI Tutor, Materials, Quiz, Flashcards, Mistakes, Planner, Achievements, Analytics on demo data, plus the sidebar profile footer + Settings — while the plan-first surfaces (FR-1/FR-36) layer on as they land; the earlier "placeholder if needed" framing is superseded by this retention.

### 6.3 Explicit Non-Goals (v1, both phases)

Hosted learning content of any kind — no content library, no course marketplace, no AI mini-course generation: the system provides plans and assessment, the user provides materials (owner decision). User-authored quiz questions from arbitrary content (quiz generation is strictly materials-sourced). Question types beyond Open and Choice (with Mix Mode). Collaborative studying — shared sessions, comments, co-editing (plan *sharing* via the Square is in). Instructor courses; instructor approval flows; native mobile apps; UI languages beyond 中文/English; dual-mode (AI vs. manual) anything — removed by owner decision; classroom/roster features.

## 7. Success Metrics

**Primary**
- **SM-1** *(validates FR-1, FR-2, FR-5)*: A fresh user goes open → plan created → materials attached → studying, in under five minutes without instruction; the front door is the plan, not a tool menu.
- **SM-2** *(validates FR-10, FR-11)*: In a live demo, three consecutive Companion answers are each visibly grounded in the open page — each cites its source location.
- **SM-3** *(validates FR-3, FR-18, FR-20)*: Quiz results move Mastery Scores node-by-node; a node with no evidence reads as uncovered, not accidentally green; the plan rollup always equals the aggregation of node states.
- **SM-4** *(validates FR-3, readiness promise)*: The author reaches 100% on at least one real plan before an actual exam/interview and reports the number matched their felt readiness `[ASSUMPTION: author-rated]`.
- **SM-5** *(course gate)*: The Nov 6 demo happens at the public URL and supports the AI Fluency 4D presentation story.

**Secondary**
- **SM-6** *(validates FR-21, FR-22)*: After a week of use, generated questions visibly target the author's weakest nodes (author-rated), and Study Notes for a weak node were judged worth re-reading.
- **SM-7** *(validates FR-17, FR-16)*: After a week of annotating, a Study Focus exists that the author judges to cover the core of their own highlights (author-rated).

**Counter-metrics (do not optimize)**
- **SM-C1** *(counterbalances SM-2)*: Direct-answer share of Companion responses. Hint-first is the stance (NFR-2); if direct answers dominate, the guardrail is failing even when answers look good.
- **SM-C2** *(counterbalances SM-3/SM-4)*: Mastery Score inflation. A 100% that survives a real exam is the goal; if scores climb while quiz difficulty stays flat or questions repeat, the number is lying. Do not ease grading to move the score.
- **SM-C3** *(counterbalances all)*: Time-in-app. Synapse serves study efficiency, not engagement; more minutes is not success.

## 8. Open Questions

1. **OQ-1** — Study Focus display: where and how it appears in the Immersive Reader (owner: "think this through when we implement it") → `/bmad-ux`.
2. **OQ-2** — Roadmap renderer: graph library vs. custom SVG for the roadmap.sh-style graph → `/bmad-architecture`.
3. **OQ-3** — Backend stack (managed BaaS vs. custom service) → `/bmad-architecture`.
4. **OQ-4** — AI provider: must be terms-verified before launch → `/bmad-architecture`.
5. **OQ-5** — PDF parsing and page-text extraction approach (client-side vs. server-side) → `/bmad-architecture`.
6. **OQ-6** — Re-queue algorithm and intervals → implementation spec.
7. **OQ-7 — RESOLVED** *(owner, Q3(c), 2026-11-01)*: Mastery Marking never raises the score; it marks the claim (green) and invites a confirm quiz — only quiz evidence moves the Mastery Score (FR-15).
8. **OQ-8 — RESOLVED** *(owner, Q4, 2026-11-01)*: Phase 1 plan creation is AI-generated from a topic/goal; roadmap.sh open-source roadmaps import as ready-made plans in Phase 2 (FR-43).
9. **OQ-9 — RESOLVED** *(spec time, 2026-11-02)*: windowed mean of the last 5 evidence outcomes (correct 1 / partial 0.5 / wrong-or-forfeit 0), **score capped at 99 until the node holds ≥3 evidence records** (so plan rollup 100% implies every node mastered); mastered = ≥80% **and** ≥3 evidence records; rollup = mean of node scores with uncovered nodes at 0; no time-based decay in Phase 1 (the window ages evidence; Phase-2 freshness layers on). Recorded in [ADR-0001](../../adr/0001-mastery-computation.md) (amended same day after a TDD-caught invariant breach); placement per architecture AD-6.
10. **OQ-10** — Open Question grading: how the Companion grades Open Questions (rubric visibility, partial credit, appeal) → `/bmad-ux`.
11. **OQ-11** — Note enrichment sourcing: AI-generated charts vs. curated/stock images vs. none; placement policy and cost → `/bmad-architecture` + `/bmad-ux`.
12. **OQ-12 — RESOLVED product-side** *(owner default accepted, Q7, 2026-11-01)*: adoption = **fork** into the adopter's own plan, original author attributed; residual discovery UX (listing order) stays with `/bmad-ux`.

## 9. Assumptions Index

*Resolved by owner decisions on 2026-11-01 (logged in `.memlog.md`): Nov 6 slice confirmed (incl. Study Task in Phase 1), plan origin, mastery-marking role, Square sharing scope + fork semantics, NFR-8. Remaining live assumptions:*

- §4.2 FR-13/FR-14, FR-15 — selection shortcuts, Quick Test, and Mastery Marking are Phase 2 with a Phase 1 stretch option (slice-confirmed framing).
- §6.2 — the scaffold's existing Mistakes/Planner/Flashcards/Quiz pages may stand in as light Phase 1 demo placeholders.
- §1 — Markdown support is cheap enough for Phase 1 ("it usually is").
- §7 SM-4 — the 100% readiness check is author-rated against a real exam/interview.
- Guardrail behavioral details (what counts as a hint vs. an answer) are deferred to `/bmad-ux`, not assumed here.
