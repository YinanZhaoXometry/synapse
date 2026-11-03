import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MarkdownView from "./markdown-view";
import { sectionMarkdown } from "./parse-markdown";

/**
 * THE invariant (ticket T3): T1's sectioner ids and the rendered heading ids
 * agree. Both sides run the same pipeline — the sectioner mirrors
 * react-markdown's remark → rehype-slug exactly — so this holds by
 * construction; these tests pin it on the fixtures that matter for study
 * notes: CJK headings, duplicate dedupe, emoji/digit/punctuation edges,
 * setext headings, inline markup in headings, headings nested in
 * blockquotes/lists, and empty headings. Prior art: the sectioner's own tests.
 */

/** The rendered heading ids, in document order, read straight from the DOM. */
function renderedHeadingIds(text: string): string[] {
  const { container } = render(<MarkdownView text={text} flashSection={null} />);
  return Array.from(
    container.querySelectorAll("h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]"),
    (el) => el.getAttribute("id") ?? "",
  );
}

const FIXTURE = [
  "# 第一章: 引言",
  "内容段落。",
  "",
  "## Getting started",
  "Some **bold** body.",
  "",
  "## Getting started",
  "Duplicate heading body.",
  "",
  "## 🚀 1. Launch!",
  "Emoji, digits, punctuation.",
  "",
  "Setext title",
  "===========",
  "",
  "Setext subtitle",
  "---------------",
  "Body under setext.",
  "",
  "# `Code` and [links](https://example.com) in headings",
  "Tail body.",
].join("\n");

const NESTED = [
  "> # Quoted heading",
  "> quote body",
  "",
  "- list item one",
  "  # Heading inside a list item",
  "",
  "```md",
  "# not a heading",
  "```",
  "",
  "#",
  "empty heading above",
].join("\n");

describe("sectioner ↔ rendered-anchor agreement (T3's core invariant)", () => {
  it("CJK + duplicates + emoji/digits + setext + inline markup: parsed ids equal rendered ids", async () => {
    const sections = await sectionMarkdown(FIXTURE, "en");
    const rendered = renderedHeadingIds(FIXTURE);
    expect(rendered.length).toBeGreaterThan(4); // the fixture is actually exercising the shapes
    expect(new Set(rendered).size).toBe(rendered.length); // rehype-slug deduped every heading
    expect(sections.map((s) => s.id)).toEqual(rendered);
  });

  it("headings nested in blockquotes/list items and empty headings agree too", async () => {
    const sections = await sectionMarkdown(NESTED, "en");
    const rendered = renderedHeadingIds(NESTED);
    expect(rendered).toContain("quoted-heading");
    expect(rendered).toContain("heading-inside-a-list-item");
    expect(rendered).toContain(""); // the empty heading renders with id ''
    expect(sections.map((s) => s.id)).toEqual(rendered);
  });

  it("the intro section precedes the rendered ids — it anchors the region before the first heading", async () => {
    const md = ["Lead-in prose.", "", "# Introduction", "body"].join("\n");
    const sections = await sectionMarkdown(md, "en");
    expect(sections[0].id).toBe("introduction."); // dot-busted: a rendered slug never contains one
    expect(sections.slice(1).map((s) => s.id)).toEqual(renderedHeadingIds(md));
  });

  it("titles read clean (rendered text, syntax stripped) while ids stay the anchors", async () => {
    const sections = await sectionMarkdown(FIXTURE, "en");
    expect(sections[0].title).toBe("第一章: 引言");
    expect(sections[6].title).toBe("Code and links in headings");
    expect(sections[4].title).toBe("Setext title");
  });

  it("onHeadingsResolved reports the rendered ids in order (T4's seam)", () => {
    const resolved: string[][] = [];
    render(
      <MarkdownView
        text={["## Recap", "a", "## Recap", "b"].join("\n")}
        flashSection={null}
        onHeadingsResolved={(ids) => resolved.push(ids)}
      />,
    );
    expect(resolved[0]).toEqual(["recap", "recap-1"]);
  });
});
