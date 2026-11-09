/**
 * Chat bubbles' light markdown renderer (epic-26 T1): react-markdown +
 * remark-gfm over the compact `.chat-prose` stylesheet — AI replies render
 * their markdown (bold, lists, tables, code) instead of showing raw syntax,
 * in every chat surface (companion both modes, creation chat, quiz prompts).
 *
 * Import-site rule (the AD-8 intent behind markdown-view's old "ONLY place"
 * header): this file and reader/markdown-view.tsx are the only two
 * react-markdown import sites, and both consumer graphs are lazy-route
 * chunks — react-markdown never rides the eager entry (bundle checked
 * against epic-19's tripwire). Keep it that way.
 *
 * No rehype-slug / no anchor machinery here — chat text has no heading
 * addresses; the reader's heavy pipeline stays reader-only.
 */
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="chat-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
