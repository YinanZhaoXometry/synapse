# 01: Roadmap data model — prerequisite edges + node metadata on the wire (FR-5 data half)

**What to build:** the server can express plan structure. Creating a plan persists prerequisite edges alongside nodes (AI-expressed, server-validated), nodes carry a one-line description and an optional flag, forks and the demo seed carry the structure faithfully, and all of it is readable over GraphQL. After this ticket, a plan's true dependency graph exists as data — the graph UI still renders the old way until T2/T3.

**Blocked by:** None (can start immediately — pre-flight satisfied 2026-11-06: PR #16 `3f55e1b` landed; cut `epic/p3-16-roadmap` from a clean main).

**Status:** ready-for-agent

**Bound by:** FR-5 (structure-faithful graph), AD-12/13 (command layer, closed error enum — no new error values: invalid edges degrade, never reject), ADR-0001 + AD-6/14 (edges carry no progress semantics — evidence-only), the ≤16-node cap (grill decision 3).

- [ ] Migration: `knowledge_node_edges` (uuid pk, plan, from-node, to-node, timestamps; unique [from, to]) + `knowledge_nodes.description` (nullable) + `knowledge_nodes.optional` (default false); schema re-dumped; strong-migrations discipline honored
- [ ] Validation rules at plan creation, each pinned by a request spec: edge endpoints must be member nodes (else drop), source stage index strictly < target's (else drop — makes cycles impossible by construction), dedupe [from, to]; drops are silent-but-logged, creation never blocked by an invalid edge
- [ ] GraphQL surface: node `description`/`optional` readable; the plan read exposes its edges (endpoint id pairs); the plan-create input accepts per-node `description`/`optional` + id-paired `edges`; committed schema + codegen freshness green
- [ ] AI proposal prompt upgraded: `stages[].nodes[{title, description, optional}]` + `edges[[fromTitle, toTitle]]`; constraints — ≤16 nodes, unique titles requested, edges forward-only, every non-first-stage node ≥1 inbound edge; prompt fixture spec updated (no live AI in tests)
- [ ] Plan fork copies edges alongside nodes; demo seed's plan gains a truthful edge set (every node described, ≥1 optional node)
- [ ] api gates green (rubocop + rspec, new examples counted into the baseline)

## Comments

- (none yet)
