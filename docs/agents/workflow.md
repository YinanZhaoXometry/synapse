# Planning workflow: BMAD × Matt Pocock

Who owns which stage of idea → code in this repo. **BMAD owns product thinking, UX, and architecture; Matt Pocock's skills own implementation planning, TDD, and code review.** Don't run both toolchains over the same artifact.

## Ownership split

| Stage | Skill | Output |
|---|---|---|
| Product idea | `/bmad-product-brief` | Product brief in `docs/product/brief-{name}/` — vision, users, problem, scope |
| UX / product design | `/bmad-ux` | `DESIGN.md` + `EXPERIENCE.md` in `docs/design/` — flows, states, behavior, visual rules |
| Technical architecture | `/bmad-architecture` | Architecture spine in `docs/architecture/` — boundaries, dependency rules, state mutation, shared-data ownership, each decision with a stable ID |
| Requirements / tickets | `/grill-with-docs` (or `/grill-me`) → `/to-spec` → `/to-tickets` | Hardened decisions, implementation spec, vertical-slice tickets (GitHub Issues — see [issue-tracker.md](issue-tracker.md)) |
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

## Rules

- Do not run `/bmad-prd` and `/to-spec` over the same feature unless one is explicitly updating the other. One spec pipeline per feature.
- **Reference architecture-spine decision IDs inside tickets**, so implementation stays aligned with the agreed boundaries and rules.
- Before implementation planning, read the brief, `docs/design/`, and the `docs/architecture/` spine for the area you're about to work in. If your output contradicts a spine decision, surface it explicitly rather than silently overriding (same rule as ADR conflicts in [domain.md](domain.md)).
- `docs/adr/` still belongs to `/domain-modeling` (see [domain.md](domain.md)); the architecture spine does not replace it. Surface conflicts between the two instead of silently picking one.

## BMad run conventions for this repo

Per user instruction: no BMad infra (`_bmad/` is not set up) — memlogs are maintained by hand, doc-standards editorial passes are applied inline, and party-mode / advanced-elicitation offers are suppressed.
