# 01: Selection shortcuts — Ask Companion / Quick Test bar (FR-13)

**What to build:** text-selection bar with two one-click actions: **Ask Companion** (grounded in the selection — extends the AD-5 grounding input with selection text + position) and **Quick Test** (launches T2); works on Markdown selections and PDF text-layer selections; keyboard-reachable; UX per the spine's selection-bar pattern.

**Blocked by:** None (epic gate: 08 done).

**Status:** done

**Bound by:** FR-13, AD-5 (selection grounding rides the contract — UI renders, never guesses), AD-9 (keyboard-complete, both themes).

- [x] Selection detected on md + pdf fixtures; bar appears anchored to the selection
- [x] Ask Companion answers grounded in the selection with citation
- [x] Quick Test entry hands the selection/section scope to T2's flow

## Comments

### 2026-11-05 — T1 implementation (epic/p2-13-t01-selection)

**Delivered:** the reader's floating selection bar (`frontend/src/features/reader/selection-bar.tsx`) — 「问 Companion」+「快测」 on any text selection inside the reader content (markdown prose + the PDF text layer), anchored viewport-clamped beside the selection (pure math in `selection-capture.ts`'s `barAnchor`: centered above, flips below near the top, 8px gutters), dismissing on any scroll / viewport resize / collapse / Escape. Buttons are native `<button>` (focusable, Enter/Space); the bar suppresses `mousedown` default so pressing an action never collapses the selection it acts on.

**Capture (pure, heavily tested):** `selection-capture.ts` maps a DOM Selection → the AD-2 shapes verbatim (`{kind:"markdown", sectionId, text}` / `{kind:"pdf", page, text}`). Section resolution: ancestor heading id first, then — flat prose being the react-markdown shape — the nearest heading BEFORE the anchor node in document order; cross-section/cross-page selections clamp to the anchor side (the FIRST section — where the selection started); text above the first heading maps to the intro id (T3's contract, `introSectionId`); whitespace-only/collapsed/outside-root selections capture nothing (the bar never triggers on a click-through). PDF capture keys off the page containers' `data-page` (PdfPageFlow); a non-numeric `data-page` captures nothing honestly.

**PDF text layer (built here — T3 reuses):** PdfPageFlow rendered canvases only, so PDF selection was physically impossible; `pdf-render.ts` gains `renderTextLayer` (pdfjs 6 `TextLayer` over `page.streamTextContent()`, cancellable like the canvas render) mounted in the same lazy render window (`PdfPageCanvas`), with the viewer stylesheet's `.textLayer` CSS contract ported verbatim into `index.css` (`.pdf-text-layer`; transparent spans over the canvas, `::selection` on the citation-tint token — theme-coherent in both modes). T3's annotation ranges can drive this same layer.

**Ask = honest grounding twice over:** the composer pre-fills with a question quoting the selection (`companion.askWithSelection`, `{quote}` — the user SEES exactly what rides) AND the selection text rides the wire as a dedicated field: `CreateStreamTicketInput.selection` (optional, question-bounded, blank → key never rides — the frozen payload shape is unchanged for bar-less turns) → the ticket payload's `selection` key → `Ai::ContextAssembler.companion_grounding(material, position, selection:)` prepends a `[selection]` block FIRST (tightest grounding wins the earliest tokens), same budget discipline as every block (whole while it fits, hard-cut with the marker, `truncated` honest, estimate ≤ budget). Consumed exactly once: the pending-selection ref clears at send time, so a later turn grounds on its own position; escalation/retry replay the turn's OWN selection. One latent fix this forced: the position block compared against the FULL budget instead of `budget - consumed` (invisible while position was always first; the composition case overflowed — now the same discipline as every other block).

**The Quick Test seam (T1 → T2 handoff — T2 fills this):** `frontend/src/features/reader/quick-test-seam.ts` — `registerQuickTestHandler(fn) → unregister()` (ONE slot, latest registration wins) + `dispatchQuickTest({materialId, selection}) → boolean`. The bar's 快测 button dispatches; when NO handler is registered (T2 has not landed) it toasts the honest 「快测将在下一步开放。」 — a live affordance, never a dead button and never a fake flow. **T2's wiring contract:** its reader-level flow calls `registerQuickTestHandler` on mount (dispose on unmount) and receives `{materialId, selection}` — the selection scope this bar captured; section-level scope rides as the markdown `{sectionId}` / pdf `{page}` locator inside the same shape. No URL params were invented for the v1 — the seam keeps the bar shippable per-ticket without fake affordances.

**Schema movement:** `CreateStreamTicketInput.selection: String` (optional) — `backend/schema.graphql` re-dumped (7 lines; idempotent dump spec green); frontend `pnpm run codegen` regenerated the committed TypedDocumentNodes (6 lines).

**Deviations/notes:**
- The keyboard path to select-all-in-section is NOT built (per ticket scoping: mouse/touch selection is primary; keyboard users keep the panel's starter/intent path).
- ReaderPage's layer-Escape handler now yields to the bar while it is open (the bar's own Escape dismisses the bar, not the panel beneath).
- One vitest flake observed once during gate runs (never reproduced across 3 consecutive full runs — 706/706 green each); not attributable to this ticket's deterministic tests.

**Gates:** backend rubocop clean (418 files) + rspec **1125**/0 (baseline 1117 + 8 new: payload bound/omission, assembly prepend/blank/budget, wire mint, stream grounding) in fresh-db compose form. Frontend: codegen ✓ · `tsc -b` ✓ · eslint 0 errors (warnings pre-existing, untouched files) · vitest **706**/0 (baseline 676 + 30 new) · `vite build` ✓.
