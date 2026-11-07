/**
 * Pure Markdown sectioner (FR-9): splits a document into MaterialSections whose
 * ids are the RENDERED anchors. The ids are computed by rehype-slug itself,
 * running the exact pipeline react-markdown runs (remark-parse → remark-rehype
 * → rehype-slug), so parse ids match the reader's rendered heading ids by
 * construction (T3's core invariant): every heading the renderer ids — ATX,
 * setext, headings inside blockquotes/lists, empty headings — is a section
 * boundary, slugged on its rendered text with github-slugger's -1/-2 dedupe
 * across the whole document. Sections are the source slices between
 * consecutive headings; text before the first heading keeps its own intro
 * section, slugged through a SEPARATE slugger (rehype-slug never sees it) and
 * given a `.` suffix if it would collide — no rendered slug can ever contain a
 * dot, because the slugger strips punctuation. The pipeline is dynamically
 * imported so the markdown machinery stays out of the main chunk (AD-8, same
 * rule as pdfjs) — hence async. Pure function: document text in, sections out
 * — no I/O, no DOM, no React.
 */
import GithubSlugger from "github-slugger";
import type { MaterialSection } from "@/domain/entities";
import type { UiLanguage } from "@/ai/types";

/** The render pipeline (memoized): exactly react-markdown's, minus React. */
let processorPromise: Promise<{
  parse(source: string): unknown;
  runSync(tree: unknown): unknown;
}> | null = null;

function loadProcessor() {
  processorPromise ??= (async () => {
    const [
      { unified },
      { default: remarkParse },
      { default: remarkRehype },
      { default: rehypeSlug },
      { default: remarkGfm },
    ] = await Promise.all([
      import("unified"),
      import("remark-parse"),
      import("remark-rehype"),
      import("rehype-slug"),
      import("remark-gfm"),
    ]);
    // remark-gfm (epic-24 T1) rides BOTH pipelines — the renderer's
    // (markdown-view) and this mirror's — so tables/strikethrough/task lists
    // parse identically on both sides and the anchor invariant holds (GFM
    // leaves heading parsing untouched).
    return unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeSlug);
  })();
  return processorPromise;
}

/** Fallback title for the text before the first heading (bilingual, NFR-5). */
function introTitle(language: UiLanguage): string {
  return language === "en" ? "Introduction" : "开头";
}

/** One rendered heading: its rehype-slug id and where its source begins. */
interface RenderedHeading {
  id: string;
  start: number;
  title: string;
}

/**
 * Minimal hast node shape for the tree walk — structural, so the sectioner
 * needs no hast type dependency; the pipeline hands back exactly these fields.
 */
interface HastNode {
  type?: string;
  tagName?: string;
  value?: unknown;
  properties?: Record<string, unknown>;
  position?: { start?: { offset?: number }; end?: { offset?: number } };
  children?: HastNode[];
}

/** hast text content — what the heading says once rendered (no syntax, no raw html). */
function hastText(node: HastNode): string {
  if (node.type === "text") return typeof node.value === "string" ? node.value : "";
  let out = "";
  for (const child of node.children ?? []) out += hastText(child);
  return out;
}

/** Heading elements (h1–h6) in document order, carrying rehype-slug's ids. */
function collectHeadings(node: HastNode, out: RenderedHeading[]): void {
  for (const child of node.children ?? []) {
    if (child.type !== "element") continue;
    const id = child.properties?.id;
    const start = child.position?.start?.offset;
    if (/^h[1-6]$/.test(child.tagName ?? "") && typeof id === "string" && typeof start === "number") {
      out.push({ id, start, title: hastText(child).replace(/\s+/g, " ").trim() });
    }
    collectHeadings(child, out);
  }
}

/** Whether a node the renderer actually draws (raw html is dropped by react-markdown's default). */
function rendersContent(node: HastNode): boolean {
  if (node.type === "text") return typeof node.value === "string" && node.value.trim().length > 0;
  return node.type !== "raw" && node.type !== "comment";
}

/**
 * Whether anything renders BEFORE the first heading (the intro region). The
 * source slice alone lies — `> # Quoted` yields a slice of bare `>` markers
 * with no rendered counterpart — so this walks the tree up to the heading.
 */
function hasContentBeforeHeading(node: HastNode, headingStart: number): boolean {
  for (const child of node.children ?? []) {
    const start = child.position?.start?.offset;
    if (typeof start !== "number") continue;
    if (start >= headingStart) return false; // reached the heading — nothing before it here
    const end = child.position?.end?.offset;
    if (typeof end === "number" && end > headingStart) {
      // the heading sits inside this container — only content ahead of it counts
      return hasContentBeforeHeading(child, headingStart);
    }
    if (rendersContent(child)) return true;
  }
  return false;
}

export async function sectionMarkdown(text: string, language: UiLanguage = "zh"): Promise<MaterialSection[]> {
  const processor = await loadProcessor();
  const tree = processor.runSync(processor.parse(text));
  const headings: RenderedHeading[] = [];
  collectHeadings(tree, headings);
  // Pre-order is already document order; the sort just makes that explicit
  // (no two headings share a source position).
  headings.sort((a, b) => a.start - b.start);

  // Sections are the source slices between consecutive rendered headings —
  // the same regions the reader shows between anchor targets.
  const sections: MaterialSection[] = headings.map((heading, i) => {
    const end = i + 1 < headings.length ? headings[i + 1].start : text.length;
    return { id: heading.id, title: heading.title, text: text.slice(heading.start, end).trim() };
  });

  // Text before the first heading keeps its own section (slugged through a
  // fresh slugger, so it never shifts a real heading's dedupe suffixes; if the
  // document itself has that heading, a `.` busts the collision — rehype-slug
  // output can never contain one). The region only counts when the renderer
  // actually draws something there — markers like `> ` before a quoted heading
  // are not content — and the heading line's own marker fragment is trimmed.
  const introRaw = headings.length > 0 ? text.slice(0, headings[0].start) : text;
  const introText = introRaw.replace(/\n[ \t>]*$/, "").trim();
  if (introText.length > 0 && (headings.length === 0 || hasContentBeforeHeading(tree, headings[0].start))) {
    const title = introTitle(language);
    let id = new GithubSlugger().slug(title);
    if (headings.some((h) => h.id === id)) id = `${id}.`;
    return [{ id, title, text: introText }, ...sections];
  }
  return sections;
}
