import { Blob as NodeBlob } from "node:buffer";
import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import MarkdownView from "./markdown-view";
import { hitTestMarkdownAnnotation } from "./annotation-engine";
import type { AnnotationRenderItem } from "./annotation-engine";

/**
 * The hover-to-remove affordance (epic-24 T2): a painted annotation answers
 * the pointer with a popover (note body + remove), and remove reports the
 * annotation's id. jsdom runs the engine's wrapped-mark fallback, which is
 * also the delegation path — the Highlight-API caret bridge is browser-only
 * (no caretRangeFromPoint in jsdom), and its ADDRESS math is pinned directly
 * through hitTestMarkdownAnnotation below.
 */

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
