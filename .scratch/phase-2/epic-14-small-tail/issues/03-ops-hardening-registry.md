# 03: Ops hardening — error visibility, backups, password-reset gate, OAuth registry

**What to build:** the Deferred-table ops tail, each item shipped or trigger-recorded in `## Comments`: (a) **production error visibility before a graded demo** — lightest honest option per delta-grill (scheduled Render log drain or demo-window paid tier); (b) **Neon backups/PITR** — decision + action before real users beyond the demo account; (c) **password reset** — blocked on a mail provider (free-tier Render blocks outbound SMTP): pick provider or record trigger; (d) **Google OAuth** — registry entry, trigger "a real user asks".

**Blocked by:** None (parallel; items may complete at different times).

**Status:** needs-triage (each item resolves to done or a recorded trigger + re-gate — owner-visible choices at delta-grill)

**Bound by:** AD-20 (demo-window posture), AD-15 (password reset deferral reasoning), Deferred-table triggers.

- [ ] Registry table in `## Comments`: item / trigger / status / date — maintained, not folklore
- [ ] Whatever ships, ships tested; what re-gates, re-gates in writing
- [ ] Demo-window checklist lands in docs/deploy.md
