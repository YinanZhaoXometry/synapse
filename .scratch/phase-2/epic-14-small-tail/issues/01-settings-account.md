# 01: Settings account surfaces — password change, export, cap display, weekly goal

**What to build:** Settings gains its account half: **password change** (verify old, bcrypt new, rate-limited, sessions survive per stateless-JWT policy); **data export** — one JSON download in the import's document shape (round-trip symmetric with epic-08-T3; size policy per delta-grill); **cap display** — today's AI-call count + limit (read from epic-05's counter); **weekly-goal target** settable (feeds epic-09's ring).

**Blocked by:** None (epic gate: 08 done; cap display needs epic-05 — inherited via gate).

**Status:** done

**Bound by:** AD-15 (account mechanics; stateless token policy stated), AD-16 (cap counter source), FR-34 display consequence, AD-9 (bilingual Settings floor).

- [x] Round-trip spec: export → import-shape equality on factory data
- [x] Password change: verify + rate limit + old-token policy asserted
- [x] Cap display reads the live counter (not a guess); weekly goal persists user-scoped

## Comments

**2026-11-05 — implemented (T1, branch `epic/p2-14-t01-settings`):**

- `changePassword` mutation → `Accounts::ChangePasswordCommand`: wrong current = VALIDATION_FAILED on field currentPassword (an honest field error, never UNAUTHORIZED); new password min = `Accounts::RegisterUserCommand::MIN_PASSWORD_LENGTH` (8, reused); rate-limited through `Accounts::LoginRateLimiter` keyed by the account email (delta 2's "mirror the login limiter's mechanism" — the credential-guessing throttle is one protection, shared window with login for that email); sessions survive by construction (stateless JWT, sub = user uuid; no re-mint, no revocation — stated on the schema description). Spec pins: wrong-current digest untouched, min-boundary admits, tripped window denies BEFORE credential verification, pre-change token still decodes + still authenticates on the wire, relogin with the new credential works.
- `exportData` query → `Export::ExportDataCommand`: the caller's whole document in the import's WIRE shape (string-keyed camelCase, `version: 1`, every DocumentInput collection) as one JSON string (`document: String!`) → client Blob download `synapse-export-<date>.json` (delta 1). Round-trip spec: import populated doc → export → import on a fresh account → equality on counts + content (uuids, linkage, jsonb payloads, history timestamps) — plus the wire-level round trip through the real input objects.
- `aiUsageToday` query → `Ai::DailyCap.count_for` (new read half of the seam) + `Ai::DailyCap.limit`: the live `ai_usage_counters` row (server truth), neutral `{ callsToday, dailyLimit }` payload; the Settings row renders count/limit with no progress theatrics.
- Weekly goal: T5-of-epic-09 already placed the setter (StudyGoalRow) — recorded, no duplicate built.
- Gates: rubocop clean; rspec 1265/0 (baseline 1233 + 32); codegen + `tsc -b` + eslint (0 errors) + vitest 805/805 (baseline 796 + 9) + `vite build` green.

**Import-shape fidelity notes (what the export cannot mirror, honestly):**
1. Materials ride byteless and metadata-only (the import's own contract; the re-attach invite owns bytes).
2. `session.questionIds` is derived from the questions' stored positions — same order, verbatim.
3. Question rows carry no createdAt: the import vocabulary has none (the Phase-1 shape never did), so re-imported questions take the importer's clock. Node rows DO carry createdAt (the import accepts it though the Phase-1 TS type lacked the key).
4. Phase-2-only tables (annotations, notes, material↔node mappings, study focus sets, manual tasks) have NO import vocabulary and don't ride the document — they are not in the export.
5. A material's epic-10 node attachment scope (`attachment_scope`/`node_id`) is outside the import vocabulary; a node-scoped material exports under its plan attachment.
6. `onboardingComplete` rides no export: the api holds no onboarding state (the import argument is advisory); carrying a guess would be a lie.
7. The round trip's honest semantic: the import's FR-4 ownership law means the exported uuids land only where they are UNOWNED — a restore into the vacated id space, never concurrent two-account sharing (specs free the original rows first, breaking the task↔node↔material triangle's nullable legs).

**Adjacency:** `settings.subtitle` copy updated (both languages) — "no accounts" became false the moment the account half landed.
- **Two-axis review (2026-11-05, inline):** PASS/PASS — export mirrors the import WIRE shape (string-keyed camelCase, 12 collections) with fidelity notes recorded (materials byteless; Phase-2 tables have no import vocabulary — honest); wrong-current = field error not UNAUTHORIZED; limiter mirrored; cap read = the seam's real read half; weekly goal recorded-not-duplicated. Round-trip AC = spec-proven structural equality. Merged on `epic/p2-14-tail`.
