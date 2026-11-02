import { describe, expect, it } from "vitest";
import { sectionMarkdown } from "./parse-markdown";

/**
 * Markdown sectioner (spec testing seam 1): pure function over document text —
 * ATX headings split, github-slugger ids (the rehype-slug algorithm, so parse
 * ids match the reader's rendered anchors in T3), fenced code never read as
 * headings, duplicate headings dedupe, CJK headings stable.
 */
describe("markdown sectioner — ATX heading splits (FR-9 groundwork)", () => {
  it("splits on ATX headings; section text keeps the heading line and body", () => {
    const sections = sectionMarkdown(
      ["# Getting Started", "Welcome text.", "", "## Setup", "Install steps."].join("\n"),
      "en",
    );
    expect(sections.map((s) => s.id)).toEqual(["getting-started", "setup"]);
    expect(sections.map((s) => s.title)).toEqual(["Getting Started", "Setup"]);
    expect(sections[0].text).toBe("# Getting Started\nWelcome text.");
    expect(sections[1].text).toBe("## Setup\nInstall steps.");
  });

  it("a line without the space after the #s is body text, not a heading", () => {
    const sections = sectionMarkdown("#Real\nstill body", "en");
    expect(sections).toHaveLength(1); // intro only — no heading boundary found
    expect(sections[0].text).toBe("#Real\nstill body");
  });

  it("a bare # run with no content is not a section boundary", () => {
    const sections = sectionMarkdown("#\nbody under the empty heading", "en");
    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBe("introduction");
  });

  it("trailing closing sequence ( ##) is stripped from the title and slug", () => {
    const sections = sectionMarkdown("## Closing marks ##", "en");
    expect(sections[0].title).toBe("Closing marks");
    expect(sections[0].id).toBe("closing-marks");
  });
});

describe("markdown sectioner — slugs match rehype-slug (github-slugger)", () => {
  it("duplicate headings dedupe with -1, -2 suffixes", () => {
    const md = ["## Recap", "one", "## Recap", "two", "## Recap", "three"].join("\n");
    expect(sectionMarkdown(md, "en").map((s) => s.id)).toEqual(["recap", "recap-1", "recap-2"]);
  });

  it("CJK headings slug stably (identical across runs, spaces become dashes)", () => {
    const md = ["# 第一章: 引言", "内容。", "# 第二章 系统设计", "更多内容。"].join("\n");
    const first = sectionMarkdown(md);
    const second = sectionMarkdown(md);
    expect(first.map((s) => s.id)).toEqual(["第一章-引言", "第二章-系统设计"]);
    expect(second.map((s) => s.id)).toEqual(first.map((s) => s.id));
  });

  it("duplicate CJK headings dedupe like latin ones", () => {
    const md = ["## 第二章", "a", "## 第二章", "b"].join("\n");
    expect(sectionMarkdown(md).map((s) => s.id)).toEqual(["第二章", "第二章-1"]);
  });
});

describe("markdown sectioner — fenced code is never read as headings", () => {
  it("backtick fences: # lines inside stay section text", () => {
    const md = ["# Real", "```md", "# not a heading", "const x = 1;", "```", "## After"].join("\n");
    const sections = sectionMarkdown(md, "en");
    expect(sections.map((s) => s.id)).toEqual(["real", "after"]);
    expect(sections[0].text).toContain("# not a heading");
    expect(sections[0].text).toContain("```");
  });

  it("tilde fences behave the same, and only a same-char run closes a fence", () => {
    const md = ["# Real", "~~~", "# not a heading", "~~~", "## After"].join("\n");
    expect(sectionMarkdown(md, "en").map((s) => s.id)).toEqual(["real", "after"]);
  });
});

describe("markdown sectioner — text before the first heading", () => {
  it("becomes its own intro section (bilingual fallback title), slugged through the same slugger", () => {
    const md = ["Lead-in paragraph.", "", "# Getting Started", "body"].join("\n");
    const en = sectionMarkdown(md, "en");
    expect(en[0].id).toBe("introduction");
    expect(en[0].title).toBe("Introduction");
    expect(en[0].text).toBe("Lead-in paragraph.");
    expect(en.map((s) => s.id)).toEqual(["introduction", "getting-started"]);

    const zh = sectionMarkdown(md);
    expect(zh[0].id).toBe("开头");
    expect(zh[0].title).toBe("开头");
  });

  it("a document with no headings is one intro section holding everything", () => {
    const sections = sectionMarkdown("just\nplain\nlines", "en");
    expect(sections).toHaveLength(1);
    expect(sections[0].text).toBe("just\nplain\nlines");
  });

  it("whitespace-only text yields no sections (parseFile reports the empty reason)", () => {
    expect(sectionMarkdown("   \n  \n\t")).toEqual([]);
  });
});
