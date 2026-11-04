# 03: `dueItems` query + dev/demo force-due trigger

**What to build:** `dueItems(date)` GraphQL query returning the day's due reviews (mistake entries + flashcards) with their source locations and study-flow links (plan/task/material ids — enough for epic-09's Today hub to deep-link); a dev-only force-due trigger (rake task or dev-gated mutation) so demos show re-queue without waiting days.

**Blocked by:** 2.

**Status:** done (2026-11-04)

**Bound by:** AD-13 (user-scoped query — scoping context), FR-24/FR-23 (due items pulled from the Notebook/decks), FR-27 (the shape Today consumes — link fields per the FR).

- [x] Query answers per user, per date; scoping context green
- [x] Force-due trigger exists dev-only (never prod-exposed — guard asserted)
- [x] Response shape reviewed against FR-27's task-list pattern; notes in Comments for epic-09

## Comments (2026-11-04)

**dueItems shape (FR-27's task-list pattern — notes for epic-09):** `dueItems(date): [DueItem!]!` — `date` defaults to now, **inclusive window** (`next_due_at <= day_end`, UTC day boundary matching the streak): an overdue item is still due, so the Today list never silently drops forgotten reviews; ordered by `next_due_at` asc. Each item: `itemType` ("mistake" | "flashcard" — the discriminator), `itemId`, `dueAt`, `stage`, `title` (question prompt / card front — what the row renders), and the deep-link set: `nodeId` → `planId`/`taskId` (through the node's AD-6 columns), `materialId` (the mistake's question's source material / the deck's material), `questionId` + `sourceLocation` (mistakes only; **the type guards per item type are load-bearing** — flashcards have neither column, an unconditional delegation NoMethodErrors the item). Rows whose source was deleted between scans are skipped live (they prune on the next wake).

**Read posture:** a sanctioned bare read (scoping IS the logic — the owner's `requeue_schedules` scope, CurrentUserGuard), no command. Scale note: the polymorphic schedulable resolves per row (small per-user lists; a Dataloader source is the obvious upgrade if a hub ever paginates — deliberately not preempted, AD-12).

**Force-due:** `requeue:force_due[email]` (lib/tasks/requeue.rake) — flips all of one user's schedules to due now; guarded to development/test (`abort` in production), pinned by spec (production env raises SystemExit). The rake form needs no schema surface (kickoff decision 9).

**Contract:** schema.graphql grew by DueItem + dueItems only; codegen green (gitignored output, AD-18's client consumes at cutover).
