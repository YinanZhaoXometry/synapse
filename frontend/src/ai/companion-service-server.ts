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
import { apiErrorCode } from "@/api/errors";
import { readingLocator } from "@/api/mappers";
import type { ErrorLike } from "@apollo/client";
import { AppError } from "@/lib/app-error";
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
import type { CompanionService } from "./companion-service";
import type {
  Citation,
  CompanionReply,
  GeneratedQuestion,
  GradedAnswer,
  GroundedChatRequest,
  MaterialRef,
  PlanStructureProposal,
  QuizMode,
  UiLanguage,
} from "./types";

// -- the mutation-path error map (AD-9) -------------------------------------------

/**
 * Terminal code → t() key for the THREE generation mutations — the FULL
 * closed enum (the streams' sibling map is STREAM_TERMINAL_KEYS). A code-less
 * failure (network/parse) and any out-of-contract code land on the generic
 * failure key.
 */
export const AI_MUTATION_KEYS: Record<string, string> = {
  UNAUTHORIZED: "ai.generate.errorUnauthorized",
  FORBIDDEN: "ai.generate.errorForbidden",
  NOT_FOUND: "ai.generate.errorNotFound",
  VALIDATION_FAILED: "ai.generate.errorValidation",
  RATE_LIMITED: "ai.generate.errorRateLimited",
  CAP_REACHED: "ai.generate.capReached",
  INTERNAL: "ai.generate.errorInternal",
};

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
      text,
      citations,
      canEscalate: posture.canEscalate,
      language: posture.language,
    };
  }

  async generatePlanStructure(
    topic: string,
    language: UiLanguage,
    onToken?: (chunk: string) => void,
    goal?: string | null,
  ): Promise<PlanStructureProposal> {
    const session = startStream(
      // The goal is a generation input (A3/FR-1): it rides INSIDE the ticket;
      // the server strips the tags from the streamed text itself.
      { op: "proposal", topic, goal: goal ?? undefined, language },
      {
        onToken: (chunk) => onToken?.(chunk),
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
  }): Promise<GeneratedQuestion[]> {
    // Server-side generation (FR-33): the scope's context is assembled on the
    // api — materials/nodeIds stay the simulated double's local inputs and
    // never cross. The client-supplied uuid is the replay key (delta 3: a
    // same-user replay returns the session without a provider call).
    const payload = await this.runMutation(
      GenerateQuizDocument,
      {
        input: {
          clientUuid: crypto.randomUUID(),
          language: currentUiLanguage(),
          mode: input.mode,
          planId: input.planId ?? undefined, // xor scope — the absent side is not sent
          taskId: input.taskId ?? undefined,
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
