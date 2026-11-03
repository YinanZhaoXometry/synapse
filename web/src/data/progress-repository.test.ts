import { beforeEach, describe, expect, it } from "vitest";
import type { ChatMessage, ReadingPosition } from "@/domain/entities";
import { STORAGE_KEY } from "./document";
import { registerMaterial } from "./material-repository";
import {
  appendChatMessage,
  getChatThread,
  getReadingProgress,
  listReadingProgress,
  saveReadingProgress,
} from "./progress-repository";

/**
 * ReadingProgress round-trips (FR-10; AD-3/4): save → load → restored, the
 * 1:1-with-material overwrite, the cross-material listing (the Plans Home
 * continue line's source), and the reload simulation — position and the
 * sections it points at survive; blob bytes never enter the document.
 * Prior art: material-repository.test.ts.
 *
 * ChatThread round-trips (T5 · FR-11; AD-3/4): the CompanionPanel's
 * per-material conversation — append → restore, citation locators stored on
 * the companion message, threads staying 1:1 with their material, and the
 * reload simulation (the transcript survives; the plan-creation transcripts
 * stay ephemeral, out of this store entirely).
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

describe("chat thread repository (T5 · FR-11 seam: append → restore round-trip)", () => {
  const userMessage = (text: string): Omit<ChatMessage, "id" | "createdAt"> => ({
    role: "user",
    text,
    citations: [],
  });
  const companionMessage = (
    text: string,
    citations: ChatMessage["citations"],
  ): Omit<ChatMessage, "id" | "createdAt"> => ({
    role: "companion",
    text,
    citations,
  });

  it("a companion reply stores its citation locators and restores them verbatim", () => {
    appendChatMessage("m1", userMessage("为什么集成测试要先验证接口契约？"));
    appendChatMessage(
      "m1",
      companionMessage("先往这个方向想……", [{ kind: "pdf", page: 7 }]),
    );

    const thread = getChatThread("m1");
    expect(thread?.materialId).toBe("m1");
    expect(thread?.messages.map((m) => m.role)).toEqual(["user", "companion"]);
    expect(thread?.messages[1].citations).toEqual([{ kind: "pdf", page: 7 }]);
    expect(typeof thread?.messages[1].id).toBe("string");
    expect(thread?.messages[1].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("threads stay 1:1 with their material — two materials never share a transcript", () => {
    appendChatMessage("m1", userMessage("m1 的问题"));
    appendChatMessage("m2", userMessage("m2 的问题"));
    expect(getChatThread("m1")?.messages.map((m) => m.text)).toEqual(["m1 的问题"]);
    expect(getChatThread("m2")?.messages.map((m) => m.text)).toEqual(["m2 的问题"]);
  });

  it("no thread for an unknown material reads as undefined — never a fake thread", () => {
    expect(getChatThread("no-such-material")).toBeUndefined();
  });

  it("reload simulation: the transcript (roles, text, citations) survives; bytes never persist (AD-4)", () => {
    const sentinel = "RAW_PDF_BYTES_STAY_SESSION_ONLY";
    registerMaterial({
      title: "Lecture 4.pdf",
      kind: "pdf",
      sizeBytes: 1,
      planId: null,
      taskId: null,
      blob: new Blob([sentinel]),
      sections: [{ id: "page-7", title: "12.2 集成策略", text: "接口 = 缺陷传播的路径" }],
    });
    appendChatMessage("m1", userMessage("解释这一页"));
    appendChatMessage(
      "m1",
      companionMessage("答案：接口 = 缺陷传播的路径", [
        { kind: "pdf", page: 7 },
        { kind: "markdown", sectionId: "intro" },
      ]),
    );

    // "reload": the same localStorage document, read back through the seams
    const raw = localStorage.getItem(STORAGE_KEY) ?? "";
    expect(raw).toContain("解释这一页"); // the question survives
    expect(raw).toContain("答案：接口 = 缺陷传播的路径"); // the reply survives
    expect(raw).toContain('"sectionId":"intro"'); // citation locators survive
    expect(raw).not.toContain(sentinel); // bytes never do

    const restored = getChatThread("m1");
    expect(restored?.messages).toHaveLength(2);
    expect(restored?.messages[1].citations).toEqual([
      { kind: "pdf", page: 7 },
      { kind: "markdown", sectionId: "intro" },
    ]);
  });
});
