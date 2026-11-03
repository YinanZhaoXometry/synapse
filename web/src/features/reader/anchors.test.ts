import { describe, expect, it } from "vitest";
import { parseReaderHash, parseReaderSearchParams, readerAnchorHref, readerSectionHref } from "./anchors";

/**
 * Reader anchor params (AD-8) — pure parsing seam (canvas rendering is not
 * component-tested; jsdom cannot exercise it). Prior art: entry-decision.test.ts.
 */
describe("parseReaderSearchParams (AD-8 anchors)", () => {
  it("?page=N is a 1-based page target", () => {
    expect(parseReaderSearchParams("?page=7")).toEqual({ page: 7, section: null, highlight: false });
    expect(parseReaderSearchParams("?page=1")).toEqual({ page: 1, section: null, highlight: false });
  });

  it("a missing page anchor means start-at-the-beginning (null, not 1)", () => {
    expect(parseReaderSearchParams("")).toEqual({ page: null, section: null, highlight: false });
    expect(parseReaderSearchParams("?hl=1")).toEqual({ page: null, section: null, highlight: true });
  });

  it("unusable page values are dropped, never guessed", () => {
    expect(parseReaderSearchParams("?page=0").page).toBeNull();
    expect(parseReaderSearchParams("?page=-2").page).toBeNull();
    expect(parseReaderSearchParams("?page=3.5").page).toBeNull();
    expect(parseReaderSearchParams("?page=abc").page).toBeNull();
    expect(parseReaderSearchParams("?page=").page).toBeNull();
  });

  it("a known total clamps out-of-range pages into the document", () => {
    expect(parseReaderSearchParams("?page=99", 19)).toEqual({ page: 19, section: null, highlight: false });
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

describe("parseReaderHash — the Markdown branch of the anchor channel (AD-8)", () => {
  it("#section-id is the section target, latin and CJK", () => {
    expect(parseReaderHash("#getting-started")).toBe("getting-started");
    expect(parseReaderHash("#第二章-系统设计")).toBe("第二章-系统设计");
  });

  it("a percent-encoded hash decodes to the section id", () => {
    expect(parseReaderHash(`#${encodeURIComponent("第二章-系统设计")}`)).toBe("第二章-系统设计");
    expect(parseReaderHash("#hello%20world")).toBe("hello world");
  });

  it("a missing, empty, or malformed hash is not an anchor — dropped, never guessed", () => {
    expect(parseReaderHash("")).toBeNull();
    expect(parseReaderHash("#")).toBeNull();
    expect(parseReaderHash("no-hash-at-all")).toBeNull();
    expect(parseReaderHash("#%E7")).toBeNull(); // truncated escape
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

describe("readerSectionHref — Markdown locators anchor by section id (T3's branch)", () => {
  it("builds /read/:id#section-id with the id percent-encoded", () => {
    expect(readerSectionHref("m1", "getting-started")).toBe("/read/m1#getting-started");
    expect(readerSectionHref("m1", "第二章-系统设计")).toBe("/read/m1#%E7%AC%AC%E4%BA%8C%E7%AB%A0-%E7%B3%BB%E7%BB%9F%E8%AE%BE%E8%AE%A1");
  });

  it("hl=1 rides along when the jump should flash", () => {
    expect(readerSectionHref("m1", "recap", true)).toBe("/read/m1?hl=1#recap");
    expect(readerSectionHref("m1", "recap", false)).toBe("/read/m1#recap");
  });

  it("round-trips through parseReaderHash", () => {
    const href = readerSectionHref("m1", "开头", true);
    const hash = `#${href.split("#")[1]}`;
    expect(parseReaderHash(hash)).toBe("开头");
  });
});
