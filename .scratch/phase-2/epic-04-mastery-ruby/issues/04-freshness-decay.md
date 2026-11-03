# 04: Freshness/decay layer — ADR-0001 amendment (separable, may slip)

**What to build:** NFR-8's decay/freshness rule: propose values + rationale as an **ADR-0001 amendment** (docs/adr/ conventions — surface, don't silently pick), extend the vector generator with decay cases, implement in the Ruby module, prove fixture parity. Ships as one change (amendment + vectors + Ruby). If values aren't ready, this ticket slips without holding the epic or the cutover (v1 = no decay, identical to Phase 1).

**Blocked by:** 2.

**Status:** needs-info (decay values are an owner-visible product choice — present the amendment options at kickoff; standing delegation applies if unanswered)

**Bound by:** AD-6/14 (values live in ADR-0001, both implementations agree), NFR-8 (decay rule), OQ-9 residual (Phase-2 freshness).

- [ ] ADR-0001 amended with values + rationale (dated reversal note per doc conventions)
- [ ] Vectors extended (decay boundaries both directions); Ruby parity exact
- [ ] Slip path documented: ticket re-gated at epic-09 kickoff (Analytics is the first consumer)
