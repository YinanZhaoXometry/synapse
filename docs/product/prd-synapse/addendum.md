# Addendum — prd-synapse

Technical-how and pointers that don't belong in the PRD body. Product-level depth lives in the brief's [addendum](../brief-synapse/addendum.md) — especially "Reader experience extensions" (immersive reader, annotations, mastery marking, shortcuts, structure-first philosophy, roadmap reference) and "Product name" (origin & rationale).

## Renderer notes (OQ-2)

- roadmap.sh's own content repo (`github.com/nilbuild/developer-roadmap`) stores one markdown doc per node, tied to the graph by a `@<node-id>` filename suffix — the rendering engine lives site-side, not in that repo. For Synapse, the choice is a graph library (e.g. React Flow / `@xyflow/react`) vs. custom SVG; decision at `/bmad-architecture`.
- Whatever the renderer, the Roadmap data model should stay renderer-agnostic: nodes (id, label, group, state), edges (sequence), source section link.

## Reading Position tracking notes (OQ-5)

- PDF: page index + extracted text layer per page (client-side pdf.js vs. server-side extraction — architecture's call).
- Markdown: stable section IDs from heading slugs; section content addressable for Companion grounding.

## Guardrail behavior (NFR-2 / FR-8)

- The hint-first-vs-direct-answer line is behavioral spec territory for `/bmad-ux` (what the Companion does per intent: explain / quiz-me / why-is-this-true).
- Archive lesson carried over: per-feature provider/model config scoping was an epic-2 open finding — keep model choice per feature (Companion vs. quiz generation may want different settings).

## Mastery Score design notes (OQ-9)

- Evidence-based by principle (owner): the score moves on quiz evidence; self-reported Mastery Marking does not inflate it (its exact role is OQ-7).
- Coverage must be distinguished from mastery: a node with no evidence reads "uncovered," never "mastered by default" — otherwise the 100% readiness promise is a lie (see counter-metric SM-C2).
- Candidate inputs for the architecture stage: per-question correctness weighted by node, recency/decay, Open-Question partial credit. Keep the formula swappable behind one module — it will be tuned.
- The readiness state (100%) is a product promise aimed at exams/interviews (owner's framing); its credibility is the metric (SM-4), so resist any scoring change that makes 100% easier to reach without more evidence.

## Open-Question grading notes (OQ-10)

- Graded by the Companion against the Material with the grade rationale shown (FR-18); rubric visibility and appeal flow are UX decisions.
- Cost note: Open Questions are the expensive question type (one grading call each) — relevant to NFR-4 cap design.

## Scaffold migration

- `LearningModeContext` (`ai | non-ai`) and `aiOnly` nav gating in `AppLayout` are retired in the first implementation pass (AGENTS.md "Platform note"). The settings page's mode toggle, if present in the scaffold, goes with them.
