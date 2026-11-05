# 04: roadmap.sh import — build-time job → ready-made plan (FR-43)

**What to build:** an api job/task fetching a chosen roadmap.sh roadmap, parsing stages/topics → Knowledge-Node structure, and creating the plan (attribution + license note on the plan record); user-facing import entry (pick a roadmap from a curated list v1); imported plan behaves identically (attach, quiz, mastery). **License gate: verify roadmap.sh content-license terms before building** (delta-grill; same posture as OQ-4) — attribution handling per the ruling.

**Blocked by:** None in-epic (license verification is the gate; parallel-friendly, api-only).

**Status:** ready-for-human (LICENSE BLOCKED — owner gate; NOT built in the 2026-11-05 run)

**Bound by:** FR-43 (identical behavior; attribution visible; license = build-time concern routed to architecture), AD-12/13 (job → command; user-scoped plan rows), AD-16 (no AI involved — curated structure replaces generation).

- [ ] License terms verified + ruling recorded in `## Comments` (and the plan record carries attribution)
- [ ] Parse fixtures → structure rows; failure paths typed (source unavailable → VALIDATION_FAILED/INTERNAL per enum)
- [ ] Import entry bilingual; imported plan round-trips the normal study path

## Comments

- **2026-11-05 license ruling (delta review 1) — BLOCKED:** roadmap.sh content license (fetched via the GitHub API from kamranahmedse/developer-roadmap, root `license`): "Everything including text and images in this project are protected by the copyright laws. You are allowed to use this material for personal use but are not allowed to use it for any other purpose including publishing the images, the project files or the content... You are allowed to share the links to the repository or the website roadmap.sh but not the content for any sort of usage that involves the content of this repository taken out of the repository and be shared from any other medium... you must get prior consent." FR-43's import (serving roadmap structure through Synapse) is the forbidden out-of-repository use. **Owner action to unblock: obtain prior written consent from Kamran Ahmed (kamranahmed.se@gmail.com) for serving derived plan structures from roadmap.sh content.** Until consent: this ticket stays untouched; FR-43 remains open (the honest gap).
