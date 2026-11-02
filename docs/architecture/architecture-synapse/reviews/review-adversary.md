# Adversary review — architecture-synapse.md (Phase-2 update, 2026-11-03)

**Verdict: ship-with-fixes.** The two-era structure, the command-core Rails conventions, the committed-schema contract, and the mastery golden-vector port are sound and internally coherent in intent. But four findings must be fixed before Phase-2 scaffolding starts: the free-tier deployment envelope does not actually close (AD-19/20), the post-cutover shape of the two adapter seams contradicts itself (AD-1 vs AD-16/18), the SSE one-time-ticket flow is named but not specified (AD-16), and the auth lifecycle is wholly unowned (AD-15). One diagram fails to parse (verified with mermaid 10.9.8 and 11.17.2). Nothing here requires rethinking the fundamental shape; every fix is an AD amendment.

---

## Findings

### F1 — CRITICAL — The free-tier envelope does not close: no free Render worker, a circular keep-alive, and Solid Queue polling exhausts Neon's free compute hours

**Hits:** AD-19 ("the worker is a second process of the same image on Render"; "Recurring tasks v1: … the Render free-tier keep-alive ping"), AD-20 ("api → Render docker service (web process + Solid Queue worker process, same image)"; "Free tier + keep-alive"), NFR-6, AD-20's own *Prevents* ("cold-start demo embarrassment").

Three independently verified facts break the "free tier + keep-alive" story as written:

1. **Render background workers have no free instance type.** Free instances exist for web services, static sites, and cron jobs; a separate worker service bills at minimum Starter pricing (~$7/mo). "Web process + Solid Queue worker process, same image" as specced is either two services (one not free) or an unsupported hack (a supervisor inside one free web container, which then also counts against the 750 free instance hours if kept awake).
2. **The keep-alive is circular.** The keep-alive ping is a Solid Queue recurring task (AD-19) — it runs *on the worker*. A free Render web service spins down after 15 min without inbound HTTP traffic; when the service sleeps, the recurring task sleeps with it, so nothing pings the service. The mechanism whose job is to defeat spin-down is hosted inside the thing that spins down.
3. **Solid Queue keeps Neon awake and the hours run out in ~8 days.** Solid Queue is a polling system: workers/dispatchers poll the `solid_queue_*` tables on an interval (default ~1s; dispatchers poll for recurring tasks too). Neon's free plan autosuspends after ~5 min of inactivity and includes ~191 compute-hours/month; a queue polling every second 24/7 needs ~730 compute-hours. The database pauses roughly a week into every month — the deployed app goes down entirely, which is precisely the NFR-6 embarrassment AD-20 exists to prevent. Raising the poll interval doesn't save it: any interval < 5 min prevents autosuspend from ever engaging.

**Fix (pick one coherent posture and write it into AD-19/AD-20):**
- Cheapest coherent free-ish posture: run Solid Queue **inside the single web process** (Rails 8.1's supported in-process/puma-plugin mode) — no second Render service; replace the self-referential keep-alive with an **external** uptime pinger (e.g. cron-job.org hitting a GraphQL/health endpoint) or accept the ~1 min cold start outside graded demos; and accept that Neon free hours still burn while the queue polls — which forces either paid Neon (Scale plan, ~$5/mo) or gating the queue to run only during demo windows. Note also: if Neon's pooled connection string (PgBouncer, transaction mode) is used, the Solid Queue connections need the direct (non-pooled) URL.
- Or stop claiming free: pin "Render Starter worker + Neon Scale from cutover day one" and delete the keep-alive recurring task. For a graded course project, ~$12–15/mo is the honest number; the current text promises $0 with mechanics that cannot deliver it.

Also strike or rewrite AD-19's *Prevents* ("ad-hoc cron outside the repo") — the working keep-alive is exactly an external cron; the AD currently forbids the fix.

### F2 — HIGH — AD-1's cutover note contradicts AD-18/AD-16: one seam is deleted, not swapped, and the other's call path is ambiguous

**Hits:** AD-1 ("At cutover the adapters' implementations swap (AD-16/18); the rule is unchanged"), AD-18 ("Apollo Client 4.x + graphql-codegen typed hooks replaces TanStack Query **and the repository layer**"), AD-5 (server implementation "replaces it behind the same interface"), AD-16 ("All AI operations are GraphQL mutations").

AD-1 says both adapter seams survive with swapped implementations and the rule (all domain data flows `features → data adapters`) is unchanged. AD-18 deletes the data seam instead: the repository layer is *replaced*, and codegen typed hooks are consumed from features/components directly — there is no longer a `data` adapter for the rule's arrow to point at. Meanwhile the ai seam keeps its interface (AD-5: server implementation behind the same `CompanionService` interface; AD-18 keeps the simulated service as a dev/test double — only meaningful if callers go through the seam). So post-cutover: data seam gone, ai seam alive — but AD-16's "all AI operations are GraphQL mutations" reads like license to call `useGenerateQuizMutation` directly from a feature, bypassing `src/ai` entirely. Two builders can comply differently: one keeps a `data/` wrapper over Apollo hooks and routes AI ops through a server-backed `CompanionService`; the other calls codegen hooks everywhere and lets `src/ai` rot. Both think they followed the spine.

**Fix:** amend AD-1's cutover sentence to the asymmetric truth, e.g.: "At cutover the **data seam retires** — Apollo's normalized cache is the new single owner (AD-18), features consume codegen typed hooks directly; the **ai seam survives** — a server-backed `CompanionService` implementation (GraphQL mutations + SSE internally) swaps in behind the unchanged interface (AD-5/16), and features never call AI operations via Apollo hooks directly." Mirror one sentence in AD-16 or AD-18. Alternatively decide the opposite (both seams die; AI ops are ordinary mutations; the simulated double is used only in tests via a mocked Apollo link) — either is fine, but the current text says both things at once.

### F3 — HIGH — SSE one-time ticket: the flow is named, not specified — and EventSource auto-reconnect will replay a dead ticket

**Hits:** AD-16 ("one Rails SSE endpoint (`/api/stream`) … it authorizes via a short-lived one-time ticket (EventSource cannot set headers)"), Consistency Conventions ("SSE terminal event `{ code }`").

Unspecified: how the ticket is obtained (a GraphQL mutation returning it?), how it travels (query param on the EventSource URL?), its TTL, single-use binding (to user? to operation? to a generation request id?), and what the endpoint does on expired/consumed tickets. The concrete technical trap: `EventSource` **auto-reconnects by re-requesting the original URL**. If the stream drops mid-generation (network blip, Render restart), the browser replays the same URL — the one-time ticket is already consumed, the reconnect gets 401, and depending on the status the EventSource either hammers the endpoint or closes with no app-visible way to resume. Nothing in the spine says whether a dropped generation resumes (SSE `Last-Event-ID` requires server-side buffering of partial output — not designed here) or restarts (which **spends another AI call against the 50/day cap**, AD-16). Also unstated: the SSE route needs the same exact-origin CORS headers as GraphQL (AD-20 says "CORS allows only the web origin" without mentioning the non-GraphQL route), and a ticket in the query string lands in Render access logs.

**Fix:** add a short ticket contract to AD-16: (a) ticket = opaque single-use secret, TTL ~60s, obtained via a `createStreamTicket` GraphQL mutation, bound to `current_user` + the pending operation id, passed as the last path segment or query param (accepted log exposure documented); (b) the SSE endpoint never retries auth — 401 on a bad ticket; (c) client does not use raw auto-reconnect: it wraps EventSource, disables retry, and on drop fetches a **fresh** ticket and either resumes via `Last-Event-ID` (if server buffering is added) or restarts the generation — and a restart must be counted deliberately against the cap; (d) one sentence: "the SSE route is covered by the same CORS origin allowlist as GraphQL; no credentials mode is needed (ticket auth)."

### F4 — HIGH — Idempotent import vs user scoping: client-supplied UUIDs with an unspecified uniqueness scope is a cross-user collision surface

**Hits:** AD-12 ("Ids are plain UUID strings …; clients may supply ids on create — the first-login import is thereby idempotent"), AD-13 ("Every user-owned row is scoped by `user_id`"), AD-15 ("whole-document upload as one idempotent mutation (client-supplied UUIDs, AD-12)").

The import takes an attacker-controllable document (anyone can hand-edit `synapse-db:v1` in localStorage before first login) containing arbitrary UUIDs for every row. The spine never says whether uniqueness is global (uuid PK) or composite (`[user_id, id]`), nor what happens on collision. With a global PK and create-or-skip semantics, a hostile client simply includes another user's known/leaked UUIDs and gets silently **linked to the victim's rows** — a FR-4/NFR-3 privacy hole that passes the "cannot fetch another's data by id" RSpec context AD-13 describes (the rows are now *theirs*). With a global PK and hard-insert semantics, a birthday-or-typo collision produces an opaque validation failure mid-import. Also unspecified: is the whole-document mutation one transaction (all-or-nothing), and is retry-after-partial-failure safe?

**Fix:** one amendment to AD-13 (or AD-15): uniqueness is the uuid PK (global); the import command upserts with **ownership verification on conflict** — an incoming id that already exists and belongs to a different user is a `VALIDATION_FAILED` (never a link, never a silent skip of someone else's row); conflicts within the same user's rows are skipped (idempotent retry). State that the import runs in a single transaction so a retry is safe.

### F5 — HIGH — Auth lifecycle unowned: JWT expiry/refresh/logout/revocation, password reset, and Apollo cache reset on account switch

**Hits:** AD-15 ("email + password (bcrypt) + JWT bearer …; Cutover = login wall"), AD-18 (Apollo swap — silent on logout).

AD-15 decides the login mechanism and nothing about the token's life. Unowned decisions two builders will diverge on: token TTL (forever-token = no secure logout; 15-min token with no refresh design = users dropped mid-session), whether any revocation/denylist exists (there is no Redis and none planned — fine, but then say "stateless JWT, revocation = expiry, accepted risk"), and logout semantics (client discards token — then what clears server-derived state?). Password reset is entirely absent: email+password accounts with no recovery path, no mail sender decided anywhere (`.env.example` in the Consistency table has no SMTP vars) — and note Render free instances block outbound SMTP, so "add ActionMailer later" is not free-tier compatible either; decide "reset = out of scope for the demo era, deferred explicitly" if that's the call. Finally, the demo setup actively creates the account-switch case: a graded demo logs into the seeded demo account on a browser that may hold another account's session. AD-18 says nothing about resetting Apollo's normalized cache on login/logout — without `client.clearStore()` (or equivalent) on auth change, user A's normalized data (materials, plan nodes, mastery) can surface for user B. That is an FR-4 violation the architecture altitude should have caught, since AD-18's whole *Prevents* is "the retired static architecture leaking into Phase 2."

**Fix:** extend AD-15 with the token policy (recommended: short-lived access JWT, stateless, logout = discard + cache reset; revocation accepted-risk for the course timeline; rate-limit login attempts), decide password reset explicitly (deferred row or a mail provider + non-free-tier note), and add to AD-18: "auth change (login/logout/switch) resets the Apollo cache and terminates live SSE connections."

### F6 — MEDIUM — Imported materials permanently lose their PDFs: AD-4's session-only blobs can never be in `synapse-db:v1`

**Hits:** AD-4 ("Material file blobs are the only session-only data"), AD-15 ("First login offers a one-time import of `synapse-db:v1` — whole-document upload"), AD-13 ("original file to R2"), AD-7 (pdfjs renders the original file).

The import document, by AD-4's own rule, contains metadata and extracted text but **no file bytes** — they never persisted. So every pre-cutover Material arrives server-side without an original in R2: Markdown materials still read fine (text is the source), but **PDF materials can never render page-by-page again** — the flagship reader (FR-8/9/10, the thing the Nov-6 demo protects) silently degrades to extracted-text-only for all imported data, and Reading Position page anchors have nothing to anchor to. The spine never says this. It is a product-level data-loss consequence spanning three ADs, not an implementation detail.

**Fix:** decide and state it in AD-15: either (a) the import flow invites re-attaching original files (client re-uploads via the AD-13 path, parsed again client-side, matched by id) — the honest option; or (b) imported PDFs are explicitly text-only thereafter, rendered from extracted sections, and the spine says so. Silence is the bug.

### F7 — MEDIUM — ActiveStorage direct upload from the SPA contradicts AD-12's "SSE is the only non-GraphQL surface"

**Hits:** AD-12 ("The SSE endpoint (AD-16) is the **only** non-GraphQL surface"), AD-13 ("Material files go to object storage via ActiveStorage → Cloudflare R2").

Rails' built-in ActiveStorage direct upload is a REST route (`POST /rails/active_storage/direct_uploads` returning the presigned PUT). Using it adds a second non-GraphQL surface, violating AD-12 as written. Not using it leaves the upload path undecided: the SPA needs a presigned-PUT flow for multi-MB PDFs (a base64 GraphQL variable is not acceptable for 20MB files), and nothing in the spine says how the presign happens or how the reader later gets bytes back (presigned GET URLs served through GraphQL? redirect?). Two builders: one flips on the built-in REST route, the other hand-rolls a `createDirectUpload` GraphQL mutation + R2 PUT — and AD-12's "only surface" claim diverges from reality for one of them.

**Fix:** amend AD-12 to decide: "file uploads presign via a GraphQL mutation (`createMaterialUpload` returning the R2 presigned PUT + blob key); the browser PUTs directly to R2 (not an api surface); downloads use short-lived presigned GET URLs exposed as GraphQL fields. The ActiveStorage REST direct-uploads route is never mounted." (Or explicitly exempt it in AD-12 — but then the "only surface" sentence must be rewritten, and CORS on R2 itself must be configured, which is worth a line either way.)

### F8 — MEDIUM — Golden vectors: "same inputs → same scores" is under-specified — rounding mode, float encoding, and timezone policy for the streak decide whether the port is verifiable

**Hits:** AD-14 ("verified by golden vectors generated from the TS test suite (same inputs → same scores, both directions of every boundary)"), AD-10 ("mastery port carries golden vectors"), AD-6 (streak = consecutive-evidence-days, moving server-side per AD-14).

Three portability gaps: (1) **Rounding** — JS `Math.round` (half up, toward +∞) and Ruby `Float#round` (half away from zero) agree on non-negative values but nothing pins the mode, the operation order, or the comparison policy (exact equality vs epsilon) — vectors as JSON floats must state whether both suites compare exactly; `82.5 %` as a score is a boundary that *will* be hit at ≥80-mastered. (2) **Timezones** — the streak is "consecutive evidence days": Phase 1 computes it client-side from local dates; the server computes it from timestamps in some zone. If the golden vectors' timestamps don't pin a zone (or the Ruby side doesn't use the same day-boundary policy), the vectors pass while production streaks diverge across the cutover. (3) **Logistics** — AD-17 forbids a shared code package, so where do the generated vectors live (`api/spec/fixtures/`? regenerated by whom when the TS suite changes, given the TS version retires at cutover)? Unstated, the vectors rot immediately.

**Fix:** extend AD-14: vectors are committed JSON fixtures (inputs + exact expected outputs, decimals as strings), consumed by both the TS suite (generator, until cutover) and the RSpec port (consumer), compared with exact equality; inputs include timezone-tagged timestamps and the streak day-boundary policy is stated in the vector contract; rounding mode and operation order are pinned in ADR-0001's terms.

### F9 — MEDIUM — The Design Paradigm diagram (d0) does not parse — in mermaid 10 or 11

**Hits:** `## Design Paradigm`, first flowchart.

Verified by machine (mermaid 10.9.8 and 11.17.2, `mermaid.parse()`): every node statement with a **space between the node id and its label bracket** is a hard parse error — `data ["src/data — …"]`, `ai ["src/ai — …"]`, `domain ["…"]`, `features ["…"]`, `pages ["…"]`, `query ["…"]` all have the space. (Subgraph titles with a space before the bracket — `subgraph adapters ["Adapters (replaceable)"]` — are fine; that's why this is non-obvious.) The diagram renders as a parse error in GitHub, Obsidian, and mermaid-live-editor alike. Diagrams 2–4 (Phase-2 shape, ER, evidence loop) parse clean — including the quoted parens/slashes and the erDiagram's hyphenated labels. Note: the 2026-11-02 review record claims "all mermaid verified renderable," which was false for this diagram; whatever verified it did not actually parse.

**Fix:** delete the space in the six node lines (`data["…"]`, `ai["…"]`, `domain["…"]`, `features["…"]`, `pages["…"]`, `query["…"]`) — verified to parse cleanly after exactly that change — and add a `mermaid.parse` pass to the spine lint so "verified renderable" means parsed.

### F10 — LOW — Cutover is a one-way door with no rollback line

**Hits:** AD-15 (login wall, anonymous mode "retires from the runtime"), AD-18 (Apollo swap), AD-20.

The envelope AD owns operational risk but never states the rollback. The good news hiding in the spine: the import never deletes `synapse-db:v1` ("dead weight in the browser"), and Cloudflare Pages can redeploy any prior commit — so rollback is genuinely cheap (redeploy the last pre-cutover build; the static era resumes off intact localStorage). But nobody wrote it down, and the obvious-sounding alternative (roll back the web app only, keep the api) is incoherent post-cutover.

**Fix:** one sentence in AD-20: "Rollback = redeploy the last pre-cutover commit on Cloudflare Pages; the anonymous static build resumes from the still-present `synapse-db:v1` (import never deletes it); any server-side work after cutover is abandoned, not merged back."

### F11 — LOW — Error-code set is open-ended while the mapping contract demands a closed one

**Hits:** AD-12 ("`extensions.code` ∈ `FORBIDDEN | NOT_FOUND | VALIDATION_FAILED | UNAUTHORIZED | …`"), Consistency Conventions ("`extensions.code` = `AppError.code` 1:1"), AD-9 (web maps codes to `t()` keys, never renders server strings).

The trailing `…` makes the set non-enumerable, but the 1:1 mapping and the no-server-strings rule both require the web app to know every code in advance (each needs an `AppError.code` constant and a `t()` key). Two builders each add a code on their side and the 1:1 quietly breaks.

**Fix:** "The error-code set is a closed enum defined in `api/` and mirrored as `AppError.code` in web; adding a code requires touching both in the same change (schema.graphql review catches drift)."

### F12 — LOW — Operational dimensions dropped without a Deferred row: monitoring, logs, backups, preview environments

**Hits:** AD-20 ("Binds: … all environments"; "Local dev = `just up` … — same shape as production"), Deferred table.

The memlog's adopt/skip list skips OTel/Sentry/Yabeda — a defensible call — but the spine's Deferred table carries no observability row at all, so the altitude that binds "all environments" is silent on: production error visibility (Render free has no persisted log history; SSE and cap-enforcement failures would be undiagnosable), data durability (Neon free has no point-in-time recovery; a bad migration or accidental wipe is unrecoverable), and preview environments (Cloudflare Pages gives per-PR preview deploys of web, but there is one api — a web preview can run against a schema the api doesn't serve yet, or an api main moves ahead of the web preview). Also local "same shape as production" quietly isn't: the dev compose is postgres + api only — no R2 stand-in (minio), so material uploads in dev either hit real R2 or use a divergent disk service.

**Fix:** add Deferred rows (observability = "when the first prod-only failure bites, before graded demos"; backups = "before real users beyond the demo account"; preview parity = "when PR previews are actually used") and one line in AD-17/20 naming the dev R2 stand-in (minio in compose or accepted real-R2 dev).

### F13 — LOW — pnpm appears exactly once in an npm repo

**Hits:** AD-17 ("`pnpm codegen:update-schema`, the reference's sibling-frontend pattern").

The web app's entire toolchain is npm (AGENTS.md commands; no pnpm-lock). The reference project's pnpm script was adopted verbatim. One builder installs pnpm for one script; the other rewrites it as an npm script — trivial divergence, but it's exactly the kind of convention drift the spine exists to prevent, and it will confuse the CI rule in the same AD.

**Fix:** decide one package manager for `web/` (npm is the incumbent; `npm run codegen` runs the same codegen) and drop the pnpm mention, or adopt pnpm wholesale and update AGENTS.md + CI in the same epic-0 change.

---

## What was attacked and held

For the record, attacks that did **not** land: the Phase-1 ADs (AD-1..11) are mutually consistent and genuinely enforceable (dependency directions, one-store rule, `ReadingPosition` as domain type, node attribution, sub-route sessions); AD-14's supersede of AD-6 is clean, not a contradiction; the ER and Capability Map cover the bound FRs with no orphan surfaces; the closed error contract *minus* the `…` (F11) is workable; client-supplied UUIDs are fine *given* F4's fix; the schema.graphql-as-contract choice correctly replaces a shared package; Apollo 4 + React 18 is coherent; deferring FR-33 past Nov-6 is owner-ratified in the memlog, not a spine contradiction; the ER diagram's hyphenated labels and all quoted parens/slashes parse clean (d1–d3 verified); AD-4/AD-15's localStorage-survival and UI-pref keys are consistent across cutover notes.

## Evidence appendix (external facts, checked 2026-11-03)

- Render free tier: no free instance type for background workers; free web services spin down after 15 min; outbound SMTP blocked on free instances — [Render docs — Deploy for Free](https://render.com/docs/free), [Render pricing](https://render.com/pricing), [Kuberns Render pricing analysis](https://kuberns.com/blogs/render-pricing).
- Solid Queue is a DB-polling system (worker/dispatcher poll intervals, default ~1s; recurring tasks run on the dispatcher) — [Solid Queue README](https://github.com/rails/solid_queue/blob/main/README.md?plain=1), [AppSignal deep dive](https://blog.appsignal.com/2025/06/18/a-deep-dive-into-solid-queue-for-ruby-on-rails.html), [37signals introducing Solid Queue](https://dev.37signals.com/introducing-solid-queue).
- Neon free plan: ~191 compute-hours/month, ~5-minute inactivity autosuspend — [Neon plans](https://neon.com/docs/introduction/plans), [Neon vs Supabase pricing comparison](https://devdojo.com/post/devopsdaily/neon-vs-supabase-pricing-what-the-same-app-costs-from-launch-to-scale).
- Mermaid parse failures reproduced with `mermaid.parse()` under mermaid **10.9.8** and **11.17.2** (jsdom harness): a space between node id and label bracket (`data ["…"]`) fails; `data["…"]` parses; subgraph titles tolerate the space. All four spine diagrams tested: d0 fails, d1/d2/d3 pass; d0 passes after removing the six spaces.
