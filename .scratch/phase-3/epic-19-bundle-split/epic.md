# Epic 19 (Phase 3) — bundle split: measure, split the routes, wire the tripwire

Status: done (closed 2026-11-06; both tickets landed on `epic/p3-19-bundle-split`; entry 1,026,203 → 723,680 B min (−29.5%) / 275,799 → 202,315 B gzip (−26.6%); tripwire live (CI size-summary step + chunkSizeWarningLimit 800); baselines: rspec 1452 · vitest 920 · e2e 21)
Milestone: Phase 3 — optimization season

## Parent

[roadmap.md](../roadmap.md) row 19 · NFR-6 (demo reliability; the Deferred trigger "if demo load time hurts" overridden by the owner's batch nomination 2026-11-06) · AD-11/AD-20 (static SPA posture — the wall stays eager/pre-login static) · AD-17 (no schema change; codegen zero-diff asserted) · [spec.md](spec.md).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-measure-split-tripwire.md](issues/01-measure-split-tripwire.md) | — (epic gate; starts when epic-18 is merged to main) | baseline report pinned → all in-shell routes lazy → post-split report → chunkSizeWarningLimit derived → CI size-summary step → gates + e2e green |
| 2 | [02-close.md](issues/02-close.md) | 1 | spine Deferred row updated with numbers + tripwire; board row 19 done with baselines |

## Definition of done

Every in-shell route loads via the uniform React.lazy idiom (wall + shell stay eager) · before/after build-size report committed in `bundle-report.md` · CI prints the dist listing to the job summary every run · chunkSizeWarningLimit derived from measurement and documented · all gates + e2e green with zero behavioral change (no new e2e specs needed — the suite already exercises a lazy route) · spine + board honest.

## Coordination notes

- Recon: /tmp/synapse-phase3-notes/epic-19-recon.md (route table, existing lazy inventory, measured baseline, NFR-6 wording).
- The measured baseline in the recon came from an untracked `frontend/dist/assets/` build — T1 RE-measures from a clean build and pins it (the recon numbers are orientation, not the record).
- epic-23 (flashcard-motion, owner-commissioned via the other session) is queued after this epic's lane completes; no file overlap expected either way.
- Closed 2026-11-06: the route split delivered −29.5% min / −26.6% gzip off the entry with zero behavioral change (e2e 21 green on the identical tree); vendor manualChunks + skeleton fallback stay consciously deferred (spec decisions 4/6).

## Kickoff delta review — 2026-11-06 (grill round 1 self-answered)

The eight spec decisions carry the rulings; the three with weight:
1. **Uniform lazy** over per-route judgement (decision 1) — one idiom, no special cases; thin hubs' few-KB chunks are noise under HTTP/2.
2. **No vendor manualChunks in v1** (decision 4) — route-splitting is the nominated scope; the residual entry (vendor + 106KB i18n + shell) is recorded honestly and vendor chunking deferred.
3. **Both one-time and permanent measurement** (decision 5) — the epic pins numbers once; the CI step makes every future regression visible; chunkSizeWarningLimit derived from the post-split measurement, not guessed.
