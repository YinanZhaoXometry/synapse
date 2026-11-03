# 04: roadmap.sh import — build-time job → ready-made plan (FR-43)

**What to build:** an api job/task fetching a chosen roadmap.sh roadmap, parsing stages/topics → Knowledge-Node structure, and creating the plan (attribution + license note on the plan record); user-facing import entry (pick a roadmap from a curated list v1); imported plan behaves identically (attach, quiz, mastery). **License gate: verify roadmap.sh content-license terms before building** (delta-grill; same posture as OQ-4) — attribution handling per the ruling.

**Blocked by:** None in-epic (license verification is the gate; parallel-friendly, api-only).

**Status:** ready-for-agent (license check = owner-visible delta-grill item)

**Bound by:** FR-43 (identical behavior; attribution visible; license = build-time concern routed to architecture), AD-12/13 (job → command; user-scoped plan rows), AD-16 (no AI involved — curated structure replaces generation).

- [ ] License terms verified + ruling recorded in `## Comments` (and the plan record carries attribution)
- [ ] Parse fixtures → structure rows; failure paths typed (source unavailable → VALIDATION_FAILED/INTERNAL per enum)
- [ ] Import entry bilingual; imported plan round-trips the normal study path
