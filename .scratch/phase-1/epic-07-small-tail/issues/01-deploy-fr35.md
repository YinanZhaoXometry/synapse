# T1: Public deployment — Cloudflare Pages (FR-35; AD-11)

Status: ready-for-human
Milestone: Phase 1 — Nov 6 core
Blocked by: —

## Parent

[Epic 7](../epic.md) (scale-ladder row 1 — no spec chain, implement directly from this ticket).

## What to build

Deploy the static build to a shareable public URL. The vendor is **already decided** — AD-11 (2026-11-03): Cloudflare Pages, `_redirects` SPA fallback, auto-deploy from `main`, no env vars, no server, no warm-up (NFR-6). The Phase-2 envelope (Render/Neon/R2, AD-20) does not apply yet — this ticket is the static frontend only.

Mechanics: `vite build` (run the binary at `node_modules/.bin/vite build` — repo is a pnpm layout; npm/npx break) → Pages project connected to `github.com/YinanZhaoXometry/synapse`, build command `vite build`, output dir `dist`, `_redirects` file (`/*  /index.html  200`) committed at repo root so client-side routes survive hard refresh. Pushing to `main` redeploys (note: local main is currently 1 ahead of origin — push `fc90586` first).

## Acceptance criteria

- [ ] App reachable at a public https URL from a device without the dev server
- [ ] Hard refresh on a deep route (e.g. `/read/<id>`, `/plans`, `/settings`) renders the app, not a 404 (SPA fallback verified)
- [ ] First-run entry state works on a fresh browser profile; `synapse-db:v1` + language/theme keys persist across reload in the same browser (live-demo persistence contract)
- [ ] No env vars or host-specific config required to build (AD-11); dev port 8080 / localhost references never leak into the bundle — [x] verified repo-side 2026-11-03: `vite build` ran clean with zero env vars; `dist/` grep for `localhost:8080` / `http://localhost` / `127.0.0.1` all empty (only benign hits: a Node polyfill error-message constant containing "localhost", and React's build hash `f1338f8080`)
- [x] Deploy + rollback path written down (one short section — README is still the Lovable stub; put it in `docs/` or README's real section, not a gist) — [docs/deploy.md](../../../../docs/deploy.md)
- [x] Gates green after any repo changes this ticket makes (`node_modules/.bin/tsc -b`, `node_modules/.bin/eslint .`, `node_modules/.bin/vitest run`) — tsc exit 0; eslint 0 errors (10 pre-existing react-refresh warnings in scaffold contexts, untouched); vitest N/A — no code touched (config/docs/static only)

## Comments

- 2026-11-03 — Ticket pre-created with the epic's coupling map; FR-35 has zero coupling to epics 5/6, so this is the one epic-7 piece deliberately done early (deploy risk should surface before Nov 6, and every later epic just redeploys).
- 2026-11-03 — **Repo-side done (T1 implementer).** Everything the repo can deliver is in: `public/_redirects` (`/*  /index.html  200`) → confirmed lands as `dist/_redirects` after `vite build`; [docs/deploy.md](../../../../docs/deploy.md) covers the AD-11 decision, owner click-through, rollback, redeploy-by-push. Committed on `epic/7/T1-deploy`. **Owner must (one-time, ~2 min):** Cloudflare dashboard → Workers & Pages → Pages → Connect to Git → `YinanZhaoXometry/synapse` → build command `vite build`, output dir `dist`, no env vars → Save and Deploy → then verify on the `*.pages.dev` URL: app loads, hard-refresh a deep route (`/plans`, `/settings`) renders, fresh-profile first-run + persistence. The three unchecked ACs above are all live-site checks and stay owner-pending. **Ticket corrections:** (1) `_redirects` goes in `public/`, not repo root — Vite copies `public/*` into `dist/`, and Pages reads it from the output dir; (2) the "push `fc90586` first" note is stale — `main` (83b0048) is already in sync with `origin/main`.
