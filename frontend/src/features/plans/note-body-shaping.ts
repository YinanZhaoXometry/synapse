/**
 * Note body shaping (FR-40, epic P2-12 T1) — the section's pure half,
 * extracted so the component stays wiring only (prior art: companion's
 * message-shaping.ts). The body is markdown WITH inline enrichment markers
 * (delta decision 1's markers-only v1: `[[enrich|kind|suggestion]]` lines the
 * model placed — plus the user-requested `user` kind from the enrichAt
 * input). Splitting the body into text segments and marker tokens lets the
 * view render markdown blocks and placeholder cards in document order, and
 * export the body verbatim.
 */
import type { NoteView } from "@/api/views";

/** The marker contract (Ai::Prompts::NOTE_MARKER_KINDS on the api side + the user kind). */
export const NOTE_MARKER_PATTERN = /\[\[enrich\|([^|\]]+)\|([^\]]+)\]\]/;

/** Kinds the view renders with a dedicated label + icon; unknown kinds fall back honestly. */
export const NOTE_MARKER_KINDS = [ "diagram", "chart", "image", "user" ] as const;
export type NoteMarkerKind = (typeof NOTE_MARKER_KINDS)[number];

export interface NoteTextToken {
  kind: "text";
  text: string;
}

export interface NoteMarkerToken {
  kind: "marker";
  markerKind: string;
  suggestion: string;
}

export type NoteToken = NoteTextToken | NoteMarkerToken;

/**
 * Split a note body into its markdown text segments and enrichment marker
 * tokens, in document order. Text is never dropped: between-marker prose
 * rides text tokens verbatim (leading/trailing empty segments are dropped —
 * nothing renders for them).
 */
export function splitNoteBody(body: string): NoteToken[] {
  const tokens: NoteToken[] = [];
  let rest = body;
  for (;;) {
    const match = NOTE_MARKER_PATTERN.exec(rest);
    if (!match) break;
    if (match.index > 0) {
      const text = rest.slice(0, match.index);
      if (text.trim().length > 0) tokens.push({ kind: "text", text });
    }
    tokens.push({ kind: "marker", markerKind: match[1].trim(), suggestion: match[2].trim() });
    rest = rest.slice(match.index + match[0].length);
  }
  if (rest.trim().length > 0) tokens.push({ kind: "text", text: rest });
  return tokens;
}

/** The marker kind's label key suffix ("diagram" | "chart" | "image" | "user"), null for unknown kinds. */
export function markerKindKey(markerKind: string): NoteMarkerKind | null {
  return (NOTE_MARKER_KINDS as readonly string[]).includes(markerKind) ? (markerKind as NoteMarkerKind) : null;
}

/** The export payload: the body VERBATIM — enrichment markers preserved (FR-40). */
export function noteExportMarkdown(note: NoteView): string {
  return note.body;
}

/** The download filename: `<title>.md`, path-hostile characters flattened. */
export function noteExportFilename(note: NoteView): string {
  return `${note.title.replace(/[\\/:*?"<>|\n\r]+/g, "-").trim()}.md`;
}

/**
 * The .md download over a Blob URL (FR-40's export — no new file pipeline).
 * The anchor click happens synchronously so tests can pin it through
 * HTMLAnchorElement (jsdom keeps the navigation a no-op).
 */
export function downloadNoteMarkdown(note: NoteView): void {
  const blob = new Blob([ noteExportMarkdown(note) ], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = noteExportFilename(note);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * One weak-spot targeting provenance row (FR-22, epic P2-12 T2): what the
 * server's allocation table says the note aimed at — the node, its Mastery
 * percent at generation time, its mistake count, and the coverage share the
 * targeting layer allotted it.
 */
export interface NoteTargetingRowView {
  nodeId: string;
  title: string;
  score: string;
  mistakes: number;
  share: number;
}

/**
 * Read the note's targeting jsonb (the server's allocation table) as
 * provenance rows. Server data ONLY: anything that is not an array of
 * rows carrying a nodeId address, a title label, and a numeric share
 * reads as honest [] — an untargeted note (targeting: []) and malformed
 * shapes render no strip, never a guessed one.
 */
export function noteTargetingRows(targeting: unknown): NoteTargetingRowView[] {
  if (!Array.isArray(targeting)) return [];
  return targeting.filter(isTargetingRow).map((row) => ({
    nodeId: row.nodeId,
    title: row.title,
    score: typeof row.score === "string" || typeof row.score === "number" ? String(row.score) : "",
    mistakes: typeof row.mistakes === "number" && Number.isFinite(row.mistakes) ? row.mistakes : 0,
    share: row.share,
  }));
}

function isTargetingRow(row: unknown): row is { nodeId: string; title: string; score: unknown; mistakes: unknown; share: number } {
  if (typeof row !== "object" || row === null) return false;
  const candidate = row as Record<string, unknown>;
  return (
    typeof candidate.nodeId === "string" && candidate.nodeId.length > 0 &&
    typeof candidate.title === "string" && candidate.title.length > 0 &&
    typeof candidate.share === "number" && Number.isFinite(candidate.share)
  );
}
