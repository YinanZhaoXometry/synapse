# 05: PPT upload — `.pptx` client-side parse extension (owner Q6)

**What to build:** accept `.pptx` in the attach flows: the reader's public `parse(file)` API gains a PPT parser (slide title + extracted text → sections; image-only slides yield what text exists — limitation stated in UI); flows unchanged otherwise (metadata + sections + parse state; post-cutover: presign upload of the original); rejection message for PPT retires.

**Blocked by:** None — **designated lane filler; runnable any time after epic-00** (pure client-side work per AD-7).

**Status:** done

**Bound by:** owner Q6 (PPT arrives in Phase 2), AD-7 (client-side parsing; parse API unchanged shape), FR-2's rejection consequence (superseded for pptx).

**Decision record — parser dependency (the ticket's first order of business):** picked **(a) `jszip` + hand-rolled slide XML extraction** over a pptx-specific lib. A pptx IS a zip of slide XML; the `<a:t>`-run extraction is ~100 lines (parse-pptx.ts), jszip is ~98 KB that ships as its OWN lazy chunk (`jszip.min-*.js` in the build output — the pdfjs discipline: dynamically imported inside parse-pptx only, loaded only when a pptx is actually parsed), and no third-party pptx lib is needed for text extraction (they buy rendering we don't do). Added with pnpm only (`frontend/package.json` + lockfile).

**Decision record — server kind (orchestrator-pinned):** pptx parses to **markdown-kind** sections client-side; the material rides the EXISTING markdown pipeline end-to-end (attach → presign as `text/markdown` → sections → reader render → quiz sourcing); server kind enum untouched (backend zero-diff verified). The presign content-type allowlist needed no change: `material-queries.ts` already maps kind→contentType (`markdown` → `text/markdown`), and the PUT is signed over that declared type. The original `.pptx` still downloads via the presigned GET (`downloadUrl` is content-type-agnostic); the stored object key's extension is `.md` (derived from the validated content type — cosmetic, accepted by the pin).

**Decision record — parse dispatch:** `ParseInput` is bytes in (AD-7), so `.pptx` dispatch is by the **zip magic bytes** (PK\x03\x04) on the markdown kind — the parse(file) API shape is byte-true unchanged (no filename/mime plumb-through; the caller can't tell). Plain markdown text never starts with binary control bytes; a zip that isn't a pptx fails honestly with the corrupt reason (`InvalidPPTXException` → classifier).

**Known limitation (accepted under the slide-N pin):** persisted sections carry `slide-N` ids (the pdf `page-N` mirror), while the rendered markdown view's anchors are the slide-title slugs — quiz/mistake citation chips pointing at a pptx section deep-link to a `#slide-N` hash that no rendered heading carries, and MarkdownFlow's stale-hash behavior scrolls nothing (honest no-op). Position tracking, selection, annotations and Quick Test all ride rendered ids, so they work untouched.

- [x] Fixture `.pptx` parses to sections; attach → study round-trip works (fixture BUILT in-test with jszip — no binary fixture committed; round-trip pinned at the parse-material bridge)
- [x] Parser lazily loaded like pdfjs (bundle discipline — own chunk proven in `vite build` output)
- [x] Bilingual messaging incl. the text-extraction limitation note (`reader.pptxTextOnlyNote`, attach-time toast in plan/task/reader-reupload flows; `errors.uploadUnsupportedType` copy no longer defers PPT — residue-asserted both locales)
- **Two-axis review (2026-11-05, inline):** PASS/PASS — jszip lazy chunk proven in build output (97.6kB own chunk); in-test zip-bytes fixture (no binary committed); dispatch by zip magic bytes keeps the parse API byte-true (AD-7); server kind stays markdown with zero backend diff; limitation toast at all four picker sites; known limitation honest (slide-N chips no-op on rendered hash — recorded). Merged on `epic/p2-13-reader`.
