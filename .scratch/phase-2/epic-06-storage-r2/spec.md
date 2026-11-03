# Spec: Epic 6 (Phase 2) — File storage: ActiveStorage → R2, presigned URLs, minio parity

Status: ready-for-agent
Milestone: Phase 2 — post-deadline

> Authored 2026-11-03 in the Phase-2 batch pass (see [roadmap.md](../roadmap.md)). Grounded in final
> AD-13/20. Gate: epic-01 done (models only). Runs as lane C, parallel with 02/03/04/05; must land
> before 08. Its owner ticket (R2 provisioning) can run **any time from now**.

## Problem Statement

Material files cannot live on Render's ephemeral disk (AD-13): original files need object storage on Cloudflare R2, while extracted sections/text already persist in Postgres (epic-03). The upload path must be presigned-direct-to-R2 (browser PUTs to R2, never through the api), downloads must be short-lived presigned GETs exposed as GraphQL fields, and the ActiveStock direct-uploads REST route must never be mounted. Local dev needs the same S3 API shape (minio) so the cutover's upload flow is testable offline — this also completes AD-20's `just up` shape (epic-00's A7 deliberately deferred minio to here).

## Solution

1. **Storage plumbing (ticket 1):** ActiveStorage configured to R2 via `aws-sdk-s3` (endpoint, bucket, credentials from ENV); a **minio service added to `.dockerdev/compose.yaml`** + dev config pointing ActiveStorage at it — same S3 API, local/prod parity per AD-13/20; `.env.example` grows `R2_*`.
2. **Presigned surface (ticket 2):** `createMaterialUpload` mutation → R2 presigned PUT (browser PUTs directly; R2 carries its own CORS allowlist for the web origin); Material's download URL exposed as a GraphQL field returning a **short-lived presigned GET**; original file → R2, extracted text stays Postgres (epic-03 unchanged). Direct-uploads REST route never mounted (scope guard).
3. **Owner provisioning (ticket 3, ready-for-human now):** create the R2 bucket + access token, set the bucket CORS rule for the web origin (PUT + GET), hand back the ENV values.

## User Stories

1. As the cutover (epic-08), uploads/downloads round-trip via presigned URLs against minio locally and R2 in prod — one code path.
2. As a learner, my 20 MB lecture PDF goes browser → R2 without transiting the api (NFR-6-friendly, cheap).
3. As the owner, no api route ever accepts a file body — bandwidth + memory stay flat.
4. As the first-login import (08), re-attaching original files reuses this exact presign flow.

## Implementation Decisions

- One ActiveStorage service per environment (minio dev / R2 prod) selected by ENV — not a code fork.
- Presign TTLs short (minutes); GET URLs minted per request, never persisted.
- Blob metadata (filename, size, content type) rides the epic-03 material record; ActiveStorage holds the bytes.
- The R2 CORS rule is owner-side config documented in ticket 3 (same pattern as the CF Pages re-point).

## Testing Decisions

- Request-specs against **minio in compose**: createMaterialUpload returns a working PUT URL; the presigned GET field round-trips after a PUT; expiry honored.
- Scope guard: assert no `direct-uploads` route exists in the api's route table.
- Cross-user: another user's material yields no usable URL (scoping context).
- Gates: rubocop + rspec (compose-dependent specs marked, skipped gracefully without compose).

## Out of Scope

Web upload UI re-point (08 — client PUT wiring) · first-login re-attach flow (08) · PPT bytes (13 — client-side parse extension) · IndexedDB anything (dead per the Deferred table).

## Further Notes

- Assumption A1: presign via aws-sdk-s3 signing against R2's endpoint (S3-compatible v4) — proven in ticket 1's spike spec before wiring mutations.
- Owner ticket 3 unblocks nothing until ticket 2's code exists, but doing it early removes the last human-side item before the cutover window (roadmap owner table).
