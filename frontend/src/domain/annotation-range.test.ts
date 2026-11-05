/**
 * The AD-2 annotation range (FR-16, epic-13 T3): builders from a DOM
 * Selection via the T1 capture context, the shape validator (the server
 * command law mirrored), and the drift (staleness) check. Pure over the
 * given text nodes — the engine (features/reader) owns the DOM walks; here
 * fixture nodes stand in for the section's stable text (markdown) and the
 * pdf page's text-layer string.
 */
import { describe, expect, it } from "vitest";
import {
  isStaleRange,
  isValidAnnotationRange,
  rangeFromSelection,
  textOfNodes,
  type RangeEndpoints,
} from "./annotation-range";

/** A fixture region: three text nodes in document order under one element. */
function fixtureNodes(...texts: string[]): { nodes: Text[]; text: string } {
  const host = document.createElement("div");
  const nodes = texts.map((t) => host.appendChild(document.createTextNode(t)));
  return { nodes, text: texts.join("") };
}

function endpoints(
  startContainer: Node,
  startOffset: number,
  endContainer: Node,
  endOffset: number,
): RangeEndpoints {
  return { startContainer, startOffset, endContainer, endOffset, collapsed: startContainer === endContainer && startOffset === endOffset };
}

describe("textOfNodes", () => {
  it("concatenates the region's text in document order (the anchor's stable text)", () => {
    const { nodes, text } = fixtureNodes("alpha ", "beta ", "gamma");
    expect(textOfNodes(nodes)).toBe(text);
    expect(text).toBe("alpha beta gamma");
  });
});

describe("rangeFromSelection", () => {
  it("maps a selection inside one node to offsets + the quote verbatim", () => {
    const { nodes, text } = fixtureNodes("alpha beta gamma");
    const node = nodes[0];
    const selection = endpoints(node, 6, node, 10); // "beta"

    const range = rangeFromSelection(selection, nodes, { sectionId: "sec-1" });

    expect(range).not.toBeNull();
    expect(range!.sectionId).toBe("sec-1");
    expect(range!.page).toBeUndefined();
    expect(range!.start).toBe(6);
    expect(range!.end).toBe(10);
    expect(range!.quote).toBe("beta");
    expect(range!.quote).toBe(text.slice(6, 10)); // drift-consistent by construction
  });

  it("maps a selection spanning several nodes (boundary offsets inside each)", () => {
    const { nodes } = fixtureNodes("alpha ", "beta ", "gamma");
    const selection = endpoints(nodes[0], 3, nodes[2], 2); // "ha beta ga"

    const range = rangeFromSelection(selection, nodes, { sectionId: "sec-1" });

    expect(range).not.toBeNull();
    expect(range!.start).toBe(3);
    expect(range!.end).toBe(13);
    expect(range!.quote).toBe("ha beta ga");
  });

  it("carries the pdf page anchor (the text-layer string's offsets)", () => {
    const { nodes } = fixtureNodes("page text ", "second span");
    const selection = endpoints(nodes[1], 0, nodes[1], 6); // "second"

    const range = rangeFromSelection(selection, nodes, { page: 3 });

    expect(range).not.toBeNull();
    expect(range!.page).toBe(3);
    expect(range!.sectionId).toBeUndefined();
    expect(range!.start).toBe(10);
    expect(range!.end).toBe(16);
    expect(range!.quote).toBe("second");
  });

  it("clamps a cross-region selection to the region's end (the anchor side — T1's rule)", () => {
    const host = document.createElement("div");
    const nodes = ["one ", "two "].map((t) => host.appendChild(document.createTextNode(t)));
    const next = document.createElement("div");
    const nextText = next.appendChild(document.createTextNode("next section text"));
    host.appendChild(next);
    const selection = endpoints(nodes[0], 0, nextText, 4);

    const range = rangeFromSelection(selection, nodes, { sectionId: "sec-1" });

    expect(range).not.toBeNull();
    expect(range!.start).toBe(0);
    expect(range!.end).toBe(8);
    expect(range!.quote).toBe("one two ");
  });

  it("answers null for a selection entirely before the region", () => {
    const host = document.createElement("div");
    const beforeText = host.appendChild(document.createTextNode("before region"));
    const nodes = ["inside"].map((t) => host.appendChild(document.createTextNode(t)));
    const selection = endpoints(beforeText, 0, beforeText, 6);

    expect(rangeFromSelection(selection, nodes, { sectionId: "sec-1" })).toBeNull();
  });

  it("answers null for a collapsed or whitespace-only selection", () => {
    const { nodes } = fixtureNodes("alpha beta");
    const collapsed = endpoints(nodes[0], 4, nodes[0], 4);
    expect(rangeFromSelection(collapsed, nodes, { sectionId: "sec-1" })).toBeNull();

    const whitespace = endpoints(nodes[0], 5, nodes[0], 6); // " "
    expect(rangeFromSelection(whitespace, nodes, { sectionId: "sec-1" })).toBeNull();
  });

  it("resolves element-based endpoints (a selection starting between blocks)", () => {
    const { nodes } = fixtureNodes("first", "second");
    const host = nodes[0].parentElement!;
    // start at the element boundary before the second node
    const selection = endpoints(host, 1, nodes[1], 3);

    const range = rangeFromSelection(selection, nodes, { sectionId: "sec-1" });

    expect(range).not.toBeNull();
    expect(range!.start).toBe(5);
    expect(range!.end).toBe(8);
    expect(range!.quote).toBe("sec");
  });
});

describe("isValidAnnotationRange (the server command law, mirrored)", () => {
  const validMd = { sectionId: "sec-1", start: 0, end: 5, quote: "alpha" };
  const validPdf = { page: 3, start: 12, end: 40, quote: "alpha" };

  it("accepts the markdown and pdf shapes", () => {
    expect(isValidAnnotationRange(validMd)).toBe(true);
    expect(isValidAnnotationRange(validPdf)).toBe(true);
  });

  it("rejects a range carrying both addresses (the xor law)", () => {
    expect(isValidAnnotationRange({ ...validMd, page: 3 })).toBe(false);
    expect(isValidAnnotationRange({ ...validPdf, sectionId: "sec-1" })).toBe(false);
  });

  it("rejects a range carrying neither address", () => {
    expect(isValidAnnotationRange({ start: 0, end: 5, quote: "alpha" })).toBe(false);
  });

  it("rejects bad offsets (negative, non-integer, end before start)", () => {
    expect(isValidAnnotationRange({ ...validMd, start: -1 })).toBe(false);
    expect(isValidAnnotationRange({ ...validMd, start: 1.5 })).toBe(false);
    expect(isValidAnnotationRange({ ...validMd, start: 6, end: 5 })).toBe(false);
    expect(isValidAnnotationRange({ ...validMd, end: "5" })).toBe(false);
    expect(isValidAnnotationRange({ ...validMd, start: undefined })).toBe(false);
  });

  it("rejects a blank quote and a bad pdf page", () => {
    expect(isValidAnnotationRange({ ...validMd, quote: "   " })).toBe(false);
    expect(isValidAnnotationRange({ ...validMd, quote: "" })).toBe(false);
    expect(isValidAnnotationRange({ ...validPdf, page: 0 })).toBe(false);
    expect(isValidAnnotationRange({ ...validPdf, page: 2.5 })).toBe(false);
    expect(isValidAnnotationRange({ ...validMd, sectionId: "" })).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isValidAnnotationRange(null)).toBe(false);
    expect(isValidAnnotationRange("range")).toBe(false);
    expect(isValidAnnotationRange(42)).toBe(false);
  });
});

describe("isStaleRange (the drift check — never silently misplaced)", () => {
  it("reads fresh when the text still reads the quote at [start, end)", () => {
    const range = { sectionId: "sec-1", start: 6, end: 10, quote: "beta" };
    expect(isStaleRange(range, "alpha beta gamma")).toBe(false);
  });

  it("reads stale when the text drifted at the offsets", () => {
    const range = { sectionId: "sec-1", start: 6, end: 10, quote: "beta" };
    expect(isStaleRange(range, "alpha BETA gamma")).toBe(true);
  });

  it("reads stale when the offsets fall outside the (shorter) text", () => {
    const range = { sectionId: "sec-1", start: 6, end: 10, quote: "beta" };
    expect(isStaleRange(range, "short")).toBe(true);
  });
});
