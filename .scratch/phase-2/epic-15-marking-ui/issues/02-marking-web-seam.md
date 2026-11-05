# 02: Marking web seam — operation documents, codegen, typed hooks

**What to build:** the typed api seam over the marking ops: a `frontend/src/lib/graphql/section-markings.graphql` document file (query `SectionMarkings` + mutations `ClaimSection` / `UnclaimSection`, following the per-file header convention of `quiz.graphql`), run `pnpm run codegen` (committed `src/types/graphql.ts` regenerates), then hooks in `frontend/src/api/queries/`:

- `useSectionMarkingsQuery(materialId)` — copies `useMaterialNodeMappingsQuery` (`mapping-queries.ts:24-26`): `{ data: SectionMarkingView[] | undefined, loading: loading && !data, error, refetch }`.
- `useClaimSectionMutation()` / `useUnclaimSectionMutation()` — raw Apollo tuples; refetch sweep declared on the hook (sweep `SectionMarkings` for the material).
- Map server rows → the dormant `SectionMarking` domain interface (`domain/entities.ts:194-200`) — wire it, extend it only if a field is genuinely missing (record any extension).

**Blocked by:** 01 (the read op must be in the committed schema before codegen sees it).

**Status:** ready-for-agent (pending 01)

**Bound by:** AD-18 (the hooks layer is the ONLY route features touch domain data), AD-12 (client uuid via `newClientUuid()` at call sites where a uuid input exists — note: ClaimSectionInput has none, only `clientMutationId`; leave it unset unless a call site needs it), AD-14 (no mastery fields here — nothing to recompute), honest-empty loading posture.

- [ ] Document file + regenerated `src/types/graphql.ts` committed (freshness gate will diff it in CI).
- [ ] Hooks barrel-exported from `src/api/queries/index.ts` (and `src/api/index.ts` if that's the house export path — match `mapping-queries.ts` exactly).
- [ ] Mapper + view types in `src/api/mappers.ts` / `src/api/views.ts` (or reuse domain `SectionMarking` directly if that's the closer precedent — match how `mapMaterialNodeMapping` does it).
- [ ] Vitest: mapper round-trip (claimedAt/clearedAt DateTime-as-string per codegen scalar config; open vs cleared derivation) + a hook smoke test if the house has a precedent for query-hook tests (match `mapping-queries` test coverage — if it has none, a mapper test suffices; do not invent a new test harness pattern mid-night).
- [ ] Frontend gates green in the ticket worktree: `pnpm install --frozen-lockfile` first (fresh checkout), then codegen, `tsc -b`, eslint, `vitest run`, `vite build` — via `frontend/node_modules/.bin/*` direct calls, pnpm only, never bare npm/npx/node.
- [ ] No backend files touched.

## Comments

- **Assigned 2026-11-06** (night run, epic-15, after 01 merges to the integration branch).
