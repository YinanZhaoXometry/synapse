import { Blob as NodeBlob } from "node:buffer";
import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import MarkdownView from "./markdown-view";
import { PdfPageFlow } from "./PdfPageFlow";
import { hitTestMarkdownAnnotation, hitTestPdfAnnotation } from "./annotation-engine";
import type { AnnotationRenderItem } from "./annotation-engine";
import { attachAnnotationHover, type AnnotationHoverAnchor } from "./annotation-hover";

/**
 * The hover-to-remove affordance (epic-24 T2): a painted annotation answers
 * the pointer with a popover (note body + remove), and remove reports the
 * annotation's id. jsdom runs the engine's wrapped-mark fallback, which is
 * also the delegation path — the Highlight-API caret bridge is browser-only
 * (no caretRangeFromPoint in jsdom), and its ADDRESS math is pinned directly
 * through hitTestMarkdownAnnotation / hitTestPdfAnnotation below. The pdf
 * surfaces (2026-11-09 hotfix) run the same affordance through PdfPageFlow
 * against a mocked pdf-render: one page, one span, "page text more text".
 */

// The pdf double: one 400×300 page whose text layer renders a single span —
// the T1 contract the engine addresses by [data-page] + text offsets.
vi.mock("./pdf-render", () => ({
  openPdfDocument: async () => ({
    numPages: 1,
    pageSize: () => ({ width: 400, height: 300 }),
    async renderPage() {
      return { cancel: () => {}, promise: Promise.resolve() };
    },
    async renderTextLayer(_pageNumber: number, layer: HTMLElement) {
      layer.replaceChildren();
      const span = document.createElement("span");
      span.textContent = "page text more text";
      layer.appendChild(span);
      return { cancel: () => {}, promise: Promise.resolve() };
    },
    destroy: () => {},
  }),
}));

const doc = (text: string) => new NodeBlob([text]) as unknown as Blob;

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

const DOC = "# 一\n\nalpha beta gamma\n\n## 二\n\ndelta epsilon\n";

/** An annotation over "beta" in section 一, with a note body. */
function betaAnnotation(id = "anno-1"): AnnotationRenderItem {
  return {
    id,
    range: { sectionId: "一", start: 6, end: 10, quote: "beta" },
    kind: "highlight",
    color: "coral",
    body: "期中必考",
  };
}

function renderView(props: {
  annotations?: AnnotationRenderItem[];
  onRemoveAnnotation?: (id: string) => void;
}) {
  return render(
    <LanguageProvider>
      <MarkdownView
        text={DOC}
        flashSection={null}
        annotations={props.annotations}
        onRemoveAnnotation={props.onRemoveAnnotation}
      />
    </LanguageProvider>,
  );
}

describe("annotation hover-remove (epic-24 T2) — fallback marks path", () => {
  it("hovering a painted mark opens the popover with the note body; remove reports the id", async () => {
    const user = userEvent.setup();
    const onRemoveAnnotation = vi.fn();
    const view = renderView({ annotations: [betaAnnotation()], onRemoveAnnotation });
    await waitFor(() => {
      expect(view.container.querySelector("mark[data-annotation-id]")).not.toBeNull();
    });
    const mark = view.container.querySelector("mark[data-annotation-id]")!;
    expect(mark.textContent).toBe("beta");

    await user.hover(mark);
    // the bridge resolves on the rAF tick — wait for the popover (the
    // assertion must live INSIDE waitFor: a bare null return resolves too)
    const popover = await waitFor(() => {
      const el = view.container.querySelector('[data-testid="annotation-hover-popover"]');
      expect(el).not.toBeNull();
      return el;
    });
    expect(popover!.textContent).toContain("期中必考");

    await user.click(view.container.querySelector('[data-testid="annotation-remove"]')!);
    expect(onRemoveAnnotation).toHaveBeenCalledTimes(1);
    expect(onRemoveAnnotation).toHaveBeenCalledWith("anno-1");
    expect(view.container.querySelector('[data-testid="annotation-hover-popover"]')).toBeNull();
  });

  it("no remove handler — no bridge, hovering paints nothing extra", async () => {
    const user = userEvent.setup();
    const view = renderView({ annotations: [betaAnnotation()] });
    await waitFor(() => {
      expect(view.container.querySelector("mark[data-annotation-id]")).not.toBeNull();
    });
    await user.hover(view.container.querySelector("mark[data-annotation-id]")!);
    expect(view.container.querySelector('[data-testid="annotation-hover-popover"]')).toBeNull();
  });

  it("Escape dismisses the popover without removing", async () => {
    const user = userEvent.setup();
    const onRemoveAnnotation = vi.fn();
    const view = renderView({ annotations: [betaAnnotation()], onRemoveAnnotation });
    await waitFor(() => {
      expect(view.container.querySelector("mark[data-annotation-id]")).not.toBeNull();
    });
    await user.hover(view.container.querySelector("mark[data-annotation-id]")!);
    await waitFor(() => {
      expect(view.container.querySelector('[data-testid="annotation-hover-popover"]')).not.toBeNull();
    });
    await user.keyboard("{Escape}");
    expect(view.container.querySelector('[data-testid="annotation-hover-popover"]')).toBeNull();
    expect(onRemoveAnnotation).not.toHaveBeenCalled();
  });
});

describe("the sticky anchor (2026-11-10) — the popover parks, it never chases the pointer", () => {
  /** One annotation painted as TWO marks (a multi-node wrap): the bug shape
   * where re-anchoring to each mark's rect let the popover jump between them. */
  function markDom(): { article: HTMLElement; markA: HTMLElement; markB: HTMLElement; plain: HTMLElement } {
    const article = document.createElement("article");
    const markA = article.appendChild(document.createElement("mark"));
    markA.setAttribute("data-annotation-id", "anno-1");
    markA.textContent = "first";
    const plain = article.appendChild(document.createElement("p"));
    plain.textContent = "gap";
    const markB = article.appendChild(document.createElement("mark"));
    markB.setAttribute("data-annotation-id", "anno-1");
    markB.textContent = "second";
    return { article, markA, markB, plain };
  }

  it("one annotation across two marks keeps the FIRST contact's anchor", async () => {
    const { article, markA, markB, plain } = markDom();
    document.body.append(article);
    const seen: Array<AnnotationHoverAnchor | null> = [];
    const rects = new Map<Element, { left: number; top: number; width: number; height: number }>([
      [markA, { left: 10, top: 20, width: 40, height: 16 }],
      [markB, { left: 100, top: 200, width: 60, height: 16 }],
    ]);
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const rect = rects.get(this);
        return rect ? ({ ...rect, x: rect.left, y: rect.top, right: 0, bottom: 0 } as DOMRect) : new DOMRect(0, 0, 0, 0);
      });
    const dispose = attachAnnotationHover(article, { items: [], onAnchor: (anchor) => seen.push(anchor) });
    try {
      markA.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
      await waitFor(() => expect(seen.length).toBeGreaterThanOrEqual(1));
      // markA's own box, centered horizontally (capped at the popover's half-width)
      expect(seen[0]).toEqual({ id: "anno-1", x: 30, y: 20 });

      // Moving to the SAME annotation's other mark re-parks NOTHING — the
      // dedup proves the coords held (a second callback would mean a jump).
      markB.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(seen).toHaveLength(1);

      // Off the annotation entirely: leaving the article clears the anchor
      // (jsdom has no caret API — a bare move over a non-annotation keeps
      // the parked anchor by design; the article leave is the dismissal).
      article.dispatchEvent(new MouseEvent("mouseleave"));
      await waitFor(() => expect(seen.at(-1)).toBeNull());

      // Re-entry parks at the ENTRY mark's geometry, not the old anchor.
      markB.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
      await waitFor(() => expect(seen.at(-1)).toEqual({ id: "anno-1", x: 130, y: 200 }));
    } finally {
      dispose();
      rectSpy.mockRestore();
      article.remove();
    }
  });
});

describe("hitTestMarkdownAnnotation (epic-24 T2) — the caret path's address math", () => {
  // Build the rendered shape by hand (the engine's region walks are the same
  // ones the real render feeds): article > h1#一 + p + h2#二 + p.
  function articleDom(): { article: HTMLElement; betaNode: Text; deltaNode: Text } {
    const article = document.createElement("article");
    const h1 = document.createElement("h1");
    h1.id = "一";
    h1.textContent = "一";
    const p1 = document.createElement("p");
    p1.textContent = "alpha beta gamma";
    const h2 = document.createElement("h2");
    h2.id = "二";
    h2.textContent = "二";
    const p2 = document.createElement("p");
    p2.textContent = "delta epsilon";
    article.append(h1, p1, h2, p2);
    return { article, betaNode: p1.firstChild as Text, deltaNode: p2.firstChild as Text };
  }

  it("the caret inside the covered span answers the annotation", () => {
    const { article, betaNode } = articleDom();
    const hit = hitTestMarkdownAnnotation(article, [betaAnnotation()], null, betaNode, 7);
    expect(hit).toBe("anno-1"); // 6 ≤ 7 < 10
  });

  it("the caret outside every range answers null", () => {
    const { article, betaNode } = articleDom();
    expect(hitTestMarkdownAnnotation(article, [betaAnnotation()], null, betaNode, 2)).toBeNull();
    expect(hitTestMarkdownAnnotation(article, [betaAnnotation()], null, betaNode, 12)).toBeNull();
  });

  it("the caret in ANOTHER section never answers a foreign range", () => {
    const { article, deltaNode } = articleDom();
    expect(hitTestMarkdownAnnotation(article, [betaAnnotation()], null, deltaNode, 2)).toBeNull();
  });

  it("a drifted (stale) range is not hoverable — it paints nothing, it answers nothing", () => {
    const { article, betaNode } = articleDom();
    const stale: AnnotationRenderItem = {
      ...betaAnnotation(),
      range: { sectionId: "一", start: 6, end: 10, quote: "WRONG TEXT" },
    };
    expect(hitTestMarkdownAnnotation(article, [stale], null, betaNode, 7)).toBeNull();
  });

  it("the caret inside a heading answers null — headings are addresses, not content", () => {
    const { article } = articleDom();
    const h1Text = (article.querySelector("h1")!.firstChild as Text)!;
    expect(hitTestMarkdownAnnotation(article, [betaAnnotation()], null, h1Text, 0)).toBeNull();
  });
});

describe("hitTestPdfAnnotation — the caret path's address math (pdf pages)", () => {
  // The rendered shape by hand (the engine's page walk is the same one the
  // real layer feeds): zone > [data-page=2] > .pdf-text-layer > span.
  function pdfPageDom(): { zone: HTMLElement; textNode: Text; foreignNode: Text } {
    const zone = document.createElement("div");
    const pageBox = zone.appendChild(document.createElement("div"));
    pageBox.setAttribute("data-page", "2");
    const layer = pageBox.appendChild(document.createElement("div"));
    layer.className = "pdf-text-layer";
    const span = layer.appendChild(document.createElement("span"));
    span.textContent = "page text more text";
    const foreign = zone.appendChild(document.createElement("span"));
    foreign.textContent = "outside every layer";
    return { zone, textNode: span.firstChild as Text, foreignNode: foreign.firstChild as Text };
  }

  /** An annotation over "text" (5..9) on page 2, with a note body. */
  function pageAnnotation(id = "anno-1"): AnnotationRenderItem {
    return {
      id,
      range: { page: 2, start: 5, end: 9, quote: "text" },
      kind: "highlight",
      color: "coral",
      body: "期中必考",
    };
  }

  it("the caret inside the covered text answers the annotation", () => {
    const { zone, textNode } = pdfPageDom();
    expect(hitTestPdfAnnotation(zone, [pageAnnotation()], textNode, 6)).toBe("anno-1"); // 5 ≤ 6 < 9
  });

  it("the caret outside every range answers null", () => {
    const { zone, textNode } = pdfPageDom();
    expect(hitTestPdfAnnotation(zone, [pageAnnotation()], textNode, 2)).toBeNull();
    expect(hitTestPdfAnnotation(zone, [pageAnnotation()], textNode, 12)).toBeNull();
  });

  it("another page's ranges never answer (the page box is the address)", () => {
    const { zone, textNode } = pdfPageDom();
    const otherPage: AnnotationRenderItem = {
      ...pageAnnotation(),
      range: { page: 3, start: 5, end: 9, quote: "text" },
    };
    expect(hitTestPdfAnnotation(zone, [otherPage], textNode, 6)).toBeNull();
  });

  it("a drifted (stale) range is not hoverable — it paints nothing, it answers nothing", () => {
    const { zone, textNode } = pdfPageDom();
    const stale: AnnotationRenderItem = {
      ...pageAnnotation(),
      range: { page: 2, start: 5, end: 9, quote: "WRONG TEXT" },
    };
    expect(hitTestPdfAnnotation(zone, [stale], textNode, 6)).toBeNull();
  });

  it("a node outside every page layer answers null", () => {
    const { zone, foreignNode } = pdfPageDom();
    expect(hitTestPdfAnnotation(zone, [pageAnnotation()], foreignNode, 3)).toBeNull();
  });
});

describe("annotation hover-remove — the pdf page surfaces (2026-11-09 hotfix)", () => {
  // The flow measures its column through ResizeObserver before any page
  // mounts; the suite-wide stub never fires, so this file gives it one that
  // reports a real width on observe. Re-stubbed per test — the file-wide
  // afterEach in annotation-engine's convention unstubs between tests.
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private readonly callback: ResizeObserverCallback) {}
        observe(target: Element): void {
          this.callback([{ contentRect: { width: 800 } } as ResizeObserverEntry], target as unknown as ResizeObserver);
        }
        unobserve(): void {}
        disconnect(): void {}
      },
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Page-1 twin of the address-math fixture ("text" = 5..9). */
  function pageOneAnnotation(id = "anno-1"): AnnotationRenderItem {
    return {
      id,
      range: { page: 1, start: 5, end: 9, quote: "text" },
      kind: "highlight",
      color: "coral",
      body: "期中必考",
    };
  }

  const noop = () => {};

  function renderFlow(props: { annotations?: AnnotationRenderItem[]; onRemoveAnnotation?: (id: string) => void }) {
    return render(
      <LanguageProvider>
        <PdfPageFlow
          blob={doc("the mock owns the bytes")}
          initialPage={null}
          flashTarget={false}
          onPageChange={noop}
          onTotalPages={noop}
          annotations={props.annotations}
          onAnnotationsApplied={noop}
          onRemoveAnnotation={props.onRemoveAnnotation}
        />
      </LanguageProvider>,
    );
  }

  it("hovering a painted page mark opens the popover with the note body; remove reports the id", async () => {
    const user = userEvent.setup();
    const onRemoveAnnotation = vi.fn();
    const view = renderFlow({ annotations: [pageOneAnnotation()], onRemoveAnnotation });
    const mark = await waitFor(() => {
      const el = view.container.querySelector("mark[data-annotation-id]");
      expect(el).not.toBeNull();
      return el;
    });
    expect(mark!.textContent).toBe("text");

    await user.hover(mark!);
    const popover = await waitFor(() => {
      const el = view.container.querySelector('[data-testid="annotation-hover-popover"]');
      expect(el).not.toBeNull();
      return el;
    });
    expect(popover!.textContent).toContain("期中必考");

    await user.click(view.container.querySelector('[data-testid="annotation-remove"]')!);
    expect(onRemoveAnnotation).toHaveBeenCalledTimes(1);
    expect(onRemoveAnnotation).toHaveBeenCalledWith("anno-1");
    expect(view.container.querySelector('[data-testid="annotation-hover-popover"]')).toBeNull();
  });

  it("no remove handler — no bridge, hovering paints nothing extra", async () => {
    const user = userEvent.setup();
    const view = renderFlow({ annotations: [pageOneAnnotation()] });
    const mark = await waitFor(() => {
      const el = view.container.querySelector("mark[data-annotation-id]");
      expect(el).not.toBeNull();
      return el;
    });
    await user.hover(mark!);
    expect(view.container.querySelector('[data-testid="annotation-hover-popover"]')).toBeNull();
  });

  it("Escape dismisses the popover without removing", async () => {
    const user = userEvent.setup();
    const onRemoveAnnotation = vi.fn();
    const view = renderFlow({ annotations: [pageOneAnnotation()], onRemoveAnnotation });
    const mark = await waitFor(() => {
      const el = view.container.querySelector("mark[data-annotation-id]");
      expect(el).not.toBeNull();
      return el;
    });
    await user.hover(mark!);
    await waitFor(() => {
      expect(view.container.querySelector('[data-testid="annotation-hover-popover"]')).not.toBeNull();
    });
    await user.keyboard("{Escape}");
    expect(view.container.querySelector('[data-testid="annotation-hover-popover"]')).toBeNull();
    expect(onRemoveAnnotation).not.toHaveBeenCalled();
  });
});
