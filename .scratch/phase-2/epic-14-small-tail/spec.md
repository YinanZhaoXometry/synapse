# Spec: Epic 14 (Phase 2) — Small tail: Settings account surfaces, Task→Plan promotion, ops hardening

Status: ready-for-agent (delta-grill at kickoff)
Milestone: Phase 2 — post-deadline

> Authored 2026-11-03 in the Phase-2 batch pass (see [roadmap.md](../roadmap.md)). The Deferred-table
> tail: items whose trigger is "before real users / before graded demos" plus two small product
> halves. Gate: epic-08 done. Closes Phase 2.

## Problem Statement

Three loose ends don't belong to any capability epic: (a) the Settings page lacks its account surfaces — password change, data export, and the cap display EXPERIENCE.md deferred to "later"; (b) FR-37's stretch half — promoting a Study Task into a Study Plan — has no home; (c) the Deferred table's ops rows (production error visibility before graded demos; Neon backups before real users; password reset gated on a mail provider; Google OAuth deferred) need a tracked place so they stop being folklore.

## Solution

1. **Settings account surfaces (T1):** password change (authenticated mutation, bcrypt verify + rate limit); **data export** (the user's data as one JSON document download — the `synapse-db`-shaped export, symmetric with the first-login import); **cap display** (today's AI-call count + limit from the cost-cap counter, read-only); weekly-goal target settable (from epic-09's note).
2. **Task→Plan promotion (T2, FR-37 stretch):** promote a Study Task into a Study Plan — its single node becomes the plan's first node, its material attaches plan-wide, evidence carries over (node attribution unchanged); promoted task marks itself superseded (read-only pointer to the plan).
3. **Ops hardening registry (T3):** production error visibility for the graded-demo window (Render keeps no log history — pick the lightest honest option: scheduled log drain or demo-window paid tier per AD-20 posture); Neon backups/PITR decision recorded before real users; password reset unblocked when a mail provider exists (free-tier Render blocks outbound SMTP); Google OAuth re-gated on "a real user asks". Each item lands or records its trigger — nothing silently drops.

## User Stories

1. As a learner, I can change my password, download all my data, and see my remaining AI calls today.
2. As a learner whose single-document study outgrew itself, I can promote the task into a full plan without losing progress.
3. As the operator, the pre-demo and pre-real-users checklists are tickets, not memories.

## Implementation Decisions

- Export reuses the import's document shape (one command, streaming-friendly size guard; big-payload policy: synchronous v1, flagged if evidence history makes it heavy — Relay revisit hook).
- Promotion is one transactional command (client uuid idempotent); no evidence re-attribution — node ids are stable, only plan linkage changes.
- T3 items may each close as `done` (shipped) or as a recorded trigger + wontfix-for-now, per the triage vocabulary — the ticket's Comments carry the registry.

## Testing Decisions

- Password change: old-password verify, rate limit, session continuity; export: shape parity with import (round-trip spec); cap display reads the real counter.
- Promotion: evidence/mastery continuity spec (scores unchanged through promotion); task becomes read-only pointer.
- T3: whatever ships, ships tested; what doesn't, ships documented.

## Out of Scope

New Settings surfaces beyond the four listed · multi-account/profile management · anything the registry explicitly re-gates.

## Further Notes

- Delta-grill items: export size policy, error-visibility option pick, promotion's "superseded" UX wording.
- This epic closing = Phase 2 feature-complete against the PRD (the §6.2 list consumed); the roadmap's final checklist item re-runs the diff check at close.
