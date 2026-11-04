# 02: `createMaterialUpload` presigned PUT + presigned GET field

**What to build:** `createMaterialUpload(filename, contentType, size, materialId)` mutation returning a presigned PUT URL (minutes TTL) the browser PUTs to directly; Material's `downloadUrl` GraphQL field minting a short-lived presigned GET per request (never persisted); blob metadata linked to the epic-03 material record; scope guard: the ActiveStock direct-uploads REST route never mounted.

**Blocked by:** 1.

**Status:** done (2026-11-04)

**Bound by:** AD-13 (presign pattern verbatim; downloads as GraphQL fields), AD-12 (mutation → command → Result), AD-20 (presigned URLs keep the api's web surface GraphQL-only — they point at the provider, never the backend), AD-13 scoping (cross-user → no usable URL).

- [x] Round-trip spec via minio: presign → PUT → GET field serves bytes; TTL expiry honored
- [x] Route-table spec asserts no `direct-uploads` route
- [x] Cross-user presign attempts rejected; size/type validation with typed Failures
- [x] schema.graphql + codegen green

## Comments (2026-11-04)

**Blob linkage — the ActiveStorage-native path (kickoff choice 5):** the server mints the Blob NOW (`createMaterialUpload`), owning the object key (`materials/{user_id}/{uuid}{ext}`; extension from the VALIDATED content type, never the client filename), and attaches it to `Material.original` (`has_one_attached`) in the same call — no write-back, no callback, no `storage_key` column. `downloadUrl` = presigned GET of that blob's key. The key never travels to the client as data: it rides the blob, the payload carries only `uploadUrl` / `materialId` / `expiresAt`.

**Presign mechanics:** one construction site — the `Storage` module seam (`presigned_put_url` / `presigned_get_url` over `ActiveStorage::Blob.service.client.client`, the spike spec's exact seam) — shared by the command (PUT, `UPLOAD_PRESIGN_TTL_SECONDS = 900`) and the `MaterialType.downloadUrl` field (GET, `DOWNLOAD_PRESIGN_TTL_SECONDS = 300`), constructed per call. The blob row is the direct-upload builder's shape minus checksum validation (a raw browser PUT carries none; the column allows null) and marked `identified`/`analyzed` up front — the attach path would otherwise try to download the first 4 KiB that don't exist yet.

**Migration correction (picked up mid-flight):** ticket 01's tables landed via the installer migration, whose `primary_and_foreign_key_types` reads `config.generators' primary_key_type` — unset in this app on purpose (spine tables pin uuid per-migration), so `active_storage_attachments.record_id` defaulted to **bigint**, silently truncating every Material uuid on attach (`"3cee05a0-…" → 3`). Pinned to `[:uuid, :uuid]` and **schema.rb re-dumped** — the committed schema.rb was the bigint version's cache. Discovery note for future migrations: `db:migrate` on an empty database **loads schema.rb wholesale instead of running migrations** (and test-env `db:create` + `db:migrate` therefore loaded the stale bigint schema); a changed-but-same-version migration is invisible until the schema cache is regenerated.

**Expiry proof (no sleeps beyond 2s):** the command carries a `upload_ttl_seconds` injection seam; the minio round-trip spec drives it to 1s, lets real time lapse, and expects the provider's `403 Request has expired` — same for the GET seam behind `downloadUrl`. The "never persisted" property is pinned structurally (nothing `X-Amz`-shaped on the blob row); same-second presigns legitimately produce identical URLs, so per-request minting is pinned by usability, not byte inequality.

**Gates:** rubocop clean (239 files at the ticket pass); rspec 607/607 (was 568 — +15 command, +8 request, +3 round-trip; the auth-surface example was edited in place, +26 total); schema_dump byte-identity green; web codegen regenerates against the new IDL (output gitignored — the AD-18 client consumes it at the Apollo cutover). CI's minio service container + loopback hosts mapping landed with ticket 01 and covers the minio-tagged specs.
