import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { UiLanguage } from "@/ai/types";
import { parseFile } from "./parse";
import { parsePptx } from "./parse-pptx";

/**
 * The PPT path of the reader's public parse(file) seam (epic-13 T5, owner Q6;
 * AD-7): a pptx is a zip of slide XML — the fixture is BUILT in-test with
 * jszip itself (slide files carrying `<a:t>` runs in the DrawingML shape the
 * real decks use), so no binary fixture file is committed. Sections mirror
 * parse-pdf's page contract: `slide-N` ids, title from the title placeholder
 * (else the first text run, else the bilingual 第 N 页 fallback), all text
 * runs as the body, notes slides appended labeled, image-only slides yielding
 * the honest limitation note while truly-empty slides are skipped.
 * Prior art: parse.test.ts (the pdf/markdown fixtures + reason codes).
 */

const slideXml = (spTree: string): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"` +
  ` xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"` +
  ` xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
  `<p:cSld><p:spTree>${spTree}</p:spTree></p:cSld></p:sld>`;

/** A title-placeholder shape (`<p:ph type="title"/>`) carrying one run. */
const titleShape = (text: string): string =>
  `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>` +
  `<p:txBody><a:bodyPr/><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;

/** A body shape: each entry is one `<a:p>` paragraph with one run. */
const bodyShape = (paragraphs: string[]): string =>
  `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Content 2"/><p:nvPr/></p:nvSpPr>` +
  `<p:txBody><a:bodyPr/>${paragraphs
    .map((p) => `<a:p><a:r><a:rPr lang="en-US"/><a:t>${p}</a:t></a:r></a:p>`)
    .join("")}</p:txBody></p:sp>`;

/** A picture shape — visual content with no text runs. */
const picShape = (name: string): string =>
  `<p:pic><p:nvPicPr><p:cNvPr id="4" name="${name}"/><p:nvPr/></p:nvPicPr>` +
  `<p:blipFill><a:blip r:embed="rId2"/></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr></p:pic>`;

/** An empty placeholder shape — the layout residue of a blank slide. */
const emptyShape = (): string =>
  `<p:sp><p:nvSpPr><p:cNvPr id="5" name="Content Placeholder 4"/><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr>` +
  `<p:txBody><a:bodyPr/><a:p><a:endParaRPr lang="zh-CN"/></a:p></p:txBody></p:sp>`;

const notesXml = (paragraphs: string[]): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"` +
  ` xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
  `<p:cSld><p:spTree>${paragraphs
    .map((p) => `<p:sp><p:txBody><a:bodyPr/><a:p><a:r><a:t>${p}</a:t></a:r></a:p></p:txBody></p:sp>`)
    .join("")}</p:spTree></p:cSld></p:notes>`;

interface FixtureSlide {
  spTree: string;
  notes?: string[];
}

/** Build the pptx BYTES in-test: a zip of slide (+ notes) XML parts, real deck shape. */
async function buildPptx(slides: FixtureSlide[]): Promise<Uint8Array> {
  const zip = new JSZip();
  slides.forEach((slide, i) => {
    zip.file(`ppt/slides/slide${i + 1}.xml`, slideXml(slide.spTree));
    if (slide.notes) zip.file(`ppt/notesSlides/notesSlide${i + 1}.xml`, notesXml(slide.notes));
  });
  const blob = await zip.generateAsync({ type: "uint8array" });
  return blob;
}

const bytesOf = (text: string): Uint8Array => new TextEncoder().encode(text);

describe("parse(file) — PPT path (epic-13 T5, owner Q6; AD-7)", () => {
  it("slides → slide-N sections in order; title placeholder titles, all runs as the body", async () => {
    const bytes = await buildPptx([
      { spTree: titleShape("Lecture One") + bodyShape(["First point", "Second point"]) },
      { spTree: titleShape("第二章") + bodyShape(["要點一"]) },
    ]);
    const outcome = await parseFile({ bytes, kind: "markdown" });
    expect(outcome.state).toBe("parsed");
    expect(outcome.reason).toBeUndefined();
    expect(outcome.sections.map((s) => s.id)).toEqual(["slide-1", "slide-2"]);
    expect(outcome.sections.map((s) => s.title)).toEqual(["Lecture One", "第二章"]);
    expect(outcome.sections[0].text).toContain("First point");
    expect(outcome.sections[0].text).toContain("Second point");
    expect(outcome.sections[1].text).toContain("要點一");
  });

  it("a slide with no title placeholder titles by its first text run", async () => {
    const bytes = await buildPptx([{ spTree: bodyShape(["Runaway Heading", "body under it"]) }]);
    const outcome = await parseFile({ bytes, kind: "markdown" });
    expect(outcome.state).toBe("parsed");
    expect(outcome.sections[0].title).toBe("Runaway Heading");
    expect(outcome.sections[0].text).toContain("body under it");
  });

  it("an image-only slide keeps the bilingual 第 N 页 fallback title plus the limitation note", async () => {
    const bytes = await buildPptx([
      { spTree: titleShape("Real Slide") + bodyShape(["text"]) },
      { spTree: picShape("Diagram 1") },
    ]);
    const zh = await parseFile({ bytes, kind: "markdown" });
    expect(zh.sections.map((s) => s.id)).toEqual(["slide-1", "slide-2"]);
    expect(zh.sections[1].title).toBe("第 2 页");
    expect(zh.sections[1].text).toContain("图片内容不会出现");
    const en = await parseFile({ bytes, kind: "markdown", language: "en" satisfies UiLanguage });
    expect(en.sections[1].title).toBe("Page 2");
    expect(en.sections[1].text).toContain("image content");
  });

  it("a truly-empty slide is skipped — an all-empty deck fails honestly with the empty reason", async () => {
    const bytes = await buildPptx([
      { spTree: titleShape("Only Content") + bodyShape(["text"]) },
      { spTree: emptyShape() },
    ]);
    const outcome = await parseFile({ bytes, kind: "markdown" });
    expect(outcome.state).toBe("parsed");
    expect(outcome.sections).toHaveLength(1);
    expect(outcome.sections[0].id).toBe("slide-1");

    const emptyDeck = await parseFile({ bytes: await buildPptx([{ spTree: emptyShape() }]), kind: "markdown" });
    expect(emptyDeck.state).toBe("failed");
    expect(emptyDeck.reason).toBe("empty");
  });

  it("notes-slide text is appended to its slide's body, labeled", async () => {
    const bytes = await buildPptx([
      { spTree: titleShape("Speaker Notes") + bodyShape(["visible text"]), notes: ["Remember to recap."] },
    ]);
    const zh = await parseFile({ bytes, kind: "markdown" });
    expect(zh.sections[0].text).toContain("备注：Remember to recap.");
    const en = await parseFile({ bytes: await buildPptx([
      { spTree: titleShape("Speaker Notes") + bodyShape(["visible text"]), notes: ["Remember to recap."] },
    ]), kind: "markdown", language: "en" });
    expect(en.sections[0].text).toContain("Notes: Remember to recap.");
  });

  it("per-section text rides the same 2000-char cap as every other kind (AD-4)", async () => {
    const bytes = await buildPptx([{ spTree: titleShape("Big") + bodyShape(["x".repeat(5000)]) }]);
    const outcome = await parseFile({ bytes, kind: "markdown" });
    expect(outcome.state).toBe("parsed");
    expect(outcome.sections[0].text.length).toBe(2000);
  });

  it("a zip that is not a pptx fails honestly with the corrupt reason (never fake success)", async () => {
    const zip = new JSZip();
    zip.file("readme.txt", "just a plain zip");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const outcome = await parseFile({ bytes, kind: "markdown" });
    expect(outcome.state).toBe("failed");
    expect(outcome.reason).toBe("corrupt");
    expect(outcome.sections).toEqual([]);
  });

  it("markdown bytes are untouched — the zip sniff never diverts plain text to the pptx parser", async () => {
    const outcome = await parseFile({ bytes: bytesOf("# Heading\n\ntext"), kind: "markdown" });
    expect(outcome.state).toBe("parsed");
    expect(outcome.sections[0].id).toBe("heading");
  });

  it("parsePptx direct: the same sections the dispatch produces (slide title + runs contract)", async () => {
    const bytes = await buildPptx([{ spTree: titleShape("Direct") + bodyShape(["one", "two"]) }]);
    const sections = await parsePptx(bytes, "zh");
    expect(sections).toEqual([{ id: "slide-1", title: "Direct", text: expect.stringContaining("two") }]);
  });
});
