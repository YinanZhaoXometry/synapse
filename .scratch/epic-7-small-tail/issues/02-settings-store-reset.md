# T2: Settings store reset covers the plan-first store (AD-4)

Status: ready-for-agent
Milestone: Phase 1 — Nov 6 core
Blocked by: —

## Parent

[Epic 7](../epic.md) (scale-ladder row 1 — no spec chain, implement directly from this ticket).

## What to build

The Settings reset currently calls `useUserProgress().resetAll()` only — it resets the frozen demo store but **`synapse-db:v1` survives** (verified 2026-11-03: `SettingsPage.tsx` wires the AlertDialog to `resetAll()` + toast; the AD-4 document at `src/data/document.ts` `STORAGE_KEY = "synapse-db:v1"` is untouched). After epic-2, that means a user who "resets" keeps all their real plans/materials/reading progress — reset semantics are now wrong for the primary store.

Extend the reset to wipe **study data** in one action: the whole `synapse-db:v1` document (wholesale clear — future-proof: epic-5/6 add repositories under the same versioned document, AD-4, so no per-key list to maintain) **plus** the UserProgress demo reset, then reload into the first-run state. **UI preferences are explicitly retained** — `synapse-lang`, `synapse-theme`, `synapse-mode`, `synapse-motion` survive a reset (reset means study data, not theme). Update the confirm-dialog copy (`settings.resetTitle`/`settings.resetBody`) to say what actually gets wiped now, zh + en.

Implementation seam: add a `resetAll()` (or `destroy()`) on the data adapter in `src/data/store.ts` / repository surface rather than deleting the key ad hoc from the page — AD-3/AD-4: the adapter owns the document's lifecycle.

## Acceptance criteria

- [ ] Confirm reset → app returns to the first-run entry state (onboarding/entry states at `/`; Plans Home empty; no plans, materials, tasks, quiz/flashcard evidence, mistakes, threads, or reading positions remain)
- [x] Verified by test: reset clears `synapse-db:v1` (storage key gone or an empty document per the adapter's contract) and UserProgress is re-seeded
- [x] Language + theme/motion preferences survive the reset
- [x] Reset goes through the data adapter's public surface, not a direct `localStorage.removeItem` in the page (AD-3/AD-4)
- [x] Dialog copy updated, i18n parity zh + en (`settings.reset*` keys)
- [x] Gates green (`node_modules/.bin/tsc -b`, `node_modules/.bin/eslint .`, `node_modules/.bin/vitest run`)

## Comments

- 2026-11-03 — Ticket pre-created with the epic's coupling map. Weak coupling only: epic-5/6 add repositories under the same `synapse-db:v1` document, which the wholesale clear already covers — re-verify the key inventory at epic close (epic.md DoD), not before starting.
- 2026-11-03 — Implemented on `epic/7/T2-settings-reset` (TDD). Red first: new `src/pages/SettingsPage.test.tsx` drove the confirm flow over the real repositories and failed at `loadDb() ≠ emptyDb()` — the seeded plan/material/reading-progress survived the old `resetAll()`-only handler. Green after wiring the handler to `resetAll()` + `resetDb()` (imported from `@/data`; the adapter's public surface — `resetDb()` had zero callers before this ticket) + `window.location.replace("/")` for the first-run reload. Adapter contract pinned in `src/data/store.test.ts`: empty document, `version` kept, key retained, UI-pref keys untouched. Copy updated zh+en: `settings.reset` (trigger said "demo data" — a lie once real data dies), `settings.resetTitle`, `settings.resetBody`, `common.resetDone`. Gates: vitest 54 files / 403 tests green (baseline 53/400), `tsc -b` exit 0, eslint 0 errors (10 pre-existing react-refresh warnings, none in touched files).
- 2026-11-03 — AC 1 left unchecked, deliberately: every app-controlled link is test-verified (document provably `emptyDb()` — covers plans/nodes/materials/tasks/sessions/questions/evidence/flashcards/mistakes/readingProgress/chatThreads/sectionMarkings + `onboardingComplete:false`; `location.replace("/")` fired; `resolveEntryDestination(false) → "onboarding"` per the existing entry-decision tests; EntryGate renders the wizard on that), but the final leg — the live browser actually reloading and rendering the first-run wizard at `/` — is browser-only and was not manually verified (jsdom stubs `location.replace`). Worth a 30-second manual pass post-merge. Status kept `ready-for-agent` on that basis.
