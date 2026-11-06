# 03: Materials hub re-point — server rows replace demo data (frontend-only)

**What to build:** `/materials` renders the user's real materials from `useAllMaterialsQuery` — server-truth meta, kind filter, real scope chips, working Open, honest upload pointer. The demo-data import dies on this page.

**Blocked by:** None (independent of 01/02; T4 does not touch this page).

**Status:** done (2026-11-06; landed on `epic/p3-18-hub-tails`: e963366 — server rows replace the demo fixture)

**Bound by:** decision 1–3 of the spec (read/open/filter only; demo columns die with nothing faked back; real scope chips hidden when unresolvable), NFR-6 (zero new deps), i18n-mandatory, the api-layer conventions (`frontend/src/api/index.ts` header), the AD-8 reader deep-link paths MistakesPage already uses.

- [ ] Codegen fresh (no schema change expected this ticket — `useAllMaterialsQuery` already exists; run `pnpm run codegen` and commit zero-diff)
- [ ] `MaterialsPage` re-pointed: `useAllMaterialsQuery` feeds the list (loading/error+retry/empty states per the hub-page conventions MistakesPage uses); every row renders wire truth — title, `kind` (pdf/markdown icon+label from existing keys), formatted `sizeBytes`, `createdAt` date, `parseState` chip with `failed` emphasized + `parseFailureReason` surfaced (title/hover)
- [ ] Filter row re-built: kind filter (all / pdf / markdown) replaces the course/notes/exam tags; search keeps title matching; empty state honest (server-empty vs filter-empty)
- [ ] Real scope chip per row: plan/task title via `usePlansQuery`/`useTasksQuery` label lookups (MistakesPage pattern); unresolvable → chip hidden (never raw ids); `attachmentScope`/node linkage display-only
- [ ] Open → the existing reader deep link (`/read/:materialId` — reader owns parse state); upload button → honest pointer CTA to attach-in-plan (reworded i18n; no upload flow on the hub)
- [ ] The `MATERIALS`/`TAG_IDS` demo import is GONE from the page (grep-clean); `demo-data.ts` itself stays (other consumers may exist — check; only the page's dependency dies)
- [ ] i18n: every new/changed key `{zh, en}` in the dictionary; dead keys of the demo era removed
- [ ] Vitest: the page moves onto the Apollo stub harness (`@/test/apollo-harness`, wire-shaped fixtures) — server rows render, kind filter, search, scope chips (resolvable + hidden), failed-parse surfacing, empty/error states, upload pointer; the old demo-fixture pins retire; architecture guard stays green
- [ ] web gates green (codegen zero-diff, tsc, eslint, vitest ≥ 875 baseline grown, build)

## Comments

- (none yet)
