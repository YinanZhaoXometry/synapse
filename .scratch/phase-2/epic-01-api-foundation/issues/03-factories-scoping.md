# 03: factory_bot factories + the shared user-scoping RSpec context

**What to build:** factory_bot factories for every entity (sensible graphs: plan→nodes→materials, quiz→questions→evidence, etc.) and the **shared RSpec context** `user-scoped` that every later epic inherits: for each user-owned model it asserts one authenticated user cannot list or fetch another user's rows by id, and that a same-user read succeeds. This context is FR-4's standing test.

**Blocked by:** 02.

**Status:** done

**Bound by:** AD-13 (FR-4's testable consequence — one authenticated user cannot list or fetch another's data by id), AD-10 (factory_bot + colocated RSpec).

- [x] Factory for each entity; factories build valid full graphs without sequences colliding on client-supplied uuids
- [x] Shared context iterates every user-owned model and proves cross-user isolation (read side)
- [x] The context demonstrably fails when a model's scoping is broken (verify once by mutation, then revert)
- [x] Context is one `include` away for epics 02–08 — documented in `backend/AGENTS.md`
- [x] Full api gate suite green via `just spec`

## Comments

For epics 02–08 (and every later backend epic) — how to live with the factories and the scoping context:

**The scoping contract and how to inherit it (AD-13/FR-4):**

- The shared examples `"user-scoped"` live in `backend/spec/support/user_scoping.rb` (auto-loaded by the support glob). Per model they prove: `User#<assoc>` lists **only** the owner's rows · `find_by(id:)` on another user's row → nil · `.find(id:)` → `ActiveRecord::RecordNotFound` · a same-user read succeeds. Four examples per model, currently 13 × 4 = 52.
- **Zero include is the default path.** `backend/spec/models/user_scoping_spec.rb` is the roster keeper: it eager-loads the app (the test env is lazy outside CI), enumerates `ApplicationRecord.descendants - [User]`, and fails with an actionable message if any model (a) lacks `belongs_to :user` + a `user_id` column, or (b) lacks the derived `User` has_many path (`model.name.underscore.pluralize`). Landing a new model needs **no spec edit**: give it the scoping surface above plus a factory named `model.name.underscore` — the roster discovers it and runs the examples against it automatically.
- **One include** is for exotic shapes: in a model spec, `include_examples "user-scoped", described_class` (second arg overrides the has_many name). The shared examples define `let(:user)/:other_user/:own_record/:foreign_record` — be aware of name collisions if the host spec uses the same lets.

**Factory rules (AD-10/AD-12):**

- One file per entity in `backend/spec/factories/`, table-style plural filenames, factory names = `model.name.underscore` (the roster spec's discovery depends on this).
- **NEVER pre-assign uuids in a factory** — every id is filled by the `gen_random_uuid()` server default (the AC's "no client-supplied uuid" posture; a client-supplied id in a test is always an explicit `create(model, id: …)` choice, per the AD-12 idempotent-import contract). Uniqueness comes from exactly one sequence: `users.email` (`user-<n>@synapse.test`).
- **Graphs share the user:** multi-association factories pass `user:` down (`session/node/source_material { association :…, user: user }`), so `create(:question)` builds its whole provenance graph under one owner. Overriding `user:` flows through (the blocks see the override). `mistake_entry.node` follows `question.node` (attribution matches provenance) unless overridden.
- **The task↔node triangle does ticket 02's insert dance:** the `study_task` factory creates material/node with `task_id` null, creates the task, then `after(:create)` back-fills `task_id` on both (unique nullable indexes respected). Don't "simplify" this away — the pair is circular.
- jsonb columns are stamped with TS-verbatim camelCase keys: `materials.sections` ships one sample `MaterialSection` (`sec-1`) that `question.source_section_id`/`section_marking.section_id` reference by slug (string slugs, not uuid FKs — ticket 02 decision); `chat_threads.messages` shows the `ChatMessage` shape (`createdAt` camelCase); `reading_progresses.position` / `mistake_entries.source_location` / `annotations.locator` carry `ReadingLocator`-shaped values (`{kind:"pdf",page}` | `{kind:"markdown",sectionId}`).
- Nulls are left null where the TS shape says nullable: `study_plan.goal`, node `plan_id`/`task_id`, quiz `plan_id`/`task_id`, `question.options`/`correct_option_index`/`keywords`, `flashcard.node_id`/`difficulty`, `mistake_entry.session_id`, evidence `session_id`/`question_id`, `section_marking.cleared_at`, `material.parse_failure_reason`. Enum strings are assigned as values (`kind { "markdown" }`); `evidence_records.outcome` has **no DB default** — its factory supplies `"correct"`.

**Mutation-test evidence (AC 3):** removed `belongs_to :user` from `SectionMarking` and ran the roster spec — 5 failures: the teeth example failed with the model named (`models without user scoping (AD-13): SectionMarking`) and all 4 `SectionMarking` scoping examples failed (the factory's `user:` override becomes an unknown attribute). Reverted immediately (`git checkout --`); the broken state was never committed; full suite re-verified green after revert.

**Gates:** rubocop 106 files, no offenses; rspec **147 examples, 0 failures** (93 pre-existing + 54 new: 2 roster teeth + 13 × 4 scoping examples); `schema.graphql` byte-identical (schema_dump_spec green — still health-only). The api gates were run as the two direct compose forms that the root `justfile` `spec` recipe's backend steps contain verbatim (per the orchestrator's gate instructions, `just spec`'s frontend half — untouched by this epic — is not part of this ticket's verification; epics' `just spec` remains the full-suite entrypoint).

**Roadmap note:** ticket 03 closing unblocks the epic 04/06 lanes (GraphQL surface / first business commands inherit these factories + the context).
