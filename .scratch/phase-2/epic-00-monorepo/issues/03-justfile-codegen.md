# 03: Root justfile (`setup · dev · up · spec`) + web codegen against the api contract

**What to build:** one root entrypoint orchestrates both stacks — a session starts with `just setup`, frontend work is `just dev`, the api stack is `just up`, and `just spec` runs *every* gate for both stacks and exits nonzero on any failure. Web's graphql-codegen consumes the api-committed schema and emits typed output, proving the contract→client pipeline end-to-end before any real query exists.

**Blocked by:** 01 (web layout exists), 02 (api stack + schema exist).

**Status:** done 2026-11-03 — 4875eb0+ad04861 (merged 651a39a) + review fixes f7d610f..96eb1ea, merged into epic/p2-0-monorepo (main merge post-Nov-6)

**Bound by:** AD-17 (just targets, no shared package, schema.graphql as the only contract), AD-18 boundary note (codegen is compile-level only — no runtime GraphQL client, that's the cutover epic).

- [x] `just setup`: web package install + api dev image build/pull
- [x] `just dev`: web Vite only (the api has no web-facing behavior until cutover — deliberate, A7-adjacent)
- [x] `just up`: compose postgres + api; health query answers afterwards
- [x] `just spec`: web gates + api gates in one command; a forced failure in either stack makes it exit nonzero
- [x] Every web-invoking target calls the pnpm toolchain — no bare `npm`/`npx` anywhere in the justfile (A4)
- [x] `codegen` script in web emits typed output against the api schema with zero errors; generated output location is gitignored or clearly generated
- [x] minio absent (A7 — joins with the ActiveStorage/R2 epic)
