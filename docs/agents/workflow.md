# Planning workflow: BMAD × Matt Pocock

Who owns which stage of idea → code in this repo. **BMAD owns product thinking, UX, and architecture; Matt Pocock's skills own implementation planning, TDD, and code review.** Don't run both toolchains over the same artifact.

## Ownership split

| Stage | Skill | Output |
|---|---|---|
| Product idea | `/bmad-product-brief` | Product brief in `docs/product/brief-{name}/` — vision, users, problem, scope |
| UX / product design | `/bmad-ux` | `DESIGN.md` + `EXPERIENCE.md` in `docs/design/` — flows, states, behavior, visual rules |
| Technical architecture | `/bmad-architecture` | Architecture spine in `docs/architecture/` — boundaries, dependency rules, state mutation, shared-data ownership, each decision with a stable ID |
| Requirements / tickets | `/grill-with-docs` (or `/grill-me`) → `/to-spec` → `/to-tickets` | Hardened decisions, implementation spec, vertical-slice tickets (local markdown tracker — see [issue-tracker.md](issue-tracker.md)) |
| Build | `/tdd`, `/implement`, then `/code-review` | Test-first implementation and review |

## Pipeline

1. **BMAD planning first.** Run brief → UX → architecture in order for a new product or meaningful feature, each consuming the previous artifacts plus the existing codebase.
2. **Hand the artifacts to Matt's workflow.** Give the brief, UX docs, and architecture spine to `/grill-with-docs` to challenge assumptions and fix domain language, then `/to-spec` and `/to-tickets`.
3. **Build** with `/tdd` / `/implement` and review with `/code-review`.

## Pick the path by scale

Choose the planning path by the size of the work — don't run the full chain mechanically (BMAD's own "choose a planning path" guidance). In this hybrid:

| Work size | Path |
|---|---|
| Small change, one session | No BMAD at all — straight to `/tdd` / `/implement`, `/code-review` after |
| One clear feature, stable requirements | `/bmad-product-brief` (only if no existing brief covers it) → `/grill-with-docs` → `/to-spec` → `/to-tickets` → build |
| Feature with a UI/UX surface | Insert `/bmad-ux` after the brief |
| Large or unstable requirements | Insert `/bmad-prd` between brief and UX — it reads the brief and hardens what / for-whom / acceptance criteria |
| Project-level (multi-epic, ~20+ implementation sessions) | Full planning chain; `/bmad-architecture` becomes mandatory. BMAD's own slicing/sprint skills (`bmad-create-epics-and-stories`, `bmad-sprint-planning`, `bmad-retrospective`) are **not installed** in this repo — slice with `/to-tickets` instead, or install those skills explicitly first |

Phase reference: brief = Analysis; PRD + UX = Planning; architecture = Solutioning. Everything from grill onward is implementation and belongs to Matt's skills in this repo — the BMAD build/review/retro chain is deliberately not used here.

`bmad-prd` reads the brief but is not a hard dependency — brief-only or PRD-only are both valid shapes. When it IS used, the rule below still applies.

## Managing delivery phases & epics

(BMAD's "phase reference" above means methodology phases — Analysis/Planning/Solutioning. This section is about **delivery phases**: what ships when.)

**Vocabulary.** The PRD owns the only phase tags — `[Phase 1]` (Nov 6 course deadline), `[Phase 2]`, `stretch` (pull into Phase 1 only if the core lands early). Never invent new phase names; a ticket's phase = its FRs' tags.

**Phases = a `Milestone:` line.** One milestone per phase; every epic and ticket file carries exactly one (`Milestone: Phase 1 — Nov 6 core` or `Milestone: Phase 2 — post-deadline`; created 2026-11-02). `stretch` FRs ride in the Phase-2 milestone until a Phase-1 checkpoint pulls them forward (re-milestone + one-line note on the epic).

**Directory layout carries the phase (2026-11-03; re-laid to two levels the same day).** Epic tracker dirs live at `.scratch/phase-<N>/epic-<NN>-<slug>/` — the phase is the parent directory (hierarchy first, owner ruling), the epic number is zero-padded to two digits inside it (`.scratch/phase-1/epic-07-small-tail/`, `.scratch/phase-2/epic-00-monorepo/`). Phase-1's shipped dirs were migrated into `phase-1/` in the same change; the epic-4 gap stays (superseded, never renumbered). The `Milestone:` line remains the authoritative phase marker; non-epic wayfinding efforts keep their single-level `.scratch/<effort>/` slot. Prose shorthand "Epic N" resolves by context — the directory slug is authoritative.

**Epics = capability slices, one spec pipeline each.** An epic is a tracking doc in the feature's `.scratch/<feature>/epic.md`; its tickets are files under `issues/` with `Blocked by:` lines (see [issue-tracker.md](issue-tracker.md)). Create the epic doc when its spec run starts — never pre-file empty shells. One epic = one `/grill-with-docs` → `/to-spec` → `/to-tickets` chain; don't run the chain per-ticket.

**Phase-1 slicing** (dependency-ordered, from the [gap analysis](../architecture/architecture-synapse/gap-analysis.md) §5):

| # | Epic | Scope (FRs) | Blocks |
| --- | --- | --- | --- |
| 1 | foundation | `src/domain` entities + `mastery.ts` + tests; `src/data` `synapse-db:v1`; `src/ai` simulated CompanionService | everything |
| 2 | plans | entry states, Plans Home light + streak, creation chat, material attach (FR-1/2/25) | — |
| 3 | reader | `parse(file)`, PDF/MD render, ReadingPosition (FR-8/9/10) | companion, tasks |
| 4 | companion | page-aware panel + guardrail contract (FR-11/12) | — |
| 5 | tasks | Study Task (FR-37) | — |
| 6 | quiz + flashcards | in-flow generation, evidence recording (FR-18/19) | — |
| 7 | small tail | FR-36 sidebar ordering, Settings store reset, deploy (FR-35/36) — scale-ladder row 1: straight to `/implement`, no spec chain | — |

After epic 1 lands, epics 2–6 can run two lanes in parallel (that's what AD-2's visible boundaries are for); epic 4 waits on 3 for ReadingPosition grounding.

**Definition of done (Phase-1 epic):** FR acceptance criteria pass · gates green (`npx tsc -b`, `npm run lint`, `npm run test` — AD-10) · grandfathered scaffold surfaces untouched unless the epic's FR re-points them · every ticket cites its AD ids.

**Phase 2 is planned (2026-11-03).** The full board — 15 epics (00 monorepo through 14 small-tail), each with spec + tickets — lives under `.scratch/phase-2/`, indexed by [`.scratch/phase-2/roadmap.md`](../../.scratch/phase-2/roadmap.md) (dependency graph, parallel lanes, owner-side windows, kickoff checklist). The spine's Deferred table remains the trigger registry for anything *not* on the board; the hub stand-ins (`/quiz` `/flashcards` `/mistakes` `/planner` scaffold pages) stand until epic-09 re-points them. Feature epics (09–14) carry a **delta-grill at kickoff** line — a light re-validation of their specs' open assumptions, honoring one-spec-chain-per-epic without re-running the pipeline.

## Rules

- Do not run `/bmad-prd` and `/to-spec` over the same feature unless one is explicitly updating the other. One spec pipeline per feature.
- **Reference architecture-spine decision IDs inside tickets**, so implementation stays aligned with the agreed boundaries and rules.
- Before implementation planning, read the brief, `docs/design/`, and the `docs/architecture/` spine for the area you're about to work in. If your output contradicts a spine decision, surface it explicitly rather than silently overriding (same rule as ADR conflicts in [domain.md](domain.md)).
- `docs/adr/` still belongs to `/domain-modeling` (see [domain.md](domain.md)); the architecture spine does not replace it. Surface conflicts between the two instead of silently picking one.

## BMad run conventions for this repo

Per user instruction: no BMad infra (`_bmad/` is not set up) — memlogs are maintained by hand, doc-standards editorial passes are applied inline, and party-mode / advanced-elicitation offers are suppressed.
