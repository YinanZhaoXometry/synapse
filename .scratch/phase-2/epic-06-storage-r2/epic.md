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
