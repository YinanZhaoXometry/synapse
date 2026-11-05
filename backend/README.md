# Synapse api (backend/)

The Rails 8.1 API-only GraphQL service. **Its real documentation is [`AGENTS.md`](AGENTS.md)** — the architecture contract (command-layer-first, closed error enum, scoping roster, dev-container gates) and the surface inventory live there; this file is only a pointer.

- Dev containers: `just up` (postgres 17 + api on :3000) from the repo root; `just dev` for the web dev server (:8080).
- Gates: `just spec` (web gates, then `rubocop` + `rspec` in dev containers).
- Cross-stack contract: the committed [`schema.graphql`](schema.graphql) — the frontend's `pnpm run codegen` consumes it verbatim (CI freshness-gates both sides).
