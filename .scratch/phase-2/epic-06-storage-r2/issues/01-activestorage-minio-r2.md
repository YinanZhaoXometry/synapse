# 01: ActiveStorage dual-env config — minio dev / R2 prod

**What to build:** `aws-sdk-s3` + ActiveStorage service config selected by ENV (minio endpoint in dev, R2 endpoint in prod); **minio service added to `backend/.dockerdev/compose.yaml`** (completing AD-20's local shape per epic-00 A7); `.env.example` grows `R2_ENDPOINT/BUCKET/ACCESS_KEY/SECRET`; a spike spec proving v4 presign works against minio before anything builds on it (A1).

**Blocked by:** None (epic gate: epic-01 done).

**Status:** done

**Bound by:** AD-13 (R2 prod; minio dev parity), AD-20 (`just up` full shape), AD-17 (compose DX).

- [x] One service config per env via ENV; no code fork between dev/prod
- [x] minio in compose; `just up` boots it; spike spec round-trips a PUT/GET against minio
- [x] `.env.example` + compose carry the storage vars; rubocop clean

## Comments

**Commits:** 2a37b29 (engine require + route guard + gem) · e953198 (storage.yml + env selection + config spec) · 56151c7 (compose minio + ENV contract + spike spec). Gates: rubocop 232 files / 0 offenses (baseline 229 + 3 new spec files); rspec **581/581** (baseline 568 + 10 config/route-guard + 3 spike). `schema.graphql` byte-identical (constraint held; schema_dump spec green). Deviation from kickoff choice 6: none — TTLs are ticket 02 scope.

**Gem:** `aws-sdk-s3 ~> 1.237.0` — current stable on rubygems.org verified 2026-11-04 (1.237.0); runtime default group; floor pin per the spine stack table posture (Gemfile.lock holds the exact version). No other aws-sdk gems (ActiveStorage's S3Service itself does `require "aws-sdk-s3"`).

**storage.yml shape** (`backend/config/storage.yml`, one file, both shapes; env files are the only fork):

```yaml
minio:                      # development.rb / test.rb → :minio
  service: S3
  endpoint: http://minio:9000
  bucket: synapse-materials
  access_key_id: <%= ENV.fetch("R2_ACCESS_KEY_ID", "synapse-dev") %>
  secret_access_key: <%= ENV.fetch("R2_SECRET_ACCESS_KEY", "synapse-dev-password") %>
  region: us-east-1
  force_path_style: true
r2:                         # production.rb → :r2
  service: S3
  endpoint: <%= ENV["R2_ENDPOINT"] %>            # all four plain ENV[...] — no defaults
  bucket: <%= ENV["R2_BUCKET"] %>
  access_key_id: <%= ENV["R2_ACCESS_KEY_ID"] %>
  secret_access_key: <%= ENV["R2_SECRET_ACCESS_KEY"] %>
  region: auto
  force_path_style: true
```

Design notes: (a) the `:r2` section must be *nil-safe* rather than raising `ENV.fetch` — the engine parses the WHOLE file whenever the blob class first loads (incl. CI eager load), so a raising fetch would kill dev/test boots; the fail-fast lives in `production.rb` instead (raises at prod boot listing the missing var). (b) `force_path_style: true` on **both** services (kickoff pinned only minio's): keeps one addressing style across dev/prod so ticket 02's presigned-URL shape is identical everywhere; R2 supports path style. (c) `config.active_storage.draw_routes = false` in application.rb + `spec/routes/active_storage_route_guard_spec.rb` (route-table scan, named-routes check, blob-url-helper absence, unroutable classic blob URL) — landed red→green (4 failing examples while routes were drawn). Ticket 02 re-asserts per its ticket text.

**Compose diff** (`backend/.dockerdev/compose.yaml`):

- `minio`: pinned `minio/minio:RELEASE.2025-10-15T17-29-55Z` (latest non-prerelease GitHub release; minio's community distribution is archived as of late 2025 — this is the final one), `command: server /data`, **port 9000 only** (console unexposed), volume `minio-data`, healthcheck `curl -f http://localhost:9000/minio/health/live` (verified in-image: the release Dockerfile ships minio + mc + **static curl** on ubi9-micro; `mc ready local` does NOT work — the entrypoint never seeds a `local` alias).
- `minio-init`: one-shot service (same image), `mc alias set local http://minio:9000 … && mc mb --ignore-existing local/synapse-materials`, `restart: "no"`; runs once per stack creation, idempotent.
- `backend.depends_on`: db healthy + **minio healthy + minio-init service_completed_successfully** — `just up` boots the full shape; the health-query poll is unchanged (verified `{"data":{"health":"ok"}}`).

**Image pin + mirror note (epic-00 lesson recurred, harder):** direct `docker pull minio/minio:…` → `pull access denied` (registry-1.docker.io polluted — valid auth.docker.io token still gets 401 on manifest HEAD); daocloud (docker + quay variants), 1ms, dockerproxy, nju, sjtu, gcr mirror, xuanyuan, huawei, baidu, 1panel all 403/404/TLS-fail for `minio/minio` (daocloud serves `library/` only). Workaround that produced the local image: `git clone --branch RELEASE.2025-10-15T17-29-55Z` → `GOTOOLCHAIN=auto GOPROXY=https://goproxy.cn,direct CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build` (minio + mc), then a local Dockerfile mirroring `Dockerfile.release`'s layout (minio + mc + apk curl on a cached base, upstream entrypoint) tagged **`minio/minio:RELEASE.2025-10-15T17-29-55Z`** — compose keeps referencing the upstream pinned name, so CI (GitHub runners: hub fine) and clean environments pull the real image. Built binaries report DEVELOPMENT.GOGET version strings (cosmetic; the tag carries the pin). On any network where hub works, no workaround is needed.

**Bucket-init mechanism:** the `minio-init` one-shot (above) makes `just up` self-sufficient. The spike spec additionally **ensures the bucket idempotently** (`head_bucket` → `create_bucket` rescuing BucketAlreadyOwnedByYou/Exists, behind a 5×2s connect-warmup for first-boot latency) — that covers CI's service container (no init step available) and any fresh-volume edge.

**Exact ENV contract** (`.env.example`): `R2_ENDPOINT` · `R2_BUCKET` · `R2_ACCESS_KEY_ID` · `R2_SECRET_ACCESS_KEY` — production: ALL four required, no defaults (boot fails fast otherwise; ticket 03 provisioning owns real values). dev/test: endpoint/bucket are pinned in storage.yml; access/secret fall back to the documented dev defaults `synapse-dev` / `synapse-dev-password`, which the compose `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` must stay aligned with. No R2_* vars are set on the backend compose service — the dev defaults are the single dev source.

**Spike-spec portability for T02** (`spec/integration/minio_presign_round_trip_spec.rb`, tag `minio`): builds the client the ActiveStorage-native way — `ActiveStorage::Service::S3Service.new(**storage.yml[:minio].except(:service))` — i.e. the exact service instance the presign flow will get; presigns via `Aws::S3::Presigner` over `service.client.client` (S3Service's client is an `Aws::S3::Resource`; the Presigner wants the wrapped `Aws::S3::Client`); proves `X-Amz-Algorithm=AWS4-HMAC-SHA256` + a real Net::HTTP PUT→GET byte-equality round-trip; also asserts the live `Rails.application.config.active_storage.service == :minio` and that `ActiveStorage::Blob.service` resolves to the synapse-materials S3Service. Rubocop's `--no-deps` runs never execute specs — unaffected by minio. T02 can lift the `let(:service)`/`client`/`presigner` scaffolding verbatim (note the explicit `require "active_storage/service/s3_service"` — the adapter is lazily loaded).

**CI:** backend job gains a `minio` service container (same pinned image + dev creds, curl healthcheck) and a one-line `/etc/hosts` entry mapping `minio`→loopback (rspec runs on the VM, not in a container). Local gates unchanged (`just spec` untouched — the rspec `run` form now starts db+minio+init through depends_on, verified working).
