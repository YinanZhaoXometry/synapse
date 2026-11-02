# T3: Plan Home (light) — honest mastery, node list, activity shell, quick actions (FR-25)

Status: ready-for-agent
Milestone: Phase 1 — Nov 6 core
Blocked by: 02-plans-home-creation.md

## Parent

[Epic 2](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

The light plan overview (FR-25, Q7): header with topic/goal, the evidence-day streak chip (rule on hover), and the mastery ring with its honesty footnote. The node list groups by stage; each node row shows state glyph + tint + label (never color alone), its score when evidence exists, and an evidence popover with the last-5 outcome marks and the rule text — all reading the real evidence queries through the shipped domain functions, so a fresh plan reads all-uncovered honestly and lights up when slice 6 lands. Materials section lists attached materials read-only with parse-pending chips and the session-only re-upload note (upload itself is the next ticket). Recent activity is a real-query shell (honest empty until sessions exist). Quick actions render as the four-tile grid, disabled with reasons: generation actions gated on having a material ("attach a material first"), slice-gated actions say so. The scaffold quiz page's hardcoded mastery deltas and the Dashboard stay untouched.

## Acceptance criteria

- [ ] Plan Home shows topic/goal, streak chip (evidence-day rule stated on hover), mastery ring + honesty footnote — all from real queries (FR-25; AD-6)
- [ ] Nodes grouped by stage; every row: state glyph + tint + label (never color-only), score when evidence exists (em dash when not), evidence popover with last-5 outcome marks + rule text (UX display contract; ADR-0001)
- [ ] Fresh plan reads all-uncovered with rollup per contract (uncovered = 0; 100% only when all nodes mastered) — no display arithmetic (ADR-0001)
- [ ] Materials section lists materials with kind/size, parse-pending chip, and the session-only re-upload note (read-only; upload = next ticket) (Q1)
- [ ] Recent activity wired to real session/evidence queries; honest empty state until slice 6 produces data (Q7)
- [ ] Quick actions: four-tile grid; generation actions disabled with 「先附上材料」 until a material exists; quiz/flashcards/companion actions explain their slice on interaction — no dead clicks promised (Q7)
- [ ] Display shaping (rollup for the ring, mini-bar counts, activity list shaping, most-recent-plan selection) covered by vitest at the logic seam (Q8)
- [ ] All new user-facing strings in the i18n table, zh + en (NFR-5)
- [ ] Gates green: `npx tsc -b`, `npm run lint`, `npm run test`; quiz page + Dashboard untouched (AD-9)
