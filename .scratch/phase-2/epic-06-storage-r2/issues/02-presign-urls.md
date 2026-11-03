# 02: `createMaterialUpload` presigned PUT + presigned GET field

**What to build:** `createMaterialUpload(filename, contentType, size, materialId)` mutation returning a presigned PUT URL (minutes TTL) the browser PUTs to directly; Material's `downloadUrl` GraphQL field minting a short-lived presigned GET per request (never persisted); blob metadata linked to the epic-03 material record; scope guard: the ActiveStock direct-uploads REST route never mounted.

**Blocked by:** 1.

**Status:** ready-for-agent

**Bound by:** AD-13 (presign pattern verbatim; downloads as GraphQL fields), AD-12 (mutation → command → Result), AD-13 scoping (cross-user → no usable URL).

- [ ] Round-trip spec via minio: presign → PUT → GET field serves bytes; TTL expiry honored
- [ ] Route-table spec asserts no `direct-uploads` route
- [ ] Cross-user presign attempts rejected; size/type validation with typed Failures
- [ ] schema.graphql + codegen green
