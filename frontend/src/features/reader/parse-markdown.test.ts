import { describe, expect, it } from "vitest";
import { sectionMarkdown } from "./parse-markdown";

/**
 * Markdown sectioner (spec testing seam 1): pure function over document text —
 * headings split, and the ids ARE the reader's rendered anchors: the sectioner
 * runs the exact react-markdown pipeline (remark → rehype-slug), so every
 * heading the renderer ids is a section boundary with that id. The
 * sectioner↔rendered-anchor agreement itself is pinned in
 * markdown-anchor-agreement.test.tsx (renders the real pipeline); these tests
 * pin the section shapes. The pipeline loads lazily, hence the awaits.
 */
describe("markdown sectioner — ATX heading splits (FR-9 groundwork)", () => {
  it("splits on ATX headings; section text keeps the heading line and body", async () => {
    const sections = await sectionMarkdown(
      ["# Getting Started", "Welcome text.", "", "## Setup", "Install steps."].join("\n"),
      "en",
    );
    expect(sections.map((s) => s.id)).toEqual(["getting-started", "setup"]);
    expect(sections.map((s) => s.title)).toEqual(["Getting Started", "Setup"]);
    expect(sections[0].text).toBe("# Getting Started\nWelcome text.");
    expect(sections[1].text).toBe("## Setup\nInstall steps.");
  });

  it("a line without the space after the #s is body text, not a heading", async () => {
    const sections = await sectionMarkdown("#Real\nstill body", "en");
    expect(sections).toHaveLength(1); // intro only — no heading boundary found
    expect(sections[0].text).toBe("#Real\nstill body");
  });

  it("a bare # run with no content is a boundary — it renders an empty heading (id '')", async () => {
    const sections = await sectionMarkdown("#\nbody under the empty heading", "en");
    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBe("");
    expect(sections[0].title).toBe("");
    expect(sections[0].text).toBe("#\nbody under the empty heading");
  });

  it("trailing closing sequence ( ##) is stripped from the title and slug", async () => {
    const sections = await sectionMarkdown("## Closing marks ##", "en");
    expect(sections[0].title).toBe("Closing marks");
    expect(sections[0].id).toBe("closing-marks");
  });

  it("inline markup is slugged on the RENDERED text, and the title reads clean", async () => {
    const sections = await sectionMarkdown("# 使用 **加粗** 与 `代码`", "zh");
    expect(sections[0].id).toBe("使用-加粗-与-代码");
    expect(sections[0].title).toBe("使用 加粗 与 代码");
  });
});

describe("markdown sectioner — setext headings (rendered h1/h2, so boundaries)", () => {
  it("= underline is an h1 boundary, - underline an h2 boundary", async () => {
    const md = ["Setext title", "===========", "", "Setext subtitle", "---------------", "body"].join("\n");
    const sections = await sectionMarkdown(md, "en");
    expect(sections.map((s) => s.id)).toEqual(["setext-title", "setext-subtitle"]);
    expect(sections[0].text).toBe("Setext title\n===========");
    expect(sections[1].text).toBe("Setext subtitle\n---------------\nbody");
  });

  it("--- after a blank line is a thematic break, not a heading; after a paragraph it is one", async () => {
    const md = ["Intro.", "", "---", "", "Still intro.", "", "Paragraph", "---", "tail"].join("\n");
    const sections = await sectionMarkdown(md, "en");
    // the standalone --- is no boundary; Paragraph--- is a setext h2 named "Paragraph"
    expect(sections.map((s) => s.id)).toEqual(["introduction", "paragraph"]);
    expect(sections[0].text).toContain("---");
    expect(sections[1].text).toBe("Paragraph\n---\ntail");
  });
});

describe("markdown sectioner — headings anywhere the renderer ids them", () => {
  it("a heading inside a blockquote is a boundary (rehype-slug ids it too)", async () => {
    const md = ["> # Quoted", "> quote body", "", "after"].join("\n");
    const sections = await sectionMarkdown(md, "en");
    // no intro: the bare `> ` markers before the heading render nothing
    expect(sections.map((s) => s.id)).toEqual(["quoted"]);
    expect(sections[0].text).toBe("# Quoted\n> quote body\n\nafter");

    // but rendered prose inside the quote before the heading IS an intro region
    const withProse = ["> prose before", "> # Quoted", "> quote body"].join("\n");
    const sectionsWithProse = await sectionMarkdown(withProse, "en");
    expect(sectionsWithProse.map((s) => s.id)).toEqual(["introduction", "quoted"]);
    expect(sectionsWithProse[0].text).toBe("> prose before");
  });

  it("fenced code is never read as headings — backtick and tilde fences", async () => {
    const md = ["# Real", "```md", "# not a heading", "const x = 1;", "```", "## After"].join("\n");
    const sections = await sectionMarkdown(md, "en");
    expect(sections.map((s) => s.id)).toEqual(["real", "after"]);
    expect(sections[0].text).toContain("# not a heading");
    expect(sections[0].text).toContain("```");

    const tilde = ["# Real", "~~~", "# not a heading", "~~~", "## After"].join("\n");
    expect((await sectionMarkdown(tilde, "en")).map((s) => s.id)).toEqual(["real", "after"]);
  });
});

describe("markdown sectioner — slugs match rehype-slug (github-slugger)", () => {
  it("duplicate headings dedupe with -1, -2 suffixes", async () => {
    const md = ["## Recap", "one", "## Recap", "two", "## Recap", "three"].join("\n");
    expect((await sectionMarkdown(md, "en")).map((s) => s.id)).toEqual(["recap", "recap-1", "recap-2"]);
  });

  it("CJK headings slug stably (identical across runs, spaces become dashes)", async () => {
    const md = ["# 第一章: 引言", "内容。", "# 第二章 系统设计", "更多内容。"].join("\n");
    const first = await sectionMarkdown(md);
    const second = await sectionMarkdown(md);
    expect(first.map((s) => s.id)).toEqual(["第一章-引言", "第二章-系统设计"]);
    expect(second.map((s) => s.id)).toEqual(first.map((s) => s.id));
  });

  it("duplicate CJK headings dedupe like latin ones", async () => {
    const md = ["## 第二章", "a", "## 第二章", "b"].join("\n");
    expect((await sectionMarkdown(md)).map((s) => s.id)).toEqual(["第二章", "第二章-1"]);
  });

  it("emoji and leading digits survive as github-slugger renders them", async () => {
    const md = "## 🚀 1. Launch!";
    const sections = await sectionMarkdown(md, "en");
    // whatever github-slugger makes of it — the agreement test pins it against the renderer
    expect(sections[0].id).toBeTruthy();
    expect(sections[0].title).toBe("🚀 1. Launch!");
  });
});

describe("markdown sectioner — text before the first heading", () => {
  it("becomes its own intro section (bilingual fallback title), slugged through a separate slugger", async () => {
    const md = ["Lead-in paragraph.", "", "# Getting Started", "body"].join("\n");
    const en = await sectionMarkdown(md, "en");
    expect(en[0].id).toBe("introduction");
    expect(en[0].title).toBe("Introduction");
    expect(en[0].text).toBe("Lead-in paragraph.");
    expect(en.map((s) => s.id)).toEqual(["introduction", "getting-started"]);

    const zh = await sectionMarkdown(md);
    expect(zh[0].id).toBe("开头");
    expect(zh[0].title).toBe("开头");
  });

  it("a document with no headings is one intro section holding everything", async () => {
    const sections = await sectionMarkdown("just\nplain\nlines", "en");
    expect(sections).toHaveLength(1);
    expect(sections[0].text).toBe("just\nplain\nlines");
  });

  it("whitespace-only text yields no sections (parseFile reports the empty reason)", async () => {
    expect(await sectionMarkdown("   \n  \n\t")).toEqual([]);
  });

  it("an intro colliding with a real heading takes the dot-busted id — rendered slugs never contain a dot", async () => {
    const md = ["Lead-in prose.", "", "# Introduction", "body"].join("\n");
    const sections = await sectionMarkdown(md, "en");
    expect(sections[0].id).toBe("introduction.");
    expect(sections[1].id).toBe("introduction");
  });
});
