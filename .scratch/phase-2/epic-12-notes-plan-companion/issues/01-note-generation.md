# 01: Note generation + visual enrichment + export (FR-40)

**What to build:** `generateNote(scope)` — whole plan | node | material — producing standalone Markdown persisted as a user-scoped Note entity; AI-selected enrichment placement markers (visual where it aids understanding); user-requested annotation at a chosen spot; markdown export (download); **OQ-11 sourcing ruling recorded at delta-grill before build** (v1 recommendation: curated/diagram-safe).

**Blocked by:** None (epic gate: 08 done; enrichment needs only 05).

**Status:** ready-for-agent (OQ-11 = delta-grill item)

**Bound by:** FR-40 (standalone, exportable, scope-selection, placement rules), AD-16 (adapter; cap-counted), AD-13 (user-scoped), NFR-1 (materials-sourced content).

- [ ] OQ-11 ruling recorded in `## Comments`; asset path implemented per ruling (presigned GET if stored)
- [ ] Scope correctness on fixture materials; placement + user-requested markers render
- [ ] Export downloads valid markdown; CAP_REACHED path sane
