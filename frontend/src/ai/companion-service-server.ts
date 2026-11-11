/**
 * The CompanionService server adapter (epic P2-8 T5, FR-33): the seam's
 * RUNTIME implementation. chat + plan-proposal ride the T4 SSE wrapper — one
 * minted single-use ticket per generation, drop → fresh-ticket restart,
 * restarts counted against the daily AI cap (AD-16). Quiz generation,
 * flashcard generation, and open-answer grading ride the ai.graphql mutations
 * over the Apollo seam; the generation happens SERVER-SIDE (the wire carries
 * no sections — the plan/task scope and the questionId are the only inputs
 * that cross, and the server owns keywords/citations/structure).
 *
 * Errors surface as AppErrors carrying the closed-enum code 1:1 (AD-12/16)
 * with a t() messageKey — never a server string. The streams map lives in
 * sse-client.ts (T4); the mutation path maps through AI_MUTATION_KEYS below —
 * the same enum, generation-flavored copy. Out-of-contract codes keep their
 * raw code on the generic failure key (honest fallback, not absorption).
 *
 * Not a React module: language rides the REQUEST for streams (chat / proposal
 * / grading carry it on the seam), and the generation mutations read the UI
 * language through currentUiLanguage() (the provider-owned mirror — the
 * adapter cannot mount hooks). Both Apollo seams are injectable so the tests
 * run offline (stub client + fake EventSource).
 */
import { getApolloClient } from "@/apollo/client";
import { apiErrorCode, apiErrorKeys } from "@/api/errors";
import { readingLocator } from "@/api/mappers";
import type { ErrorLike } from "@apollo/client";
import { AppError } from "@/lib/app-error";
import { newClientUuid } from "@/lib/uuid";
import { currentUiLanguage } from "@/contexts/LanguageContext";
import {
  GenerateQuizDocument,
  GenerateFlashcardsDocument,
  GradeOpenAnswerDocument,
} from "@/types/graphql";
import type {
  GenerateFlashcardsMutation,
  GenerateQuizMutation,
  GradeOpenAnswerMutation,
  QuestionPartsFragment,
} from "@/types/graphql";
import type { ApolloClient } from "@apollo/client";
import type { ReadingLocator } from "@/domain/entities";
import { startStream } from "./sse-client";
import type { StreamDeps, StreamRung, StreamSession, StreamTerminal } from "./sse-client";
import { sanitizeCompanionReplyText } from "./reply-sanitize";
import type { CompanionService } from "./companion-service";
import type {
  Citation,
  CompanionReply,
  GeneratedQuestion,
  GradedAnswer,
  GroundedChatRequest,
  MaterialRef,
  PlanChatRequest,
  PlanProposalOptions,
  PlanStructureProposal,
  QuizMode,
  UiLanguage,
  ProposalMaterial,
} from "./types";

// -- the mutation-path error map (AD-9) -------------------------------------------

/**
 * Terminal code → t() key for the THREE generation mutations — the FULL
 * closed enum, derived from the ONE base suffix map (src/api/errors.ts) so
 * the streams' sibling (STREAM_TERMINAL_KEYS) can never drift — only the
 * namespace differs, generation-flavored copy. A code-less failure
 * (network/parse) and any out-of-contract code land on the generic failure
 * key.
 */
export const AI_MUTATION_KEYS: Record<string, string> = apiErrorKeys("ai.generate.");

const AI_MUTATION_FAILED_KEY = "ai.generate.failed";
/** A cancelled stream (resetApiClient on logout — never a UI action) ends
 * without a terminal; the rejection reuses the stream's honest failure key. */
const STREAM_CANCELLED_KEY = "ai.stream.failed";

// -- injectable seams -------------------------------------------------------------

export interface ServerCompanionServiceOptions {
  /** Explicit Apollo seam override (offline tests); default is the app
   * singleton — the ONE seam every login/logout funnels through. */
  client?: ApolloClient;
  /** T4 stream deps override (tests inject the recorded mint + fake
   * EventSource); default is the real ticket mint + browser EventSource. */
  deps?: StreamDeps;
}

// -- wire → seam mappers (the mapper convention: honest union member or throw loud) --

function toGeneratedQuestion(question: QuestionPartsFragment): GeneratedQuestion {
  if (question.kind !== "open" && question.kind !== "choice") {
    throw new Error(`unknown question kind from the api: ${question.kind}`);
  }
  return {
    prompt: question.prompt,
    nodeId: question.nodeId,
    kind: question.kind,
    options: question.options ?? undefined,
    correctOptionIndex: question.correctOptionIndex ?? undefined,
    sourceMaterialId: question.sourceMaterialId,
    sourceSectionId: question.sourceSectionId,
    keywords: question.keywords ?? undefined,
    explanation: question.explanation,
  };
}

function toGradedAnswer(graded: NonNullable<GradeOpenAnswerMutation["gradeOpenAnswer"]>["gradedAnswer"]): GradedAnswer {
  const outcome = graded.outcome;
  if (outcome !== "correct" && outcome !== "partial" && outcome !== "wrong") {
    throw new Error(`unknown grade outcome from the api: ${outcome}`);
  }
  const citation = graded.citation;
  const mapped: Citation | null = citation
    ? { locator: readingLocator(citation.locator), quote: citation.quote ?? undefined }
    : null;
  return { outcome, rationale: graded.rationale, citation: mapped };
}

// -- the adapter ------------------------------------------------------------------

/** The stream terminal's honest split: "OK" is the success branch, every
 * other code carries its mapped AppError. (The union's failure member types
 * `code` as `string`, which defeats naive narrowing — this guard is the
 * one-place decision.) */
function streamFailure(terminal: StreamTerminal): terminal is StreamTerminal & { error: AppError } {
  return terminal.code !== "OK";
}

export class ServerCompanionService implements CompanionService {
  private readonly client: ApolloClient;
  private readonly deps: StreamDeps | undefined;

  constructor(options: ServerCompanionServiceOptions = {}) {
    this.client = options.client ?? getApolloClient();
    this.deps = options.deps;
  }

  /** One shared mutation path: GraphQL failures map through the closed enum
   * onto AppErrors carrying their t() keys; a code-less failure (network /
   * parse / missing payload) is the generic generation failure. */
  private async runMutation(
    // The three ai.graphql documents share this one call path; their generated
    // generics differ per op, so the seam stays deliberately loose here and is
    // checked on read (toGeneratedQuestion / toGradedAnswer).
    mutation: unknown,
    variables: Record<string, unknown>,
    root: string,
  ): Promise<Record<string, unknown>> {
    try {
      const result = await this.client.mutate({ mutation: mutation as never, variables });
      const code = apiErrorCode(result.error);
      if (code) throw new AppError(code, AI_MUTATION_KEYS[code] ?? AI_MUTATION_FAILED_KEY);
      const payload = (result.data as Record<string, unknown> | null | undefined)?.[root];
      if (!payload || typeof payload !== "object") {
        throw new AppError("INTERNAL", AI_MUTATION_FAILED_KEY);
      }
      return payload as Record<string, unknown>;
    } catch (error) {
      if (error instanceof AppError) throw error;
      const code = apiErrorCode(error as ErrorLike);
      if (code) throw new AppError(code, AI_MUTATION_KEYS[code] ?? AI_MUTATION_FAILED_KEY);
      throw new AppError("INTERNAL", AI_MUTATION_FAILED_KEY);
    }
  }

  /** Resolve a stream session to its terminal; cancellation (resetApiClient
   * mid-stream) resolves done with null — reject so no reply is built from
   * nothing (the driver's failure path is already unmount-safe). */
  private async settleStream(session: StreamSession): Promise<StreamTerminal> {
    const terminal = await session.done;
    if (!terminal) throw new AppError("INTERNAL", STREAM_CANCELLED_KEY);
    return terminal;
  }

  async chat(
    request: GroundedChatRequest,
    onToken?: (chunk: string) => void,
  ): Promise<CompanionReply> {
    // The companion stream is material-scoped — the ticket carries the id
    // (CreateStreamTicketInput.materialId, ownership-checked). No id → no
    // honest target, no mint (the wire would refuse VALIDATION_FAILED anyway).
    if (!request.materialId) {
      throw new AppError("VALIDATION_FAILED", AI_MUTATION_KEYS.VALIDATION_FAILED);
    }

    let rung: StreamRung | null = null;
    let text = "";
    const citations: Citation[] = [];

    const session = startStream(
      {
        op: "companion",
        materialId: request.materialId,
        question: request.question,
        position: request.position,
        escalated: request.escalated === true,
        // epic-13 T1 (FR-13): the selection grounding text — the ticket
        // carries it inside; the server's assembly prepends the [selection]
        // block. Absent for bar-less turns (the payload shape stays frozen).
        selection: request.selection,
        language: request.language,
      },
      {
        onRung: (seen) => {
          rung = seen;
        },
        onToken: (chunk) => {
          text += chunk;
          onToken?.(chunk);
        },
        onCitation: (citation) => citations.push(citation),
        // The cap-counted restart notice crosses the seam (AD-16: never
        // silent) — the call site toasts the t() key; the stream continues.
        onRestart: (notice) => request.onNotice?.(notice.messageKey),
      },
      this.deps,
    );

    const terminal = await this.settleStream(session);
    if (streamFailure(terminal)) throw terminal.error;
    // Contract guard: a rung opens every stream; one that ends without it
    // renders the neutral low-friction posture instead of a guessed intent.
    const posture: StreamRung = rung ?? {
      intent: "reference",
      rung: "answer",
      canEscalate: false,
      language: request.language,
    };
    return {
      intent: posture.intent,
      rung: posture.rung,
      // Unwrap backstop (2026-11-06): the prompts forbid JSON replies, and a
      // {"hint": …} answer must never render as the tutor's message.
      text: sanitizeCompanionReplyText(text),
      citations,
      canEscalate: posture.canEscalate,
      language: posture.language,
    };
  }

  /**
   * Plan-level chat (FR-46, epic P2-12 T3): the third stream op rides the
   * same SSE wrapper — one minted single-use ticket per generation, the
   * grounding inputs INSIDE the ticket (planId + the optional
   * mistakeEntryId + the optional AI 讲解 nodeId, epic-34 T2), drop →
   * fresh-ticket restart, restarts counted against the daily AI cap. The
   * reply contract is chat's verbatim; the plan stream's rung is always
   * hint-first with canEscalate false (the payload has no escalation flag),
   * and the citation list carries the mistake's own source locator when a
   * mistakeEntryId rode (empty otherwise).
   */
  async planChat(
    request: PlanChatRequest,
    onToken?: (chunk: string) => void,
  ): Promise<CompanionReply> {
    let rung: StreamRung | null = null;
    let text = "";
    const citations: Citation[] = [];

    const session = startStream(
      {
        op: "plan_companion",
        planId: request.planId,
        question: request.question,
        mistakeEntryId: request.mistakeEntryId,
        nodeId: request.nodeId,
        language: request.language,
      },
      {
        onRung: (seen) => {
          rung = seen;
        },
        onToken: (chunk) => {
          text += chunk;
          onToken?.(chunk);
        },
        onCitation: (citation) => citations.push(citation),
        onRestart: (notice) => request.onNotice?.(notice.messageKey),
      },
      this.deps,
    );

    const terminal = await this.settleStream(session);
    if (streamFailure(terminal)) throw terminal.error;
    const posture: StreamRung = rung ?? {
      intent: "explain",
      rung: "hint",
      canEscalate: false,
      language: request.language,
    };
    return {
      intent: posture.intent,
      rung: posture.rung,
      // Same unwrap backstop — the tutor page rides this op (2026-11-06).
      text: sanitizeCompanionReplyText(text),
      citations,
      canEscalate: posture.canEscalate,
      language: posture.language,
    };
  }

  async generatePlanStructure(
    message: string,
    materials: ProposalMaterial[],
    language: UiLanguage,
    onToken?: (chunk: string) => void,
    options?: PlanProposalOptions,
  ): Promise<PlanStructureProposal> {
    const session = startStream(
      // The message + the attached materials' client-extracted text are the
      // generation inputs (epic-27): they ride INSIDE the ticket; the server
      // strips the tags from the streamed text itself.
      { op: "proposal", message, materials, language },
      {
        onToken: (chunk) => onToken?.(chunk),
        // Same seam channel as chat: the cap-counted restart notice (AD-16).
        onRestart: (notice) => options?.onNotice?.(notice.messageKey),
      },
      this.deps,
    );

    const terminal = await this.settleStream(session);
    if (streamFailure(terminal)) throw terminal.error;
    if (!terminal.proposal) {
      // OK without a payload is a provider-contract violation, not a user
      // mistake — the honest generic failure (mirrors the api's INTERNAL).
      throw new AppError("INTERNAL", AI_MUTATION_FAILED_KEY);
    }
    return terminal.proposal;
  }

  async generateQuiz(input: {
    materials: MaterialRef[];
    nodeIds: string[];
    mode: QuizMode;
    planId?: string | null;
    taskId?: string | null;
    targeting?: { nodeId: string } | null;
    materialId?: string | null;
    sectionIds?: string[] | null;
    targetCount?: number | null;
  }): Promise<GeneratedQuestion[]> {
    // Server-side generation (FR-33): the scope's context is assembled on the
    // api — materials/nodeIds stay the simulated double's local inputs and
    // never cross. The client-supplied uuid is the replay key (delta 3: a
    // same-user replay returns the session without a provider call).
    // targeting is T5's node Quick Test scope (epic P2-10 T5, FR-21) — the
    // xor scope on the wire: a targeting node rides INSTEAD of planId/taskId.
    // materialId is T2's material Quick Test scope (epic-13, FR-14) — the
    // FOURTH xor member: it rides INSTEAD of plan/task/targeting, with its
    // two narrowing inputs (sectionIds 1–5, targetCount 3–5); the gate
    // (≥1 confirmed node mapping) is server-side, a refusal surfaces as
    // VALIDATION_FAILED through the shared mutation path.
    const payload = await this.runMutation(
      GenerateQuizDocument,
      {
        input: {
          clientUuid: newClientUuid(),
          language: currentUiLanguage(),
          mode: input.mode,
          planId: input.targeting || input.materialId ? undefined : (input.planId ?? undefined),
          taskId: input.targeting || input.materialId ? undefined : (input.taskId ?? undefined),
          targeting: input.targeting && !input.materialId ? input.targeting : undefined,
          // T2 (FR-14): the material scope — absent fields stay undefined so
          // the wire shape is unchanged for every pre-T2 caller.
          materialId: input.materialId ?? undefined,
          sectionIds: input.sectionIds?.length ? input.sectionIds : undefined,
          targetCount: input.targetCount ?? undefined,
        },
      },
      "generateQuiz",
    );
    const generated = payload as unknown as NonNullable<GenerateQuizMutation["generateQuiz"]>;
    return (generated.questions ?? []).map(toGeneratedQuestion);
  }

  async generateFlashcards(input: {
    materials: MaterialRef[];
  }): Promise<Array<{ front: string; back: string }>> {
    const cards: Array<{ front: string; back: string }> = [];
    // The server generates one material per call (GenerateFlashcardsInput);
    // sequential walks keep the seam's material-order contract deterministic
    // for the driver's section-count slicing.
    for (const ref of input.materials) {
      const payload = await this.runMutation(
        GenerateFlashcardsDocument,
        { input: { materialId: ref.materialId, language: currentUiLanguage() } },
        "generateFlashcards",
      );
      const generated = payload as unknown as NonNullable<GenerateFlashcardsMutation["generateFlashcards"]>;
      for (const card of generated.cards ?? []) {
        cards.push({ front: card.front, back: card.back });
      }
    }
    return cards;
  }

  async gradeOpenAnswer(input: {
    keywords: string[];
    answer: string;
    sourceText: string;
    source: ReadingLocator;
    language: UiLanguage;
    questionId?: string;
  }): Promise<GradedAnswer> {
    // Grading is server-side BY QUESTION ID (FR-33): the api owns the
    // keywords and the cited source section, so grading inputs never ride the
    // wire and there is no local fallback (AD-14: no client recompute).
    if (!input.questionId) {
      throw new AppError("VALIDATION_FAILED", AI_MUTATION_KEYS.VALIDATION_FAILED);
    }
    const payload = await this.runMutation(
      GradeOpenAnswerDocument,
      { input: { questionId: input.questionId, answer: input.answer, language: input.language } },
      "gradeOpenAnswer",
    );
    const graded = (payload as unknown as GradeOpenAnswerMutation["gradeOpenAnswer"])?.gradedAnswer;
    if (!graded) throw new AppError("INTERNAL", AI_MUTATION_FAILED_KEY);
    return toGradedAnswer(graded);
  }
}
