# 02: Square public read path — the AD-13 exception, structurally leak-proof

**What to build:** public-plan GraphQL surface: `squarePlans` listing (topic, stage/node summary) + `squarePlan(id)` preview — a **reduced type set** with no material/annotation/score fields at all; a dedicated public scope context (no current_user required for reads, but reads touch only public rows); authenticated-by-anyone semantics documented; listing ordered per delta-grill (v1 simple).

**Blocked by:** 1.

**Status:** ready-for-agent

**Bound by:** AD-13 (the single sanctioned exception; structure only — NFR-7), FR-39 (listing by structure, not content).

- [ ] Reduced types literally lack content fields (schema-level assertion spec)
- [ ] Private plans absent from list + direct-id preview (404-shaped)
- [ ] Visibility flip propagates immediately (no cache staleness server-side)
