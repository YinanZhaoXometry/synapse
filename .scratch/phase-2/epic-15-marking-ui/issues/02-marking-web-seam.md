# 02: Marking web seam — operation documents, codegen, typed hooks

**What to build:** the typed api seam over the marking ops: a `frontend/src/lib/graphql/section-markings.graphql` document file (query `SectionMarkings` + mutations `ClaimSection` / `UnclaimSection`, following the per-file header convention of `quiz.graphql`), run `pnpm run codegen` (committed `src/types/graphql.ts` regenerates), then hooks in `frontend/src/api/queries/`:

- `useSectionMarkingsQuery(materialId)` — copies `useMaterialNodeMappingsQuery` (`mapping-queries.ts:24-26`): `{ data: SectionMarkingView[] | undefined, loading: loading && !data, error, refetch }`.
- `useClaimSectionMutation()` / `useUnclaimSectionMutation()` — raw Apollo tuples; refetch sweep declared on the hook (sweep `SectionMarkings` for the material).
- Map server rows → the dormant `SectionMarking` domain interface (`domain/entities.ts:194-200`) — wire it, extend it only if a field is genuinely missing (record any extension).

**Blocked by:** 01 (the read op must be in the committed schema before codegen sees it).

**Status:** done (2026-11-06 — implementer subagent + inline two-axis review PASS/PASS; merged to the integration branch)

**Bound by:** AD-18 (the hooks layer is the ONLY route features touch domain data), AD-12 (client uuid via `newClientUuid()` at call sites where a uuid input exists — note: ClaimSectionInput has none, only `clientMutationId`; leave it unset unless a call site needs it), AD-14 (no mastery fields here — nothing to recompute), honest-empty loading posture.

- [x] Document file + regenerated `src/types/graphql.ts` committed (freshness gate will diff it in CI).
- [x] Hooks barrel-exported from `src/api/queries/index.ts` (and `src/api/index.ts` if that's the house export path — match `mapping-queries.ts` exactly).
- [x] Mapper + view types in `src/api/mappers.ts` / `src/api/views.ts` (or reuse domain `SectionMarking` directly if that's the closer precedent — match how `mapMaterialNodeMapping` does it).
- [x] Vitest: mapper round-trip (claimedAt/clearedAt DateTime-as-string per codegen scalar config; open vs cleared derivation) + a hook smoke test if the house has a precedent for query-hook tests (match `mapping-queries` test coverage — if it has none, a mapper test suffices; do not invent a new test harness pattern mid-night).
- [x] Frontend gates green in the ticket worktree: `pnpm install --frozen-lockfile` first (fresh checkout), then codegen, `tsc -b`, eslint, `vitest run`, `vite build` — via `frontend/node_modules/.bin/*` direct calls, pnpm only, never bare npm/npx/node.
- [x] No backend files touched.

## Comments

- **Assigned 2026-11-06** (night run, epic-15, after 01 merges to the integration branch).

- **Two-axis review (2026-11-06, inline):** PASS/PASS — compliance: all ACs landed (doc + regenerated committed codegen output +47 lines marking-only, stable across two runs; hooks barrel via `src/api/index.ts` — verified there is no `queries/index.ts`; mapper round-trip + 3 hook smokes; five gates green: codegen / tsc -b exit 0 / eslint 0 errors 15 pre-existing warnings / vitest 814 (807+7) / vite build). Contract: honest-empty posture exact (`loading && !data`); refetch sweep declared on the hooks (house pattern, sweep verified by a real read-back smoke); server order preserved, never re-sorted; dormant `SectionMarking` wired with zero field extension (`SectionMarkingView` = alias); no `clientMutationId` minted (inputs carry none); AD-14 clean — no mastery fields touched. Verified directly: `UnclaimSectionPayload.sectionMarking` exists (schema.graphql:4897+), doc selections valid. Decisions recorded: fragment form per per-file convention; first `src/api/mappers.test.ts` (colocated house shape, MockedProvider precedent exists — `node-row.test.tsx`). tsbuildinfo regen committed per A6.
