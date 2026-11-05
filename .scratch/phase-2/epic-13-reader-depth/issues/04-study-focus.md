# 04: Study Focus — annotation-derived core items, regenerable (FR-17, OQ-1)

**What to build:** Companion-generated Study Focus (core study items) from one Material's Annotations; regenerable as annotations change (regeneration replaces v1); **display placement per OQ-1 delta-grill** (recommendation: reader-side panel on demand); items link back to their annotation locations.

**Blocked by:** 3.

**Status:** done

**Bound by:** FR-17, AD-5/16 (AI seam; cap-counted), AD-8 (anchor channel for item links).

- [x] OQ-1 placement ruling recorded in `## Comments`
- [x] Generation from fixture annotations; regeneration replaces; items deep-link to sources
- [x] No-annotations empty state honest and bilingual

## Comments

### 2026-11-05 — OQ-1 ruling (delta review, decide-all delegation)

Recorded at kickoff, applied verbatim here: **reader-side panel on demand** — a collapsible 「核心要点」panel toggled from the reader toolbar; items generated from the material's annotations through the AD-16 seam (cap-counted sync command like generateNote); regeneration REPLACES; items deep-link via the anchors channel.

### 2026-11-05 — T4 implementation (epic/p2-13-t04-studyfocus)

**Delivered:** the OQ-1 panel lives in the reader's material zone beside T3's annotations card (`study-focus-panel.tsx` — same anatomy: header + close, scrollable body, Esc in the layer ladder; the two left cards are mutually exclusive since they share the same spot). Toolbar gains the 核心要点 toggle (`ListChecks`). Content: the active set's items render textually (title + detail, AD-9), each linkable row is ONE button deep-linking through the anchor channel (`jumpToLocator` — scroll + flash, the citation chips' channel) with the locator derived from the server-owned `sourceRange` (`focusSourceLocator`, its own module so the panel stays component-only); a range-less (pre-T3 import) source renders text-only, honestly unlinkable. The header carries the generation chip (vN — reads the refetched row). Empty states honest + bilingual: no annotations → 无标注——先在正文上划选标注 (no generate CTA — the server would refuse); annotations but no set → the 生成核心要点 CTA; a set → 重新生成. Generation toasts ride the closed-enum map (`apiErrorKeys("ai.generate.")` — capReached included); regenerate carries the read-back sweep (fresh set = render truth, nothing patched client-side).

**Storage shape (PICK, recorded per the ticket note):** a `study_focus_sets` single-row-per-material set — `user_id` + `material_id` + `client_uuid` + `items` jsonb (`[{ id, title, detail, sourceRange }]`, string-keyed TS keys verbatim, sourceRange = the annotation range jsonb VERBATIM — the deep-link shape) + `generation` int (DB default 1) — with the UNIQUE index on (user_id, material_id) as the one-active-set law at the storage layer. Regeneration updates the row in place and bumps `generation` (no forked history v1). NOT per-item rows (items are one generation's output, replaced atomically; a row-per-item shape would need a generation-scoped delete+insert dance for the same read).

**Replay key design (delta 3, adapted):** `client_uuid` is a dedicated GLOBALLY-UNIQUE column — the replay key of the set's LAST generation. An owned uuid returns the set untouched without a provider call (a timeout retry never spends two cap calls); a foreign uuid is VALIDATION_FAILED before anything is spent; the lookup runs BEFORE the ≥1-annotation gate so a retry stays safe even if annotations changed between attempt and retry. Regeneration replaces the key along with the items — an older generation is deliberately no longer addressable (regeneration REPLACES). Unlike Notes, the uuid is NOT the row id (the row persists across generations, so a row-id key would break the replace-in-place law).

**Backend:** `Ai::GenerateStudyFocusCommand` mirrors GenerateNoteCommand (language → uuid shape → material through `current_user` uniformly NOT_FOUND → replay → gate → assemble → ONE cap-counted `Ai::Provider.complete` → normalize → persist). The gate is honest: zero annotations → VALIDATION_FAILED (nothing to distill; the frontend hides the action anyway). Context assembly = new `Ai::ContextAssembler.annotation_scope` — the material's annotations ride FIRST as numbered `[annotation N]` lines (kind + address + offsets + quoted span — the distillation source of truth), then the section index for coherence ONLY; the mapping_scope budget discipline (annotations hard-truncated honestly when they alone exceed the budget; index fills the remainder whole or marker-cut). `Ai::Prompts.studyFocus` targets ~5 items (`FOCUS_TARGET`) with the NFR-1 line doubled down (index is never a content source) and the reply contract `{"items":[{title, detail, sourceAnnotationIndex}]}`. The index map is SERVER-owned: a strict Integer 1..count resolves to that annotation's range jsonb; out-of-range/non-integer DROPS the item (an honest count landing below target); blank title/detail drops too (the flashcards normalize posture); zero survivors → INTERNAL (provider-contract violation). Item ids are server-minted (the flashcards posture). Ops: `studyFocus(materialId:)` (bare sanctioned read — the scoping IS the logic; null = never distilled) + `generateStudyFocus` (verb-first, `clientUuid`/`language`/`materialId`).

**Schema movement:** `backend/schema.graphql` re-dumped (+135 lines: StudyFocusSet/StudyFocusItem types, the query + the mutation; dump idempotency green in the suite); `db/schema.rb` carries the table + validated FKs; frontend `pnpm run codegen` regenerated the committed TypedDocumentNodes (study-focus.graphql: StudyFocusItemParts/StudyFocusSetParts fragments + StudyFocus/GenerateStudyFocus).

**Deviations/notes:**
- Items sourced to a range-less annotation carry `sourceRange: null` and render WITHOUT a deep link — the locator alone would invent no address; honest unlinkable (recorded on the type + the panel).
- The auth roster (`auth_surface_spec`) grew by `generateStudyFocus` (the roster-keeper pattern).
- One flaky vitest run observed mid-ticket (1 unrelated failure that did not reproduce in two consecutive full green runs — no reader file involved); noted for honesty, not addressed here.

**Gates:** backend rubocop clean (443 files) + rspec **1233**/0 (baseline 1188 + 45: 41 written across model 12 / command 23 / wire 6 + 4 auto-added by the user-scoping roster keeper discovering `StudyFocusSet`) in fresh-db compose form (`-p synapse-t13t04` isolated project, `!override` port file, teardown, no repo files). Frontend: `pnpm install --frozen-lockfile` ✓ · codegen ✓ · `tsc -b` ✓ · eslint 0 errors (15 warnings, all pre-existing untouched files) · vitest **781**/0 (baseline 769 + 12: panel 10 + locator 2) × two consecutive green runs · `vite build` ✓.
