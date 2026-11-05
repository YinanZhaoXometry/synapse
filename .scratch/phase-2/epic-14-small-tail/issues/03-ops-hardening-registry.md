# 03: Ops hardening — error visibility, backups, password-reset gate, OAuth registry

**What to build:** the Deferred-table ops tail, each item shipped or trigger-recorded in `## Comments`: (a) **production error visibility before a graded demo** — lightest honest option per delta-grill (scheduled Render log drain or demo-window paid tier); (b) **Neon backups/PITR** — decision + action before real users beyond the demo account; (c) **password reset** — blocked on a mail provider (free-tier Render blocks outbound SMTP): pick provider or record trigger; (d) **Google OAuth** — registry entry, trigger "a real user asks".

**Blocked by:** None (parallel; items may complete at different times).

**Status:** done (2026-11-05 — registry landed per delta decision 3: all four items carry external dependencies, so T3 ships the registry + the deploy.md demo-window checklist; nothing codeable without owner-side accounts was found on recon — every item trigger-recorded)

**Bound by:** AD-20 (demo-window posture), AD-15 (password reset deferral reasoning), Deferred-table triggers.

- [x] Registry table in `## Comments`: item / trigger / status / date — maintained, not folklore
- [x] Whatever ships, ships tested; what re-gates, re-gates in writing (nothing ships — see Comments; every re-gate is written in the table)
- [x] Demo-window checklist lands in docs/deploy.md (§11)

## Comments

**2026-11-05 — disposition (delta review 3):** all four items carry EXTERNAL dependencies (Render paid tier/log drain, Neon console, mail provider, Google console) — none is agent-buildable end-to-end, and recon found NO zero-dependency code any item implies (password reset needs the mailer; OAuth needs the console; backups + log drain are vendor-dashboard actions). T3 therefore ships the registry (this table) + the demo-window checklist in [`docs/deploy.md` §11](../../../docs/deploy.md). Nothing fake was built: no stub mailer, no stub OAuth, no placebo backup config.

### The registry (item / trigger / status / date — maintained here, not folklore)

| # | Item | Trigger (Deferred-table source) | Status | Date |
| --- | --- | --- | --- | --- |
| 1 | Production error visibility | **Before a graded demo** (Deferred: "Render free keeps no log history") | **trigger-recorded — disposition: the demo-window paid tier** (deploy.md §8 upgrade already ships full dashboard log access for the window — the lightest honest option; a scheduled Render log drain is the standing alternative IF persistent visibility is ever needed beyond windows). Free-tier demo rule (now in deploy.md §11): Render keeps NO log history — capture failures live during the window. | 2026-11-05 |
| 2 | Neon backups / PITR | **Before real users beyond the demo account** (Deferred row verbatim) | **trigger-recorded — owner-gated:** Neon console (backups/PITR are a Neon plan feature; the free plan the demo runs on has none). On trigger: pick the Neon tier with PITR, enable, record the restore-test date in this row. | 2026-11-05 |
| 3 | Password reset (email recovery) | **A mail provider is picked** (free-tier Render blocks outbound SMTP — AD-15's recorded reasoning); before real users beyond the demo account | **trigger-recorded — owner-gated:** provider pick is the owner's (Render's own additive options: Resend/Mailgun/SES all have free tiers; none provisioned). On trigger: pick + provision SMTP/HTTP creds → build the reset flow as its own ticket (request → token email → reset command; rate-limited like login; the schema currently has NO reset-token plumbing — that build is unbuilt and unclaimed). | 2026-11-05 |
| 4 | Google OAuth (FR-30's second half) | **A real user asks for it** (Deferred row verbatim — email+password shipped first, epic-02) | **trigger-recorded — owner-gated:** needs a Google Cloud console OAuth client (owner-side). On trigger: console client + redirect URIs → the api-side OAuth exchange as its own ticket. Until then FR-30 stays honestly half-shipped (email+password only). | 2026-11-05 |

### "Whatever ships, ships tested" — the honest statement

Nothing ships in code: zero-dependency implementations were explicitly sought and do not exist for any item (a mailer without a provider is dead code; an OAuth client id without a console is fiction; backups are the vendor's console feature; a log drain needs a Render plan). So the tested-shipped clause is vacuously satisfied and the re-gate clause is exercised four times — each row above writes its trigger and its unblock action.

### Owner feed extracted (feeds the session's owner to-do list)

1. Provision the live stack (deploy.md §2 — Render/Neon/R2/Pages, all [owner]) + §2.5 live smoke + §9 rollback rehearsal (epic-08's merge-order amendment: these moved post-merge).
2. Before the next graded demo: §8 paid-upgrade window (which IS item 1's disposition) + §11 checklist.
3. Before real users beyond the demo account: Neon backups/PITR (item 2) + mail provider pick → password-reset build (item 3).
4. When a real user asks: Google OAuth console client (item 4).
5. FR-43 consent letter to Kamran Ahmed (epic-11 ticket 04 — the roadmap.sh license ruling lives there, not here).
6. FR-15 web marking UI placement decision (epic-13's recorded gap — server ops exist, no web UI ever consumed them).

- **Two-axis review (2026-11-05, inline):** PASS/PASS — compliance: all three ACs land (registry table with item/trigger/status/date; ships-tested clause stated honestly vacuous + four written re-gates; deploy.md §11 checklist) and the four triggers quote the Deferred table verbatim (error visibility "before graded demos", backups "before real users beyond the demo account", password reset mail-provider gate per AD-15, OAuth "a real user asks") — delta decision 3 followed exactly (registry + checklist + owner feed, zero fake code). Contract: docs-only change (this ticket + deploy.md) — no AGENTS.md surface touched, no storage keys, no i18n, no schema; the registry is the single maintained record and deploy.md §11 points here instead of duplicating the table (no folklore fork). No code gates required for a docs-only ticket; the epic-close `just spec` run covers the branch.
