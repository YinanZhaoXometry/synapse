# 01: Measure + split + tripwire — the entry stops carrying every route

**What to build:** a pinned before/after build-size report, every in-shell route on the uniform React.lazy idiom, a data-derived `chunkSizeWarningLimit`, and a permanent CI step that prints the dist listing to the job summary. Zero behavioral change.

**Blocked by:** None (epic gate; starts when epic-18 is merged to main).

**Status:** done (2026-11-06; landed on `epic/p3-19-bundle-split`: d42eaa8 BEFORE report · 7cf53c1 uniform route split · 578c4b0 framer-motion removal (epic-23 handoff) · 2488778 AFTER report + chunkSizeWarningLimit 800 · 8783b12 CI dist-summary step; gates green — codegen zero-diff / tsc / eslint / vitest 920 / build / e2e 21)

**Bound by:** decisions 1–8 of the spec (uniform lazy incl. thin hubs; wall + shell eager; NO manualChunks; gzip+ls reporting — zero new deps; inline `fallback={null}` idiom), NFR-6 (zero new deps), the coverage-summary CI precedent (`ci.yml:77-98`).

- [ ] Baseline report FIRST: clean `vite build` from the un-modified tree → per-chunk minified + gzip sizes (`gzip -k` + `ls -l` over `dist/assets`) → `.scratch/phase-3/epic-19-bundle-split/bundle-report.md` created with the BEFORE table (this file is ticket-scoped: T1 creates it, the close ticket references it)
- [ ] `App.tsx`: every currently-static in-shell route → `React.lazy(() => import(...))` + the existing inline `Suspense fallback={null}` idiom (wall: `/`, `/login`, `/register`, NotFound — stays eager; `AppLayout` stays eager; lazy trio already in place stays as-is)
- [ ] Post-split clean build → AFTER table in `bundle-report.md` (same columns; entry delta + the largest new route chunks called out)
- [ ] `chunkSizeWarningLimit` set from the measured post-split entry (ceil to a sane ceiling, ~10% headroom; derivation documented in the config comment)
- [ ] CI step in `.github/workflows/ci.yml` frontend job (after Build, mirroring the coverage-summary pattern): dist assets listing → `$GITHUB_STEP_SUMMARY`; keep it shell-builtins only
- [ ] `pnpm remove framer-motion` + lockfile regen (epic-23's handoff — spec decision 7 amendment; zero source imports exist, verify with grep); `recharts` stays (import site lives in the scaffold's chart.tsx — noted, not removed)
- [ ] Gates: codegen zero-diff (no schema change) · `tsc -b` · eslint · vitest ≥ 920 · `vite build` · the full e2e suite green (21 specs — no new ones; the suite already rides a lazy route)
- [ ] web gates green is the review artifact; the report diff tells the story

## Comments

- (none yet)
