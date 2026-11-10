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

### Local data

**synapse-db**:
The single versioned document holding all of one user's study data locally in the browser. The app's only persisted domain data.
_Avoid_: the database, storage keys, cache
