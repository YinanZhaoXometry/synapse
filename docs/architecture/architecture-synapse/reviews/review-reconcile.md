---
name: Reconciliation Review — Spine vs PRD/EXPERIENCE/Owner Decisions
type: review
reviewer-role: reconciliation
created: 2026-11-03
spine: docs/architecture/architecture-synapse/architecture-synapse.md (updated 2026-11-03, AD-1..20)
against:
  - ../../product/prd-synapse/prd-synapse.md (final, 2026-11-01 — all 46 FRs, §5 NFRs, §6 MVP, §8 OQs)
  - ../../design/ux-synapse/EXPERIENCE.md (final, updated 2026-11-02)
  - owner decisions 2026-11-03 (Phase-2 backend: Rails/GraphQL, qc-center-api conventions, just, Cloudflare/Render/Neon/R2, Solid Queue, Apollo 4, login wall + idempotent import, mastery→Ruby with golden vectors, server-only AI/SSE/cost cap, monorepo)
---

# Reconciliation Review — architecture-synapse.md (2026-11-03 update)

## Verdict

**Pass with reconciliation fixes.** All nine owner-decision clusters from 2026-11-03 land verbatim and binding — nothing decided was silently dropped or weakened (detail in §"Decision coverage"). The misses run the other direction: **five Phase-2 PRD/EXPERIENCE obligations that the new backend will have to carry have no home in the spine at all** (Square FR-38/39 + NFR-7, FR-43 import + its PRD-routed license handling, FR-44/45/46 plan-structure AI features, the FR-33 Phase-1-tag contradiction, and the server-side AI response contract), plus wording-level gaps in the binds list, the Deferred table, and the ER. None of these block the Nov-6 static build; all of them should be fixed in the spine text before Phase-2 epic-0 specs derive from it.

## Decision coverage (Check B — all honored)

For the record, each 2026-11-03 decision and its landing:

| Owner decision | Lands in |
| --- | --- |
| Rails over Node/TS; GraphQL-first; qc-center-api conventions (ApplicationCommand/dry-monads, error `extensions.code`, thin resolvers, strong_migrations, RSpec+factory_bot colocated, rubocop, ENV+.env.example) | AD-12, AD-13, AD-10, AD-17 CI, Consistency Conventions (Config), Stack table, frontmatter source ref to qc-center-api |
| Skips: packwerk, logidze, paranoia, data_migrate, Sidekiq/Redis | Deferred (packwerk), AD-13 ("no logidze, no soft delete, no data-migration split"), AD-19 ("no Redis") — **partial: see Minor 3** |
| just manages dev lifecycle (root justfile, `api/.dockerdev` compose) | AD-17, AD-20 ("Local dev = `just up`"), Structural Seed |
| Cloudflare + Render + Neon; Solid Queue; recurring = FR-24 scan + keep-alive ping; free tier + keep-alive, paid before graded demos | AD-20, AD-19 (recurring v1 names both tasks exactly), AD-15/20 (demo account, static pre-login surface preserve NFR-6) |
| Apollo Client 4 + codegen at cutover; anonymous mode retires; login wall; seeded demo account | AD-18 (Apollo 4.x verified 2026-11-03), AD-15 |
| First login = one-time idempotent import of `synapse-db:v1` | AD-15 (whole-document upload, one idempotent mutation, client-supplied UUIDs per AD-12) |
| Mastery + streak move to Ruby at cutover; TS retires; golden vectors per ADR-0001 | AD-14 (rules verbatim, golden vectors generated from the TS suite), AD-10 |
| Material files: ActiveStorage + R2; extracted text in Postgres; parsing client-side | AD-13 + AD-7 |
| AI server-side only; OpenAI-compatible adapter; GLM first (terms verified at build); one SSE endpoint, short-lived one-time ticket; cap 50 calls/user/day + ~8k context-in | AD-16 (all elements, value explicitly set "here per NFR-4"), Deferred (OQ-4 residual) |
| Monorepo: flat web/+api/+root justfile, no shared package, committed schema.graphql → web codegen; restructure = Phase-2 epic-0; FR-33 deferred for Nov-6; email+password JWT, Google OAuth deferred | AD-17, spine scope line, AD-15, Deferred ("Google OAuth… email+password ships first") |

Check D consistency notes: the FR-30 framing is sound — the PRD's "email + password **or** Google OAuth" is satisfied by either path, the spine says so ("FR-30 allows either"), and the Deferred row carries a revisit condition. FR-4 (AD-13 command-layer scoping + RSpec context), FR-24 (AD-19 + capability map), FR-30/31 (AD-15 + capability map), FR-34 (AD-16 + capability map), FR-35 (AD-11/AD-20 + capability map) all have homes. The one genuine spine-vs-PRD contradiction is FR-33's phase tag (Dropped 4). EXPERIENCE's accessibility floor is bound (AD-9), and its error-state contract ("never silent, never fake success") landed in the Errors convention row.

---

## Dropped (real misses)

**D1. Square / plan visibility — FR-38, FR-39, NFR-7, and OQ-12 have no home; AD-13's scoping invariant has no named exception.**
- PRD FR-39: "The user can browse the Square to discover Public Study Plans shared by others, preview a plan's structure, and adopt it as their own"; FR-38: "A Public plan's structure appears in the Square; a Private plan never does"; NFR-7: "Public Study Plans expose structure only; a user's Materials, Annotations, and Mastery Scores are never visible to other users through the Square or any sharing surface." OQ-12 (resolved product-side): adoption = fork with attribution.
- EXPERIENCE.md holds the IA position ("**Square** = sidebar section below the hubs" — named, Phase 2).
- Spine: zero occurrences of "Square", "FR-38", "FR-39", or "OQ-12". NFR-7 is bound only nominally — AD-13's Binds line says "FR-4, NFR-3/7" — while AD-13's rule states an **absolute** invariant: "Every user-owned row is scoped by `user_id`… one authenticated user cannot list or fetch another's data by id." FR-39's public-plan read path is the one sanctioned cross-user read in the product, and the spine neither names it nor carves it out; an implementer deriving Phase-2 specs from AD-13 alone would design the Square as a violation.
- Fix: add a capability-map or Deferred row — "Square (FR-38/39): Phase 2, post-cutover; public-plan read is the single exception to AD-13 scoping, structure-only per NFR-7 (never Materials/Annotations/Mastery Scores); adoption = fork per OQ-12" — plus one clause in AD-13 naming the exception.

**D2. FR-43 (roadmap.sh import) — no home, and the PRD explicitly routes an architecture obligation to this spine that is unaddressed.**
- PRD FR-43: "The user can import an open-source roadmap.sh developer roadmap as a ready-made Study Plan — its nodes and stages become the plan's Knowledge Node structure," with the consequence: "**license handling is a build-time concern → `/bmad-architecture`**" and "Source-roadmap attribution is visible on the plan."
- Spine: zero occurrences of "FR-43" and "roadmap.sh". The Deferred row "Roadmap renderer, graph vs custom SVG (OQ-2) | FR-5 build (Phase 2)" covers FR-5's graph renderer only — a reader will mistake it for FR-43 coverage; it is not.
- Fix: a Deferred row ("FR-43 roadmap.sh import | Phase-2 build; roadmap fetch/parse + attribution + license handling are the api's job at build time (AD-12/13)") — the license-handling obligation is PRD-assigned to architecture and currently has no landing spot at all.

**D3. FR-46 (plan-level Companion) and FR-44/45 (node-pinned attachment, material–node mapping) — Phase-2 AI/data features the backend must carry, with no row anywhere.**
- PRD FR-46: "the user can chat with the Companion grounded in the whole plan's attached Materials instead of a Reading Position; answers cite their Material and section… 'Analyze my mistake' on a Notebook item yields an explanation grounded in that item's source section." Post-cutover this is a server-side AI surface (plan-scope context assembly, citation without a Reading Position, Mistakes-Notebook data access) — and the retained `/ai-tutor` page inherits it "when server-side AI (FR-33) lands" (FR-46 text; EXPERIENCE AITutorChat row).
- PRD FR-44: "its content then scopes to that node's grounding and quiz generation"; FR-45: "the AI maps the Material's sections to existing Knowledge Nodes and proposes new nodes… the user confirms" — both directly shape the AD-16 adapter's context assembly and the AD-13 data model.
- Spine: zero occurrences of FR-44, FR-45, FR-46. AD-5's CompanionService binds FR-11/12/18/19/33 only; AD-16 governs "all AI operations" generically but never names these.
- Fix: capability-map or Deferred rows citing FR-46/44/45 with AD-16 as governor (FR-46 is also the answer to "where do multi-user-adjacent AI surfaces land post-accounts": on the same SSE endpoint + plan-scope grounding contract).

**D4. FR-33's PRD `[Phase 1]` tag vs the spine's deferral — a live spine-vs-PRD contradiction, unreconciled.**
- PRD §4.7: "**FR-33: Server-side AI calls `[Phase 1]`** — AI requests execute server-side only; no provider key reaches the client," and §6.1 lists "server-side AI" inside the Nov-6 scope parenthetical.
- Spine scope line: "**FR-33 stays deferred for the Nov-6 demo**" (owner decision 2026-11-03, post-dating the final PRD of 2026-11-01).
- The spine solved exactly this shape of problem for FR-29 with a starred frontnote — "**FR-29\*:** persistence binds as relaxed by owner decision 2026-11-02" — and for FR-30's halving with a Deferred row. FR-33 gets a prose sentence only; the frontmatter binds list carries "FR-33" unqualified, so a PRD-first reader still expects a live server on Nov 6 (and SM-2/SM-5 demo scrutiny follows from it).
- Fix: an "FR-33\*" frontnote mirroring FR-29's ("binds as deferred to Phase 2 by owner decision 2026-11-03 — Phase 1 ships the simulated adapter per AD-5; the server lands at cutover per AD-16"), and a one-line PRD addendum note so §6.1 isn't read as binding.

**D5. The AI response contract has no server-side home: reply language, mid-stream citation events, and ticket-vs-reconnect.**
- EXPERIENCE.md binding contracts: "**Grounding contract:** every factual claim about the Material carries ≥1 `CitationChip`"; streaming state renders "citation chips… with the claims they support" (i.e., mid-stream, not only at stream end); "**Companion replies in the active UI language, switching with the toggle**"; tone/guardrail contracts — hint-first ladder (NFR-2), anti-sycophancy ("no praise on correct answers beyond a checkmark verdict").
- AD-5 frames the structured response contract "(intent, rung, citations)" and says the server implementation "replaces it behind the same interface" — which covers intent/rung by implication. But AD-16, the server-side AI rule, specifies provider, SSE transport, one-time tickets, and the cost cap without saying: (a) rung/citation metadata is **produced server-side** and must ride the SSE event vocabulary alongside tokens (the Errors convention defines only a terminal `{ code }` event — the happy-path event types are unspecified, and a bare token stream cannot render EXPERIENCE's mid-stream citation chips); (b) the **UI language is a request parameter** — nothing in the spine tells the server which language to answer in, yet the contract is zh/en-following-the-toggle; (c) EventSource **auto-reconnects** with the same URL — a short-lived one-time ticket cannot survive reconnect, so "reconnect = request a fresh ticket" is part of the transport contract, not an implementation detail.
- Fix: one clause in AD-16 ("the response contract of AD-5 — intent, rung, citation anchors, reply language — is produced by the server adapter; the SSE event vocabulary carries token, citation, rung, and terminal events; reconnection mints a fresh ticket").

---

## Minor (wording-level)

**M1. Frontmatter binds list omits FR-24.** AD-19's rule text and the capability map both bind FR-24, but the `binds:` array (FR-1…FR-34, FR-13/14/15) doesn't include it — add "FR-24" for findability.

**M2. Deferred row conflates a resolved OQ and mis-attributes placement.** "Re-queue algorithm (OQ-6); mastery weighting/decay values (OQ-9) | implementation spec (`/to-spec`) — placement fixed by AD-6/14": OQ-9 is **RESOLVED** (ADR-0001 — only Phase-2 freshness values remain open; PRD §8 marks it RESOLVED), and re-queue placement is fixed by **AD-19** (Solid Queue recurring scan), not AD-6/14. Split the row and fix the citations.

**M3. The adopt/skip list is half-recorded.** The 2026-11-03 decision adopted qc-center-api conventions with an explicit skip list; the spine records the skips of packwerk (Deferred), logidze/paranoia(soft-delete)/data_migrate (AD-13), and Sidekiq/Redis (AD-19), but the skips of **settings gem, OTel/Sentry/Yabeda, SCIM, and multi-tenancy** appear nowhere (grep: 0 hits). One "not adopted from the reference" line in AD-12 or AD-13 prevents drift-back (multi-tenancy especially: its skip is what makes AD-13's `user_id`-scoping the right shape).

**M4. The api's AGENTS.md-style contract is implicit.** The decision list adopts an "AGENTS.md-style contract" as part of the qc-center-api conventions; AD-17 says "AGENTS.md + CI updated in the same change," which reads as the root file only, and the Structural Seed shows no `api/AGENTS.md`. Make the api-side contract file explicit.

**M5. The ER drops the Annotation entity.** FR-4 ("Study Plans, Materials, **Annotations**, and Mastery Scores are visible only to that user"), NFR-3, NFR-7, FR-16, and FR-17 (Study Focus is derived from Annotations) all reference Annotations; the ER's entity list (12 entities) omits it, and AD-13's "one model per entity, no renames" reads as a closed list. Add Annotation (or a note that Phase-2 features may add entities — which also covers StudyPlan's FR-38 visibility field).

**M6. Deferred rows should cite the FRs they absorb.** "Node-*targeted* quiz generation (not attribution) | Phase 2 per AD-6" is FR-21's mechanism (adaptive weak-spot targeting) — cite FR-21; "Note enrichment sourcing (OQ-11) | FR-40 build" should also cite FR-22 (weak-spot Study Notes, explicitly "a variant of Note generation (FR-40)"). Otherwise those FRs appear homeless to an FR-number-indexed reader.

**M7. EXPERIENCE's Settings "later" items and PPT upload have backend halves and no Deferred row.** EXPERIENCE IA table: Settings = "Profile display + language (Phase 1); **account, data export, cost caps later**" — post-cutover that means password change/logout (JWT lifecycle) and data-export mutations, none of which AD-15 names. PRD FR-2 consequence + §6.2: "PPT arrives in Phase 2 — owner Q6… first candidate when Phase 2 opens" — no row. One Deferred row each ("Settings account/data-export surfaces | AD-15 build"; "PPT upload | Phase-2 opening, client-side parse extension per AD-7").

---

*Method: full reads of the spine (AD-1..20, conventions, stack, structural seed, ER, capability map, Deferred), the PRD (all 46 FRs, NFRs, §6, §7, §8), and EXPERIENCE.md; absence claims verified by term-count grep against the spine (FR-43/38/39/44/45/46/21/22, Square, roadmap.sh, Annotation, NFR-7-as-text, Sentry/SCIM/multi-tenancy/settings-gem: all 0 hits; NFR-2: AD-5 only; FR-24: AD-19 + capability map, absent from binds).*
