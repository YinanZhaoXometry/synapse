# 02: DAG layout — deterministic swimlane layout, typed edge data, creation-flow wiring (FR-5 layout half)

**What to build:** the frontend speaks the new structure end to end. Plan creation carries the AI proposal's node metadata and title-paired edges onto the create input (resolving titles to the client-supplied node ids, dropping what doesn't resolve); the typed hooks layer exposes edges + node metadata as domain views; and a pure deterministic layout engine turns (nodes, edges) into swimlane columns with orthogonal elbow routes — with the epic-10 derived-sequence behavior kept as the fallback for zero-edge legacy plans.

**Blocked by:** 1.

**Status:** ready-for-agent

**Bound by:** NFR-6 (zero new dependencies — this is a pure-function module in the plans feature, the epic-10 layout module pattern), AD-14 (layout consumes server states; computes geometry only), grill decisions 4–6 (stage-forward edges, title-paired on the wire, no stored positions).

- [ ] Codegen types regenerated; the typed hooks layer exposes plan edges + node `description`/`optional` on the domain views (conventions of the api layer header respected)
- [ ] Creation flow: proposal schema (types) gains node metadata + title-paired edges; title→id resolution at the existing flatten seam — duplicate-title and unresolvable pairs dropped deterministically client-side (mirrors the server's authority; creation never blocked)
- [ ] Layout engine (pure, deterministic, byte-identical output pinned): stages as swimlane columns ordered by stage position; within-column ordering by barycenter of inbound edge sources, ties by node id; orthogonal elbow polyline routes between column ports; geometry pinned no-overlap at 16 nodes
- [ ] Legacy fallback: a zero-edge plan renders the current derived-sequence edge set (present-day behavior, selected per-plan by edge presence)
- [ ] Vitest: layout suite (determinism, per-column no-overlap, barycenter ordering incl. tie-break, elbow endpoints, 16-node fixture, empty input, legacy fallback) + creation-flow resolution tests (drop rules mirrored)
- [ ] web gates green (codegen freshness, tsc, eslint, vitest, build)

## Comments

- (none yet)
