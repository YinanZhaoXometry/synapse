# 03: Close — spine touch row shipped, board row done

**What to build:** the honest record.

**Blocked by:** 1, 2.

**Status:** done (2026-11-07)

**Bound by:** scope exception: THIS ticket edits `.scratch/phase-3/` + the ONE spine touch row ("Touch pinch-zoom on the roadmap canvas", architecture-synapse.md ~L351) only.

- [x] Spine touch row → shipped (epic-20, 2026-11-06/07): pinch continuous-within-clamp midpoint-anchored + two-finger pan + drawer swipe-to-close; keyboard contract untouched; recorded honestly (no Playwright touch project — vitest two-pointer sequences carry the coverage, the real-Chromium smoke carries the gesture fidelity)
- [x] Board: row 20 State → **done** (closed 2026-11-07; baselines: vitest 949 · e2e 21 @ workers=2 · touch smoke 2/2; rspec untouched — zero backend files; branch `epic/p3-20-touch-batch`); epic.md Status → done + close-out note; tickets → done
- [x] Live browser smoke: canvas pinch + drawer swipe on the real stack — **2/2 PASS** (desktop Chrome, CDP touch + mouse-pointer; NOT a physical device — honest caveat):
  - pinch: continuous zoom (k>1.2 after a 100→200px spread, not stepped), contract zoom back within the clamp, midpoint-anchor property holds (pan + c·k ≈ midpoint)
  - node tap after a completed pinch opens the sheet (the T1 capture fix verified — pointerdown capture would have retargeted the click)
  - drawer: swipe past min(40%·w, 120) dismisses (aria-expanded tracks); sub-threshold springs back; nav-link tap closes + navigates (the T2 capture fix verified)
  - twilight + dark mode + reduce-motion: data-motion rides the panel, the spring is instant (no transition), swipe still dismisses
  - **smoke catch #3 (app fix)**: the entrance animation replayed when a post-swipe tap cleared the spring-back posture — the panel teleported off-screen and ate the pointerup; fixed (`swipedOnceRef`) + vitest-pinned
  - fidelity notes: CDP touch ends synthesize pointercancel (canvas maps cancel = gesture end); a simultaneous two-point touchStart ran as a one-finger drag (fingers land sequentially); swipe/tap legs ride the mouse pointer (same pointer pipeline + capture semantics); a mouse drag STARTING on a drawer link triggers a native link drag (touch devices never do this)
- [x] Full web gates green (codegen zero-diff; tsc; eslint; vitest 949; build 717.67 kB index < 800 tripwire; e2e 21 passed @ workers=2 — CI-equivalent parallelism; rspec untouched asserted: zero backend files in the epic diff)

## Comments

- 2026-11-07: the e2e run's isolation recipe (owner's demo stack live on this machine, and host :3000 is an unrelated ssh tunnel): worktree-local gitignored `backend/.dockerdev/compose.override.yaml` (compose project `synapse-t20e2e`, api on :13000, minio :19000, gems read-only from the retired `synapse-t19a_bundle-cache`, image pinned `synapse-t19a-backend` — backend/ byte-identical on this branch) + a throwaway Vite proxy override to :13000 (untracked `frontend/vite.e2e-override.config.ts`, deleted after the run). Playwright reuses whatever answers on :8080.
- 2026-11-07: the smoke spec itself was throwaway (spec decision 7 keeps the hasTouch project out) — verdicts recorded here, file deleted after the run.
