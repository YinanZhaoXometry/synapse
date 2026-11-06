# 02: Generation-backed Today suggestion — persisted row + cap-honest mutation

**What to build:** an explicit, cap-counted, replay-safe AI generation that proposes one "study next" node for a plan with a one-line reason, persisted and re-readable all day for free; the heuristic v1 slot untouched.

**Blocked by:** None (independent of 01).

**Status:** ready-for-agent

**Bound by:** AD-16 (server-side AI through the adapter seam; ONE SSE surface stays; STREAM_OPS does not grow), the cap law (every provider call counts against 50/day), decisions 7–11 of the spec (addition-not-replacement; never-on-load; deterministic per-(plan, UTC-day) replay uuid; persisted row; honest failures), AD-12 (command skeleton, closed enum), GenerateStudyFocusCommand/GenerateNoteCommand as the family shape.

- [ ] Migration: `today_suggestions` (uuid pk, `user_id` FK indexed, plan uuid, node uuid, `reason` text null:false, `client_uuid` unique, `day` date null:false, timestamps); schema re-dumped; the model gets `belongs_to :user` + the factory named per convention — the user-scoping roster auto-discovers it (run the roster spec to confirm)
- [ ] `Ai::GenerateTodaySuggestionCommand`: input = plan id + deterministic client uuid (uuid5 over a user-scoped namespace + planId + UTC date — the exact derivation pinned in a unit spec); replay-before-spend — owned uuid returns the persisted suggestion with ZERO provider calls and ZERO cap consumption; gate → VALIDATION_FAILED honestly; zero usable nodes (no non-mastered node with a confirmed mapping) → INTERNAL with an honest message; CAP_REACHED passes through; context assembly server-side from the plan's weakest non-mastered nodes + open mistakes (title-only leak discipline per the existing prompt patterns); ONE provider call; reply parsed to `{nodeId, nodeTitle, reason}` validated against the plan's actual nodes (unresolvable node in reply → drop to the weakest-node fallback? NO — INTERNAL honest per decision 9: an unusable AI reply fails honestly, v1 stays as fallback client-side)
- [ ] GraphQL: mutation returning the suggestion view (planId, nodeId, nodeTitle, reason, day); NO change to `todayHub` (the v1 heuristic rides verbatim, its specs must pass untouched)
- [ ] Request + lib specs: deterministic-uuid derivation; replay returns the persisted row with zero cap consumption (assert the cap counter unchanged); first generation consumes exactly 1; CAP_REACHED passthrough; INTERNAL on zero-usable; foreign plan → NOT_FOUND; user-scoping; todayHub specs untouched-green
- [ ] api gates green (rubocop + full rspec; baseline must grow)

## Comments

- (none yet)
