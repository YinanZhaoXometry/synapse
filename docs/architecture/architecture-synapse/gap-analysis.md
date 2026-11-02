---
name: Gap Analysis — Current Code vs Architecture Spine
type: analysis-snapshot
created: 2026-11-02
code-baseline: main @ 0ecca73 (working tree clean)
spine: docs/architecture/architecture-synapse/architecture-synapse.md (status: final, 2026-11-02)
feeds: /grill-with-docs → /to-spec → /to-tickets
---

# Gap Analysis — Current Code vs Architecture Spine

**What this is:** a point-in-time diff between the architecture spine (final 2026-11-02) and the code as it exists at `0ecca73`. It answers three questions per area: what gets **added**, what gets **changed**, what gets **deleted** — and, just as importantly, what the spine deliberately says must **not** be touched yet.

## 0. TL;DR

The current code is the **Northstar prototype port**: a polished ten-page demo shell with static `demo-data.ts` content, an in-memory `UserProgressContext`, simulated AI inline in components, toast-stub reader/upload, and zero persistence beyond UI prefs. The spine describes the **plan-first product** built on ports-and-adapters (domain core + `data` + `ai` seams + TanStack Query + `synapse-db:v1`).

- **Added** — essentially the entire plan-first core: `src/domain`, `src/data`, `src/ai`, `src/features/{plans,tasks,reader,companion,quiz,flashcards}`, plan-first routes, the localStorage document, 3 new deps, real tests, deploy config.
- **Changed** — small and surgical: `App.tsx` routing/entry logic, `OnboardingPage` completion, sidebar/⌘K ordering (FR-36), Settings reset semantics, `package.json`.
- **Deleted** — almost **nothing, by design**. The spine grandfathers every scaffold page (`AD-2`), freezes `UserProgressContext` (`AD-3`), and keeps the retained ten-page nav standing in through Phase 1 (Deferred table). The only true deletions today are dead code crumbs.

## 1. Reading rule: grandfathering (why "deleted" is nearly empty)

Three spine clauses govern every "should we delete X?" question:

1. **AD-2:** retained scaffold pages are grandfathered inside `pages/` as-is; each migrates into a feature module only when its FR re-points it (FR-25/26/28/36), never big-bang.
2. **AD-3:** `UserProgressContext` is frozen as retained demo garnish — new plan-first surfaces never write to it; it retires later as evidence re-points retained pages.
3. **Deferred table:** hubs (FR-23/27/41/42) are Phase 2 — retained `/mistakes` `/planner` `/flashcards` `/quiz` pages **stand in through Phase 1**.

So the gap is not "wrong code to remove" — it is "product core not yet built, shell retained." Deletions listed in §7 are mostly future-dated re-pointings, not Phase-1 work.

## 2. Structure-level diff

| Path (spine's Structural Seed) | Today at `0ecca73` | Delta |
| --- | --- | --- |
| `src/domain/` — pure TS entities + `mastery.ts` | **does not exist** | **ADD** |
| `src/data/` — repo interfaces, localStorage adapter (`synapse-db:v1`), query keys, `use<Entity>Queries` | **does not exist** (no `data/`, no `services/`, no fetch; `lib/demo-data.ts` *is* the de-facto data layer, imported directly by every page) | **ADD** |
| `src/ai/` — `CompanionService` interface + deterministic simulated adapter | **does not exist** (AI is inline fake logic in pages) | **ADD** |
| `src/features/` — plans · tasks · reader · companion · quiz · flashcards | **does not exist** | **ADD** |
| `src/pages/` — thin shells for plan-first routes + grandfathered scaffold pages | 12 pages exist; all are prototype-port demo surfaces; no plan-first shells | **ADD** shells; **KEEP** the 10 scaffold pages + `NotFound` |
| `src/components/ui/` — shadcn stock | 48 primitives | no change (treat as generated) |
| `src/components/shared/` — cross-feature presentational (`MasteryRing`, `UploadDropzone`, `CitationChip`, …) | only `CommandPalette.tsx` | **ADD** components as features need them |
| `src/contexts/` — `LanguageProvider` (UI i18n); `UserProgressContext` frozen | `LanguageContext` ✓ (persists `synapse-lang`), `ThemeContext` ✓ (cross-cutting UI, persists `synapse-theme/mode/motion`), `UserProgressContext` ✓ (in-memory) | keep all three; **freeze** `UserProgressContext` (no new writers) |
| `src/lib/` `src/hooks/` — as-is | `utils.ts` (`cn`), `themes.ts`, `demo-data.ts`; `use-mobile` (unused) | keep as-is; `demo-data.ts` becomes retained-page-only |

## 3. AD-by-AD conformance

| AD | Rule (abbrev.) | Code today | Verdict |
| --- | --- | --- | --- |
| AD-1 | domain core + exactly two seams (`data`, `ai`); no side-channels | All data flows `pages → lib/demo-data` directly; all "AI" is inline `setTimeout` fakes | **Absent** — build the seams |
| AD-2 | dependency arrows `pages → features → {domain,data,ai,ui,shared,contexts}`; `ReadingPosition` is a domain type; scaffold pages grandfathered | No `features/`; no `ReadingPosition` anywhere; scaffold pages comply by being untouched | **Absent for new code**; retained pages compliant via grandfathering |
| AD-3 | repositories + TanStack Query own domain entities; **no new domain contexts**; `UserProgressContext` frozen | Zero repositories; zero `useQuery`/`useMutation` (provider mounted in `App.tsx:25` only); `UserProgressContext` holds points/streak/mastery and receives writes from `QuizPage.applyQuizOutcome` | **Absent** — add repos + Query; freeze the context |
| AD-4 | one versioned localStorage doc `synapse-db:v1`; blobs session-only; `onboarding-complete` flag inside the doc | Only UI-pref keys exist (`synapse-lang`, `synapse-theme`, `synapse-mode`, `synapse-motion`); progress resets on reload by design | **Absent** — add the store |
| AD-5 | `CompanionService` (chat, plan-structure generation, quiz/flashcard gen, grading) + simulated adapter; no component does AI directly | `AITutorPage.tsx:18-26,73-76` keyword `detectIntent` + 1200 ms `setTimeout`; `QuizPage.tsx:231-238` fake "generate from materials" (spinner, questions unchanged) | **Absent** — add `src/ai`; inline fakes tolerated only inside grandfathered pages |
| AD-6 | mastery = one pure function in `domain/mastery.ts`; evidence-only; node-attributed `EvidenceRecord`; streak rollup also in `domain/` | Mastery = `Record<design\|requirements\|testing, number>` mutated by hardcoded deltas computed **inside `QuizPage.tsx:305-322`** (+6 correct / +3 partial, cap 100); no EvidenceRecord, no nodes, no streak logic (streak is a seed number) | **Absent** — the product's core number is demo garnish today |
| AD-7 | client-side reader: pdfjs-dist 6.x + react-markdown 10.x + rehype-slug 6.x behind `parse(file)` public API | Reader = **two toast stubs** (`DashboardPage.tsx:125`, `MaterialsPage.tsx:121`); no file input, no FileReader, no pdfjs/markdown deps | **Absent** — add `features/reader` + deps |
| AD-8 | `/` = Onboarding-once-then-Plans-Home; `/plans`; `/plan/new`, `/plan/:id(+/quiz,/flashcards)`, `/task/new`, `/task/:id(+/quiz)`, `/read/:materialId(?page=N\|#section)`; sessions are sub-routes not modals | `/` unconditionally renders `OnboardingPage` (goals never persisted; CTA → `/dashboard`, `OnboardingPage.tsx:191`); no plan/task/read routes exist; quiz/flashcards are full pages (fine — they're the scaffold stand-ins) | **Partial** — router present (react-router 6), entry logic + plan-first routes missing |
| AD-9 | i18n `t()` zh+en parity; semantic tokens; loose TS; sonner single toast; a11y floor binds new surfaces | `t()` used consistently for chrome (341 keys/lang); tokens/`cn()` respected; sonner is the only toast — **but** 5 hardcoded strings remain (see §10) and the a11y floor is untested until new surfaces exist | **Partial** — good hygiene to inherit; fix stragglers |
| AD-10 | vitest mandatory for `domain/` (mastery: uncovered-never-green, rollup cap, evidence-only) + dense behavior; gates `tsc -b`/lint/test | `src/test/example.test.ts` = `expect(true).toBe(true)` placeholder; no other tests | **Absent** — first real tests arrive with `domain/mastery.ts` |
| AD-11 | static SPA host, SPA-fallback rewrite, auto-deploy from `main`; no env vars | No deploy config in repo | **Not started** — deploy-task decision (vendor deferred) |

## 4. Capability map: spine target vs today

| Capability | Spine: lives in | Today | Phase-1 action |
| --- | --- | --- | --- |
| FR-1 entry states, Plans Home | `features/plans` + `/` + `src/ai` plan generation | Onboarding wizard, goals discarded, CTA → `/dashboard` | **ADD** Plans Home + entry-state routing; **CHANGE** Onboarding completion |
| FR-2 material attach (UploadDropzone) | `features/plans` + Material repo + reader `parse(file)` | Upload button = toast (`MaterialsPage.tsx:49`) | **ADD** real upload flow in-plan/in-task |
| FR-3 Mastery Score | `domain/mastery.ts` + `components/shared/MasteryRing` | 3 demo topic numbers, mutated by quiz page | **ADD** evidence-based score + ring |
| FR-8/9/10 reader + Reading Position | `features/reader` | toast stubs | **ADD** reader feature |
| FR-11/12 Companion chat + guardrails | `features/companion` + `src/ai` | `AITutorPage` canned keyword replies (grandfathered) | **ADD** grounded Companion; keep AITutorPage as-is |
| FR-18/19 quiz + flashcard generation | `features/quiz`, `features/flashcards` + `src/ai` | `QuizPage` (765-line FSM over static `QUIZ_BANK`, fake generation), `FlashcardsPage` (working flip/review demo) — both grandfathered stand-ins | **ADD** in-flow generation + sub-route sessions alongside |
| FR-25 plan home (light) + streak | `features/plans` + `domain` streak rollup | `DashboardPage` reads context stats; "continue reading" stub | **ADD** Plans Home light; Dashboard re-points **later** |
| FR-29 persistence | `data` local adapter | nothing persists but UI prefs | **ADD** `synapse-db:v1` |
| FR-32 bilingual UI | `LanguageProvider` + `t()` | ✓ working | keep; new entities stay language-neutral |
| FR-35 deployment | host contract | none | **ADD** deploy config |
| FR-36 IA / sidebar ordering | routes + `AppLayout` | grouped ten-page nav (`nav-items.ts` NAV_GROUPS) + ⌘K | **CHANGE** ordering to put plan-first front door + Today hub first; retained entries stay |
| FR-37 Study Task | `features/tasks` | closest thing is `PlannerPage` checklist (local state, resets on `resetTick`) — grandfathered | **ADD** task feature; PlannerPage untouched |

## 5. ADDED (Phase 1, the build list)

**New top-level modules (the three seams + core):**

1. `src/domain/` — entity types (`StudyPlan`, `KnowledgeNode`, `Material`, `StudyTask`, `QuizSession`, `Question`, `EvidenceRecord`, `Flashcard`, `MistakeEntry`, `ReadingProgress`, `ChatThread`, `SectionMarking`, `ReadingPosition`), `mastery.ts` (AD-6), consecutive-evidence-days streak rollup. Pure TS, no React imports.
2. `src/data/` — repository interfaces (single owner of domain entities), localStorage adapter over one versioned `synapse-db:v1` document (migrations, synchronous full-doc writes), query keys, `use<Entity>Queries` hooks, `AppError { code, messageKey? }`. Material blobs session-only.
3. `src/ai/` — `CompanionService` interface + deterministic simulated adapter: ReadingPosition-grounded chat, streamed plan-structure generation, mode-based quiz generation (node-attributed), flashcard generation, open-answer grading with rationale.

**New features:** `features/plans` (Plans Home light, plan creation chat, plan detail, UploadDropzone, node list), `features/tasks` (Study Task single-document flow), `features/reader` (PDF page-by-page + per-page text extraction; Markdown + section ids; public `parse(file)` API; position tracking + `?page=N`/`#section-id` anchors + highlight flag), `features/companion` (page-aware `CompanionPanel`, CitationChip grounding), `features/quiz` (in-flow generation + sub-route runner + attempt gate + evidence recording), `features/flashcards` (generation + study session + evidence).

**New routes in `App.tsx`:** `/plans`, `/plan/new`, `/plan/:id`, `/plan/:id/quiz`, `/plan/:id/flashcards`, `/task/new`, `/task/:id`, `/task/:id/quiz`, `/read/:materialId` — plus entry-state logic on `/`.

**New shared components:** `MasteryRing`, `UploadDropzone`, `CitationChip`, node rows/results deltas as needed (cross-feature presentational only).

**New deps:** `pdfjs-dist@6.x`, `react-markdown@10.x`, `rehype-slug@6.x` (pdfjs dynamically imported only inside `features/reader`, AD-8).

**New tests:** `domain/mastery` (uncovered-never-green, rollup-cap-at-100%-only-when-all-nodes-mastered, evidence-only movement), quiz attempt gate, reading-position tracking. Gates: `npx tsc -b` + `npm run lint` + `npm run test`.

**New infra:** static-host deploy config with SPA-fallback rewrite to `index.html`, auto-deploy from `main` (vendor = deploy-task decision).

## 6. CHANGED (surgical edits to existing files)

| File | Change | Driven by |
| --- | --- | --- |
| `src/App.tsx` | `/` renders Onboarding **iff** `!onboardingComplete` (flag read from `synapse-db:v1`), else Plans Home; add all plan-first routes; drop dead `Navigate` import (`App.tsx:2`) | AD-8, FR-1 |
| `src/pages/OnboardingPage.tsx` | Persist the complete flag through the data adapter (not a bare localStorage key — it's a field of the store doc); final CTA navigates to `/` instead of `/dashboard` (`OnboardingPage.tsx:191`) | AD-4, AD-8 |
| `src/components/layout/nav-items.ts` + `AppLayout.tsx` + `CommandPalette.tsx` | Sidebar/⌘K ordering re-pointed: plan-first front door + Today hub first; retained ten-page entries stay below | FR-36, AD-8 |
| `src/pages/SettingsPage.tsx` | "Reset demo data" must also reset `synapse-db:v1` (today `resetAll()` only reseeds in-memory context, `SettingsPage.tsx:204-207`); fix hardcoded "Yinan Chen" (`:68`) | AD-4 (implied), AD-9 |
| `package.json` / lockfile | +3 reader deps | AD-7 |
| `src/contexts/UserProgressContext.tsx` | **Frozen, not edited** — the change is contractual: no new plan-first surface imports or writes it; existing writers (QuizPage, FlashcardsPage, AppLayout, Dashboard…) stay until their FR re-points them | AD-3 |
| `src/pages/NotFound.tsx` | Redirect target `/dashboard` → `/` when FR-1 lands (scaffold "home" redirect clause) | AD-8 |
| `playwright.config.ts` | Unresolved either way: dep `lovable-agent-playwright-config` still absent from package.json; e2e stays deferred (open item, not Phase-1) | AD-10 deferral |

## 7. DELETED (now) vs retired (later)

**Deleted in Phase 1 — dead code only:**

1. Unused `Navigate` import, `App.tsx:2`.
2. Nothing else. (Dual-mode legacy — `LearningModeContext`, `aiOnly`, mode toggle, onboarding mode step — was **already removed** in the 2026-11-01 pass; grep confirms zero remnants.)

**Explicitly NOT deleted in Phase 1 (spine-mandated retention):**

- All ten scaffold pages (`/dashboard` `/ai-tutor` `/materials` `/quiz` `/flashcards` `/mistakes` `/planner` `/achievements` `/analytics` `/settings`) — grandfathered (AD-2), retained destinations per owner round 2026-11-01 (FR-25/26/28/36/46).
- `UserProgressContext` + `lib/demo-data.ts` — frozen demo garnish for those pages (AD-3); the bilingual `{zh,en}` demo-data pattern stays a retained-page pattern (AD-9).
- Inline simulated AI inside `AITutorPage`/`QuizPage` — tolerated inside grandfathered pages; the AD-5 "no component AI" rule binds **new** surfaces.
- Unused `use-mobile` hook and mounted-but-idle `QueryClientProvider` — `lib/`/`hooks/` stay as-is; Query gets real use.

**Retired later (future deletions, each gated by an FR re-point — not Phase-1 work):**

- `UserProgressContext` retires as plan evidence re-points Dashboard/Achievements/Analytics (FR-25).
- `PlannerPage` gives way to plan/task surfaces as FR-36/37 re-point it.
- Retained `/quiz` `/flashcards` `/mistakes` `/planner` pages are replaced by Phase-2 hubs (FR-23/27/41/42).
- `demo-data.ts` shrinks as its consumers migrate.

## 8. Data & entity-shape gaps (summary)

| Concern | Today | Spine target |
| --- | --- | --- |
| Data layer | `lib/demo-data.ts` static bilingual constants, imported directly by pages | `data/` repositories + Query; demo-data retained pages only |
| Persistence | none for domain data (in-memory context; UI prefs in 4 localStorage keys) | one `synapse-db:v1` JSON doc with `version`; migrations owned by adapter; blobs session-only |
| Mastery | 3 topic numbers; deltas computed in `QuizPage` | EvidenceRecord[] → per-node score → plan rollup, single pure fn; task = exactly 1 auto-node (`planId:null`) |
| Quiz grading | open-answer keyword-hit count ≥2 (`QuizPage.tsx:276-285`) | `CompanionService` grading with rationale; every Question node-attributed at generation |
| Streak | seed integer `5` | consecutive-evidence-days rollup in `domain/` |
| IDs / dates | demo strings | `crypto.randomUUID()`, ISO 8601 |
| Errors | none modeled | typed `AppError { code, messageKey? }` → sonner toasts |
| Language of entities | inline `{zh,en}` objects in demo-data | domain entities language-neutral; `{zh,en}` pattern retained-pages-only |

## 9. Dependencies diff

| Package | Status |
| --- | --- |
| `pdfjs-dist@6.x` | **add** (dynamic import, reader only) |
| `react-markdown@10.x`, `rehype-slug@6.x` | **add** |
| `@tanstack/react-query@5` | installed, provider-only → **starts being used** (no version change) |
| `next-themes` | installed; only consumed by stock `components/ui/sonner.tsx` — see §10 |
| `lovable-agent-playwright-config` | still missing from package.json — e2e deferred (open item) |
| everything else | unchanged |

## 10. Non-spine observations (code health noticed during the sweep)

Not mandated by the spine; fix opportunistically when the file is next touched:

1. **Sonner theme disconnect** — `components/ui/sonner.tsx` reads `useTheme` from `next-themes`, which knows nothing of the app's `ThemeContext`; toasts won't follow the sunset/twilight/aurora palettes. Wire the wrapper to the real theme when toasts become user-critical (new surfaces will lean on sonner per AD-9).
2. **Hardcoded user strings** — "Yinan Chen" (`AppLayout.tsx:114`, `SettingsPage.tsx:68`), "Yinan" (`DashboardPage.tsx:87`), plus counters "/ 12" (`AchievementsPage.tsx:33`) and "6" (`AnalyticsPage.tsx:179`) violate AD-9's no-hardcoded-strings rule; grandfathered until re-pointed, but new surfaces must not copy the pattern.
3. `AppLayout` reads `progress.level/points/streak` from the frozen context (`AppLayout.tsx:18`) — the chrome itself is a UserProgress consumer; when FR-25 re-points, the sidebar footer switches to plan-evidence-derived stats.
4. `NotFound.tsx:12` still ships a scaffold `console.error`.

---

**Snapshot provenance:** code facts verified by full-file read of `src/App.tsx`, all 12 pages, 3 contexts, `nav-items.ts`, `AppLayout.tsx`, `CommandPalette.tsx`, `demo-data.ts`, `themes.ts`, `src/test/*` at `0ecca73` (2026-11-02). Spine = `architecture-synapse.md` (final, 2026-11-02, 11 ADs). This document is a snapshot, not a decision record — when code and this doc drift, the spine wins.
