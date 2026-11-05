/**
 * PPT per-slide text extraction (epic-13 T5, owner Q6; AD-7): a `.pptx` is a
 * zip of slide XML, so the ONE new dependency is jszip — dynamically imported
 * HERE ONLY, at parse time (AD-8, the pdfjs rule: the ~100 KB zip machinery
 * never enters the main chunk; it loads only when a pptx is actually parsed).
 * The `<a:t>` runs are extracted by hand: per slide, the title comes from the
 * title placeholder's runs when present, else the slide's first text run, else
 * the honest bilingual 「第 N 页」/ "Page N" fallback; the body is every
 * `<a:p>` paragraph's runs (title included — the pdf parser's keep-the-title
 * precedent), notes-slide text appended labeled. Image-only slides (visual
 * content, zero runs) yield the fallback title plus the bilingual limitation
 * note — the spec's stated UI limitation — while truly-empty slides are
 * skipped. Slides ride their file numbering (`slide-N`, PowerPoint names
 * slide files in presentation order). Structural failures (not a zip, no
 * slide parts) throw the named InvalidPPTXException so parse()'s classifier
 * reports the honest corrupt reason.
 */
import type { MaterialSection } from "@/domain/entities";
import type { UiLanguage } from "@/ai/types";

/** Named structural-failure error — classifyParseFailure maps it to "corrupt". */
function invalidPptx(message: string): Error {
  const error = new Error(message);
  error.name = "InvalidPPTXException";
  return error;
}

const SLIDE_FILE = /^ppt\/slides\/slide(\d+)\.xml$/;
const TITLE_PLACEHOLDER = /<p:nvPr>[^<]*<p:ph[^>]*type="(?:ctrTitle|title)"/;
const SHAPE_BLOCK = /<p:sp>[\s\S]*?<\/p:sp>/g;
const PARAGRAPH_BLOCK = /<a:p>[\s\S]*?<\/a:p>/g;
const TEXT_RUN = /<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g;
/** Visual-content signals for a text-less slide: a picture shape or any blip fill. */
const VISUAL_SIGNAL = /<p:pic[\s>]|<a:blip[\s>]/;

const notesLabel = (language: UiLanguage): string => (language === "en" ? "Notes: " : "备注：");
const limitationText = (language: UiLanguage): string =>
  language === "en"
    ? "No text on this slide; image content won't appear in the extracted text."
    : "本页无文本内容；图片内容不会出现在提取结果中。";
const fallbackTitle = (n: number, language: UiLanguage): string =>
  language === "en" ? `Page ${n}` : `第 ${n} 页`;

/** All `<a:t>` run texts of one XML part, in document order. */
function runTexts(xml: string): string[] {
  const texts: string[] = [];
  for (const match of xml.matchAll(TEXT_RUN)) texts.push(match[1].trim());
  return texts.filter((text) => text.length > 0);
}

/** Paragraph-per-line body text: every `<a:p>`'s runs joined, paragraphs newline-joined. */
function bodyText(xml: string): string {
  const lines: string[] = [];
  for (const match of xml.matchAll(PARAGRAPH_BLOCK)) {
    const line = Array.from(match[0].matchAll(TEXT_RUN))
      .map((run) => run[1].trim())
      .filter((text) => text.length > 0)
      .join("");
    if (line.length > 0) lines.push(line);
  }
  return lines.join("\n");
}

/** The title placeholder shape's text; empty string when absent or run-less. */
function titlePlaceholderText(xml: string): string {
  for (const match of xml.matchAll(SHAPE_BLOCK)) {
    if (!TITLE_PLACEHOLDER.test(match[0])) continue;
    const title = runTexts(match[0]).join(" ").replace(/\s+/g, " ").trim();
    if (title.length > 0) return title;
  }
  return "";
}

/** Notes-slide text (plain body text); null when the deck has none for this slide. */
function notesText(notesXml: string | null): string | null {
  if (!notesXml) return null;
  const text = bodyText(notesXml);
  return text.length > 0 ? text : null;
}

export async function parsePptx(bytes: Uint8Array, language: UiLanguage): Promise<MaterialSection[]> {
  const JSZip = (await import("jszip")).default;
  let zip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw invalidPptx("not a zip archive");
  }

  // Slide parts in presentation order (PowerPoint numbers slide files in deck
  // order); a zip without any slide part is not a pptx.
  const slideFiles = (zip.file(new RegExp(SLIDE_FILE.source)) ?? [])
    .map((file) => ({ name: file.name, n: Number(SLIDE_FILE.exec(file.name)?.[1]) }))
    .sort((a, b) => a.n - b.n);
  if (slideFiles.length === 0) throw invalidPptx("no slide parts in archive");

  const sections: MaterialSection[] = [];
  for (const { name, n } of slideFiles) {
    const xml = await zip.file(name)!.async("string");
    const runs = runTexts(xml);
    if (runs.length === 0) {
      // Image-only slides keep an honest limitation section; a slide with no
      // text and no visual content is truly empty and skipped.
      if (!VISUAL_SIGNAL.test(xml)) continue;
      sections.push({
        id: `slide-${n}`,
        title: fallbackTitle(n, language),
        text: limitationText(language),
      });
      continue;
    }
    const title =
      titlePlaceholderText(xml) ||
      runs[0].replace(/\s+/g, " ").trim() ||
      fallbackTitle(n, language);
    let text = bodyText(xml);
    const notesEntry = zip.file(`ppt/notesSlides/notesSlide${n}.xml`);
    const notes = notesEntry ? notesText(await notesEntry.async("string")) : null;
    if (notes) text += `\n\n${notesLabel(language)}${notes}`;
    sections.push({ id: `slide-${n}`, title, text });
  }
  return sections; // an all-empty deck yields [] — parseFile reports the empty reason
}
