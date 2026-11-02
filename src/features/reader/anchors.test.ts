import { describe, expect, it } from "vitest";
import { parseReaderSearchParams, readerAnchorHref } from "./anchors";

/**
 * Reader anchor params (AD-8) — pure parsing seam (canvas rendering is not
 * component-tested; jsdom cannot exercise it). Prior art: entry-decision.test.ts.
 */
describe("parseReaderSearchParams (AD-8 anchors)", () => {
  it("?page=N is a 1-based page target", () => {
    expect(parseReaderSearchParams("?page=7")).toEqual({ page: 7, highlight: false });
    expect(parseReaderSearchParams("?page=1")).toEqual({ page: 1, highlight: false });
  });

  it("a missing page anchor means start-at-the-beginning (null, not 1)", () => {
    expect(parseReaderSearchParams("")).toEqual({ page: null, highlight: false });
    expect(parseReaderSearchParams("?hl=1")).toEqual({ page: null, highlight: true });
  });

  it("unusable page values are dropped, never guessed", () => {
    expect(parseReaderSearchParams("?page=0").page).toBeNull();
    expect(parseReaderSearchParams("?page=-2").page).toBeNull();
    expect(parseReaderSearchParams("?page=3.5").page).toBeNull();
    expect(parseReaderSearchParams("?page=abc").page).toBeNull();
    expect(parseReaderSearchParams("?page=").page).toBeNull();
  });

  it("a known total clamps out-of-range pages into the document", () => {
    expect(parseReaderSearchParams("?page=99", 19)).toEqual({ page: 19, highlight: false });
    // a page within range passes untouched
    expect(parseReaderSearchParams("?page=7", 19).page).toBe(7);
  });

  it("an unknown total (document not open yet) passes the raw page for later clamping", () => {
    expect(parseReaderSearchParams("?page=99", null).page).toBe(99);
  });

  it("?hl=1 is the highlight flag; other hl values are not", () => {
    expect(parseReaderSearchParams("?page=2&hl=1").highlight).toBe(true);
    expect(parseReaderSearchParams("?page=2&hl=0").highlight).toBe(false);
    expect(parseReaderSearchParams("?page=2&hl=true").highlight).toBe(false);
  });
});

describe("readerAnchorHref — the anchor channel's producer side (citation chips, T5)", () => {
  it("builds /read/:id?page=N", () => {
    expect(readerAnchorHref("m1", 7)).toBe("/read/m1?page=7");
  });

  it("hl=1 rides along when the jump should flash", () => {
    expect(readerAnchorHref("m1", 7, true)).toBe("/read/m1?page=7&hl=1");
    expect(readerAnchorHref("m1", 7, false)).toBe("/read/m1?page=7");
  });

  it("pages floor at 1 and the id is URI-escaped", () => {
    expect(readerAnchorHref("m1", 0)).toBe("/read/m1?page=1");
    expect(readerAnchorHref("a b", 2)).toBe("/read/a%20b?page=2");
  });
});
