# 03: Plan-level Companion — plan-scope chat + analyze-my-mistakes + /ai-tutor re-point (FR-46)

**What to build:** plan grounding mode on the existing SSE chat op (context = all attached materials, no Reading Position — assembly uses epic-10's mapping for section scoping); answers cite Material + section; intent shortcuts (explain / quiz me / summarize / **analyze my mistakes** — grounding input = mistake-entry id → its source section); surfaces: plan home + empty-state chat; the retained `/ai-tutor` page re-points to this grounding (demo keyword responses retire — delta-grill confirms timing).

**Blocked by:** epic-10-T1 landed (mapping); none in-epic.

**Status:** ready-for-agent

**Bound by:** FR-46 (citations without a document; mistake analysis grounded; /ai-tutor inheritance), AD-16 (one SSE surface — mode, not new endpoint), AD-5 (contract, citation chips as-is).

- [ ] Plan-scope answers cite material+section on fixtures; no-position grounding proven
- [ ] "Analyze my mistake" grounds on the entry's source section (spec)
- [ ] /ai-tutor renders real grounding; intent shortcuts work zh+en
