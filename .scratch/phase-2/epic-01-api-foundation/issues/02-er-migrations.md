# 02: The full spine ER as migrations — uuid, user-scoped, Phase-2 structural fields

**What to build:** users table + every spine entity as ActiveRecord models/migrations: StudyPlan (**with `visibility`, default private** — FR-38 structural), KnowledgeNode, Material (metadata + extracted sections/text; no blob columns — bytes are epic-06), StudyTask, QuizSession, Question, EvidenceRecord, Flashcard, MistakeEntry, ChatThread, ReadingProgress, SectionMarking, Annotation. uuid PKs (`gen_random_uuid()` default, client-suppliable on create), `user_id` scoping FK on every user-owned row, timestamps, relations exactly per the spine ER diagram. `strong_migrations` on; plain schema migrations.

**Blocked by:** 01 (command core conventions exist before anything generates Failures about data).

**Status:** ready-for-agent

**Bound by:** AD-13 (the spine ER, no renames; user scoping; strong_migrations; Postgres 17), AD-12 (uuid client-suppliable — idempotency contract), FR-38/FR-16/17 (structural fields land now).

- [ ] All 14 entities migrated, names/relations per the spine ER verbatim — no renames
- [ ] uuid PKs with server default + client-suppliable create path (A2)
- [ ] Every user-owned row carries `user_id`; FKs indexed
- [ ] `study_plans.visibility` default private; `annotations` table present
- [ ] Model specs green (scoping columns, uuid default, visibility default); rubocop clean
- [ ] Field decisions beyond the spine's names+ownership appended under `## Comments` for epics 03/04
