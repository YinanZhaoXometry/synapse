# Epic 6 (Phase 2) — File storage: ActiveStorage → R2, presigned URLs, minio parity

Status: ready-for-agent (spec + tickets 2026-11-03; gate: epic-01 done; owner ticket 3 open from now)
Milestone: Phase 2 — post-deadline

## Parent

[roadmap.md](../roadmap.md) lane C · spine **AD-13** (R2 via ActiveStorage; presigned direct upload; direct-uploads route never mounted; minio dev parity), **AD-20** (envelope; epic-00's deferred minio lands here — A7) · FR-2's upload consequence, NFR-6/7 · [spec.md](spec.md). Must land before epic-08; parallel with 02–05.

## Slices

| # | Ticket | Blocked by | Delivers |
| --- | --- | --- | --- |
| 1 | [01-activestorage-minio-r2.md](issues/01-activestorage-minio-r2.md) | — | ActiveStorage dual-env config (minio dev / R2 prod), compose minio service, `R2_*` ENV |
| 2 | [02-presign-urls.md](issues/02-presign-urls.md) | 1 | `createMaterialUpload` presigned PUT + presigned GET field, route scope guard |
| 3 | [03-owner-r2-provisioning.md](issues/03-owner-r2-provisioning.md) | — (parallel, human-side) | R2 bucket + token + CORS rule + ENV handoff |

## Definition of done

Upload→download round-trips via minio in compose through GraphQL only · no direct-uploads route (guarded) · cross-user URLs unusable · prod config documented for ticket-08 deploy · rubocop+rspec green · every ticket cites AD-13/20.

## Coordination notes

- **Lane C:** fully parallel with 02/03/04/05 after 01 (epic-01). Ticket 3 is owner-side and can complete **any time** — earliest item on the roadmap's owner table.
- Epic-03's material record owns metadata; this epic owns bytes only — no schema overlap beyond the ActiveStorage attachment.
- Epic-08 consumes the presign flow twice: upload re-point + first-login re-attach.

## Kickoff delta review (2026-11-04, standing decide-all delegation — "全部按推荐")

1. **Gem:** `aws-sdk-s3`, floor-pin `~>` at current stable (spine stack table posture); runtime Gemfile group; no other aws-sdk gems (no s3-control/transfer needed for presign).
2. **Service config:** one `storage.yml` shape per env selected by `RAILS_ENV`/ENV — dev `minio` (endpoint `http://minio:9000`, bucket `synapse-materials`, creds from ENV with dev defaults), prod `r2` (endpoint/bucket/creds all ENV, no defaults). No code fork — ActiveStorage service config only.
3. **Compose:** `minio` service (image pinned via the daocloud-mirror retag lesson if Docker Hub DNS pollution recurs; ports 9000 only — no console port published) + an init step creating the `synapse-materials` bucket (mc alias + mb) so `just up` is self-sufficient; healthcheck on `/minio/health/live`.
4. **Routes:** `config.active_storage.draw_routes = false` (never mounted) + a route-table spec asserting the absence — the guard is the spec, not just config.
5. **Blob linkage (T02):** the presign flow owns the object key (`materials/{user_id}/{uuid}.{ext}` convention); the browser PUT targets R2/minio directly; the epic-03 `attachMaterial`/`attach` flow then stores the key on the Material (`storage_key` column? NO schema change without ticket text — T02 decides: ActiveStorage Blob created server-side at presign time (keyed blob) and attached, OR key stored on the material; pick the ActiveStorage-native path: presign mints the Blob + attaches to the Material, so `downloadUrl` = presigned GET of that blob's key. Record the decision in T02 Comments.)
6. **TTLs:** PUT presign 15 minutes; GET presign 5 minutes (short-lived per AD-13). Values in config constants, not literals.
7. **T03 (owner-side):** mark `ready-for-human` (already is), skip implementation tonight; the epic's DoD is satisfied by T01+T02 with minio; R2 provisioning remains the owner's pre-cutover item (documented in the owner to-do list).
8. **`just up` shape:** `up` waits for the api health query as today — minio health is compose-internal; the spec recipe gains nothing (minio not needed for DB-backed rspec — the storage spike/round-trip specs DO need minio, so rspec runs gain `--deps` for the minio service? NO: gate runs use `run` (no --no-deps) which starts ALL services including minio — already the case; verify spike specs pass in the gate form).
