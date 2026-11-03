# Synapse

A bilingual (中文/English) AI-powered study web app — the COMP5241 (Software Engineering, PolyU) course project. The brand stays "Synapse" in Chinese contexts too: 「Synapse」没有中文译名.

**The concept in one paragraph:** Synapse is plan-first. The system gives you a study plan — never content: you attach your own materials, and the plan's knowledge nodes organize what you study. Progress is measured by an evidence-based **Mastery Score** (0–100% per node/plan; 100% = exam/interview readiness) that only moves when you prove recall through a confirm quiz — marking a node is a claim, the quiz is the evidence. Quizzes (open-ended, choice, or mix) are generated strictly from your materials, in flow, by AI. A daily Today hub (今日学习) aggregates what's due; flashcards, mistakes, and an AI tutor for page-aware reading round out the loop.

## Repo structure

Monorepo (two apps, one contract, one entrypoint):

| Path | What it is |
| --- | --- |
| `frontend/` | The Vite SPA — React 18 + TypeScript + shadcn/ui + Tailwind 3, Vitest tests |
| `backend/` | The Rails 8.1 API-only service (GraphQL) — minimal bootable scaffold; see `backend/AGENTS.md` |
| `justfile` | Root orchestrator: `just setup · dev · up · spec` |
| `docs/` | Product brief + PRD, UX, architecture spine (AD-1…20), ADRs, agent handbooks |
| `.scratch/` | Local issue tracker (specs + tickets per epic) |

The only cross-stack contract is the api-committed `backend/schema.graphql`, consumed by frontend's graphql-codegen.

## Quickstart

Prerequisites: **Node 24.22** (nvm — `frontend/.nvmrc`), **pnpm 10** (the only lockfile is `frontend/pnpm-lock.yaml`), **Docker** (Docker Desktop or colima) for the backend containers, and **just**.

```bash
just setup   # install web deps (pnpm frozen) + build/pull the api image
just dev     # web dev server → http://localhost:8080
just up      # api stack (compose: postgres 17 + api) → api on http://localhost:3000
just spec    # all gates: web (tsc · eslint · vitest · build) + api (rubocop · rspec)
```

Per-stack commands, the pnpm/nvm toolchain gotchas, the localStorage key inventory, and the architecture map live in [AGENTS.md](AGENTS.md) (the real project handbook). Backend conventions and stack pins: [backend/AGENTS.md](backend/AGENTS.md).

## Documentation

- [AGENTS.md](AGENTS.md) — commands, conventions, gotchas (start here; written for humans and agents alike)
- [GLOSSARY.md](GLOSSARY.md) — the engineering vocabulary (EvidenceRecord, Knowledge Node, Mastery Score, …)
- `docs/product/` — the approved brief and final PRD
- `docs/architecture/` — the architecture spine with stable decision IDs (AD-1…20)
- `docs/deploy.md` — Cloudflare Pages deployment (SPA, `_redirects` fallback)
