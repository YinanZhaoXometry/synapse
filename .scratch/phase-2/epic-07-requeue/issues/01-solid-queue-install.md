# 01: Solid Queue install — in-process with puma, direct-URL posture

**What to build:** `solid_queue` gem + `queue_adapter` config + in-process supervisor with puma (Rails 8 pattern; no separate worker service); recurring-jobs config scaffold; prod note: connect via Neon's **direct (non-pooled) URL** (its polling dislikes transaction pooling — AD-19); migrations for queue tables; **no keep-alive loop** (grep-guard + AGENTS note).

**Blocked by:** None (epic gate: epics 01+03 done).

**Status:** ready-for-agent

**Bound by:** AD-19 (in-process; DB-backed; direct URL; no keep-alive; cold starts accepted), AD-12 (jobs are thin wrappers).

- [ ] Queue runs in-process with puma in compose; one smoke recurring job fires on wake
- [ ] Queue tables migrated; direct-URL posture documented in `api/AGENTS.md` + deploy doc
- [ ] No ping/keep-alive code paths (grep-guard spec or rubocop custom cop — simplest that works)
