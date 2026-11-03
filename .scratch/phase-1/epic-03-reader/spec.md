# Spec — Epic 3: Immersive Reader + page-aware Companion (FR-8..FR-12)

Status: ready-for-agent
Milestone: Phase 1 — Nov 6 core
Grill: round closed 2026-11-03; all recommendations adopted (standing delegation — logged below in Further Notes).

## Problem Statement

A learner attaches study materials to a plan and gets — a metadata row with a "pending-parse" chip. Nothing can be read in-app. Reading position is never captured, so returning means re-finding the page. And the Companion — the product's core AI tutor — has no surface beside the material and no Reading Position to ground on, even though the AI seam, the chat-thread persistence, and the entity types for all of this already exist. The front half of the learning loop (read → ask → test) is missing its "read" and "ask".

## Solution

The Immersive Reader at `/read/:materialId`: attached PDFs render page-by-page in-app; Markdown renders with its heading structure and stable, addressable sections. Attaching a file now parses it immediately (the reader's public `parse(file)` API), so extracted per-section text survives reloads even though file bytes are session-only. Reading position is tracked by what is actually visible and persisted per material; plan surfaces gain real continue-reading entries. The Companion sits beside the reading: answers ground on the current page/section, carry citation chips that jump the reader to the source, hint before they answer (with an explicit escalation to a direct answer), and say so honestly when the material can't answer. Conversations persist per material.

## User Stories

1. As a learner, I want an attached PDF to render page-by-page in the app, so that I can study my document without leaving Synapse (FR-8).
2. As a learner, I want an attached Markdown file rendered with its heading hierarchy, so that long notes stay navigable (FR-9).
3. As a learner, I want to see parsing progress after attaching a file, so that I know when the material is ready to study.
4. As a learner, I want a clear failure card with a retry when a file cannot be parsed, so that a broken upload never reads as lost data.
5. As a learner, I want to open a material from my plan's material list in one click, so that studying starts immediately.
6. As a learner, I want the material row to say "continue reading" when I have progress, so that resuming is obvious.
7. As a learner, I want my last reading position remembered per material, so that reopening puts me where I stopped (FR-10).
8. As a learner, I want the plans-home continue card to show where I last read, so that coming back feels like resuming, not restarting (FR-25; closes epic-2's deferral).
9. As a learner, I want ←/→ to step between PDF pages, so that paging through a document is comfortable.
10. As a learner, I want citation and continue links to land me on an exact page or section, so that deep links are precise (AD-8 anchors).
11. As a learner, I want a brief highlight flash when a link jumps me to a location, so that I can spot the referenced passage.
12. As a learner, I want the Companion beside my reading in a side panel, so that I can ask without losing my place (FR-11).
13. As a learner, I want answers grounded in the page/section I am viewing, so that answers match what is in front of me (FR-10→FR-11).
14. As a learner, I want each answer to carry citation chips of its source page/section, so that I can verify claims against the material (NFR-1).
15. As a learner, I want a citation chip to scroll the reader to its source and flash it, so that verification is one click.
16. As a learner, I want the Companion to hint, scaffold, and ask guiding questions before giving answers, so that I learn instead of copying (FR-12, NFR-2).
17. As a learner, I want an explicit "show the answer directly" escalation that always works, so that the guardrail is a ladder, never a wall (FR-12).
18. As a learner, I want a "quiz me on this page" starter, so that I can attempt recall before re-reading (NFR-8 spirit; chat-Socratic, not Quick Test).
19. As a learner, I want the Companion to say plainly when my question goes beyond the material, so that I am never misled about course authority (NFR-1).
20. As a learner, I want my conversation to persist per material across sessions, so that I can pick a thread back up.
21. As a learner, I want answers to stream in with citations appearing alongside their claims, so that long answers feel responsive (UX streaming state).
22. As a learner, I want a neutral toast and one-click retry when a Companion request fails — with my input preserved — so that failures never fake success (UX error state).
23. As a learner, I want the Companion honestly disabled for a material that failed to parse, so that it never chats against a document it cannot see (UX parse-failure state).
24. As a learner, I want extracted text to persist after a reload without the file bytes, so that Companion/quiz machinery keeps working on previously parsed materials (AD-4 relaxed contract).
25. As a learner, I want to re-upload a file after a reload, so that I can keep page-rendering even though bytes are session-only (FR-29 relaxed).
26. As a phone reader, I want full-bleed reading with the Companion as a bottom sheet, so that reading stays primary on small screens (UX responsive).
27. As a tablet reader, I want the Companion as a toggleable overlay, so that screen space negotiates fairly at medium widths.
28. As a learner in dark mode or another palette, I want the reader and Companion to hold in every theme, so that nothing becomes unreadable at night (DESIGN amendment).
29. As a Chinese- or English-speaking learner, I want every reader/Companion string in my language, so that the experience is coherent (NFR-5).
30. As a learner using reduced motion, I want streaming and highlight effects to respect it, so that the reader stays calm (accessibility floor).

## Implementation Decisions

- **Feature layout & public surfaces (AD-2).** New `features/reader` and `features/companion`. The reader's public surface: the `parse(file)` extraction API and the reader route; the companion's: the exported `CompanionPanel`. No cross-imports beyond these. `ReadingPosition` and `MaterialSection` remain the existing domain types consumed verbatim — no redefinition.
- **`parse(file)` API (AD-7).** Input: file bytes + kind. Output: `{ sections: MaterialSection[], state: "parsed" | "failed", reason? }`. PDF: pdfjs-dist 6.x, **dynamically imported only inside `features/reader`**; per-page text extraction yields sections with ids `page-N`, title from the page's first heading-like line (fallback "第 N 页 / Page N"), text bounded by the existing per-section cap (2000 chars). Markdown: a pure sectioner — split on headings, slugs generated with github-slugger (the same algorithm rehype-slug uses) so section ids match rendered anchors; duplicate headings dedupe (`-1`, `-2`); text bounded likewise.
- **Parse state machine.** `pending → parsing → parsed | failed`; `failed` carries a reason code (corrupt / encrypted / empty / unknown) mapped to bilingual i18n. Retry re-runs parse from the session blob (possible only while bytes exist — the existing re-upload contract otherwise).
- **Eager parse at attach.** The plans attach flow calls the reader's `parse()` immediately after `registerMaterial` (bytes exist only now — this is the only way extracted text survives a reload). Parse completion/failure writes back through a new material-repository mutation (e.g. `setMaterialParseResult(materialId, result)`); UI updates via the existing TanStack Query invalidation. No schema change: `sections`/`parseState` already exist in synapse-db:v1.
- **Reader route (AD-8).** `/read/:materialId`, lazy-loaded under AppLayout. Accepts position anchors — `?page=N` for PDF, `#section-id` for Markdown — plus `?hl=1` transient highlight. This anchor channel is the *only* cross-feature command channel into the reader and is reused internally by citation chips.
- **PDF rendering (FR-8).** Continuous vertical page flow; each page a canvas sized to fit-width; lazy render near the viewport via IntersectionObserver and release far pages; the most-visible page is the current one. `←`/`→` scroll to the previous/next page. No zoom control, no pdfjs text layer in Phase 1 (selection is stretch FR-13).
- **Markdown rendering (FR-9).** react-markdown 10 + rehype-slug 6; rendered in the reader typography role (`reader-body` 17px, measure 70ch per DESIGN); section ids come from the same sectioner as parse, so grounding text and rendered anchors agree. Sections are addressable via `#section-id`.
- **Reading Position tracking (FR-10).** PDF: most-visible page. Markdown: scroll-spy over section boundaries. The tracker emits `ReadingPosition { locator, text }` where `text` is the **bounded extracted section/page text from `Material.sections`** — never raw file bytes. Persisted debounced (page/section change + on unmount) through the existing ReadingProgress repository; restored on open (anchor params win over stored progress when present).
- **CompanionPanel (FR-11/12).** Chat surface on the scaffold pattern (bubbles, typing indicator, sticky input, Enter send / Shift+Enter newline, auto-scroll). Idle starters per the spine: 「解释这一页 / Explain this page」, 「考考我 / Quiz me」, plus one summarizer starter. Requests call the existing `getCompanionService().chat()` with the current `ReadingPosition` and the UI language.
- **Guardrail ladder (FR-12/NFR-2).** The structured reply contract (intent, rung, citations, canEscalate) is rendered, never guessed: direct answers labeled 答案/Answer; hint/worked-step rungs shown as such; `canEscalate` renders the quiet EscalationControl 「直接看答案 / Show answer directly」. Escalation sends a new request with a **backward-compatible optional `escalated?: boolean` added to `GroundedChatRequest`** (contract amendment); the simulated adapter honors it by skipping the hint rung.
- **CitationChip.** Renders the locator (第 N 页 / section title); click navigates the reader route to the AD-8 anchor for that locator with the highlight flag — same mechanism as external deep links, no full route change.
- **Streaming & states.** Token-streamed rendering; citation chips render alongside their claims mid-stream. Ungroundable questions get the honest-fallback bubble with the distinct general-knowledge offer. Request failure: neutral toast + one-click retry, input preserved.
- **Chat persistence (AD-3/4).** Messages append through the existing ChatThread repository (`ChatMessage.citations` stores locators); the thread restores on open. Plan-creation transcripts remain ephemerally out of scope (unchanged).
- **Disabled states.** While parsing: panel shows idle waiting copy. On parse failure: companion disabled with honest copy — never chats against a document it can't see.
- **Entry points.** Plan Home material rows gain an open/continue action (label reflects stored progress); Plans Home continue hero gains the "上次读到 …" line from the most recent ReadingProgress. Dashboard and the demo MaterialsPage untouched.
- **Presentation & theme (AD-9).** Reader top bar: back link, title, page pager (PDF), panel-collapse and immersive toggles per the mock. The PDF page container carries the app's one large shadow. Semantic tokens only (glass/accent-tint; citation tint for flash) — dark mode + sunset/twilight/aurora verified; reduced-motion respected.
- **Responsive.** ≥1024px: docked panel 400px (420px ≥1280px), collapsible to a rail. 768–1023px: Companion toggles as right overlay. <768px: full-bleed reading, Companion as bottom sheet (~65dvh, drag handle). Immersive toggle hides reader-level chrome (reader top bar + panel); the app sidebar is out of this epic's reach.
- **Bundling (AD-8).** The reader route is lazy; pdfjs-dist and react-markdown are dynamically imported inside `features/reader` only.

## Testing Decisions

Good tests assert external behavior at public seams — parse outputs, state transitions, persisted round-trips, tracker outputs, adapter replies — never canvas internals or component internals (jsdom cannot render canvases meaningfully, and the codebase's 16 existing test files are all pure-function / repository / integration; that precedent holds).

- **`parse(file)` seam:** a tiny committed fixture PDF (exercised via pdfjs-dist's legacy Node build for text extraction) and fixture Markdown (incl. CJK headings and duplicate-heading slug dedupe) → section ids/titles/bounds and failure reasons. Prior art: `upload-validation.test.ts` pure-function fixtures.
- **Parse state machine:** transitions incl. retry and failure reasons. Prior art: `entry-decision.test.ts`.
- **Tracker selectors:** most-visible-page from measured page rects; markdown scroll-spy boundaries — boundary cases (page half-visible, gap between sections). Prior art: `display-shaping.test.ts`.
- **Repository round-trips:** parse result write-back; ReadingProgress save/restore; ChatThread append/restore; reload simulation (sections/progress/thread survive; bytes gone; re-upload contract intact) against real localStorage. Prior art: `material-repository.test.ts`, `evidence-loop.integration.test.ts`.
- **AI seam extension:** simulated adapter — `escalated: true` yields the answer rung directly; grounding cites the supplied position; honest fallback unchanged. Prior art: `simulated/companion.test.ts`.
- **Integration walk:** attach → parse → open reader → position saved → grounded chat citing the position → reload simulation. Prior art: `evidence-loop.integration.test.ts`.

## Out of Scope

- Selection shortcuts, Quick Test, Mastery Marking (FR-13/14/15 — designed-but-stretch; pull-forward checkpoint after slice 6), Annotations/Study Focus (FR-16/17), all Phase-2 FRs.
- NFR-8 session-close recall prompt (its mechanism is Quick Test, Phase 2; no Phase-1 mount point specified).
- Plan-level Companion (FR-46), node click-through (FR-7), node-pinned attachment/mapping (FR-44/45).
- Study Task entry (slice 5), in-flow quiz/flashcard generation (slice 6).
- Server-side AI (FR-33\* superseded to Phase 2; AD-16 cutover), plan-scope grounding, reply-language server parameter.
- PDF text layer / text selection, zoom controls, TOC/outline panel, PPT upload, blob persistence (dead), MaterialsPage rewiring, AppLayout chrome changes beyond the reader surface.

## Further Notes

- **Grill adoptions (2026-11-03, standing delegation):** (1) slices 3+4 merged into one epic; (2) eager parse at attach — AD-7's "callable from plan/task upload flows" plus session-only bytes make attach-time the only moment extraction can capture text; (3) continuous vertical PDF page flow per the UX spine's visibility-based tracking; (4) MaterialsPage untouched (DoD grandfather rule); (5) optional `escalated?` added to `GroundedChatRequest`; (6) no stretch work in this epic.
- **Supersessions honored:** FR-33\* (simulated AI in Phase 1, server at cutover); FR-29 relaxed (metadata/text/progress persist; bytes session-only). SM-2 must be met by the simulated adapter.
- **Known doc drift (from planning reconnaissance):** the reader mockup's sidebar chrome is stale (spine wins); per-section text is the grounding input (bounded 2000 chars — do not feed raw rasters to the AI seam); ChatThread is Material-anchored only — no plan-level thread in this epic.
