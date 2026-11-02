import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, titleFromFilename, validateUpload } from "./upload-validation";

/**
 * Upload validators (spec testing seam 3; Q8): pure accept/reject/size logic.
 * Files enter as plain { name, type, size } — structural typing means a real
 * File satisfies it, and no DOM is needed to test (Q8: no DOM tests).
 * Discriminants are checked with `in` guards: strictNullChecks is off, so
 * boolean narrowing would not discriminate the union.
 */
const file = (name: string, type: string, size: number) => ({ name, type, size });

describe("upload validators — accept list (PDF / Markdown only)", () => {
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

  it("rejects unsupported types with the bilingual reason key naming what is supported (PPT = Phase 2)", () => {
    const rejects = [
      file("deck.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", 100),
      file("essay.txt", "text/plain", 100),
      file("noext", "", 100),
    ];
    for (const f of rejects) {
      const v = validateUpload(f);
      expect(v.ok).toBe(false);
      if ("messageKey" in v) expect(v.messageKey).toBe("errors.uploadUnsupportedType");
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

describe("upload validators — 20 MB size boundary", () => {
  it("a byte just under the cap passes", () => {
    expect(validateUpload(file("big.pdf", "application/pdf", MAX_UPLOAD_BYTES - 1)).ok).toBe(true);
  });

  it("a file of exactly the cap is rejected with the too-large reason key", () => {
    const v = validateUpload(file("big.pdf", "application/pdf", MAX_UPLOAD_BYTES));
    expect(v.ok).toBe(false);
    if ("messageKey" in v) expect(v.messageKey).toBe("errors.uploadTooLarge");
  });

  it("a clearly oversized file is rejected with the too-large reason key", () => {
    const v = validateUpload(file("huge.md", "text/markdown", MAX_UPLOAD_BYTES + 5_000_000));
    expect(v.ok).toBe(false);
    if ("messageKey" in v) expect(v.messageKey).toBe("errors.uploadTooLarge");
  });

  it("wrong type is reported even when the file is also oversized (type is the primary reason)", () => {
    const v = validateUpload(file("deck.pptx", "", MAX_UPLOAD_BYTES + 1));
    expect(v.ok).toBe(false);
    if ("messageKey" in v) expect(v.messageKey).toBe("errors.uploadUnsupportedType");
  });
});
