# T1: Public deployment — Cloudflare Pages (FR-35; AD-11)

Status: ready-for-agent
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
- [ ] No env vars or host-specific config required to build (AD-11); dev port 8080 / localhost references never leak into the bundle
- [ ] Deploy + rollback path written down (one short section — README is still the Lovable stub; put it in `docs/` or README's real section, not a gist)
- [ ] Gates green after any repo changes this ticket makes (`node_modules/.bin/tsc -b`, `node_modules/.bin/eslint .`, `node_modules/.bin/vitest run`)

## Comments

- 2026-11-03 — Ticket pre-created with the epic's coupling map; FR-35 has zero coupling to epics 5/6, so this is the one epic-7 piece deliberately done early (deploy risk should surface before Nov 6, and every later epic just redeploys).
