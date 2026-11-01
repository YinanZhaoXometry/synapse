---
title: Synapse — Product Brief
status: approved
created: 2026-11-01
updated: 2026-11-01
approved: 2026-11-01
---

# Product Brief: Synapse

> **Name:** **Synapse** — in Chinese contexts too: the brand stays "Synapse" in both languages, no translated Chinese name (owner decision, 2026-11-01). Origin and rationale are recorded in the [addendum](addendum.md).
> **Status:** approved by the owner on 2026-11-01 — all owner-blocked decisions resolved (see the memlog's final entries); UX/architecture-stage questions remain with those stages. Supersedes the archived "Adaptive Learning Platform" brief (`../project-new-archive-20261101/_bmad-output/…/brief-adaptive-learning/`); two of its concepts (spaced repetition, skill-tree roadmap) are re-admitted here in evolved form.
> **Revision 2026-11-01 (owner decision):** the platform is **AI-guided only**. The former dual-mode (AI vs. manual) comparison concept is removed — "otherwise there is no reason for it to exist." New flagship feature: the **AI companion reader**.
> **Consumers:** future development sessions (human + agent), per `docs/product/README.md`: read this brief before `/grill-with-docs`, `/to-spec`, or `/to-tickets` on a new feature. Secondary audience: COMP5241 lecturer/class. Requirements detail (FRs, UJs, NFRs, metrics) now lives in the [PRD](../prd-synapse/prd-synapse.md) — this brief stays the source of truth for vision, problem, positioning, and scope boundary.

## Executive Summary

**Synapse** is a bilingual (中文/English), AI-guided study platform for university students, built around one flagship experience: the **AI companion reader**. Upload a course PDF or slide deck and it opens in a reader with a chat beside it — and the AI knows which page you are on and what content is in front of you, so its answers are grounded in exactly what you are reading and tailored to your learning, not generic chatbot output.

Around the reader sits the rest of the study loop, all fed by the same materials and the same AI: quizzes and flashcards generated from your content, a mistakes notebook whose items resurface on a spaced schedule, a per-subject topic roadmap that unlocks as you prove mastery, a planner, and analytics. The point is that the AI is not one more window competing for the student's attention — it is woven through every step, and it knows the student's materials, page, mistakes, and progress.

The AI teaches with guardrails: it guides with hints and questions before it hands over answers. That posture is deliberate — field-experimental evidence shows unguarded AI practice can measurably harm exam performance while guardrailed tutoring avoids the harm (Bastani et al., PNAS 2025). An AI-guided platform must be designed against that failure mode, not just equipped with a model.

Built as the COMP5241 course project, with a real backend (accounts, sync, server-side AI; stack chosen at the architecture stage).

## The Problem

University students studying for exams face three compounding pains:

1. **AI is context-blind.** Students already use ChatGPT-class tools constantly, but a generic chatbot does not know which page of which lecture PDF they are stuck on, what the course covered last week, which questions they got wrong, or when the exam is. Students pay a context tax on every question — re-explaining, pasting, restating — and still receive answers tailored to no one.
2. **Fragmented study tooling.** The PDF lives in one app, notes in another, flashcards in a third, the timetable in a fourth. Effort goes into juggling tools instead of learning; progress is invisible across them.
3. **Nobody schedules forgetting.** Re-reading is the default review strategy; spaced repetition and mistake-driven review demonstrably work but require discipline and tooling most students don't have.

The cost of the status quo: hours lost to context-reassembly and tool-juggling, and study help that is generic precisely where it should be personal.

## The Solution

A single AI-guided workspace (AI-first positioning, owner decision 2026-11-01):

- **Study Plan first — the app's front door (owner: the biggest highlight).** Open the app and the first thing you see depends on where you are: **no plans yet** → an agent-style chat surface inviting you to create your first Study Plan; **plans exist** → a "continue where you left off" prompt into the plan's detail page, plus a create-new path. Learning proceeds along the plan. Critically, **the system provides the plan, never the learning content**: the user finds their own materials and attaches them to the plan as its context — one plan, multiple files (plan-wide, or pinned to a single node). Plans are AI-generated from a topic/goal; open-source roadmap.sh roadmaps import directly as ready-made plans for engineer-growth topics.
- **Study Task — independent, plan-free study.** Some learning is ad-hoc: one PDF you simply want to master, tied to no plan. A Study Task is that standalone unit: upload one document (PDF/Markdown), get the identical learning machinery — Immersive Reader, Companion, quizzes, mastery — without a plan around it. Same capabilities, split out.
- **The Square (广场) — discover shared plans.** A Study Plan is created as **Public** or **Private**. Public plans appear in the Square, where users discover plans others have shared — and attach their *own* materials to them (structure shared, content never; adoption forks the plan with the original author credited — owner, 2026-11-01).
- **Notes — AI-authored study documents.** From the plan's materials, the Companion produces an independent Markdown Note; by default it enriches the note with AI-selected images and charts at points where visuals aid understanding, and the user can request image annotations at chosen places.
- **Mastery Score — quantified readiness.** From quiz evidence against the plan's knowledge nodes, the platform computes a mastery percentage per node and per plan. Until it reads 100%, you know what's left; at 100%, you have the confidence to walk into the exam or interview. Assessment of "do I actually know this yet?" is the product's core promise, not a side statistic.
- **Immersive reader (flagship).** Open an attached material and read it in-app, with a chat panel beside it. The AI knows the current page and its content — ask "explain this," "why is this true," "test me on this page" — and get answers grounded in the exact material in view, tailored to the learner. No context tax. The Companion also lives beyond the reader: at the plan level and in the empty-state chat, grounded in all attached materials — including "analyze my mistake" explanations from the Mistakes Notebook.
- **Customization loop (the AI-era learning advantage).** Based on the learner's demonstrated mastery, the AI targets weak areas with custom-generated questions and custom study notes; the learner's performance feeds back, and the next round adapts. Deep enough, diverse enough, personal — what traditional study cannot do.
- **Quizzes and flashcards: generation in-flow, aggregation in the sidebar.** They are generated vertically within a single learning topic, from the plan's attached materials only, and *launched* inside the study flow. The top-level sidebar carries the aggregated cross-plan views of study output: **Mistakes Notebook** (all past mistakes, grouped by Study Plan), **Today / 今日学习** (each day's tasks: AI-suggested weak-spot tasks, due reviews, manual tasks), **Flashcards Hub**, and **Quiz Hub**. The product's purpose is mastery of a topic; the sidebar shows your study record, not a toolbox.
- **Annotate and mark mastery.** Highlight with colors and underline while reading; mark the parts you have already mastered — their background turns green, unmarked material stays plain — so one glance shows what remains. Marking is a claim, not evidence: it invites a confirm quiz, and only quiz results move the Mastery Score (owner, 2026-11-01).
- **Instant feedback on any selection.** Hit something you don't quite understand and one-click shortcuts turn it into action: ask the companion, or get a quick test on it, without leaving the page.
- **Annotation-driven study focus.** The AI reads your highlights and underlines to generate the core things to study for this material; where and how that surfaces is a deliberate design decision, deferred to the UX stage.
- **Structure over fragments.** Design principle: optimize for structural knowledge of a domain, not piece-by-piece detail recall — details are retrievable (internet, AI); structure is what you must own. The Study Plan is that structure, visualized as the roadmap and tracked by mastery states.
- **Recall and repetition, woven in** *(confirmed 2026-11-01)*. Active recall: every study surface asks before it tells — quiz and flashcard flows require an attempt before any reveal; Quick Tests close each reading session. Spaced repetition: due reviews (Re-queue) surface on the plan home, and readiness decays — a stale Mastery Score does not certify 100% (exact decay rule to the spec).
- **Guardrailed tutoring.** The AI guides — hints, questions, step-by-step scaffolding — before it answers. Design posture, not a feature flag.
- **Real accounts and sync.** Email + Google OAuth sign-in, per-user persistent data behind a full backend (stack chosen at the architecture stage). AI calls run server-side only.
- **Honesty constraints** (product rules, not implementation details): the AI provider must be terms-verified before launch; per-user cost is capped; the platform never presents generated content as course authority.
- **Bilingual from the ground up** (中文/English).

## What Makes This Different

- **Plan, not content.** The system tells you *what* to master and *how well* you've mastered it; it never pretends to be the content source. The user brings their materials; the AI custom-generates the study experience around them. An honest division of labor in the AI era.
- **Quantified readiness.** A mastery percentage per topic, driven by evidence — "you are 100% ready" is a checkable state, not a feeling. Aimed at the moment that matters: the exam, the interview.
- **Page-level context.** Generic chatbots answer anyone's question about anything; this AI answers *this* student's question about *this* page of *their* course material.
- **Instant feedback loop.** Confusion becomes action in one click — ask, or get tested, right where you're reading.
- **Structure-first stance.** An explicit learning philosophy built into the product: the Study Plan renders the domain's structure, mastery tracks it, and detail memorization is left to search and AI.
- **Adaptive by construction.** Generation targets the learner's demonstrated weak spots; every answer feeds the next round. Whole-loop integration — the reading companion, the quiz generator, and the review scheduler are one continuous intelligence, not three tools.
- **Guardrailed by design.** Hint-first tutoring follows the research rather than repeating its failure mode.
- **Bilingual** (中文/English), matching how PolyU students actually study.
- **Honest about the moat:** there is no technical moat — the differentiators are context integration, restraint (guardrails), and execution speed in a course context. Dev-reference-first purpose (owner-accepted default).

## Who This Serves

**Primary user:** university students studying university courses, who want better study performance, stronger exam results, and to actually learn the material — not just pass. Bilingual; studies across several subjects at once; already uses AI but pays the context tax every session. The author is the first user.

**Secondary audience:** classmates and the COMP5241 lecturer, who see the product as a demo and the guardrailed-AI design as course evidence (AI Fluency 4D: Delegation, Description, Discernment, Diligence).

## Success Criteria

Owner-accepted (2026-11-01); phasing below reflects the real deadline:

1. The app runs end-to-end: upload → read with the companion → quiz → mistakes → review, with persistent data.
2. The page-aware companion chat demos live and lands — the flagship moment.
3. It supports the AI Fluency 4D presentation story.
4. The author uses it for their own study — dogfooding is the standing quality bar.

## Timeline & Feasibility

**Course deadline: November 6, 2026** (owner-confirmed) — five days after this brief was drafted. The full scope cannot be built in that window. Phasing (owner-confirmed, 2026-11-01):

- **By Nov 6 (demo slice — owner-confirmed 2026-11-01):** plan entry with the two states (empty → create prompt; existing → continue + new; the agent-style chat empty state may simplify to a clean prompt for the demo), the standalone **Study Task** path, PDF upload + in-app reader + the page-aware side chat, basic quiz (open + choice questions) generated from the uploaded material, a working Mastery Score from quiz results, minimal persistence, deployed at a public URL. Annotation, mastery marking, and shortcuts are stretch candidates. No accounts/sync, no SRS scheduling, no Square, no Notes, no roadmap *graph* rendering, Markdown support if it is cheap (it usually is).
- **After Nov 6:** accounts (email + Google OAuth) and sync on a full backend; **roadmap.sh roadmap import as ready-made Study Plans** and PPT upload (first in line); the Square with Public/Private plans; Notes with AI-inserted images/charts; node-pinned material attachment and material–node mapping; adaptive weak-spot targeting; SRS scheduling and the mistakes re-queue (with readiness freshness); the roadmap.sh-style graph rendering of Study Plans; annotation layer + mastery marking + instant-feedback shortcuts (if not pulled into the stretch); deeper analytics; terms-verified provider hardening.
- **Scaffold note:** the exported scaffold's `LearningModeContext` (`mode: "ai" | "non-ai"`) and its `aiOnly` nav gating are legacy from the abandoned dual-mode concept — retire them during the first implementation pass. Same pass restructures the top-level navigation: quiz and flashcards stop being primary destinations (owner: they are in-study aids, not menu items).

## Scope

**In (v1):** *(phased — see Timeline & Feasibility; the Nov 6 slice is a subset of this list)*

- **Study Plans as the app's front door**: entry states (empty → create prompt; existing → continue + new); multiple materials attach to one plan as its context; the system provides the plan, never the content.
- **Study Tasks**: plan-free standalone study of a single document with the identical machinery.
- **Plan visibility and the Square**: Public/Private plans; the Square (广场) surfaces public plans for discovery — structure shared, materials never.
- **Notes**: AI-generated Markdown study documents from the plan's materials, with AI-selected image/chart enrichment by default.
- **Mastery Score**: evidence-based mastery percentage per knowledge node and per plan; 100% = readiness state for exam/interview.
- **Immersive reader**: in-app PDF and Markdown reading, page-aware chat panel, color highlights and underlines, mastery marking (mastered sections turn green), instant-feedback shortcuts (ask companion / quick test).
- **Quizzes and flashcards as embedded study aids** — not top-level navigation: generated from the plan's attached materials only; quiz questions are open questions and choice questions (single- or multi-select) plus a mixed mode, per the owner's constraint; custom question authoring from arbitrary content is not offered.
- **Adaptive generation**: questions and study notes target the learner's demonstrated weak spots; performance feeds back into the next round.
- Spaced-repetition scheduling: flashcards + mistakes-driven re-quiz queue (algorithm and intervals deferred to the spec); four aggregated sidebar surfaces: Mistakes Notebook, Today (今日学习), Flashcards Hub, Quiz Hub.
- The Study Plan rendered as an interactive node graph (roadmap.sh-style), with Mastery Score states and click-through into the reader.
- Accounts (email + Google OAuth), per-user sync, server-side AI under the honesty constraints.
- Public deployment: static host + managed cloud DB, shareable URL.

**Explicitly out (v1):** instructor courses, instructor approval flows, collaborative studying (shared sessions, comments, co-editing — plan *sharing* via the Square is in), hosted learning content of any kind, native mobile apps, UI languages beyond 中文/English, the dual-mode concept (removed by owner decision). The system gives plans and assessment; the user brings the content.

**Deliberately undecided:** every other old-platform concept beyond the two re-admitted above — the owner has deferred these ("shall wait to be decided").

## Vision

If it works, the platform becomes the companion that knows your course life — every plan you've run, every page you have read, every mistake you made — and tells you the truth about your readiness: today, "this topic: 62%, these three nodes left"; before the exam, "100% — go." Grounded: it is a course project first; the architecture keeps the larger shape open, not promised.

## Open Decisions

| Decision | Where it lands |
|---|---|
| ~~Final course deadline~~ | **Resolved: November 6, 2026** (owner) |
| ~~Dual-mode / comparison concept~~ | **Resolved: removed** — AI-guided only (owner, 2026-11-01) |
| Backend stack (managed BaaS vs. custom service) | `/bmad-architecture` stage — owner deferred |
| AI provider (must be terms-verified) | `/bmad-architecture` stage — owner deferred |
| Companion-reader mechanics (PDF/Markdown parsing, page tracking, grounding/citations) | `/bmad-ux` + `/bmad-architecture` stages |
| Annotation-driven study focus — where and how it displays in the reader | `/bmad-ux` stage — owner: "think this through when we implement it" |
| Roadmap renderer implementation (library/engine for the roadmap.sh-style graph) | `/bmad-architecture` stage |
| ~~Study Plan origin~~ | **Resolved (owner, 2026-11-01):** AI-generated from topic/goal (Phase 1); roadmap.sh open-source roadmaps import as ready-made plans (Phase 2) |
| Mastery Score computation (what evidence, what weighting, what decay/freshness rule for readiness) | `/bmad-ux` + `/bmad-architecture` stages |
| ~~Square sharing scope & adoption~~ | **Resolved (owner, 2026-11-01):** structure-only sharing; adoption = fork with attribution; discovery UX (listing/ranking) → `/bmad-ux` |
| Note visual enrichment: AI image/chart sourcing and placement (generated vs. stock vs. none) | `/bmad-ux` + `/bmad-architecture` stages |
| ~~Recall/repetition integration~~ | **Resolved (owner, 2026-11-01):** ask-before-tell, session-closing recall, Re-queue surfacing, freshness-gated readiness (PRD NFR-8) |
| ~~Product name~~ | **Resolved: Synapse** (both languages; no Chinese name) — owner, 2026-11-01; origin & rationale in [addendum](addendum.md) |
| ~~Nov 6 demo slice cut~~ | **Resolved (owner, 2026-11-01):** entry states + Study Task + reader + Companion + quiz + working Mastery Score + persistence + deployment; shortcuts/Quick Test/mastery marking = stretch |
| ~~PPT support~~ | **Resolved (owner default, 2026-11-01):** out of v1 core; Phase 2, first in line |
| All deferred old-platform features | Unsettle — re-decide per feature, not in bulk |
