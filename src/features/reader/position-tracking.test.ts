import { describe, expect, it } from "vitest";
import type { Material } from "@/domain/entities";
import {
  currentSection,
  locatorSectionId,
  locatorsEqual,
  mostVisiblePage,
  positionText,
  READING_LINE_OFFSET,
  type MeasuredPageRect,
} from "./position-tracking";

/**
 * Tracker selectors (FR-10; AD-10 dense behavior): most-visible page from
 * measured page rects, markdown scroll-spy over section boundaries, and the
 * bounded text resolver. Prior art: display-shaping.test.ts / pager.test.ts.
 */

/** Two equal pages of height 100 in a viewport of 100 — the half-boundary rig. */
const twoPages: MeasuredPageRect[] = [
  { page: 1, top: 0, height: 100 },
  { page: 2, top: 100, height: 100 },
];

const material = (): Material => ({
  id: "m1",
  title: "Lecture.pdf",
  kind: "pdf",
  sizeBytes: 10,
  planId: null,
  taskId: null,
  parseState: "parsed",
  sections: [
    { id: "page-1", title: "Page 1", text: "page one 文本" },
    { id: "page-2", title: "Page 2", text: "page two 文本" },
    { id: "introduction.", title: "开头", text: "intro 文本" },
  ],
  createdAt: "2026-11-01T00:00:00Z",
});

describe("most-visible page (FR-10: visibility-based tracking)", () => {
  it("a single fully-visible page is the current one", () => {
    expect(mostVisiblePage([{ page: 4, top: 0, height: 100 }], 0, 100)).toBe(4);
  });

  it("degenerate input honestly yields null: no rects, no viewport", () => {
    expect(mostVisiblePage([], 0, 100)).toBeNull();
    expect(mostVisiblePage(twoPages, 0, 0)).toBeNull();
    expect(mostVisiblePage(twoPages, 0, -5)).toBeNull();
  });

  it("nothing visible (overscroll bounce) yields null — the caller holds its previous page", () => {
    expect(mostVisiblePage(twoPages, 300, 100)).toBeNull(); // scrolled past everything
    expect(mostVisiblePage([{ page: 1, top: 200, height: 100 }], 0, 100)).toBeNull(); // before it
  });

  it("the exact half-visible boundary between two equal pages is a tie — the earlier page holds", () => {
    // scrollTop 50: page 1 shows 50/100 of the viewport, page 2 shows 50/100
    expect(mostVisiblePage(twoPages, 50, 100)).toBe(1);
    expect(mostVisiblePage([...twoPages].reverse(), 50, 100)).toBe(1); // tie-break is the smaller page, not list luck
  });

  it("one pixel past the half boundary flips the tracked page", () => {
    expect(mostVisiblePage(twoPages, 49, 100)).toBe(1);
    expect(mostVisiblePage(twoPages, 51, 100)).toBe(2);
  });

  it("a page taller than the viewport still wins while it fills the screen", () => {
    const tall: MeasuredPageRect[] = [
      { page: 1, top: 0, height: 300 },
      { page: 2, top: 300, height: 100 },
    ];
    expect(mostVisiblePage(tall, 0, 100)).toBe(1);
    expect(mostVisiblePage(tall, 250, 100)).toBe(1); // 50/50 straddle is a tie → the earlier page
    expect(mostVisiblePage(tall, 251, 100)).toBe(2);
  });

  it("zero-height rects are skipped, not winners", () => {
    expect(mostVisiblePage([{ page: 9, top: 0, height: 0 }, { page: 1, top: 0, height: 100 }], 0, 100)).toBe(1);
  });
});

describe("markdown scroll-spy (FR-10: current section over boundaries)", () => {
  // heading tops in content coordinates; the reading line sits READING_LINE_OFFSET below scrollTop
  const boundaries = [
    { id: "alpha", top: 100 },
    { id: "beta", top: 300 },
    { id: "gamma", top: 600 },
  ];

  it("above the first boundary sits the intro region — Material.sections[0]'s id (T3's contract)", () => {
    expect(currentSection(boundaries, 0, "introduction.")).toBe("introduction.");
    expect(currentSection(boundaries, 67, "introduction.")).toBe("introduction."); // line 99 < 100
  });

  it("an exact boundary hit already belongs to that section (the landing scroll-mt)", () => {
    // scrollTop 68 → reading line exactly 100, the heading's scroll-mt-8 landing spot
    expect(READING_LINE_OFFSET).toBe(32);
    expect(currentSection(boundaries, 68, "introduction.")).toBe("alpha");
  });

  it("no intro (document starts with a heading) reads null above the first boundary", () => {
    expect(currentSection(boundaries, 0)).toBeNull();
  });

  it("between boundaries (the gaps) the earlier section holds", () => {
    expect(currentSection(boundaries, 200, "introduction.")).toBe("alpha");
    expect(currentSection(boundaries, 450, "introduction.")).toBe("beta");
  });

  it("past the last boundary the last section holds (short tail sections stay current)", () => {
    expect(currentSection(boundaries, 568, "introduction.")).toBe("gamma"); // exact hit
    expect(currentSection(boundaries, 2000, "introduction.")).toBe("gamma");
  });

  it("a document with no rendered headings is the intro region (or null without one)", () => {
    expect(currentSection([], 100, "introduction.")).toBe("introduction.");
    expect(currentSection([], 100)).toBeNull();
  });
});

describe("position text resolver (AD-4: bounded extracted text, never raw bytes)", () => {
  it("a pdf locator matches its page-N section's text", () => {
    expect(positionText(material(), { kind: "pdf", page: 1 })).toBe("page one 文本");
    expect(positionText(material(), { kind: "pdf", page: 2 })).toBe("page two 文本");
  });

  it("a markdown locator matches its section id's text", () => {
    expect(positionText(material(), { kind: "markdown", sectionId: "introduction." })).toBe("intro 文本");
  });

  it("a locator with no matching section resolves to the empty string, honestly", () => {
    expect(positionText(material(), { kind: "pdf", page: 9 })).toBe("");
    expect(positionText(material(), { kind: "markdown", sectionId: "gone-slug" })).toBe("");
  });

  it("no material (not loaded) resolves to the empty string", () => {
    expect(positionText(null, { kind: "pdf", page: 1 })).toBe("");
  });
});

describe("locator helpers", () => {
  it("locatorSectionId maps pdf pages to page-N sections and markdown ids through", () => {
    expect(locatorSectionId({ kind: "pdf", page: 3 })).toBe("page-3");
    expect(locatorSectionId({ kind: "markdown", sectionId: "recap" })).toBe("recap");
  });

  it("locatorsEqual: same kind + target only", () => {
    expect(locatorsEqual({ kind: "pdf", page: 2 }, { kind: "pdf", page: 2 })).toBe(true);
    expect(locatorsEqual({ kind: "pdf", page: 2 }, { kind: "pdf", page: 3 })).toBe(false);
    expect(locatorsEqual({ kind: "markdown", sectionId: "a" }, { kind: "markdown", sectionId: "a" })).toBe(true);
    expect(locatorsEqual({ kind: "pdf", page: 1 }, { kind: "markdown", sectionId: "page-1" })).toBe(false);
  });
});
