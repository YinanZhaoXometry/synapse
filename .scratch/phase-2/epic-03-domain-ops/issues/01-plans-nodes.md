# 01: Plans + nodes operations

**What to build:** GraphQL create/read/update for StudyPlan (title, topic/goal, visibility passthrough) and its KnowledgeNodes; **proposal-confirm persistence** — the creation chat's staged node proposal (arriving from epic-05's stream at runtime; here it's just an input payload) confirms into a plan + nodes in one command; plan listing (current user's) + detail with node tree; client-supplied uuid on creates.

**Blocked by:** None (epic gate: epics 01+02 done).

**Status:** ready-for-agent

**Bound by:** AD-12 (thin ops over commands), AD-13 (user-scoped; scoping context inherited), AD-6 (task-nodes: planId set, taskId null).

- [ ] Plan CRUD + list/detail ops; thin resolvers only
- [ ] Proposal-confirm command: payload → plan + nodes, one transaction, idempotent on client uuid
- [ ] Node tree read; every op passes the scoping context (cross-user FORBIDDEN/NOT_FOUND per enum)
- [ ] Mastery-field placement decision recorded in `## Comments` (expose placeholder vs epic-04 adds)
- [ ] Direct-execution RSpec: happy + scoped + failure paths
