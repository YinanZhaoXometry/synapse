# T1 — Plan-scoped chat threads (backend)

Milestone: Phase 2 — post-deadline
Status: ready-for-agent
Epic: epic-25-tutor-thread-tails
Blocked by: —

## AC

1. Migration (strong_migrations discipline, two-step where the floor demands):
   `chat_threads` gains nullable uuid `plan_id`; `material_id` relaxes to nullable;
   CHECK constraint `chat_threads_one_scope` enforces exactly-one of
   material_id/plan_id; unique index on `plan_id` (the material_id unique index stays
   — multiple NULLs are legal in PG). schema.rb regenerated.
2. `ChatThread` model: `belongs_to :plan, optional: true`, `belongs_to :material,
   optional: true` + a model-level scope validation mirroring the CHECK.
3. `Chat::AppendMessageCommand` gains `plan_id` option: exactly-one of material_id /
   plan_id (both/neither → VALIDATION_FAILED with field: :scope); plan addressed
   through `current_user.plans` (foreign/malformed → NOT_FOUND, delta-2 posture);
   thread created on first append with the same SAVEPOINT race backstop as the
   material path.
4. Query: NEW field `planChatThread(planId: String!): ChatThread` (chatThread stays
   frozen); foreign/unknown plan → null, honest-empty (NOT the material thread).
5. Mutation: `appendChatMessage` — material_id required→optional, plan_id optional
   added; command's exactly-one rule is the gate.
6. schema.graphql committed; rubocop + full rspec green; the new surface has command +
   request specs (race backstop included) and the integration walk stays green.
7. Check the op-roster guards (epic-12's op_check DB floor / architecture guard) —
   widen them for the new op instead of letting them pin the old count.
