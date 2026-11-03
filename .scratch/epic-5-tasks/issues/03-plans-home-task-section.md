# T3: Plans Home task section + create-task entries in both states (FR-37; AD-8/9)

Status: ready-for-agent
Milestone: Phase 1 — Nov 6 core
Blocked by: 02-task-home.md

## Parent

[Epic 5](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

The task lives in the learner's library (UJ-6 resolution): Plans Home carries the
Study Task path in both of its states. The empty state adds the pitch line
「只想搞懂一份文档？不需要计划 — 直接开始。」 beside the creation chat with the
create-task action; the plans-exist state keeps the create-task entry persisting
next to create-new. When at least one task exists, a Study Tasks section renders —
rows show title, the single-node Mastery Ring, and a continue-reading deep link
into the reader at the last position, newest first; at zero tasks the section is
absent (no empty chrome). The entry decision (where `/` lands) is unchanged and no
existing Plans Home behavior regresses.

## Acceptance criteria

- [ ] Empty Plans Home state shows the pitch copy and a create-task entry alongside the creation chat; the entry navigates to the creation route (spine: both states persist the action).
- [ ] Plans-exist state shows the create-task entry persisting next to create-new.
- [ ] With ≥ 1 task, a Study Tasks section renders rows of title + single-node mastery ring + continue-reading deep link into the reader at the stored position, newest first.
- [ ] Task rows link to the task home route — no dead links (this ticket is gated on task home existing).
- [ ] With zero tasks the section renders nothing (no empty-section chrome).
- [ ] Section numbers flow through pure display-shaping selectors over real queries; entry-decision logic and existing Plans Home behaviors are unchanged (existing plans-home tests stay green).
- [ ] Pitch and all new copy are i18n keys with zh/en parity (AD-9); semantic tokens only; dark mode verified.
- [ ] Selector tests (ordering, empty-section rule, ring values) + component tests for both Plans Home states; gates green via direct `node_modules/.bin` binaries.
