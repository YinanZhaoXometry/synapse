# Synapse

Single context. Product vocabulary — Study Plan, Study Task, Material, Knowledge Node, Mastery Score, Companion, Reading Position, Mix Mode, the hub surfaces — lives in [PRD §3](docs/product/prd-synapse/prd-synapse.md) and is used verbatim; this glossary holds only the engineering terms the code, specs, and tickets use. Neither file redefines the other's terms.

## Language

### Evidence & mastery

**EvidenceRecord**:
One graded quiz answer, tied to the Knowledge Node it evidences. The only unit that can move a Mastery Score.
_Avoid_: score event, progress point, activity

**Outcome**:
The graded result of one attempted recall: correct, partial, or wrong. A forfeit (「看答案」) grades as wrong.
_Avoid_: score, mark, result

**Evidence-producing session**:
A study session in which at least one EvidenceRecord is created. The only unit the streak counts — never minutes, never logins.
_Avoid_: active session, study time

### Node mastery states

**uncovered**:
A Knowledge Node with no EvidenceRecords. Reads as neutral "not studied yet" — never as weakly-mastered.
_Avoid_: new, unknown, untested

**partial**:
A node with evidence below the mastered bar.
_Avoid_: weak, in-progress, half-done

**mastered**:
A node whose recent evidence sits at or above the mastery threshold, with at least the minimum evidence count. The only state that counts toward plan readiness.
_Avoid_: done, complete, green (green is the rendering, not the state)

### Self-declared status

**Study Mark**:
The user's self-declared per-node status — `learning | finished | skipped`, nullable, revocable (FR-47). "Where the user says they are." ORTHOGONAL to the mastery states above by contract (ADR-0002): it renders (roadmap chip, sheet row) and nothing else — no score, readiness, targeting, or hub computation reads it.
_Avoid_: done (the word itself — the UI copy is 已完成), mark-as-mastered (it is NEVER evidence), progress (the progress bar stays mastery-only)

### Node teaching & mapping

**AI 讲解 (node teaching)**:
The node-scoped teaching action on a Knowledge Node — opens the plan Companion drawer with the turn grounded on that node (node scope + its confirmed section mappings; answers honestly that no material is attached when the node is unmapped). Always rendered, never mapping-gated; replaced the old mapping-gated 问 AI 导师 node action. Prefill is short and never auto-sent.
_Avoid_: 问 AI 导师 (the node-level sense is retired), lesson (a generated artifact — see AI 讲义, a different thing)

**Unmapped node (未映射节点)**:
A Knowledge Node with zero confirmed section mappings — the material-mapping axis. NEVER confused with **uncovered** (the evidence axis): an unmapped node can be mastered, an uncovered node can be fully mapped.
_Avoid_: 未覆盖节点 / uncovered (taken by the mastery axis)

**Auto-mapping (自动映射)**:
The plan-page effect that fires the section-mapping proposal once per mounted session for each parsed material with zero mapping rows. Consumes the user's daily AI cap like any AI call; the manual mapping button remains the explicit retry.
_Avoid_: background mapping (it is not a job), ingestion (parsing is a different, client-side thing)

### Generated study content

**AI 讲义 (Generated lesson)**:
A Material Synapse generates FROM the user's own materials — a grounded re-presentation, never parametric writing. Markdown kind, `origin: generated`; every section carries source anchors back to the mapped sections (node entry) or the source material (material entry) it was generated from. One per node / one per source material; regeneration replaces in place. A full Material everywhere (readable, annotatable, quiz-sourceable) with two exclusions: never a generation source for other lessons, never proposed by Auto-mapping.
_Avoid_: 书 / book (the parametric living-book pipeline stays rejected), 讲解 (the dialogue action — ephemeral, not persisted), AI 内容 (say which: a lesson is a Material)

### Local data

**synapse-db**:
The single versioned document holding all of one user's study data locally in the browser. The app's only persisted domain data.
_Avoid_: the database, storage keys, cache
