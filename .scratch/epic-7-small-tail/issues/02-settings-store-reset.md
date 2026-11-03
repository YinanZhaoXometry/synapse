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
- [ ] Verified by test: reset clears `synapse-db:v1` (storage key gone or an empty document per the adapter's contract) and UserProgress is re-seeded
- [ ] Language + theme/motion preferences survive the reset
- [ ] Reset goes through the data adapter's public surface, not a direct `localStorage.removeItem` in the page (AD-3/AD-4)
- [ ] Dialog copy updated, i18n parity zh + en (`settings.reset*` keys)
- [ ] Gates green (`node_modules/.bin/tsc -b`, `node_modules/.bin/eslint .`, `node_modules/.bin/vitest run`)

## Comments

- 2026-11-03 — Ticket pre-created with the epic's coupling map. Weak coupling only: epic-5/6 add repositories under the same `synapse-db:v1` document, which the wholesale clear already covers — re-verify the key inventory at epic close (epic.md DoD), not before starting.
