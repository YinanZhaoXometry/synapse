# Demo script — Synapse graded walkthrough (local machine)

> Written 2026-11-06 for the presentation. Post-Phase-2 + epic-15: everything below is shipped and locally verified unless marked ⚠️. The honesty lines at the end are part of the demo, not caveats to hide — the course grades include AI Fluency 4D coverage (see the drafted speech, 2026-10-29).

## Boot (5 minutes, do it before the room fills)

```bash
just up          # postgres 17 + api on :3000 (health-checked by the recipe)
just dev         # web dev server on :8080 (HMR overlay is off — watch the terminal for errors)
```

- Login: **demo@synapse.test / demo-password** (seeded, idempotent — a fresh volume seeds itself; the demo plan + nodes exist out of the box).
- Terminal layout: keep `just dev`'s output visible — dev errors only appear there.
- AI: the provider key rides the gitignored `backend/.env` — the Rails process loads it itself, so bare `just up` carries it (deploy.md §1 recipe). **Concurrency ≈ 1 — pre-generate anything you cannot afford to wait on** (a queued AI call can take tens of seconds; don't let the demo stall on one).

## The walkthrough (≈10 minutes)

1. **Front door** (`/`): returning user → Plans Home. Open the demo plan — roadmap graph with node states (epic-10 SVG stage columns), Mastery Scores are server-computed (AD-14 — never touched by hand).
2. **Attach a material** (plan home): a `.md` / `.pdf` / `.pptx` all parse client-side (AD-7; PPT rides the markdown pipeline, epic-13 T5). Reader opens.
3. **The reader — the flagship stretch:**
   - Select text → the selection bar: Ask Companion / Quick Test (FR-13/14).
   - **Mastery Marking (FR-15, epic-15, landed last night):** hover a section heading → 标记已掌握 → the section start renders green — say the law out loud: *a claim is never evidence; only quiz results move the score.* The confirm-quiz launcher sits in the green state (needs a node mapping on the material to enable — confirm one mapping first, or demo the honest hidden state).
   - Annotations: multi-color highlight + underline (FR-16), Study Focus (FR-17).
   - Companion panel: grounded answers with citations (epic-12 plan grounding; threads persist).
4. **Quick Test → the loop closes:** 3–5 questions on the selection; wrong answers land in the Mistakes Notebook with their source section; evidence records move the Mastery Score — flip back to the plan and show the node score move.
5. **A full quiz** (`/plan/:id/quiz`): Open + Choice (+Mix), strictly materials-sourced; grading returns per-question evidence; streak + freshness live.
6. **Hubs** (epic-09): Mistakes (re-queue due items — FR-24's due scan runs server-side every 10 min), Today (daily task list), Flashcards, Quiz hubs; Analytics real series; Achievements — 12 server-computed badges.
7. **Square** (epic-11): public square, read + **fork** a plan (adoption = fork, original author attributed). ⚠️ Do NOT demo roadmap.sh import — FR-43 is WONTFIX by owner decision (content license forbids redistribution; the ruling is in epic-11 ticket 04).
8. **Notes + weak-spots** (epic-12): note with enrichment, plan-level Companion.
9. **Study Task → Plan promotion** (epic-14 T2): promote a task; evidence continuity is spec-proven (node ids stable).
10. **Settings** (epic-14 T1): password change, data export (the import-shaped JSON — open it, show the versioned document), AI cap display. Toggle 中文/English live (every string is keyed — i18n is real). Sunset/twilight/aurora + dark mode.

## Honesty lines (say them)

- **Deployment:** the graded demo runs locally; the live stack (Render/Neon/R2/Pages) is provisioned-but-unverified — owner-gated per deploy.md §2/§2.5 (rollback rehearsal §9 pending). Don't claim a live URL.
- **AI:** live through the OpenAI-compatible provider with a per-user daily cap (FR-34); the Phase-1 simulator survives only as the test double.
- **Known-open (all trigger-recorded, all in the spine Deferred table):** roadmap.sh import (license), Google OAuth + password reset (need a console client / mail provider), Neon backups, production error visibility (free tier keeps no logs — deploy.md §11), MaterialsPage server backing, mistake lifecycle flags.
- **Mastery honesty:** the score is evidence-only (ADR-0001: last-5 windowed mean, capped at 99 until ≥3 evidence records) — the demo claim-marking deliberately does NOT move it.

## If something breaks

- AI call hangs: concurrency ≈ 1 — wait it out or move on; the queue drains. A pre-generated quiz/notes set is the safe fallback.
- Port already owned: `just down` first, then `just up`.
- Fresh DB shows no demo plan: `db:seed` is idempotent (`DemoSeed.call`) — run it once in the api container.
