# 01: Plan visibility flows — Public/Private (FR-38)

**What to build:** visibility set at plan creation (default Private) + changeable afterwards (plan settings surface, bilingual); the flip immediately governs the Square read path (T2 consumes); flipping to Private removes the plan from Square listings.

**Blocked by:** None (epic gate: 08 done).

**Status:** ready-for-agent

**Bound by:** FR-38 (changeable; private removes from Square; public = structure only — NFR-7 enforced downstream in T2), AD-13 (user-scoped writes).

- [ ] Set-at-create + change ops; scoping context green
- [ ] UI affordance on plan settings with clear structure-only disclosure (zh+en)
- [ ] Flip behavior asserted at the model/query level (not just UI)
