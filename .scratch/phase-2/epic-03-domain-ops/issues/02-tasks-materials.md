# 02: Study Task + Material metadata operations

**What to build:** Study Task create/read (one Material, one auto-owned KnowledgeNode — `taskId` set, `planId` null, per AD-6); material **attach** accepting client-extracted payload — metadata, sections (ids + headings + text, bounded per-section size), parse state — with file bytes explicitly absent (blobs are epic-06); material listing/detail under plan or task scope.

**Blocked by:** 1.

**Status:** ready-for-agent

**Bound by:** AD-13 (extracted text lives in Postgres; bytes never), AD-7 (parsing stays client-side — this op persists what the client extracted), AD-6 (task's single auto-node).

- [ ] Task ops with auto-node creation in-transaction
- [ ] Material attach: sections/text/parse-state persisted; oversized-section guard (quota-era rule carried server-side)
- [ ] Material reads scoped by owning plan/task/user via scoping context
- [ ] Idempotent attach on client uuid (re-upload safe)
