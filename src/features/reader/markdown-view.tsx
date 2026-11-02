/**
 * The Markdown render (FR-9): react-markdown + rehype-slug — the exact
 * packages the sectioner (parse-markdown.ts) mirrors, so the rendered heading
 * ids ARE the section anchors. This module is the ONLY place react-markdown is
 * imported, and MarkdownFlow lazy-loads it, keeping the markdown pipeline in a
 * reader-only chunk (AD-8, same rule as pdfjs). Headings carry a scroll margin
 * so deep links land with breathing room, and the flashing one (?hl=1, AD-8)
 * washes once in the citation tint under an overlay — the same mechanism the
 * PDF pages use. Prose typography is the reader-body role plus the
 * .reader-prose rules in index.css (semantic tokens only).
 */
import { useEffect, useRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSlug from "rehype-slug";

interface MarkdownViewProps {
  /** The FULL document text, decoded from the session bytes (AD-4). */
  text: string;
  /** The section id currently flashing — its heading washes once; null = none. */
  flashSection: string | null;
  /** The rendered heading ids, in document order, once they exist in the DOM. */
  onHeadingsResolved?(ids: string[]): void;
}

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

type HeadingProps = JSX.IntrinsicElements["h1"] & { node?: unknown };

function headingComponent(Tag: HeadingTag, flashSection: string | null) {
  return function Heading({ node: _node, children, ...rest }: HeadingProps) {
    const flashing = typeof rest.id === "string" && rest.id === flashSection;
    return (
      <Tag {...rest} className="relative scroll-mt-8">
        {children}
        {flashing && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-3 -inset-y-1 bg-[hsl(var(--citation-tint))] animate-reader-flash"
          />
        )}
      </Tag>
    );
  };
}

export default function MarkdownView({ text, flashSection, onHeadingsResolved }: MarkdownViewProps) {
  const docRef = useRef<HTMLDivElement>(null);

  // Report the rendered anchors straight from the DOM — the most authoritative
  // statement of which section ids exist (and in what order). Fires per text
  // change; MarkdownFlow gates its one-shot anchor landing on the first call.
  useEffect(() => {
    const headings = docRef.current?.querySelectorAll("h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]");
    if (!headings) return;
    onHeadingsResolved?.(Array.from(headings, (el) => el.getAttribute("id") ?? ""));
  }, [text, onHeadingsResolved]);

  const components: Components = {
    h1: headingComponent("h1", flashSection),
    h2: headingComponent("h2", flashSection),
    h3: headingComponent("h3", flashSection),
    h4: headingComponent("h4", flashSection),
    h5: headingComponent("h5", flashSection),
    h6: headingComponent("h6", flashSection),
  };

  return (
    <div ref={docRef} className="reader-prose">
      <ReactMarkdown rehypePlugins={[rehypeSlug]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
