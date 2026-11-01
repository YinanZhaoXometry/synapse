# Addendum — product brief

Depth material preserved for downstream documents (UX spine, architecture spine, specs). Not part of the brief proper.

## Lineage of the two re-admitted concepts

Both v1 additions come from the archived predecessor's approved brief (`../project-new-archive-20261101/_bmad-output/initiative-ai-learning-platform/brief-adaptive-learning/`), slimmed:

- **Spaced repetition with reminders** — old brief: "schedule spaced review with reminders; channels, cadence, controls and adaptation rules remain undecided." Synapse v1 narrows it to flashcards + the mistakes notebook's re-quiz queue; no reminder channels (push/email) in v1.
- **Skill-tree roadmap** — old brief: "show current status and unfinished learning nodes through a roadmap resembling a game skill tree. Node size and navigation restrictions remain open." Synapse v1 narrows it to one subject's tree, built from uploaded materials, unlocked by quiz mastery; the planner page stays separate and may consume the tree later.

Everything else from the old platform (mini-course generation, instructor courses and approval flows, external-source supplementation, retention self-reports) is out of scope and explicitly deferred without a decision.

## Lessons carried from the archived implementation

- **Live AI already shipped once** (archive-era epic 1, via Kimi k3): the integration pattern is proven, but the provider was owner-admitted only — its terms were never verified. The brief's terms-verified constraint exists so this doesn't repeat.
- **Epic-2 open finding:** the archive's AI feature needed a purpose-scoped provider config at build time. Whatever provider the architecture stage picks, per-feature scoping of model/config should be a deliberate decision there.
- The archive's PRD (R1–R22) and UX spine are background reference. They describe the *old* product; do not treat their requirement IDs or flows as settled for Synapse.

## Research grounding

- Bastani, H., Bastani, O., Sungu, A., Ge, H., Kabakcı, Ö., & Mariman, R. — *Generative AI Without Guardrails Can Harm Learning: Evidence from High School Mathematics* (PNAS, 2025). ~1,000-student field experiment: practicing with an unguarded GPT-4 tutor produced **17% worse** performance on a subsequent unassisted exam vs. no-AI practice; a guardrailed tutor (hints, no direct answers) eliminated the harm. Sources: [SSRN working paper](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4895486) · [PNAS full text via PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12232635).
- **How this applies after the 2026-11-01 pivot:** the dual-mode measurement design (owner has since removed it) was the original response to this result. What survives is the *guardrail posture*: an AI-only platform must teach hint-first — guide with questions and scaffolding before dispensing answers — because naive answer-dispensing is the exact failure mode the study isolated. The platform makes no effectiveness claim it does not want examined; the guardrails exist so the AI helps rather than substitutes.

## AI companion reader — concept note (owner, 2026-11-01)

Captured from the owner's description; depth material for `/bmad-ux` and `/bmad-architecture`:

- **Experience:** upload a PDF or PPT → it opens in an in-app reader → a chat box sits on the side → the student asks a question → the AI answers **based on the page the student is on and the content they are reading**, tailored to their learning.
- **What "knows where you are" implies downstream:** document text extraction (PDF parsing; PPT if cheap), page-level position tracking, grounding the answer in current-page content (retrieval/chunking strategy), and ideally citing the page it answered from so trust is checkable.
- **Tailoring inputs the architecture should keep open:** the learner's mistakes, quiz history, and progress — so answers can meet the student at their level, not just at their page.
- **Extension worth designing for (not building first):** "test me on this page" — the reader as the entry point of the quiz/mistakes loop.

## Product name — Synapse: origin & rationale

Chosen by the owner on 2026-11-01 from a neural-metaphor candidate set (Synapse, Engram, NeuroPal, Myelin), replacing the working name "StudyFlow".

- **The name is the science.** In neuroscience, learning and memory *are* synaptic strengthening — "neurons that fire together, wire together" (Hebb's rule). Every answered quiz question and corrected mistake is, literally, a synaptic connection getting stronger. The name makes the product's promise physical: studying here strengthens your connections.
- **It carries every requested meaning.** 神经 (neural) ✓; 加强学习 (strengthening learning) ✓ — by definition, not analogy. The companion/tool role is carried by the tagline: **「你的 AI 学习伙伴 — 每一次提问，都在强化一条连接」** / *"The AI study companion that strengthens your connections."*
- **Bilingual handling.** The brand stays "Synapse" in the Chinese UI as well — no translated Chinese name (owner decision, 2026-11-01; an earlier 突触 pairing was dropped the same day). An English brand name is normal in Chinese tech contexts, and the Chinese tagline carries the meaning: 「你的 AI 学习伙伴 — 每一次提问，都在强化一条连接」. Synapse is short, memorable, and pronounceable for both audiences.
- **Demo value.** The name explains itself to a lecturer in one sentence — and doubles as the product's scientific stance (guardrailed, learning-first AI).
- **Runners-up and why they lost.** *Engram* (忆痕): the memory trace — poetic but means storage, not learning, and is obscure. *NeuroPal* (脑友): warmest buddy vibe but the weakest strengthening meaning; toy-like for a platform. *Myelin* (髓鞘): practice thickens myelin = faster recall — beautiful but hardest to say and explain.
- **Context.** The owner explicitly waived name-collision concerns for this course project (other study apps use Synapse/Synaptic); no claim on the name beyond the course. Naming searches were run before the owner waived them; they informed the candidate set, not the final call, which rests on meaning fit.

## Reader experience extensions — concept notes (owner, 2026-11-01)

Depth captured from the owner's description; belongs to `/bmad-ux` and `/bmad-architecture`.

- **Immersive reader mode** (confirms the flagship): reading view with a side chat panel; the AI answers based on the current reading context, like a normal AI companion app but page-aware.
- **Markdown reader with annotation.** The reader supports Markdown files: highlight text in different colors, underline. These annotations are the *input* for AI-generated "core things to study" for the material. Where and how that output displays is deliberately undecided — owner: "when we implement it we should think this through."
- **Mastery marking.** In the reader, mark the parts you have already mastered; their background turns green (or similar); unmarked material keeps no background. The page itself becomes a visual progress surface.
- **Instant feedback shortcuts (positioned as the platform's special feature).** On any part you don't quite understand, click shortcuts to: (a) ask the AI companion for an answer, or (b) ask it to give you a quick test. Feedback happens at the moment of confusion, inside the reading flow.
- **Structure-first philosophy (owner's framing).** Study should focus on the *structure* of knowledge rather than details memorized piece by piece — everything is findable via the internet and AI, which makes structural knowledge of a domain the durable, scarce asset. This principle should shape what the platform emphasizes going forward.
- **Roadmap rendering — resolved by reference (owner, 2026-11-01).** The owner pointed to the developer-roadmap repo behind roadmap.sh (`github.com/nilbuild/developer-roadmap`) as the form factor: an interactive node graph — topic nodes grouped by stage, connected by edges, click a node for its content, progress marking on nodes (roadmap.sh uses done / in progress / skipped). Mapped to Synapse: nodes derive from the material's knowledge structure; node state = mastery (mastered → green, matching the reader's mastery marking); clicking a node jumps into the reader at that section or fires a quick test. Note: that repo holds content, not the rendering engine (one markdown doc per node, tied by a `@<node-id>` suffix); choosing the renderer (e.g. a graph library vs. custom SVG) lands in `/bmad-architecture`.
- **Connecting spine (facilitator synthesis — confirm with owner).** The document's own structure (headings/sections) becomes the knowledge structure; the roadmap renders it, mastery marking tracks it at the section level, quiz evidence gates it, and analytics aggregate it. One structure, four views: reader, roadmap, quiz, analytics. If the owner confirms this, it is the product's architectural anchor.

## Course context

- COMP5241 (Software Engineering, PolyU), 2026–27. **Final deadline: November 6, 2026 (owner-confirmed).** The final presentation must cover AI Fluency 4D (Delegation, Description, Discernment, Diligence); after the AI-only pivot, the 4D story centers on designing an AI that guides rather than substitutes — discernment embodied in the guardrails, not in a comparison experiment.

## Downstream pipeline

Per `docs/agents/workflow.md`: this brief feeds `/bmad-ux` (flows, states, behavior into `docs/design/`) and `/bmad-architecture` (boundaries, dependency rules, backend stack decision into `docs/architecture/`), then the Matt-Pocock implementation pipeline (`/grill-with-docs` → `/to-spec` → `/to-tickets`). Stack and provider decisions belong to those stages, not this brief.
