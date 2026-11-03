# 05: PPT upload — `.pptx` client-side parse extension (owner Q6)

**What to build:** accept `.pptx` in the attach flows: the reader's public `parse(file)` API gains a PPT parser (slide title + extracted text → sections; image-only slides yield what text exists — limitation stated in UI); flows unchanged otherwise (metadata + sections + parse state; post-cutover: presign upload of the original); rejection message for PPT retires.

**Blocked by:** None — **designated lane filler; runnable any time after epic-00** (pure client-side work per AD-7).

**Status:** ready-for-agent

**Bound by:** owner Q6 (PPT arrives in Phase 2), AD-7 (client-side parsing; parse API unchanged shape), FR-2's rejection consequence (superseded for pptx).

- [ ] Fixture `.pptx` parses to sections; attach → study round-trip works
- [ ] Parser lazily loaded like pdfjs (bundle discipline)
- [ ] Bilingual messaging incl. the text-extraction limitation note
