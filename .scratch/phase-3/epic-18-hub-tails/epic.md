# Epic 18 (Phase 3) — hub tails: Materials server backing, mistake lifecycle, generation-backed Today suggestions

Status: done (closed 2026-11-06; five tickets landed on `epic/p3-18-hub-tails` @ 2cbef6f + the T5 close-out (71a12b5 e2e · ca0fbcb spine); final baselines: rspec 1452 · vitest 917 · e2e 21 passed + the opt-in visual smoke; spine §6.2 survivor rows consumed — Materials hub SHIPPED, Hub state-field tails annotated with the targeting-bonus epic-21 deferral)
Milestone: Phase 3 — optimization season

## Parent

[roadmap.md](../roadmap.md) row 18 · closes the §6.2 survivor rows of the spine Deferred table (Materials hub server backing + Hub state-field tails) · ADR-0001 + AD-6/14 (evidence-only; the fence asserted untouched) · AD-12 (command-layer, client-supplied uuid, closed error enum) · AD-16 (server-side AI, one SSE surface — this epic adds NO stream op) · AD-17 (schema + codegen in the same change) · [spec.md](spec.md).

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-mistake-lifecycle.md](issues/01-mistake-lifecycle.md) | — | `mistake_entries.resolved` + SetMistakeEntryResolvedCommand + GraphQL mutation/read fields (lifecycle data half) |
| 2 | [02-today-suggestion-generation.md](issues/02-today-suggestion-generation.md) | — | `today_suggestions` table + GenerateTodaySuggestionCommand (replay/cap-honest) + mutation (generation half; independent of T1) |
| 3 | [03-materials-hub-repoint.md](issues/03-materials-hub-repoint.md) | — | `/materials` re-pointed to `useAllMaterialsQuery` — server rows, kind filter, real scope chips, honest parse-failure surfacing (frontend-only; independent of T1/T2) |
| 4 | [04-lifecycle-and-suggestion-ui.md](issues/04-lifecycle-and-suggestion-ui.md) | 1, 2 | MistakesPage resolve toggle + filter; PlannerPage on-demand AI suggestion card with cap-honest states |
| 5 | [05-e2e-and-close.md](issues/05-e2e-and-close.md) | 3, 4 | e2e for server-live flows, dual-theme smoke, spine rows closed/annotated, board + baselines |

## Definition of done

Materials hub renders only server rows (demo-data imports gone from the page) · parse failures visible on rows · mistake entries resolvable both ways with ownership scoping and replay idempotence · targeting bonus provably unchanged (spec + spine annotation) · Today heuristic specs pass untouched · AI suggestion costs at most one cap-counted call per (plan, UTC day), never on load, and fails honestly while v1 stays · codegen fresh both stacks · `just spec` + new e2e green · baselines recorded on the board.

## Coordination notes

- T1 and T2 are independent backend tickets (serial lane regardless — single-implementer cadence).
- The 16-node/e2e harness is untouched except T5's additions; the suggestion generation is AI-gated and stays e2e-uncovered by convention.
- Guards to respect: architecture.guard.test.ts (frontend), no_keep_alive_spec.rb + user-scoping roster (backend auto-covers `today_suggestions` once the model has `belongs_to :user` + factory).
- Close-out (T5, 2026-11-06): e2e 19 → 21 passed — `frontend/e2e/hub-tails.spec.ts` covers the two server-live flows (materials hub server row + reader deep link; mistake resolve toggle surviving reload and driving the open/reviewed filter both ways); NO new stub-provider prompt shape (the T2 suggestion stays AI-gated/uncovered, asserted nowhere in e2e). Live browser smoke (bundled Chromium, real stack): /materials + /mistakes + /planner across light+dark, dark twilight, reduced motion — 12 screenshots outside the repo, self-reviewed clean (dark/reduce-motion html classes + twilight `--grad-a` re-tint verified per state; the 「生成 AI 建议」 trigger rendered but stayed unclicked). Honest caveats: theme/palette/motion pinned via ThemeContext's localStorage contract, not Settings clicks; the planner's suggestion slot needed one confirmed mapping seeded directly on the worktree dev DB (`mapMaterialSections` is AI-gated — not drivable on the stub); the browser storage PUT rides the shared main-stack minio (host 3000/9000 held — the worktree stack remaps to 13000/19000 via a /tmp compose override, but storage.yml pins the presigned host `minio:9000`, which resolves to the shared minio: same dev creds, same bucket, CORS default-open). Gates: rspec 1452 / vitest 917 (baselines held exactly — nothing grew, nothing broke) / codegen zero-diff / mastery-vector anti-drift green / rubocop / tsc / eslint / build / e2e.

## Kickoff delta review — 2026-11-06 (grill round 1 self-answered; owner may veto any line asynchronously)

Grounded in the recon notes (main @ 1bc23de). Decisions 1–12 in the spec carry the rulings; the
three with real weight:

1. **Upload-from-hub rejected** (decision 1) — attach needs a plan/task owner + client-side
   extraction; PlanHome owns the UX. The hub becomes the library view; upload is a pointer.
2. **Targeting bonus stays any-entry** (decision 5) — epic-10-T5's revisit hook gets an explicit
   ruling instead of a silent ride-along: the lifecycle flag is display-only this epic; the
   open-only quota variant is deferred to epic-21 where targeting behavior changes are measured.
   Spine row annotated at T5.
3. **Today = generation-backed ADDITION with a never-on-load spend rule** (decisions 7–10) —
   explicit button, deterministic per-(plan, UTC-day) replay uuid, persisted row, v1 card as the
   permanent fallback. The «AI 建议» card deep-links the exact nodeId consumer shape epic-10-T5
   documented.
