# 03: Owner-side R2 provisioning (bucket, token, CORS)

**What to build (owner, human-side — can be done any time from now):** create the R2 bucket (e.g. `synapse-materials`); create a scoped access token; set the bucket's CORS rule to allow PUT+GET from the web origin (the Cloudflare Pages domain, and `http://localhost:8080` for dev against local minio — note: local dev uses minio, so the R2 rule needs only the prod origin); hand the ENV values back for `R2_*`.

**Blocked by:** None (parallel; no code dependency).

**Status:** ready-for-human

**Bound by:** AD-13 (R2 + its own CORS allowlist), AD-20 (envelope).

- [ ] Bucket exists; token scoped to it
- [ ] CORS rule recorded in the deploy doc (rule JSON pasted under `## Comments` here)
- [ ] ENV values delivered (not committed) — `.env.example` names only
- [ ] Ticket closes epic-06's owner dependency for the cutover window
