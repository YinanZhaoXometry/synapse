# 03: factory_bot factories + the shared user-scoping RSpec context

**What to build:** factory_bot factories for every entity (sensible graphs: plan→nodes→materials, quiz→questions→evidence, etc.) and the **shared RSpec context** `user-scoped` that every later epic inherits: for each user-owned model it asserts one authenticated user cannot list or fetch another user's rows by id, and that a same-user read succeeds. This context is FR-4's standing test.

**Blocked by:** 02.

**Status:** ready-for-agent

**Bound by:** AD-13 (FR-4's testable consequence — one authenticated user cannot list or fetch another's data by id), AD-10 (factory_bot + colocated RSpec).

- [ ] Factory for each entity; factories build valid full graphs without sequences colliding on client-supplied uuids
- [ ] Shared context iterates every user-owned model and proves cross-user isolation (read side)
- [ ] The context demonstrably fails when a model's scoping is broken (verify once by mutation, then revert)
- [ ] Context is one `include` away for epics 02–08 — documented in `api/AGENTS.md`
- [ ] Full api gate suite green via `just spec`
