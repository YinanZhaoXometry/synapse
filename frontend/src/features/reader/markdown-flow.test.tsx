import { Blob as NodeBlob } from "node:buffer";
import { render, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { MarkdownFlow } from "./MarkdownFlow";

/**
 * MarkdownFlow's position seam (FR-10; the short-document fix): the flow must
 * report its viewport scrollTop to the position tracker even when the document
 * never scrolls — for a one-screen document the one-shot landing is the ONLY
 * report there ever is, and without it the Companion waits on a position
 * forever. Component-level because the bug was wiring (a missing report, not
 * selector math — position-tracking.test.ts owns that); jsdom has no scroll
 * layout, so these pin the REPORTING contract (one call, the container's
 * scrollTop), not the section choice. jsdom 20's Blob predates .arrayBuffer(),
 * so the bytes ride Node's Blob (reader-loop prior art); its missing
 * scrollIntoView is stubbed for the anchor case.
 */

const doc = (text: string) => new NodeBlob([text]) as unknown as Blob;

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

describe("MarkdownFlow position reporting (FR-10)", () => {
  it("a document that fits one screen reports once the headings resolve — no scroll event needed", async () => {
    const onViewportScroll = vi.fn();
    render(
      <LanguageProvider>
        <MarkdownFlow
          blob={doc("# One\n\nalpha\n\n## Two\n\nbeta")}
          initialSection={null}
          flashTarget={false}
          onViewportScroll={onViewportScroll}
        />
      </LanguageProvider>,
    );
    await waitFor(() => expect(onViewportScroll).toHaveBeenCalledTimes(1));
    expect(onViewportScroll).toHaveBeenCalledWith(0); // jsdom: the unscrolled container scrollTop
  });

  it("an anchor landing reports too — one settled report after the programmatic scroll", async () => {
    const onViewportScroll = vi.fn();
    render(
      <LanguageProvider>
        <MarkdownFlow
          blob={doc("# One\n\nalpha\n\n## Two\n\nbeta")}
          initialSection="two"
          flashTarget={false}
          onViewportScroll={onViewportScroll}
        />
      </LanguageProvider>,
    );
    await waitFor(() => expect(onViewportScroll).toHaveBeenCalledTimes(1));
    expect(onViewportScroll).toHaveBeenCalledWith(0);
  });
});

/**
 * epic-13 T5 (owner Q6): a markdown-kind material can carry pptx bytes (the
 * deck rides the markdown pipeline end-to-end). The flow must NOT decode a zip
 * as text — it synthesizes the slide-title document through the parse seam, so
 * the existing markdown view shows 第 N 页-titled sections (no special
 * rendering). The observable: the rendered heading ids the flow reports — a
 * raw-zip decode renders none.
 */
describe("MarkdownFlow pptx bytes (epic-13 T5)", () => {
  it("a pptx blob renders the synthesized slide-title document, never raw zip bytes", async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file(
      "ppt/slides/slide1.xml",
      `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
        `xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>` +
        `<p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Lecture One</a:t></a:r></a:p></p:txBody></p:sp>` +
        `<p:sp><p:txBody><a:p><a:r><a:t>slide body text</a:t></a:r></a:p></p:txBody></p:sp>` +
        `</p:spTree></p:cSld></p:sld>`,
    );
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const onHeadingsResolved = vi.fn();
    render(
      <LanguageProvider>
        <MarkdownFlow
          blob={new NodeBlob([bytes]) as unknown as Blob}
          initialSection={null}
          flashTarget={false}
          onHeadingsResolved={onHeadingsResolved}
        />
      </LanguageProvider>,
    );
    await waitFor(() => expect(onHeadingsResolved).toHaveBeenCalled());
    const ids = onHeadingsResolved.mock.calls[0][0] as string[];
    expect(ids).toContain("lecture-one"); // the slide title became the rendered heading
    expect(ids).not.toContain("slide-1"); // persisted ids are not DOM anchors (honest no-op jump)
  });
});
