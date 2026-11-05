/**
 * Selection capture (FR-13, epic-13 T1) — the pure mapper from a DOM Selection
 * to the AD-2 locator shapes (ReadingLocator verbatim: markdown sectionId /
 * pdf page). jsdom fixtures per surface: markdown sections anchor through the
 * rendered heading ids (the rehype-slug contract), pdf through the page
 * containers' data-page (PdfPageFlow). Pinned here: the two shapes, the
 * cross-section clamp to the FIRST (anchor-side) section, whitespace/collapsed
 * suppression, the intro fallback (T3's contract — text above the first
 * heading is sections[0]), the honest nulls (outside the reader content, a
 * malformed page container), and the bar-anchor viewport clamping.
 */
import { afterEach, describe, expect, it } from "vitest";
import { barAnchor, captureSelection, type SelectionCaptureContext } from "./selection-capture";

function mdFixture(): { root: HTMLElement; pa: HTMLElement; pb: HTMLElement; intro: HTMLElement } {
  const root = document.createElement("div");
  root.id = "reader-root";
  const intro = document.createElement("p");
  intro.id = "intro-p";
  intro.textContent = "intro paragraph text";
  const h2a = document.createElement("h2");
  h2a.id = "sec-a";
  h2a.textContent = "Section A";
  const pa = document.createElement("p");
  pa.id = "pa";
  pa.textContent = "alpha content here";
  const h2b = document.createElement("h2");
  h2b.id = "sec-b";
  h2b.textContent = "Section B";
  const pb = document.createElement("p");
  pb.id = "pb";
  pb.textContent = "beta content follows";
  root.append(intro, h2a, pa, h2b, pb);
  document.body.appendChild(root);
  return { root, pa, pb, intro };
}

function pdfFixture(page: string): { root: HTMLElement; span: HTMLElement } {
  const root = document.createElement("div");
  root.id = "pdf-column";
  const pageBox = document.createElement("div");
  pageBox.setAttribute("data-page", page);
  const span = document.createElement("span");
  span.textContent = "pdf page three words";
  pageBox.appendChild(span);
  root.appendChild(pageBox);
  document.body.appendChild(root);
  return { root, span };
}

/** A structural fake of a live DOM Selection — captureSelection reads only
 * these members, so the fixture keeps the unit deterministic (jsdom has no
 * real layout-backed selection to drive). */
function fakeSelection(
  startNode: Node,
  startOffset: number,
  endNode: Node,
  endOffset: number,
  text: string,
): Selection {
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return {
    rangeCount: 1,
    isCollapsed: range.collapsed,
    toString: () => text,
    getRangeAt: (index: number) => {
      if (index !== 0) throw new Error("no range");
      return range;
    },
  } as unknown as Selection;
}

function wholeText(el: HTMLElement): Selection {
  return fakeSelection(el.firstChild!, 0, el.firstChild!, el.textContent!.length, el.textContent!);
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("captureSelection — markdown (FR-13)", () => {
  it("maps a selection inside a section to {kind: markdown, sectionId, text}", () => {
    const { root, pa } = mdFixture();
    const context: SelectionCaptureContext = { root, introSectionId: "sec-0" };

    const captured = captureSelection(wholeText(pa), context);

    expect(captured).toEqual({ kind: "markdown", sectionId: "sec-a", text: "alpha content here" });
  });

  it("clamps a cross-section selection to the FIRST (anchor-side) section", () => {
    const { root, pa, pb } = mdFixture();
    const context: SelectionCaptureContext = { root };

    // start inside pa (sec-a), end inside pb (sec-b) — the anchor side wins
    const spanning = fakeSelection(
      pa.firstChild!,
      0,
      pb.firstChild!,
      pb.textContent!.length,
      "alpha content hereSection Bbeta content follows",
    );

    const captured = captureSelection(spanning, context);
    expect(captured).toMatchObject({ kind: "markdown", sectionId: "sec-a" });
  });

  it("maps a selection above the first heading to the intro section id (T3's contract)", () => {
    const { root, intro } = mdFixture();
    const captured = captureSelection(wholeText(intro), { root, introSectionId: "sec-0" });
    expect(captured).toEqual({ kind: "markdown", sectionId: "sec-0", text: "intro paragraph text" });
  });

  it("captures nothing above the first heading when no intro id rides the context (honest null)", () => {
    const { root, intro } = mdFixture();
    expect(captureSelection(wholeText(intro), { root })).toBeNull();
  });

  it("trims the selected text into the captured shape", () => {
    const { root, pa } = mdFixture();
    const padded = fakeSelection(pa.firstChild!, 0, pa.firstChild!, pa.textContent!.length, "  alpha content here \n");
    expect(captureSelection(padded, { root })).toEqual({
      kind: "markdown",
      sectionId: "sec-a",
      text: "alpha content here",
    });
  });
});

describe("captureSelection — pdf text layer (FR-13)", () => {
  it("maps a selection inside a page container to {kind: pdf, page, text}", () => {
    const { root, span } = pdfFixture("3");
    const captured = captureSelection(wholeText(span), { root });
    expect(captured).toEqual({ kind: "pdf", page: 3, text: "pdf page three words" });
  });

  it("captures nothing in a malformed page container (no numeric data-page — honest null)", () => {
    const { root, span } = pdfFixture("not-a-page");
    expect(captureSelection(wholeText(span), { root })).toBeNull();
  });

  it("clamps a cross-page selection to the anchor-side page", () => {
    const root = document.createElement("div");
    const p2 = document.createElement("div");
    p2.setAttribute("data-page", "2");
    p2.textContent = "page two";
    const p3 = document.createElement("div");
    p3.setAttribute("data-page", "3");
    p3.textContent = "page three";
    root.append(p2, p3);
    document.body.appendChild(root);

    const spanning = fakeSelection(p2.firstChild!, 0, p3.firstChild!, p3.textContent!.length, "page twopage three");
    expect(captureSelection(spanning, { root })).toMatchObject({ kind: "pdf", page: 2 });
  });
});

describe("captureSelection — suppression and honest nulls", () => {
  it("suppresses whitespace-only selections (the bar must not trigger)", () => {
    const { root, pa } = mdFixture();
    const whitespace = fakeSelection(pa.firstChild!, 0, pa.firstChild!, 2, "  ");
    expect(captureSelection(whitespace, { root })).toBeNull();
  });

  it("suppresses collapsed selections", () => {
    const { root, pa } = mdFixture();
    const collapsed = fakeSelection(pa.firstChild!, 3, pa.firstChild!, 3, "");
    expect(captureSelection(collapsed, { root })).toBeNull();
  });

  it("captures nothing with zero ranges", () => {
    const { root } = mdFixture();
    const empty = { rangeCount: 0, isCollapsed: true } as unknown as Selection;
    expect(captureSelection(empty, { root })).toBeNull();
  });

  it("captures nothing outside the reader root (the bar is the reader's, not the app's)", () => {
    mdFixture();
    const stranger = document.createElement("p");
    stranger.textContent = "sidebar text";
    document.body.appendChild(stranger);
    expect(captureSelection(wholeText(stranger), { root: document.getElementById("reader-root")! })).toBeNull();
  });

  it("captures nothing for a null selection", () => {
    const { root } = mdFixture();
    expect(captureSelection(null, { root })).toBeNull();
  });
});

describe("barAnchor — the viewport-clamped floating bar position", () => {
  const BAR_W = 190;
  const BAR_H = 36;

  it("floats above the selection, horizontally centered on it", () => {
    const anchor = barAnchor({ left: 300, right: 500, top: 300, bottom: 330 }, 1280, 800, BAR_W, BAR_H);
    expect(anchor.y).toBe(300 - BAR_H - 8);
    expect(anchor.x).toBe(400 - BAR_W / 2);
  });

  it("flips below the selection near the viewport top", () => {
    const anchor = barAnchor({ left: 300, right: 500, top: 30, bottom: 60 }, 1280, 800, BAR_W, BAR_H);
    expect(anchor.y).toBe(60 + 8);
  });

  it("clamps horizontally inside the viewport (a selection at the right edge)", () => {
    const anchor = barAnchor({ left: 1200, right: 1270, top: 300, bottom: 330 }, 1280, 800, BAR_W, BAR_H);
    expect(anchor.x).toBe(1280 - BAR_W - 8);
  });

  it("clamps below-flip inside the viewport bottom (a selection filling the top sliver)", () => {
    const anchor = barAnchor({ left: 100, right: 200, top: 2, bottom: 790 }, 1280, 800, BAR_W, BAR_H);
    expect(anchor.y).toBe(800 - BAR_H - 8);
  });
});
