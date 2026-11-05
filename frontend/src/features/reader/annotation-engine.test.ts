/**
 * The annotation engine (FR-16, epic-13 T3): applies domain ranges to the
 * reader surfaces — markdown section regions and pdf text layers. Pinned
 * here: the wrapped-span fallback (jsdom's path — mark positions EXACTLY
 * cover the quote; marks re-apply idempotently; stale ranges render muted
 * + the drift title, never misplaced), the CSS Custom Highlight API path
 * (feature-detected, stubbed here — ranges registered per color+kind, no
 * DOM mutation), the missing/deferred honesty (unknown section, pdf page
 * off the render window), and the named-color vocabulary (AD-9: color is
 * never the only affordance — the marks also carry the kind's underline /
 * border line, and the list renders every row textually).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ANNOTATION_COLORS,
  applyMarkdownAnnotations,
  applyPdfPageAnnotations,
  buildRangeFromCapture,
  clearMarkdownAnnotations,
  clearPdfPageAnnotations,
  supportsHighlightApi,
  type AnnotationRenderItem,
} from "./annotation-engine";

/** A markdown fixture: intro prose + two heading sections with paragraphs. */
function markdownFixture(): { article: HTMLElement; paragraphs: HTMLParagraphElement[] } {
  const article = document.createElement("article");
  const intro = article.appendChild(document.createElement("p"));
  intro.textContent = "intro paragraph text";
  const h1 = article.appendChild(document.createElement("h2"));
  h1.id = "sec-1";
  h1.textContent = "First";
  const p1 = article.appendChild(document.createElement("p"));
  p1.textContent = "alpha beta gamma delta";
  const p2 = article.appendChild(document.createElement("p"));
  p2.textContent = "second paragraph";
  const h2 = article.appendChild(document.createElement("h2"));
  h2.id = "sec-2";
  h2.textContent = "Second";
  const p3 = article.appendChild(document.createElement("p"));
  p3.textContent = "third section body";
  return { article, paragraphs: [intro, p1, p2, p3] };
}

/** A pdf text-layer fixture: two spans (the pdfjs shape) inside the layer. */
function pdfLayerFixture(): HTMLDivElement {
  const layer = document.createElement("div");
  const span1 = layer.appendChild(document.createElement("span"));
  span1.textContent = "page text ";
  const span2 = layer.appendChild(document.createElement("span"));
  span2.textContent = "more text";
  return layer;
}

function item(overrides: Partial<AnnotationRenderItem> = {}): AnnotationRenderItem {
  return {
    id: overrides.id ?? "anno-1",
    range: overrides.range ?? { sectionId: "sec-1", start: 6, end: 10, quote: "beta" },
    kind: overrides.kind ?? "highlight",
    color: overrides.color ?? "amber",
    body: overrides.body ?? "",
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the named-color vocabulary (delta 3 — the chips' keys)", () => {
  it("carries the four palette keys the command validates", () => {
    expect(ANNOTATION_COLORS).toEqual(["coral", "amber", "emerald", "blue"]);
  });
});

describe("supportsHighlightApi (feature detection)", () => {
  it("answers false in jsdom (no Highlight global) — the span fallback's path", () => {
    expect(supportsHighlightApi()).toBe(false);
  });

  it("answers true when Highlight + CSS.highlights exist (the browser path)", () => {
    vi.stubGlobal("Highlight", class Fake {});
    vi.stubGlobal("CSS", { highlights: new Map() });
    expect(supportsHighlightApi()).toBe(true);
  });
});

describe("buildRangeFromCapture (the bar → mutation seam)", () => {
  it("maps a live DOM Range inside a section to the md range (quote = the slice)", () => {
    const { article } = markdownFixture();
    const p1 = article.querySelectorAll("p")[1]; // "alpha beta gamma delta"
    const textNode = p1.firstChild as Text;
    const domRange = document.createRange();
    domRange.setStart(textNode, 6);
    domRange.setEnd(textNode, 10);

    const range = buildRangeFromCapture(
      article,
      domRange,
      { kind: "markdown", sectionId: "sec-1", text: "beta" },
      null,
    );

    expect(range).not.toBeNull();
    expect(range).toEqual({ sectionId: "sec-1", start: 6, end: 10, quote: "beta" });
  });

  it("maps a live DOM Range inside a page container to the pdf range", () => {
    const zone = document.createElement("div");
    const pageBox = zone.appendChild(document.createElement("div"));
    pageBox.setAttribute("data-page", "2");
    const layer = pageBox.appendChild(document.createElement("div"));
    layer.className = "pdf-text-layer";
    const span = layer.appendChild(document.createElement("span"));
    span.textContent = "page text more text";
    const domRange = document.createRange();
    domRange.setStart(span.firstChild as Text, 0);
    domRange.setEnd(span.firstChild as Text, 4);

    const range = buildRangeFromCapture(
      zone,
      domRange,
      { kind: "pdf", page: 2, text: "page" },
      null,
    );

    expect(range).not.toBeNull();
    expect(range).toEqual({ page: 2, start: 0, end: 4, quote: "page" });
  });

  it("answers null when the anchor region does not exist (honest)", () => {
    const { article } = markdownFixture();
    const p1 = article.querySelectorAll("p")[1];
    const textNode = p1.firstChild as Text;
    const domRange = document.createRange();
    domRange.setStart(textNode, 0);
    domRange.setEnd(textNode, 1);

    expect(buildRangeFromCapture(article, domRange, { kind: "markdown", sectionId: "ghost", text: "x" }, null)).toBeNull();
    expect(buildRangeFromCapture(article, domRange, { kind: "pdf", page: 9, text: "x" }, null)).toBeNull();
  });
});

describe("applyMarkdownAnnotations — the wrapped-span fallback", () => {
  it("wraps exactly the quote in a mark carrying the annotation id + kind/color classes", () => {
    const { article } = markdownFixture();

    const results = applyMarkdownAnnotations(article, [item()]);

    const mark = article.querySelector("mark[data-annotation-id='anno-1']");
    expect(mark).not.toBeNull();
    expect(mark!.textContent).toBe("beta");
    expect(mark!.className).toContain("anno-hl");
    expect(mark!.className).toContain("anno-color-amber");
    expect(results).toEqual([{ id: "anno-1", status: "ok" }]);
  });

  it("wraps an underline kind with the underline class (AD-9: kind + color affordances)", () => {
    const { article } = markdownFixture();

    applyMarkdownAnnotations(article, [item({ kind: "underline", color: "emerald" })]);

    const mark = article.querySelector("mark[data-annotation-id='anno-1']");
    expect(mark!.className).toContain("anno-ul");
    expect(mark!.className).toContain("anno-color-emerald");
  });

  it("wraps across paragraph boundaries within one section (accumulated offsets)", () => {
    const { article } = markdownFixture();
    // sec-1's stable text = "alpha beta gamma delta" (22) + "second
    // paragraph" (16) — paragraphs accumulate with NO separator, so the
    // range covers p1's "delta" and p2's "second" across the boundary.
    const range = { sectionId: "sec-1", start: 17, end: 28, quote: "deltasecond" };
    const results = applyMarkdownAnnotations(article, [item({ range })]);

    const marks = Array.from(article.querySelectorAll("mark[data-annotation-id='anno-1']"));
    expect(results).toEqual([{ id: "anno-1", status: "ok" }]);
    expect(marks.map((mark) => mark.textContent)).toEqual(["delta", "second"]);
    expect(article.textContent).toContain("alpha beta gamma delta");
    expect(article.textContent).toContain("second paragraph"); // no text lost to the splits
  });

  it("renders a stale range honestly — muted + the drift title, never misplaced", () => {
    const { article } = markdownFixture();
    const stale = item({ range: { sectionId: "sec-1", start: 6, end: 10, quote: "BETA" } });

    const results = applyMarkdownAnnotations(article, [stale]);

    const mark = article.querySelector("mark[data-annotation-id='anno-1']");
    expect(mark).not.toBeNull();
    expect(mark!.className).toContain("anno-stale");
    expect(mark!.getAttribute("title")).toBeTruthy();
    expect(results).toEqual([{ id: "anno-1", status: "stale" }]);
  });

  it("answers missing for a section id not in the DOM (honest, never a guessed region)", () => {
    const { article } = markdownFixture();
    const ghost = item({ range: { sectionId: "sec-ghost", start: 0, end: 5, quote: "intro" } });

    const results = applyMarkdownAnnotations(article, [ghost]);

    expect(results).toEqual([{ id: "anno-1", status: "missing" }]);
    expect(article.querySelector("mark")).toBeNull();
  });

  it("resolves the intro section (no rendered heading) through the intro contract", () => {
    const { article } = markdownFixture();
    const intro = item({ range: { sectionId: "intro-0", start: 6, end: 14, quote: "paragrap" } });

    const results = applyMarkdownAnnotations(article, [intro], { introSectionId: "intro-0" });

    const mark = article.querySelector("mark[data-annotation-id='anno-1']");
    expect(results).toEqual([{ id: "anno-1", status: "ok" }]);
    expect(mark!.textContent).toBe("paragrap");
  });

  it("re-applies idempotently: the fresh set replaces the old marks, no duplicates", () => {
    const { article } = markdownFixture();
    applyMarkdownAnnotations(article, [item({ id: "a" }), item({ id: "b", range: { sectionId: "sec-1", start: 0, end: 5, quote: "alpha" } })]);

    // a re-render hands in ONE annotation (b was removed) — the stale mark goes
    applyMarkdownAnnotations(article, [item({ id: "a" })]);

    const marks = Array.from(article.querySelectorAll("mark[data-annotation-id]"));
    expect(marks.map((mark) => mark.getAttribute("data-annotation-id"))).toEqual(["a"]);
    expect(article.textContent).toContain("alpha beta gamma delta");
  });

  it("clear unwraps every mark, restoring the plain text", () => {
    const { article } = markdownFixture();
    applyMarkdownAnnotations(article, [item(), item({ id: "b", range: { sectionId: "sec-1", start: 11, end: 16, quote: "gamma" } })]);

    clearMarkdownAnnotations(article);

    expect(article.querySelector("mark")).toBeNull();
    expect(article.textContent).toContain("alpha beta gamma delta");
  });
});

describe("applyPdfPageAnnotations — the text layer (T1's spans, delta 2)", () => {
  it("wraps a range across two spans using the accumulated layer string", () => {
    const layer = pdfLayerFixture();
    // "page text more text" — covers "ext mor" across the spans
    const range = { page: 3, start: 6, end: 13, quote: "ext mor" };

    const results = applyPdfPageAnnotations(layer, [item({ range })]);

    const marks = Array.from(layer.querySelectorAll("mark[data-annotation-id='anno-1']"));
    expect(results).toEqual([{ id: "anno-1", status: "ok" }]);
    expect(marks.map((mark) => mark.textContent)).toEqual(["ext ", "mor"]);
    expect(layer.textContent).toBe("page text more text");
  });

  it("answers deferred for a page whose layer has not rendered (off the render window)", () => {
    const layer = document.createElement("div"); // no spans — not rendered yet
    const range = { page: 5, start: 0, end: 4, quote: "page" };

    const results = applyPdfPageAnnotations(layer, [item({ range })]);

    expect(results).toEqual([{ id: "anno-1", status: "deferred" }]);
    expect(layer.querySelector("mark")).toBeNull();
  });

  it("answers stale on the pdf layer when the text drifted", () => {
    const layer = pdfLayerFixture();
    const range = { page: 3, start: 0, end: 4, quote: "PAGE" };

    const results = applyPdfPageAnnotations(layer, [item({ range })]);

    const mark = layer.querySelector("mark[data-annotation-id='anno-1']");
    expect(results).toEqual([{ id: "anno-1", status: "stale" }]);
    expect(mark!.className).toContain("anno-stale");
  });

  it("clear unwraps the layer's marks", () => {
    const layer = pdfLayerFixture();
    applyPdfPageAnnotations(layer, [item({ range: { page: 3, start: 0, end: 4, quote: "page" } })]);

    clearPdfPageAnnotations(layer);

    expect(layer.querySelector("mark")).toBeNull();
    expect(layer.textContent).toBe("page text more text");
  });
});

describe("the CSS Custom Highlight API path (feature-detected, stubbed)", () => {
  function stubHighlightApi(): Map<string, { ranges: unknown[] }> {
    const registry = new Map<string, { ranges: unknown[] }>();
    vi.stubGlobal("Highlight", class FakeHighlight {
      ranges: unknown[];
      constructor(...ranges: unknown[]) {
        this.ranges = ranges;
      }
    });
    vi.stubGlobal("CSS", { highlights: registry });
    return registry;
  }

  it("registers ranges per color+kind and inserts NO marks (zero DOM mutation)", () => {
    const registry = stubHighlightApi();
    const { article } = markdownFixture();

    try {
      const results = applyMarkdownAnnotations(article, [
        item(),
        item({ id: "anno-2", kind: "underline", color: "coral", range: { sectionId: "sec-1", start: 0, end: 5, quote: "alpha" } }),
      ]);

      expect(results).toEqual([
        { id: "anno-1", status: "ok" },
        { id: "anno-2", status: "ok" },
      ]);
      expect(article.querySelector("mark")).toBeNull();
      const registered = registry.get("synapse-anno-highlight-amber");
      expect(registered).toBeDefined();
      expect(registered!.ranges.length).toBe(1);
      expect(registry.get("synapse-anno-underline-coral")).toBeDefined();
    } finally {
      // the flows' teardown contract — the shared registry is reader-scoped
      clearMarkdownAnnotations(article);
    }
  });

  it("keeps stale ranges unpainted (the list carries the honesty) and re-registers cleanly", () => {
    const registry = stubHighlightApi();
    const { article } = markdownFixture();

    try {
      applyMarkdownAnnotations(article, [item({ range: { sectionId: "sec-1", start: 6, end: 10, quote: "BETA" } })]);
      expect(registry.has("synapse-anno-highlight-amber")).toBe(false);

      // a fresh application replaces the registrations (no stale keys piling up)
      applyMarkdownAnnotations(article, [item()]);
      const keys = Array.from(registry.keys());
      expect(keys).toEqual(["synapse-anno-highlight-amber"]);
    } finally {
      clearMarkdownAnnotations(article);
    }
  });
});
