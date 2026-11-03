# 01: Settings account surfaces — password change, export, cap display, weekly goal

**What to build:** Settings gains its account half: **password change** (verify old, bcrypt new, rate-limited, sessions survive per stateless-JWT policy); **data export** — one JSON download in the import's document shape (round-trip symmetric with epic-08-T3; size policy per delta-grill); **cap display** — today's AI-call count + limit (read from epic-05's counter); **weekly-goal target** settable (feeds epic-09's ring).

**Blocked by:** None (epic gate: 08 done; cap display needs epic-05 — inherited via gate).

**Status:** ready-for-agent

**Bound by:** AD-15 (account mechanics; stateless token policy stated), AD-16 (cap counter source), FR-34 display consequence, AD-9 (bilingual Settings floor).

- [ ] Round-trip spec: export → import-shape equality on factory data
- [ ] Password change: verify + rate limit + old-token policy asserted
- [ ] Cap display reads the live counter (not a guess); weekly goal persists user-scoped
