# 03: Root justfile (`setup · dev · up · spec`) + web codegen against the api contract

**What to build:** one root entrypoint orchestrates both stacks — a session starts with `just setup`, frontend work is `just dev`, the api stack is `just up`, and `just spec` runs *every* gate for both stacks and exits nonzero on any failure. Web's graphql-codegen consumes the api-committed schema and emits typed output, proving the contract→client pipeline end-to-end before any real query exists.

**Blocked by:** 01 (web layout exists), 02 (api stack + schema exist).

**Status:** ready-for-agent

**Bound by:** AD-17 (just targets, no shared package, schema.graphql as the only contract), AD-18 boundary note (codegen is compile-level only — no runtime GraphQL client, that's the cutover epic).

- [ ] `just setup`: web package install + api dev image build/pull
- [ ] `just dev`: web Vite only (the api has no web-facing behavior until cutover — deliberate, A7-adjacent)
- [ ] `just up`: compose postgres + api; health query answers afterwards
- [ ] `just spec`: web gates + api gates in one command; a forced failure in either stack makes it exit nonzero
- [ ] Every web-invoking target calls the pnpm toolchain — no bare `npm`/`npx` anywhere in the justfile (A4)
- [ ] `codegen` script in web emits typed output against the api schema with zero errors; generated output location is gitignored or clearly generated
- [ ] minio absent (A7 — joins with the ActiveStorage/R2 epic)
