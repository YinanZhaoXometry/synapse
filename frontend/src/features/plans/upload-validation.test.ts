import { describe, expect, it } from "vitest";
import { translations } from "@/contexts/i18n-dictionary";
import { MAX_UPLOAD_BYTES, titleFromFilename, validateUpload } from "./upload-validation";

/**
 * Upload validators (spec testing seam 3; Q8): pure accept/reject/size logic.
 * Files enter as plain { name, type, size } — structural typing means a real
 * File satisfies it, and no DOM is needed to test (Q8: no DOM tests).
 * Discriminants are checked with `in` guards: strictNullChecks is off, so
 * boolean narrowing would not discriminate the union.
 *
 * epic-13 T5 (owner Q6): `.pptx` joins as a MARKDOWN-pipeline input — the
 * reader parses it client-side into markdown-kind sections, so the attach
 * attach surface validates it exactly like a .md (kind markdown, same cap),
 * and the retired "PPT comes later" rejection copy must be gone (residue).
 */
const file = (name: string, type: string, size: number) => ({ name, type, size });

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

describe("upload validators — accept list (PDF / Markdown / PPT)", () => {
  it("accepts a .pdf by extension and derives kind + title", () => {
    expect(validateUpload(file("Lecture 4.pdf", "application/pdf", 1_234_567))).toEqual({
      ok: true,
      kind: "pdf",
      title: "Lecture 4",
    });
  });

  it("accepts markdown via .md and .markdown extensions", () => {
    expect(validateUpload(file("notes.md", "text/markdown", 100))).toEqual({
      ok: true,
      kind: "markdown",
      title: "notes",
    });
    expect(validateUpload(file("notes.markdown", "", 100))).toEqual({
      ok: true,
      kind: "markdown",
      title: "notes",
    });
  });

  it("falls back to the content-type for extension-less filenames", () => {
    expect(validateUpload(file("syllabus", "application/pdf", 100))).toEqual({
      ok: true,
      kind: "pdf",
      title: "syllabus",
    });
    expect(validateUpload(file("reader-notes", "text/markdown", 100))).toEqual({
      ok: true,
      kind: "markdown",
      title: "reader-notes",
    });
  });

  it("accepts a .pptx as a markdown-pipeline input (epic-13 T5: client-side parse, kind stays markdown)", () => {
    expect(validateUpload(file("Lecture deck.pptx", PPTX_MIME, 5_000_000))).toEqual({
      ok: true,
      kind: "markdown",
      title: "Lecture deck",
    });
    // extension-less filenames fall back to the content type, like the other kinds
    expect(validateUpload(file("deck", PPTX_MIME, 100))).toEqual({
      ok: true,
      kind: "markdown",
      title: "deck",
    });
  });

  it("rejects unsupported types with the bilingual reason key naming what is supported", () => {
    const rejects = [file("essay.txt", "text/plain", 100), file("noext", "", 100)];
    for (const f of rejects) {
      const v = validateUpload(f);
      expect(v.ok).toBe(false);
      if ("messageKey" in v) expect(v.messageKey).toBe("errors.uploadUnsupportedType");
    }
  });

  it("residue: the rejection copy no longer defers PPT — it now names PPT as supported (zh + en)", () => {
    for (const locale of Object.values(translations) as Record<string, string>[]) {
      const copy = locale["errors.uploadUnsupportedType"] ?? "";
      expect(copy).toMatch(/PPT/); // PPT is on the accept list, in both locales
      expect(copy).not.toMatch(/Phase 2/); // the retired deferral phrasing is gone
    }
  });

  it("a named extension wins over a contradictory content-type (.txt claiming markdown is still rejected)", () => {
    const v = validateUpload(file("essay.txt", "text/markdown", 100));
    expect(v.ok).toBe(false);
    if ("messageKey" in v) expect(v.messageKey).toBe("errors.uploadUnsupportedType");
  });

  it("title comes from the filename minus its final extension only", () => {
    expect(titleFromFilename("My.Notes.v2.md")).toBe("My.Notes.v2");
    expect(titleFromFilename(".md")).toBe(".md"); // degenerate name falls back to itself
  });
});

describe("upload validators — 20 MB size boundary (FR-2: ≤ 20 MB uploads without error)", () => {
  it("a byte just under the cap passes", () => {
    expect(validateUpload(file("big.pdf", "application/pdf", MAX_UPLOAD_BYTES - 1)).ok).toBe(true);
  });

  it("a file of exactly the cap passes (≤ 20 MB is allowed)", () => {
    const v = validateUpload(file("big.pdf", "application/pdf", MAX_UPLOAD_BYTES));
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.kind).toBe("pdf");
  });

  it("a byte over the cap is rejected with the too-large reason key", () => {
    const v = validateUpload(file("big.pdf", "application/pdf", MAX_UPLOAD_BYTES + 1));
    expect(v.ok).toBe(false);
    if ("messageKey" in v) expect(v.messageKey).toBe("errors.uploadTooLarge");
  });

  it("a clearly oversized file is rejected with the too-large reason key", () => {
    const v = validateUpload(file("huge.md", "text/markdown", MAX_UPLOAD_BYTES + 5_000_000));
    expect(v.ok).toBe(false);
    if ("messageKey" in v) expect(v.messageKey).toBe("errors.uploadTooLarge");
  });

  it("a pptx over the cap is rejected with the too-large reason key (kind accepts, size still bounds)", () => {
    const v = validateUpload(file("deck.pptx", PPTX_MIME, MAX_UPLOAD_BYTES + 1));
    expect(v.ok).toBe(false);
    if ("messageKey" in v) expect(v.messageKey).toBe("errors.uploadTooLarge");
  });

  it("wrong type is reported even when the file is also oversized (type is the primary reason)", () => {
    const v = validateUpload(file("notes.txt", "", MAX_UPLOAD_BYTES + 1));
    expect(v.ok).toBe(false);
    if ("messageKey" in v) expect(v.messageKey).toBe("errors.uploadUnsupportedType");
  });
});
