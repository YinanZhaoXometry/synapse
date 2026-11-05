import { describe, expect, it } from "vitest";
import { REUPLOAD_MAX_BYTES, reuploadKind, validateReupload } from "./reupload";

/**
 * Reader re-upload contract (FR-29 relaxed): kind match + attach cap, pure
 * seam. Prior art: upload-validation.test.ts (the epic-2 contract mirrored
 * here — AD-2 keeps the reader from importing plans internals).
 */
describe("reuploadKind", () => {
  it("extension decides; extension-less files fall back to content type", () => {
    expect(reuploadKind({ name: "lecture.pdf", type: "" })).toBe("pdf");
    expect(reuploadKind({ name: "notes.md", type: "" })).toBe("markdown");
    expect(reuploadKind({ name: "notes.markdown", type: "" })).toBe("markdown");
    expect(reuploadKind({ name: "file", type: "application/pdf" })).toBe("pdf");
    expect(reuploadKind({ name: "file", type: "text/markdown" })).toBe("markdown");
  });

  it("a .pptx routes to the markdown kind (epic-13 T5: it parses INTO markdown-kind sections)", () => {
    expect(reuploadKind({ name: "slides.pptx", type: "" })).toBe("markdown");
    expect(
      reuploadKind({
        name: "file",
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      }),
    ).toBe("markdown");
  });

  it("unknown kinds are null — the reader has no guess to make", () => {
    expect(reuploadKind({ name: "file", type: "text/plain" })).toBeNull();
  });
});

describe("validateReupload", () => {
  it("accepts a same-kind file within the cap", () => {
    expect(validateReupload({ name: "a.pdf", type: "", size: 1024 }, "pdf")).toEqual({ ok: true });
    expect(validateReupload({ name: "a.md", type: "", size: 1024 }, "markdown")).toEqual({ ok: true });
    // the original deck re-uploads into its markdown-kind row (epic-13 T5)
    expect(validateReupload({ name: "deck.pptx", type: "", size: 1024 }, "markdown")).toEqual({ ok: true });
  });

  it("rejects a kind mismatch with the bilingual reason key", () => {
    expect(validateReupload({ name: "a.md", type: "", size: 1024 }, "pdf")).toEqual({
      ok: false,
      messageKey: "reader.reuploadKindMismatch",
    });
  });

  it("rejects over-cap files; the cap itself passes (FR-2 boundary)", () => {
    expect(validateReupload({ name: "a.pdf", type: "", size: REUPLOAD_MAX_BYTES + 1 }, "pdf")).toEqual({
      ok: false,
      messageKey: "errors.uploadTooLarge",
    });
    expect(validateReupload({ name: "a.pdf", type: "", size: REUPLOAD_MAX_BYTES }, "pdf")).toEqual({ ok: true });
  });
});
