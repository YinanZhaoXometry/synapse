# 03: Close-out — browser smoke, theme/motion/viewports, records

**What to build:** proof the motion is shippable everywhere it must live. A real-browser pass over the full matrix — dual mode (light/dark), at least two accent palettes with re-tint, reduce-motion on (animations collapse to instant swaps; behavior identical to today's) and off, three viewports (phone/tablet/desktop) — plus a rapid-click stress run, then the records: board + epic updated with final baselines, and the unused-dependency observation handed to epic-19's kickoff.

**Blocked by:** 2.

**Status:** ready-for-agent

**Bound by:** AD-9 (a11y verification: keyboard contract + aria surfaces in the smoke), spec further-notes (epic-19 handoff; queue-position note).

- [ ] Full web gates: typecheck, eslint, `vitest run --coverage`, `vite build`; codegen freshness untouched (no GraphQL surface change); mastery-vector anti-drift untouched
- [ ] Real-browser smoke: light+dark, ≥2 palettes re-tint mid-session, reduce-motion OFF (full choreography: flip, sweep, settle, stack) and ON (instant swap, session fully usable), phone/tablet/desktop viewports — screenshots reviewed
- [ ] Rapid-click stress in-browser: rate-then-next and double-next bursts — no tearing, no stuck ghosts, no dead clicks
- [ ] i18n parity test green (confirms zero new keys)
- [ ] framer-motion (declared, zero-import) observation recorded as epic-19 kickoff input
- [ ] Board row + epic record updated: Status → done with final baselines (vitest count, gates)

## Comments

- (none yet)
