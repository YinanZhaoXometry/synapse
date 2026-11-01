# docs/architecture/

BMAD architecture spine from `/bmad-architecture`: module boundaries, dependency rules, state-mutation and shared-data ownership — each decision carrying a stable ID. First run: [architecture-synapse](architecture-synapse/architecture-synapse.md) (frontend-only, static-first build; final, 2026-11-02) — backend dimensions deliberately deferred with adapter seams.

Consumer rule: `/to-tickets` must reference spine decision IDs; implementation contradicting a spine decision is surfaced, never silent. `docs/adr/` (see [docs/agents/domain.md](../agents/domain.md)) remains the home of `/domain-modeling` decisions — surface conflicts between the two. See [docs/agents/workflow.md](../agents/workflow.md).
