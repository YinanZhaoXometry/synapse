/**
 * Companion message shaping (T5) — the panel's pure half: citation-locator
 * label resolution and the persisted-thread → transcript-view mapping.
 * Extracted pure so the panel stays wiring only (spec testing decisions:
 * assert external behavior at public seams; prior art: reader's
 * position-tracking.ts).
 */
import type { CompanionReply } from "@/ai/types";
import type { ChatThread, Material, ReadingLocator, ReadingPosition } from "@/domain/entities";

/**
 * The Material.sections id a locator points at. The `page-N` scheme is the
 * domain contract on MaterialSection.id ("markdown slug or `page-N` for
 * PDF", entities.ts) — restated here rather than imported so the companion
 * feature stays inside its AD-2 boundary.
 */
export function companionSectionId(locator: ReadingLocator): string {
  return locator.kind === "pdf" ? `page-${Math.max(1, Math.floor(locator.page))}` : locator.sectionId;
}

/** What a CitationChip needs to render a locator: page number and/or section title. */
export interface CitationLabel {
  /** PDF page number; null for markdown locators. */
  page: number | null;
  /** Section title resolved from Material.sections; null when nothing matches. */
  title: string | null;
}

/**
 * Resolve a locator's display parts against the material (UX CitationChip:
 * 第 N 页 / section title). PDF locators resolve their page section's title —
 * the parse contract titles pages from the page's first heading-like line, so
 * 「第 7 页 · 12.2 集成策略」 reads as one place, per the mock. Unknown ids
 * resolve to null honestly — the chip still renders (the locator is real);
 * it just names what it knows.
 */
export function citationLabel(material: Material | null, locator: ReadingLocator): CitationLabel {
  const id = companionSectionId(locator);
  const title = material?.sections.find((section) => section.id === id)?.title ?? null;
  return { page: locator.kind === "pdf" ? locator.page : null, title };
}

/**
 * The short target a locator is named by outside the chip itself (grounded
 * badge, streaming line): the PDF page number (callers format it — this
 * module stays i18n-neutral), or the section title (the raw section id when
 * the title no longer resolves — honest, never invented).
 */
export function locatorDisplayTarget(
  material: Material | null,
  locator: ReadingLocator,
): { page: number | null; text: string } {
  const label = citationLabel(material, locator);
  if (label.page !== null) return { page: label.page, text: String(label.page) };
  return { page: null, text: label.title ?? companionSectionId(locator) };
}

/**
 * The bubble-rendering slice of a transcript row (shared by the reading-mode
 * CompanionEntry and the plan-mode PlanCompanionEntry — FR-46): text,
 * citation locators, and the structured reply when the turn is in-session.
 */
export interface BubbleEntry {
  id: string;
  text: string;
  citations: ReadingLocator[];
  reply: CompanionReply | null;
}

/**
 * One transcript row. `reply` carries the structured contract ONLY for
 * in-session turns (rung labels, escalation control) — restored messages
 * persisted before this render as plain cited bubbles (the ChatThread schema
 * stores text + locators, not the reply contract). `request` is runtime-only
 * (never persisted): the original question + send-time position (+ the
 * selection grounding text when the selection bar asked — epic-13 T1), kept
 * so the EscalationControl re-sends the SAME grounding and a failed turn can
 * retry.
 */
export interface CompanionEntry extends BubbleEntry {
  role: "user" | "companion";
  request: { question: string; position: ReadingPosition; escalated?: boolean; selection?: string } | null;
  failed: boolean;
}

/** Shape a persisted thread into transcript rows (restore path, AD-3/4). */
export function entriesFromThread(thread: ChatThread | undefined): CompanionEntry[] {
  if (!thread) return [];
  return thread.messages.map((message) => ({
    id: message.id,
    role: message.role,
    text: message.text,
    citations: message.citations,
    reply: null,
    request: null,
    failed: false,
  }));
}

/** Locators stored on a ChatMessage — the citations' locators, in reply order. */
export function replyCitationLocators(reply: CompanionReply): ReadingLocator[] {
  return reply.citations.map((citation) => citation.locator);
}
