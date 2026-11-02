import { beforeEach, describe, expect, it } from "vitest";
import type { ReadingPosition } from "@/domain/entities";
import { STORAGE_KEY } from "./document";
import { registerMaterial } from "./material-repository";
import { getReadingProgress, listReadingProgress, saveReadingProgress } from "./progress-repository";

/**
 * ReadingProgress round-trips (FR-10; AD-3/4): save → load → restored, the
 * 1:1-with-material overwrite, the cross-material listing (the Plans Home
 * continue line's source), and the reload simulation — position and the
 * sections it points at survive; blob bytes never enter the document.
 * Prior art: material-repository.test.ts.
 */

beforeEach(() => {
  localStorage.clear();
});

const pdfPosition = (page: number, text: string): ReadingPosition => ({
  locator: { kind: "pdf", page },
  text,
});

const mdPosition = (sectionId: string, text: string): ReadingPosition => ({
  locator: { kind: "markdown", sectionId },
  text,
});

describe("reading progress repository (FR-10 seam: save → restore round-trip)", () => {
  it("a pdf position restores verbatim — locator and bounded text", () => {
    saveReadingProgress("m1", pdfPosition(3, "第 3 页的提取文本"));
    const stored = getReadingProgress("m1");
    expect(stored?.materialId).toBe("m1");
    expect(stored?.position.locator).toEqual({ kind: "pdf", page: 3 });
    expect(stored?.position.text).toBe("第 3 页的提取文本");
    expect(typeof stored?.updatedAt).toBe("string");
  });

  it("a markdown position restores verbatim (sectionId is the anchor)", () => {
    saveReadingProgress("m2", mdPosition("getting-started", "section text"));
    expect(getReadingProgress("m2")?.position.locator).toEqual({
      kind: "markdown",
      sectionId: "getting-started",
    });
  });

  it("re-saving overwrites in place — one progress per material (spine ER 1:1)", () => {
    saveReadingProgress("m1", pdfPosition(1, "first"));
    saveReadingProgress("m1", pdfPosition(7, "second"));
    const stored = getReadingProgress("m1");
    expect(stored?.position.locator).toEqual({ kind: "pdf", page: 7 });
    expect(stored?.position.text).toBe("second");
    expect(listReadingProgress()).toHaveLength(1); // never two rows for one material
    expect(stored?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO stamp for the continue-line recency sort
  });

  it("progress across materials lists independently (the continue line's source)", () => {
    saveReadingProgress("m1", pdfPosition(2, "a"));
    saveReadingProgress("m2", mdPosition("intro", "b"));
    expect(listReadingProgress().map((r) => r.materialId).sort()).toEqual(["m1", "m2"]);
  });

  it("no progress for an unknown material reads as undefined — never a fake row", () => {
    expect(getReadingProgress("no-such-material")).toBeUndefined();
  });

  it("reload simulation: position + the sections it points at survive; bytes never persist (AD-4)", () => {
    const sentinel = "RAW_PDF_BYTES_STAY_SESSION_ONLY";
    const { material } = registerMaterial({
      title: "Lecture 4.pdf",
      kind: "pdf",
      sizeBytes: 1,
      planId: null,
      taskId: null,
      blob: new Blob([sentinel]),
      sections: [
        { id: "page-1", title: "Page 1", text: "第一页" },
        { id: "page-2", title: "Page 2", text: "第二页的提取文本" },
      ],
    });
    // the tracker persists the section text FROM Material.sections (AD-4)
    const section = material.sections[1];
    saveReadingProgress(material.id, pdfPosition(2, section.text));

    // "reload": the same localStorage document, read back through the seams
    const raw = localStorage.getItem(STORAGE_KEY) ?? "";
    expect(raw).toContain("第二页的提取文本"); // the position's text survives
    expect(raw).toContain('"page-2"'); // the section it points at survives
    expect(raw).not.toContain(sentinel); // bytes never do

    const restoredPosition = getReadingProgress(material.id)?.position;
    expect(restoredPosition?.locator).toEqual({ kind: "pdf", page: 2 });
    // the text still matches what the material's own section carries — grounding stays honest
    expect(restoredPosition?.text).toBe("第二页的提取文本");
  });
});
