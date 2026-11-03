# 01: ActiveStorage dual-env config — minio dev / R2 prod

**What to build:** `aws-sdk-s3` + ActiveStorage service config selected by ENV (minio endpoint in dev, R2 endpoint in prod); **minio service added to `backend/.dockerdev/compose.yaml`** (completing AD-20's local shape per epic-00 A7); `.env.example` grows `R2_ENDPOINT/BUCKET/ACCESS_KEY/SECRET`; a spike spec proving v4 presign works against minio before anything builds on it (A1).

**Blocked by:** None (epic gate: epic-01 done).

**Status:** ready-for-agent

**Bound by:** AD-13 (R2 prod; minio dev parity), AD-20 (`just up` full shape), AD-17 (compose DX).

- [ ] One service config per env via ENV; no code fork between dev/prod
- [ ] minio in compose; `just up` boots it; spike spec round-trips a PUT/GET against minio
- [ ] `.env.example` + compose carry the storage vars; rubocop clean
