# 03: First-login import — one-shot idempotent synapse-db:v1 upload + re-attach invite

**What to build:** post-first-login offer: read `synapse-db:v1` → upload the whole document via **one idempotent mutation** (client-supplied uuids; id owned by another user → `VALIDATION_FAILED`; same-user conflicts skipped; retry safe — the api command's home per kickoff delta-review); then the **re-attach invite**: for each material with no blob, offer re-upload through epic-06 presign matched by id; PDFs never re-attached render text-only thereafter; the local document is **never deleted** (AD-20's rollback substrate).

**Blocked by:** 2.

**Status:** done (2026-11-04, merged `bad9dc6` — backend 775 / web 428 green; review pending the epic's pre-merge pass)

**Bound by:** AD-15 (import contract verbatim), AD-4 (the document's shape is the contract — read it, don't transform it), AD-13 (re-attach via presign).

- [ ] Real-document round-trip: a populated Phase-1 localStorage doc imports; replay = no-op success
- [ ] Ownership-conflict path shows a bilingual error, never a silent link
- [ ] Re-attach flow: presign → PUT → material renders with original file; skipped → text-only PDF path verified
- [ ] Import never deletes/renames local keys (asserted)
