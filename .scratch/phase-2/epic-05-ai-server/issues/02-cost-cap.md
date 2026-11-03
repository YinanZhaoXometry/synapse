# 02: Per-user daily cost cap at the adapter boundary

**What to build:** counter (user-day rows, A1) incremented on **every** provider call including stream restarts; enforcement before the call: >50/day → `CAP_REACHED` Failure; per-request context-in bound ~8k tokens (truncate assembly deterministically, never silently mis-ground); values in server config + `.env.example`.

**Blocked by:** 1.

**Status:** ready-for-agent

**Bound by:** AD-16 (cap at the AI adapter boundary; 50/day + ~8k set per NFR-4), AD-12 (CAP_REACHED from the closed enum), FR-34.

- [ ] Boundary specs: 49→50→CAP_REACHED; day rollover; restart double-count (deliberate)
- [ ] Context truncation deterministic + tested at the bound
- [ ] Config values overridable via ENV; documented
