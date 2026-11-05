# 03: Reader marking UI — claim, green, unmark, confirm quiz

**What to build:** the FR-15 surface in the reader (both markdown and PDF paths):

1. **Claim affordance:** a compact hover-revealed control anchored at each section start — markdown: beside the section heading (`markdown-view.tsx` heading component already renders `relative scroll-mt-8` headings with the id = section slug; the flash overlay at :51-60 is the anchoring precedent); PDF: on the page element (`PdfPageFlow.tsx:438` `data-page` = `page-${n}`). The control claims the section via `useClaimSectionMutation`.
2. **Green display:** open claims render the section-start green — `bg-mastered-tint` strip + `--mastered-ink` icon/edge (tailwind classes `bg-mastered-tint`, `text-mastered-ink` exist; `.tint-green` utility too). Always visible while claimed, palette-safe by construction (tokens live in `:root`/`.dark`, untouched by the palette switcher). **v1 scope per spec decision 2:** section-start treatment, not full-section background — record the delivered scope honestly in the ticket close.
3. **Unmark:** on the claimed state, the control flips to unmark (`useUnclaimSectionMutation`). Per the PRD, unmarking clears the claim; the evidence trail is server-side and untouched.
4. **Confirm-quiz launcher:** the claimed state offers 确认测验/Confirm quiz — dispatch through `quick-test-seam.ts` `dispatchQuickTest` scoped to exactly that sectionId (the seam's scope shape decides the exact payload — read it; the Quick Test flow's material scope + `targetCount = 4` covers the short-quiz shape per epic-13 T2's recorded note). Honest toasts on dispatch failure (the seam returns false).
5. **Persistence:** claims restore on reader load via `useSectionMarkingsQuery(materialId)` — open rows drive the green display (PRD: "marking persists across sessions; the green marking displays immediately as a claim").
6. **i18n mandatory:** every user-facing string as a dotted key with `{ zh, en }` in `frontend/src/contexts/i18n-dictionary.ts` (e.g. `marking.claim`, `marking.unmark`, `marking.confirmQuiz`, failure toasts). No hardcoded strings.
7. **Both modes verified:** dark mode + a non-default palette (the tokens are palette-safe; verify visually anyway per the house dark-mode rule).

**Blocked by:** 02.

**Status:** ready-for-agent (pending 02)

**Bound by:** FR-15 (claim ≠ evidence — no mastery writes anywhere in this ticket), AD-7 (client-side rendering), AD-9 (accessibility floor — the control is a real button with an accessible name, keyboard reachable), AD-14 (mastery display server-scored; the reader never recomputes), the theme-token rule (no raw palette classes, no hardcoded whites/corals), sonner for toasts (AD-9).

- [ ] Claim/unmark round-trips against the real ops (dev stack smoke: claim → reload → green persists → unmark → reload → gone).
- [ ] Confirm-quiz launcher dispatches a section-scoped Quick Test session and the reader takes over per the existing `?quicktest=` flow.
- [ ] Vitest for the new pure logic (open-claim derivation per section, affordance state machine, launcher dispatch payload) — colocated, house shape; UI rendering covered to the same depth the reader's existing components are (match local precedent, no new harness).
- [ ] i18n keys land for both languages; no `t()`-bypassing strings.
- [ ] Frontend gates green in the ticket worktree (`pnpm install --frozen-lockfile`, codegen, `tsc -b`, eslint, `vitest run`, `vite build` — direct bin calls, pnpm only).
- [ ] `tsc -b` explicitly (build alone does NOT typecheck).

## Comments

- **Assigned 2026-11-06** (night run, epic-15, after 02). Placement decision + green-scope rationale live in [epic.md](../epic.md) — do not re-litigate them in-ticket; deviations get recorded, not silently fixed.
