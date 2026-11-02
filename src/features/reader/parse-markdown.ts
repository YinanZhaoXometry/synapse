/**
 * Pure Markdown sectioner (FR-9 groundwork): splits a document on ATX headings
 * into MaterialSections whose ids are github-slugger slugs — the same library
 * rehype-slug uses, so parse ids match the reader's rendered anchors (T3).
 * Lines inside fenced code (``` / ~~~) are never read as headings; duplicate
 * headings dedupe (`-1`, `-2`) and CJK headings slug stably. Pure function:
 * document text in, sections out — no I/O, no pdfjs, no DOM.
 */
import GithubSlugger from "github-slugger";
import type { MaterialSection } from "@/domain/entities";
import type { UiLanguage } from "@/ai/types";

/** Fallback title for the text before the first heading (bilingual, NFR-5). */
function introTitle(language: UiLanguage): string {
  return language === "en" ? "Introduction" : "开头";
}

/**
 * The ATX heading's text content, or null when the line is not a heading.
 * Up to 3 leading spaces, 1–6 `#`s, then a space and content (a bare `#` run
 * with no content renders an empty heading — not a section boundary here).
 * A trailing closing sequence (` ##`) is stripped per CommonMark.
 */
function atxHeadingContent(line: string): string | null {
  const match = /^ {0,3}#{1,6}[ \t]+(.+?)[ \t]*$/.exec(line);
  if (!match) return null;
  const content = match[1].replace(/[ \t]+#+[ \t]*$/, "").trim();
  return content.length > 0 ? content : null;
}

export function sectionMarkdown(text: string, language: UiLanguage = "zh"): MaterialSection[] {
  const slugger = new GithubSlugger();
  const sections: Array<{ id: string; title: string; lines: string[] }> = [];
  const introLines: string[] = [];
  let current: { id: string; title: string; lines: string[] } | null = null;
  /** Open fence: the marker char and its length; a close needs the same char, at least as long. */
  let fence: { char: string; len: number } | null = null;

  for (const line of text.split(/\r\n|\r|\n/)) {
    if (fence) {
      // fence content (and its closing line) is ordinary text, never a heading
      if (current) current.lines.push(line);
      else introLines.push(line);
      const close = new RegExp(`^ {0,3}\\${fence.char}{${fence.len},}[ \\t]*$`);
      if (close.test(line)) fence = null;
      continue;
    }
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (open) {
      fence = { char: open[1][0], len: open[1].length };
      if (current) current.lines.push(line);
      else introLines.push(line);
      continue;
    }
    const heading = atxHeadingContent(line);
    if (heading !== null) {
      current = { id: slugger.slug(heading), title: heading, lines: [line] };
      sections.push(current);
      continue;
    }
    if (current) current.lines.push(line);
    else introLines.push(line);
  }

  const result = sections.map((s) => ({
    id: s.id,
    title: s.title,
    text: s.lines.join("\n").trim(),
  }));

  // Text before the first heading keeps its own section (slugged through the
  // same slugger, so a later real "Introduction" heading cannot collide).
  const introText = introLines.join("\n").trim();
  if (introText.length > 0) {
    const title = introTitle(language);
    return [{ id: slugger.slug(title), title, text: introText }, ...result];
  }
  return result;
}
