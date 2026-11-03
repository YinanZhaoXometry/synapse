# 06: Deploy the envelope + rehearse the rollback

**What to build:** api on **Render** (docker, single web process; Solid Queue in-process if epic-07-T1 landed — coordinate flag), **Neon Postgres 17** (direct URL for the queue), CORS = web origin only (GraphQL + SSE), full ENV set from `.env.example`, demo seed run; CF Pages untouched (pre-login surface stays static, NFR-6); docs/deploy.md rewritten for the two-stack envelope incl. the **pre-demo paid-upgrade window** posture (AD-20); then the **rollback rehearsal**: redeploy the last pre-cutover commit on Pages, verify the anonymous build resumes from the still-present `synapse-db:v1`, document the runbook.

**Blocked by:** 1, 2, 3, 4, 5.

**Status:** ready-for-agent (owner-side: Render/Neon accounts + R2 values in hand — roadmap owner table)

**Bound by:** AD-20 (envelope verbatim; no keep-alive; demo-window upgrade), AD-15 (demo account seeded), AD-11 (Pages SPA fallback unchanged).

- [ ] Live stack: health query + login + one real plan round-trip over HTTPS from the Pages origin
- [ ] SSE + GraphQL CORS exactly the web origin (probe from a foreign origin fails)
- [ ] Cold-start behavior observed + documented (~1 min posture)
- [ ] Rollback rehearsal executed + runbook in docs/deploy.md; `synapse-db:v1` intact post-rehearsal
