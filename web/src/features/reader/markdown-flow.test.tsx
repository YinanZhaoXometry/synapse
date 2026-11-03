import { Blob as NodeBlob } from "node:buffer";
import { render, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
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
      <MarkdownFlow
        blob={doc("# One\n\nalpha\n\n## Two\n\nbeta")}
        initialSection={null}
        flashTarget={false}
        onViewportScroll={onViewportScroll}
      />,
    );
    await waitFor(() => expect(onViewportScroll).toHaveBeenCalledTimes(1));
    expect(onViewportScroll).toHaveBeenCalledWith(0); // jsdom: the unscrolled container scrollTop
  });

  it("an anchor landing reports too — one settled report after the programmatic scroll", async () => {
    const onViewportScroll = vi.fn();
    render(
      <MarkdownFlow
        blob={doc("# One\n\nalpha\n\n## Two\n\nbeta")}
        initialSection="two"
        flashTarget={false}
        onViewportScroll={onViewportScroll}
      />,
    );
    await waitFor(() => expect(onViewportScroll).toHaveBeenCalledTimes(1));
    expect(onViewportScroll).toHaveBeenCalledWith(0);
  });
});
