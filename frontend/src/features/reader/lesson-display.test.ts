/**
 * The lesson-display pure derivations (epic-36 T2): the reader's placeholder
 * rows, the banner state, and the source-anchor label/href. Everything the
 * LessonFlow renders is derived HERE — the component stays presentational.
 */
import { describe, expect, it } from "vitest";
import type { LessonGenerationView, LessonSourceAnchorView, MaterialView } from "@/api/views";
import type { MaterialSection } from "@/domain/entities";
import { lessonBannerState, lessonRows, sourceAnchorHref, sourceAnchorLabel } from "./lesson-display";

const generation = (overrides: Partial<LessonGenerationView> = {}): LessonGenerationView => ({
  variant: "node",
  sourceMaterialIds: ["src-1"],
  outline: [
    { id: "ch-1", title: "选举与日志", anchors: [{ materialId: "src-1", sectionId: "sec-1" }], status: "pending" },
    { id: "ch-2", title: "链式复制", anchors: [], status: "pending" },
  ],
  pausedKind: null,
  generatedAt: "2026-11-12T00:00:00Z",
  ...overrides,
});

const sections = (): MaterialSection[] => [
  { id: "ch-1", title: "选举与日志", text: "# 选举与日志\n\n正文。" },
];

describe("lessonRows", () => {
  it("shapes one row per outline chapter — pending rows carry no text", () => {
    const rows = lessonRows(generation(), sections(), { activeSectionId: null, streamText: null });
    expect(rows.map((row) => [row.chapterId, row.status, row.text])).toEqual([
      ["ch-1", "pending", null],
      ["ch-2", "pending", null],
    ]);
    expect(rows[0].anchors).toEqual([{ materialId: "src-1", sectionId: "sec-1" }]);
  });

  it("a landed section resolves its text by chapter id (the server's atomic row)", () => {
    const ready = generation({
      outline: generation().outline.map((c, i) => ({ ...c, status: i === 0 ? "ready" : "pending" })),
    });
    const rows = lessonRows(ready, sections(), { activeSectionId: null, streamText: null });
    expect(rows[0].status).toBe("ready");
    expect(rows[0].text).toContain("正文。");
    expect(rows[1].text).toBeNull();
  });

  it("the LIVE stream rides its chapter: status generating + the streaming fragment, never a section lookup", () => {
    const rows = lessonRows(generation(), sections(), { activeSectionId: "ch-2", streamText: "链式" });
    expect(rows[1].status).toBe("generating");
    expect(rows[1].text).toBe("链式");
    expect(rows[1].streaming).toBe(true);
    expect(rows[0].streaming).toBe(false);
  });

  it("a dropped-connection chapter with outline status generating renders generating with no fragment", () => {
    const rows = lessonRows(
      generation({
        outline: [
          { id: "ch-1", title: "选举与日志", anchors: [], status: "generating" },
          { id: "ch-2", title: "链式复制", anchors: [], status: "pending" },
        ],
      }),
      sections(),
      { activeSectionId: null, streamText: null },
    );
    expect(rows[0].status).toBe("generating");
    expect(rows[0].text).toBeNull();
  });
});

describe("lessonBannerState", () => {
  it("live while the stream is on — pause copy never fights the spinner", () => {
    expect(lessonBannerState(generation({ pausedKind: "cap" }), lessonRows(generation(), [], { activeSectionId: null, streamText: null }), true)).toBe("live");
  });

  it("cap pause and provider pause ride the row's pausedKind verbatim", () => {
    const rows = lessonRows(generation(), [], { activeSectionId: null, streamText: null });
    expect(lessonBannerState(generation({ pausedKind: "cap" }), rows, false)).toBe("paused-cap");
    expect(lessonBannerState(generation({ pausedKind: "provider" }), rows, false)).toBe("paused-provider");
  });

  it("pending sections with no pause = incomplete (the explicit 继续生成 posture)", () => {
    const rows = lessonRows(generation(), [], { activeSectionId: null, streamText: null });
    expect(lessonBannerState(generation(), rows, false)).toBe("incomplete");
  });

  it("all ready and no pause = complete — no banner", () => {
    const done = generation({
      outline: generation().outline.map((c) => ({ ...c, status: "ready" })),
    });
    const rows = lessonRows(done, [...sections(), { id: "ch-2", title: "链式复制", text: "正文" }], {
      activeSectionId: null,
      streamText: null,
    });
    expect(lessonBannerState(done, rows, false)).toBe("complete");
  });
});

describe("sourceAnchorHref", () => {
  const anchor = (materialId: string, sectionId: string): LessonSourceAnchorView => ({ materialId, sectionId });

  it("markdown anchors ride the section channel with the highlight flag (AD-8, the existing locator)", () => {
    expect(sourceAnchorHref(anchor("src-1", "第二章-选举"))).toBe("/read/src-1?hl=1#%E7%AC%AC%E4%BA%8C%E7%AB%A0-%E9%80%89%E4%B8%BE");
    expect(sourceAnchorHref(anchor("src-1", "sec-1"))).toBe("/read/src-1?hl=1#sec-1");
  });

  it("pdf page-N anchors ride the page channel — 第 N 页 deep link", () => {
    expect(sourceAnchorHref(anchor("src-2", "page-4"))).toBe("/read/src-2?page=4&hl=1");
  });
});

describe("sourceAnchorLabel", () => {
  const anchor = (materialId: string, sectionId: string): LessonSourceAnchorView => ({ materialId, sectionId });
  const source = (overrides: Partial<MaterialView> = {}): MaterialView => ({
    id: "src-1",
    title: "分布式笔记",
    kind: "markdown",
    sizeBytes: 1,
    planId: "plan-1",
    taskId: null,
    attachmentScope: "plan",
    nodeId: null,
    parseState: "parsed",
    sections: [
      { id: "sec-1", title: "Raft", text: "x" },
      { id: "sec-2", title: "", text: "y" },
    ],
    createdAt: "2026-11-12T00:00:00Z",
    downloadUrl: null,
    origin: "uploaded",
    generation: null,
    ...overrides,
  });

  it("markdown: 《材料名》· §title — the verify-against-original line", () => {
    expect(sourceAnchorLabel(anchor("src-1", "sec-1"), [source()])).toBe("《分布式笔记》· §Raft");
  });

  it("an empty section title falls back to the section id — never a dangling label", () => {
    expect(sourceAnchorLabel(anchor("src-1", "sec-2"), [source()])).toBe("《分布式笔记》· §sec-2");
  });

  it("pdf: 《材料名》· 第 N 页 — the page ordinal rides the id convention", () => {
    expect(sourceAnchorLabel(anchor("src-2", "page-4"), [source({ id: "src-2", kind: "pdf" })])).toBe(
      "《分布式笔记》· 第 4 页",
    );
  });

  it("a deleted source renders no line (honest gap, never a guessed name)", () => {
    expect(sourceAnchorLabel(anchor("gone", "sec-1"), [source()])).toBeNull();
  });
});
