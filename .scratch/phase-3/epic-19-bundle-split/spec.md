# Spec: Epic 19 (Phase 3) — bundle split: measure, split the routes, wire the tripwire

Status: ready-for-agent
Milestone: Phase 3 — optimization season

> Authored 2026-11-06 under the standing decide-all delegation (grill round 1 self-answered from
> recon: /tmp/synapse-phase3-notes/epic-19-recon.md). Owner nomination 2026-11-06 — the spine
> Deferred trigger ("if demo load time hurts") is overridden by the batch nomination. Gate: epic-18
> merged (serial lane).

## Problem statement

The entry chunk is **~982 KiB minified** (measured 2026-11-06, pre-gzip) and carries every route
except the already-lazy reader/task trio — the 520KB-source plans feature (graph canvas included),
both quiz surfaces, flashcards, companion, and every retained hub all load before first paint of
any page. Vite has no `build` block at all: no size visibility anywhere (CI, justfile, docs —
nothing has ever recorded a bundle number), and the 500 KiB chunk warning fires ungated.

## Solution — two tickets

1. **T1 measure + split + tripwire:** pin the baseline build-size report in the epic record; move
   every in-shell route to the existing `React.lazy` + inline `Suspense fallback={null}` idiom;
   pin the post-split report next to it; lower `chunkSizeWarningLimit` to a data-derived soft
   tripwire; add a permanent CI step printing the dist assets listing to `$GITHUB_STEP_SUMMARY`
   (the coverage-summary precedent); all gates + e2e green.
2. **T2 close:** spine Deferred row updated with the measured numbers + the live tripwire; board
   row 19 done with baselines.

## Implementation decisions (grill round 1 — self-answered)

1. **All in-shell routes go lazy, uniformly** (plans family, quiz/flashcards quartet, ai-tutor,
   dashboard, materials, quiz, flashcards, mistakes, planner, achievements, analytics, settings,
   square, onboarding, plan/new — everything currently static inside the shell). Uniformity beats
   per-route judgement: one idiom, no "why is this page special" trail. The thin hubs cost a few
   KB of chunk requests each — negligible under HTTP/2 — and every route already has direct
   vitest coverage, so no coverage vehicle changes.
2. **The wall stays eager:** `/`, `/login`, `/register`, NotFound render pre-auth — the pre-login
   static fast path is NFR-6's actual posture (AD-15/AD-20); do not lazy the wall.
3. **The shell stays eager:** AppLayout (CommandPalette/cmdk, the api barrels) is on every
   in-shell route — lazy-ing it would waterfall every navigation.
4. **No manualChunks vendor split in v1.** The entry's residual weight after route-splitting is
   vendor (apollo/radix/lucide) + the 106KB i18n dictionary + shell — real, but vendor chunking is
   a caching optimization, not a loading-order fix, and the nominated scope is route-level
   splitting. The post-split report records what remains; a vendor split is a consciously deferred
   follow-up if the numbers ever disappoint (spine note at T2).
5. **Measurement = both one-time and permanent.** T1 pins the before/after report in the epic
   record (minified + gzip sizes per chunk; `gzip -k` on the built assets is enough — no
   rollup-plugin-visualizer, zero new deps) AND adds the permanent CI step (dist assets listing →
   `$GITHUB_STEP_SUMMARY`, mirroring the coverage-summary step). `chunkSizeWarningLimit` is set
   from the measured post-split entry (round up to a sane ceiling, ~10% headroom; document the
   derivation in the config comment) — it warns, it gates nothing.
6. **Suspense idiom = the existing inline `fallback={null}`** (ReaderPage/TaskCreate/TaskHome
   precedent). A shared skeleton fallback is design work and a deferred candidate, not scope.
7. **Dead deps: framer-motion is REMOVED (amended 2026-11-06 at epic-23's handoff); recharts
   stays.** epic-23's memory explicitly hands the framer-motion residue to this epic ("留给
   epic-19 删") — the motion epic is pure CSS and wants the unused dep gone so nobody is tempted
   back onto it. Removal = `pnpm remove framer-motion` + lockfile regen (zero bundle effect — it
   was already absent from dist; this is hygiene-by-handoff, not bundle work). `recharts` STAYS:
   its import site lives in the scaffold's `src/components/ui/chart.tsx` (ui/* is generated-code
   territory); noted once in the epic record as a future hygiene candidate.
8. **NFR-6 unchanged:** zero new dependencies (the size report uses gzip + ls; the CI step uses
   shell built-ins).

## Testing decisions

- The e2e suite already exercises lazy routes (`/task/new` is lazy today, 5 specs ride it) and the
  dev-server harness loads chunks on demand — **no new e2e specs**; the existing 21 must stay
  green (the route split changes only HOW pages load, not what they render).
- Vitest: no suite renders the full App route tree (auth-wall imports RequireAuth only) — route
  lazy-ing is vitest-invisible; the existing suites stay green untouched. If any test breaks on a
  lazy boundary it gets the same inline-Suspense treatment the app uses.
- Gates: web full set green (codegen zero-diff — no schema change; tsc/eslint/vitest ≥ baseline/
  build); e2e green; the before/after report + CI step diff are the review artifacts.

## Out of scope

- Vendor manualChunks; skeleton/loading-shell fallbacks; dead-dep pruning; prerender/SSG
  experiments; per-route prefetch tuning; any server-side change.

## Further notes

- Baseline numbers and the post-split report live in `epic-19-bundle-split/bundle-report.md`
  (T1 creates it; the epic record references it from the board row).
- Spine update at T2: the Deferred row gains the measured numbers + "tripwire live (CI step +
  chunkSizeWarningLimit)" + the consciously deferred vendor-split follow-up.
