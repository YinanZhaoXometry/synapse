# Spec: Epic 2 — Study Plans, the front door (FR-1 · FR-2 · FR-25)

Status: done
Milestone: Phase 1 — Nov 6 core

> Grill round closed 2026-11-02 — owner answered all 8 frontier questions 「全部按推荐」.
> UI question answered by prototype (branch `prototype/epic-2-plans-ui`): **Variant A
> (spine baseline) is the binding UI reference**; Variant B (chat-as-whole-door) and
> Variant C (editorial timeline) are recorded alternatives.

## Problem Statement

The plan-first product has no front door. Opening the app today lands on the scaffold's demo dashboard; a learner cannot create a Study Plan, cannot attach their own Materials to one, and cannot see an honest Mastery Score anywhere. The three seams epic 1 shipped (domain, data, ai) have zero UI consumers, so the product's core promise — "the system gives the plan, you attach the materials, mastery is earned" — is invisible.

## Solution

Build the plan-first entry chain: onboarding happens once, then every visit lands on **Plans Home** — an agent-style creation chat for a fresh learner, a continue-here + plan list for a returning one. Stating a topic (plus an optional goal) streams a staged Knowledge Node structure from the Companion; the learner renames nodes inline, regenerates if the draft misses, and confirms into a real persisted Study Plan. The **Plan Home (light)** shows the honest mastery rollup, stage-grouped nodes with their evidence basis, attached Materials, a streak that counts evidence days, and quick actions that are disabled with reasons until their slices land. Uploading a Material registers it against the plan (PDF/Markdown ≤ 20 MB) with an honest "parse pending" state — parsing belongs to the Reader epic.

## User Stories

1. As a fresh learner, I want the empty Plans Home to greet me with a creation chat, so that making my first plan is the app's very first interaction.
2. As a fresh learner, I want to state a topic (and optionally a goal) in one message, so that I get a full staged plan draft in seconds (SM-1: under five minutes to studying).
3. As a learner, I want the plan draft to stream in like a conversation, so that waiting feels alive rather than like a form submission.
4. As a learner, I want to rename any proposed node inline before committing, so the structure uses my course's vocabulary.
5. As a learner, I want a regenerate action that re-proposes a structure, so a bad draft is never a dead end.
6. As a learner, I want confirming to create a real persisted plan and land me on its Plan Home with "attach a material" as the primary next step, so the study loop starts immediately.
7. As a returning learner, I want a continue prompt for my most recent plan, so I re-enter my studies with one click (FR-1).
8. As a returning learner, I want a plan list where each plan shows its mastery rollup, so I can pick where to study at a glance.
9. As a learner, I want to create a new plan later from a create-new action, so the empty state's chat is also reachable when plans already exist.
10. As a learner, I want my completion of onboarding remembered, so I never see the wizard twice.
11. As a learner, I want the sidebar's 学习计划 entry to take me to Plans Home, so the front door is where the label says it is.
12. As a learner, I want to attach a PDF or Markdown file to a plan, so plan features can draw on my own materials (FR-2).
13. As a learner, I want non-PDF/Markdown uploads rejected with a clear bilingual reason, so I know what is supported today (PPT arrives Phase 2).
14. As a learner, I want files over 20 MB rejected with a bilingual message, so failures are explainable (exactly 20 MB uploads — PRD FR-2 reads the cap as inclusive).
15. As a learner, I want an attached Material to show an honest "parse pending" state, so I am never told content is ready when it is not.
16. As a learner, after a reload I want the Material's metadata to persist while the app tells me the file needs re-uploading, so session-only blobs never look like data loss.
17. As a learner, I want the plan rollup to count uncovered nodes as 0 and reach 100% only when every node is mastered, so "ready" means ready (ADR-0001).
18. As a learner, I want each node to show its state (uncovered / partial / mastered) with a glyph and label — never color alone — and let me inspect the evidence behind it, so the number has a basis I can trust.
19. As a learner, I want my streak to count consecutive days with ≥1 evidence-producing session, so the number means effort that produced evidence (FR-25).
20. As a learner, I want quiz/flashcard/companion actions visible but disabled with a reason, so I can see where the product is going without being promised a dead click.
21. As a bilingual learner, I want every one of these surfaces in 中文 and English with parity, so the product never breaks my language (NFR-5).

## Implementation Decisions

- **Entry & routing (AD-8; Q6):** `/` becomes a guard — if onboarding is complete, redirect to Plans Home; otherwise render the existing onboarding wizard. Completing onboarding persists the completion flag (the repository function already exists, currently unwired) and the final CTA re-points to Plans Home. New routes: Plans Home, plan creation, and Plan Home — quiz/flashcard sub-routes stay out (slice 6). Entry logic sits behind a pure decision function (destination from onboarding-complete; plan existence is Plans Home's internal composition state, not a routing input), which is what gets tested.
- **Nav re-point (Q2):** the 学习计划 sidebar entry points at Plans Home. The old Planner demo route remains reachable by URL but leaves the nav (its Today/Calendar successor is FR-27, Phase 2). The full FR-36 plan-first nav reorder is slice 7, not this epic.
- **Creation chat (FR-1; Q4):** the draft comes from the Companion's plan-structure generation as shipped (simulated, deterministic, zh/en, streamed). Input = required topic + optional free-text goal (Phase-2 goal chips stay out). The streamed markdown-ish lines resolve into a stage-grouped structure card. Phase-1 editing is inline node rename only (add/remove arrives with FR-45, Phase 2). Confirm maps the proposal — with renames and the optional goal — into the plan repository's create input; the mapping is a pure function and is tested. Regenerate re-runs generation from the same topic/goal.
- **Plans Home composition (Q3/Q5):** empty state = the creation chat as the primary surface (with the Study Task secondary path deferred to slice 5 — no task section this epic). Returning state = a continue hero for the most recent plan (rollup + recency; the "last reading position" line is deferred until the Reader slice can supply one) + plan cards with honest rollup chips and a node-state mini bar + a create-new action leading to the creation route. **No seeded demo data** — the empty state itself is the demo (SM-1).
- **Plan Home light (FR-25; Q7):** header carries topic/goal, the streak chip, and the mastery ring with the honesty footnote. The node list groups by stage; each row shows state glyph + tint + label (never color alone), its score when evidence exists, and an evidence popover (last-5 outcome marks + the rule text). Materials section lists attached materials read-only with parse-pending chips and the session-only re-upload note. Recent activity is a real-query shell (honest empty until slice 6 produces sessions). Quick actions render as the four-tile grid, disabled with reasons — "attach a material first" gates generation actions; slice gating shows for quiz/flashcards/companion. The scaffold quiz page's hardcoded mastery deltas are NOT touched here (slice 6 owns that AD-6 migration); the Dashboard stays on demo data (re-points later).
- **Material attach (FR-2; Q1):** an upload dropzone on Plan Home accepts PDF and Markdown up to 20 MB and rejects anything else with a bilingual reason. Acceptance/size checks are pure validators (tested). A valid file registers metadata + parse state "pending" and holds the file bytes in the session-blob registry — **no parsing happens in this epic**; `parse(file)` is the Reader's public API (AD-7, slice 3). After a reload, metadata persists while the UI asks for the file again (FR-29 owner-relaxed, already the shipped session-blob contract).
- **Mastery display contract (ADR-0001; AD-6):** all numbers come from the shipped pure domain functions; uncovered = 0 in rollups; mastered needs the evidence gate. Presentation adds no arithmetic — only shaping for display.
- **i18n (NFR-5):** every new user-facing string goes through the language context's translation table in both zh and en — including rejection reasons, disabled reasons, and the honesty footnotes.
- **Prototype provenance:** the binding Variant A composition (hero + cards, two-zone Plan Home, structure card, dropzone placement) and the evidence popover/outcome-mark presentation were validated in the prototype; the throwaway branch remains the primary source for details.

## Testing Decisions

Good tests here assert external behavior at the highest existing seam — the same posture as epic 1: domain functions directly, repositories against a real localStorage-backed store in jsdom, the CompanionService through its interface with fixtures. No DOM/rendering tests (Q8). Four logic seams carry this epic:

1. **Entry-state decision** — pure function from onboarding-complete to destination; covers first-run, returning, and post-completion cases.
2. **Proposal → create-input mapping** — pure function from a plan-structure proposal (+ renames + optional goal) to the repository create input; covers rename application, stage grouping, goal passthrough, and empty-proposal rejection.
3. **Upload validators** — pure accept/reject/size logic; covers PDF/Markdown acceptance, wrong-type rejection with the right message key, and the 20 MB boundary.
4. **Display shaping** — evidence → presentation inputs (rollup for a hero chip, node-state mini-bar counts, recent-activity shaping from session/evidence queries); thin composition over real domain functions, tested where the composition adds logic (e.g. "most recent plan" selection).

Prior art: the epic-1 domain and repository vitest suites and the CompanionService fixture tests.

## Out of Scope

- Parsing any Material (Reader epic, slice 3 — the very next slice), reading positions, continue-reading links.
- Study Tasks: creation, task home, and the Plans-Home task section (slice 5).
- Quiz, flashcard, and Companion live wiring (slices 4 and 6); the quiz page's hardcoded mastery migration (slice 6).
- Full FR-36 plan-first nav reorder, Settings reset clearing the store, deploy config (slice 7).
- Goal-selection chips (Phase 2), roadmap.sh import and node-pinned attachment / material–node mapping (FR-43/44/45, Phase 2), Dashboard re-pointing at plan evidence, Square/Notes (Phase 2), live AI (FR-33).

## Further Notes

- Prototype branch: `prototype/epic-2-plans-ui` (`6d2877c`) — mount the winners during implementation, then drop the prototype gate from main per the capture convention.
- The owner reviewed Variant C last in the browser but approved recommendations wholesale; the recommendations resolve to the spine-faithful composition (Variant A). B and C stay on the branch as proven alternatives if a surface wants to steal from them later.
- DoD: FR-1/2/25 acceptance + gates green (`tsc -b`, lint, vitest) + grandfathered scaffold surfaces untouched + every ticket cites its AD ids.
- **As-built amendments (2026-11-02 code-review round):** the entry seam ships as onboarding-complete → destination (plan existence is Plans Home's render state, per Q6's original decision — the "+ plan existence" phrasing above was a transcription artifact, now corrected); the 20 MB cap is ruled INCLUSIVE per PRD FR-2 (≤ 20 MB uploads, > 20 MB rejected) — validator and tests updated accordingly.
