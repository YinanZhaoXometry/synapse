import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEY } from "./document";
import { getMaterial, listMaterialsByPlan, registerMaterial } from "./material-repository";
import { createSessionBlobRegistry } from "./session-blobs";

beforeEach(() => {
  localStorage.clear();
});

describe("material repository (seam: public API over real localStorage)", () => {
  it("persists metadata + extracted sections; blob bytes never reach the document", () => {
    const sentinel = "RAW_PDF_BYTES_ARE_SECRET";
    const blobs = createSessionBlobRegistry();
    const { material } = registerMaterial({
      title: "Lecture 4.pdf",
      kind: "pdf",
      sizeBytes: 1_234_567,
      planId: "p-1",
      taskId: null,
      blob: new Blob([sentinel]),
      blobRegistry: blobs,
      sections: [{ id: "page-1", title: "Page 1", text: "Integration testing 集成测试" }],
    });

    // the session blob is retrievable in the same session
    expect(blobs.has(material.id)).toBe(true);

    // metadata + sections read back
    const loaded = getMaterial(material.id);
    expect(loaded?.title).toBe("Lecture 4.pdf");
    expect(loaded?.parseState).toBe("parsed");
    expect(loaded?.sections[0].text).toContain("集成测试");

    // the persisted document never contains blob bytes
    const raw = localStorage.getItem(STORAGE_KEY) ?? "";
    expect(raw).not.toContain(sentinel);

    // plan-scoped listing
    expect(listMaterialsByPlan("p-1").map((m) => m.id)).toContain(material.id);
  });

  it("reload simulation: everything restores except the blob", () => {
    const oldBlobs = createSessionBlobRegistry();
    const { material } = registerMaterial({
      title: "notes.md",
      kind: "markdown",
      sizeBytes: 100,
      planId: null,
      taskId: null,
      blob: new Blob(["file bytes"]),
      blobRegistry: oldBlobs,
      sections: [{ id: "intro", title: "Intro", text: "# Intro" }],
    });

    // "reload": fresh in-memory registries, same localStorage
    const freshBlobs = createSessionBlobRegistry();
    expect(freshBlobs.get(material.id)).toBeUndefined(); // blob gone — re-upload required

    const restored = getMaterial(material.id); // metadata + extracted text survive
    expect(restored?.title).toBe("notes.md");
    expect(restored?.sections).toHaveLength(1);
  });

  it("section text is bounded per-section (quota safety, AD-4)", () => {
    const { material } = registerMaterial({
      title: "huge.md",
      kind: "markdown",
      sizeBytes: 10,
      planId: null,
      taskId: null,
      sections: [{ id: "s1", title: "S1", text: "x".repeat(5000) }],
    });
    const stored = getMaterial(material.id)?.sections[0].text ?? "";
    expect(stored.length).toBeLessThanOrEqual(2000);
    expect(stored.length).toBeGreaterThan(0);
  });
});
