# 04: Anki export per material deck

**What to build:** On a material's flashcard deck view, the student clicks 导出 Anki and downloads a `.txt` that Anki 2.1.55+ imports directly: one row per card (front / back / deck / tags / guid), deck named `Synapse::<material title>`, tags `synapse` + material slug. The GUID is a stable content hash of the card's fields — re-importing a re-export updates the student's existing Anki notes instead of duplicating them. Card Markdown survives as light HTML (bold/italic/inline code, line breaks); unknown materials surface the standard not-found error.

**Blocked by:** 02 (serializes the two schema.graphql movers in this epic).

**Status:** done (2026-11-11)

- [ ] New GraphQL query returns the export text for a material's deck; unknown material → the closed error enum's NOT_FOUND; empty deck → valid headers-only file (not an error)
- [ ] Exact TSV format pinned by request specs: the five Anki header lines, tab-separated rows, deck naming, tag slug, field sanitization (tabs/newlines stripped from fields)
- [ ] GUID = stable content hash over the card's fields — byte-identical across content-identical re-exports; changes when any field changes (update-not-duplicate demonstrated in specs)
- [ ] Markdown→HTML pass covers bold, italic, inline code, newline→`<br>`; no MathJax translation (spec D6's stated posture)
- [ ] Deck view gains the export action (zh/en i18n keys pass the full-table parity test); clicking downloads the response as a `.txt` Blob named after the material (component test, userEvent-first)
- [ ] schema.graphql regenerated (codegen gate); gates green: rspec, rubocop, tsc, eslint, vitest
