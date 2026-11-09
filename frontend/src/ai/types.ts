/**
 * AI seam types (AD-5): the structured response contract the UI renders —
 * intent, guardrail rung, citations. Features never guess the posture.
 */
import type { ReadingLocator, ReadingPosition } from "@/domain/entities";

export type UiLanguage = "zh" | "en";

export type CompanionIntent =
  | "explain" // scaffolded explanation, hint-first
  | "direct" // explicit answer request — escalation honored
  | "quiz-me" // Socratic; never reveals before an attempt (NFR-8)
  | "reference" // define/compare/list — low guardrail friction
  | "beyond-material"; // honest fallback (NFR-1)

/** Ladder position of THIS message: hint → worked-step → answer. */
export type GuardrailRung = "hint" | "worked-step" | "answer";

export interface Citation {
  locator: ReadingLocator;
  /** The exact supporting sentence, when one matched. */
  quote?: string;
}

export interface CompanionReply {
  intent: CompanionIntent;
  rung: GuardrailRung;
  text: string;
  citations: Citation[];
  /** Escalation control stays quietly present (EXPERIENCE.md ladder rule). */
  canEscalate: boolean;
  language: UiLanguage;
}

export interface GroundedChatRequest {
  question: string;
  position: ReadingPosition;
  language: UiLanguage;
  /**
   * Contract amendment (epic-3 spec, 2026-11-03 · FR-12/NFR-2): the
   * EscalationControl re-sends the SAME question + position with
   * `escalated: true`; an adapter honors it by returning the answer rung
   * directly — still grounded on the position and cited (the guardrail is a
   * ladder, never a wall). Backward-compatible: optional, omitted by callers
   * that predate the amendment.
   */
  escalated?: boolean;
  /**
   * Additive (epic P2-8 T5): the grounding material's uuid. The server
   * companion stream is material-scoped — the ticket carries it
   * (CreateStreamTicketInput.materialId, ownership-checked) — so the server
   * adapter refuses a chat without it. The simulated adapter ignores it.
   */
  materialId?: string;
  /**
   * Additive (epic-13 T1, FR-13): the selection grounding text — the
   * reader's selection bar asked WITH the selected text. It rides the ticket
   * (CreateStreamTicketInput.selection, question-bounded) and the server's
   * context assembly prepends a [selection] grounding block. The composer
   * also pre-fills with the quote (honest display), so the wire field and
   * the visible question say the same thing. Optional: omitted by turns the
   * bar did not ask (the frozen payload shape stays unchanged).
   */
  selection?: string;
  /**
   * Additive (epic P2-8 review fix, AD-16): the restart notice channel. A
   * dropped stream restarts on a fresh ticket and EVERY restart counts
   * against the daily AI cap, so the server adapter delivers the cap-counted
   * t() messageKey here — the call site toasts it; the stream continues.
   * The simulated adapter never fires it.
   */
  onNotice?: (messageKey: string) => void;
}

/**
 * The proposal stream's additive options (same pass-through pattern as the
 * chat request's onNotice): the server adapter passes T4's cap-counted
 * restart notices through; the simulated adapter ignores the whole object.
 */
/**
 * One attached material's client-extracted content riding the proposal
 * stream's ticket (epic-27) — the creation chat's tailoring input. Parsing
 * stays client-side (AD-7): there is no material row pre-create to presign
 * against, so the extracted text IS the grounding input. `kind`: pptx rides
 * "markdown" end-to-end (epic-13 T5).
 */
export interface ProposalMaterial {
  title: string;
  kind: "pdf" | "markdown";
  text: string;
}

export interface PlanProposalOptions {
  onNotice?: (messageKey: string) => void;
}

/**
 * Plan-level chat request (FR-46, epic P2-12 T3): grounded on the WHOLE plan
 * (no ReadingPosition). `mistakeEntryId` is the "analyze my mistakes"
 * grounding input — the entry's question + its source section ride the
 * server's plan grounding first, and the stream's citation event carries the
 * entry's own source locator. The onNotice channel is the same
 * cap-counted-restart pass-through as chat.
 */
export interface PlanChatRequest {
  planId: string;
  question: string;
  language: UiLanguage;
  mistakeEntryId?: string;
  onNotice?: (messageKey: string) => void;
}

/**
 * One proposed node with its roadmap metadata (epic-16, FR-5): edges address
 * nodes by title, so titles must be unique across the proposal — a repeated
 * title makes its edges unresolvable (dropped, never blocking).
 */
export interface ProposedNode {
  title: string;
  /** One-line description; absent/null on a metadata-less node. */
  description?: string | null;
  /** May be skipped without losing the thread (dashed-node vocabulary). */
  optional?: boolean;
}

/** Plan-structure proposal stage (creation chat): a named stage's nodes. */
export interface ProposedStage {
  name: string;
  nodes: ProposedNode[];
}

/**
 * Plan-structure proposal (creation chat; epic-16 wire shape): stage-grouped
 * nodes with their roadmap metadata + top-level title-paired prerequisite
 * edges [fromTitle, toTitle] — stage-forward on the server's authority;
 * unresolvable/invalid pairs drop silently, never blocking creation.
 */
export interface PlanStructureProposal {
  topic: string;
  stages: ProposedStage[];
  edges: [string, string][];
  language: UiLanguage;
}

// -- generation + grading (AD-5) -----------------------------------------------

/** The parsed-section content the simulated adapter templates from (reader's parse output as data). */
export interface MaterialRef {
  materialId: string;
  sections: Array<{ id: string; title: string; text: string }>;
}

export type QuizMode = "open" | "choice" | "mix";

/** Node-attributed question for the data layer's QuestionInput (AD-6). */
export interface GeneratedQuestion {
  prompt: string;
  nodeId: string;
  kind: "open" | "choice";
  options?: string[];
  correctOptionIndex?: number;
  sourceMaterialId: string;
  sourceSectionId: string;
  keywords?: string[];
  explanation: string;
}

export interface GradedAnswer {
  outcome: "correct" | "partial" | "wrong";
  rationale: string;
  citation: Citation | null;
}
