# 02: Study Task → Study Plan promotion (FR-37 stretch half)

**What to build:** one transactional promotion command: the task's single auto-node becomes the plan's first node, its material attaches plan-wide, evidence carries over untouched (node ids stable — only plan linkage changes, scores unchanged through promotion); the task becomes a read-only pointer to the plan; idempotent on client uuid.

**Blocked by:** None (parallel).

**Status:** ready-for-agent

**Bound by:** FR-37 stretch half, AD-6 (no re-attribution — no second rollup path), AD-12 (one command, one transaction), AD-13 (scoping).

- [ ] Score-continuity spec: mastery identical before/after promotion
- [ ] Task page renders the promoted pointer; no zombie writable state
- [ ] Bilingual flow incl. confirmation copy
