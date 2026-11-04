# 01: Solid Queue install — in-process with puma, direct-URL posture

**What to build:** `solid_queue` gem + `queue_adapter` config + in-process supervisor with puma (Rails 8 pattern; no separate worker service); recurring-jobs config scaffold; prod note: connect via Neon's **direct (non-pooled) URL** (its polling dislikes transaction pooling — AD-19); migrations for queue tables; **no keep-alive loop** (grep-guard + AGENTS note).

**Blocked by:** None (epic gate: epics 01+03 done).

**Status:** done (2026-11-04)

**Bound by:** AD-19 (in-process; DB-backed; direct URL; no keep-alive; cold starts accepted), AD-12 (jobs are thin wrappers).

- [x] Queue runs in-process with puma in compose; one smoke recurring job fires on wake — supervisor + Scheduler registered live (solid_queue_processes), recurring task pinned in solid_queue_recurring_tasks; the job is the REAL scan from boot (no smoke job)
- [x] Queue tables migrated (same Postgres — see Comments); direct-URL posture documented in `backend/AGENTS.md` (Jobs section) + `docs/deploy.md` (checklist)
- [x] No ping/keep-alive code paths — `spec/config/no_keep_alive_spec.rb` (lexical guard over app/config/lib; simplest that works)

## Comments (2026-11-04)

**Same Postgres, not the installer's queue database:** the 1.7 installer defaults to a SEPARATE queue database (`db/queue_schema.rb` + `config.solid_queue.connects_to = :queue`); kickoff decision 4 keeps ONE Postgres via DATABASE_URL, so the schema landed as migration `20261104120000` (verbatim minus force flags), the queue-database artifacts (`bin/jobs`, `queue_schema.rb`) deleted. The gem's bigint internals stay — infrastructure, not spine entities (its queries pin these shapes; AD-13 governs domain rows). FKs follow the house two-step (`20261104120001` add NOT VALID → `20261104120002` validate; `20261104090015`'s precedent). Note for the next person: `strong_migrations` fires even on brand-new empty tables, and `validate_foreign_key`'s second argument is the **target table** (`:solid_queue_jobs`), not a column.

**Adapter scoping:** `:solid_queue` in development.rb + production.rb only — test env keeps its default adapter AND rspec never loads config/puma.rb, so the supervisor is doubly excluded from test runs. Compose sets `SOLID_QUEUE_IN_PUMA: "1"` at service level (run containers inherit it; inert — the gate lives in puma.rb).

**The recurring job is the real one from boot** (kickoff decision 6): `config/recurring.yml` → `due_scan: Requeue::ScanJob, every 10 minutes` — no throwaway smoke job. The upstream `clear_solid_queue_finished_jobs` default was dropped as unnamed work (AD-19's one-named-job rule). Live proof: SolidQueue-1.7.2 registered Supervisor(fork)/Dispatcher/Worker/Scheduler in the puma process, and `solid_queue_recurring_tasks` pins `due_scan | every 10 minutes | Requeue::ScanJob | t`.

**Deploy facts** (`docs/deploy.md` now carries the checklist): set `SOLID_QUEUE_IN_PUMA=1` on the web service; `DATABASE_URL` must be Neon's DIRECT (non-pooled) string. `queue.yml` (dispatcher/worker threads) is kept at installer defaults.
