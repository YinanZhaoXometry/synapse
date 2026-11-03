/**
 * Quiz display shaping (epic-6 T2; AD-6, ADR-0001): results/session →
 * presentation inputs. Thin composition over the shipped domain functions and
 * the machine's revealed outputs — no mastery arithmetic lives here. Node
 * numbers come ONLY from `computeNodeScore` / `getNodeState` (window 5, cap-99
 * below the 3-record gate, mastered = ≥ 80 & ≥ 3), so the results screen shows
 * the exact numbers the system keeps (plans/tasks display-shaping precedent).
 */
import type { EvidenceRecord, KnowledgeNode, Material, NodeState, Outcome } from "@/domain/entities";
import { computeNodeScore, getNodeState, MASTERY_CONFIG } from "@/domain/mastery";
import type { MaterialRef } from "@/ai/types";
import type { MaskedQuestionView, QuizAnswerResult } from "./session-machine";

// -- session score -----------------------------------------------------------------

/** The results header's score inputs: outcome counts + the round percentage. */
export interface QuizScoreSummary {
  correct: number;
  partial: number;
  wrong: number;
  total: number;
  /** round((100 × Σ outcomeValue) / total) — outcomeValues are the domain's (ADR-0001). */
  percent: number;
}

/** Count + percentage shaping over the machine's completed-run results. */
export function quizScoreSummary(results: QuizAnswerResult[]): QuizScoreSummary {
  const counts = { correct: 0, partial: 0, wrong: 0 };
  let value = 0;
  for (const r of results) {
    counts[r.outcome] += 1;
    value += r.outcomeValue;
  }
  const total = results.length;
  return { ...counts, total, percent: total === 0 ? 0 : Math.round((100 * value) / total) };
}

// -- node movement -------------------------------------------------------------------

/**
 * One affected node's mastery move (FR-3 moment): the score before this
 * session's evidence (records from other sessions) vs the number the system
 * keeps now — both through `computeNodeScore`, so window-5 / cap-99-below-gate
 * are the domain's exact behavior, never re-derived for display.
 */
export interface QuizNodeRow {
  nodeId: string;
  /** The plan node (undefined → the id renders; attribution is generation-time, AD-6). */
  node: KnowledgeNode | undefined;
  title: string;
  /** Score over evidence EXCLUDING this session (the 「before」 number). */
  before: number;
  /** Current score — the number the system keeps (ADR-0001 semantics). */
  after: number;
  state: NodeState;
  hasEvidence: boolean;
  /** True when real evidence exists but sits under the anti-inflation gate (cap 99). */
  belowGate: boolean;
  /** The score window's outcome marks, oldest → newest. */
  lastOutcomes: Outcome[];
}

/**
 * Per affected node rows over the fresh evidence (queried AFTER the evidence
 * mutation landed — the results screen's input). Node order follows first
 * appearance in the results (the generator's order).
 */
export function quizNodeRows(
  results: QuizAnswerResult[],
  nodes: KnowledgeNode[],
  evidence: EvidenceRecord[],
  sessionId: string | null,
): QuizNodeRow[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const nodeIds = [...new Set(results.map((r) => r.nodeId))];
  return nodeIds.map((nodeId) => {
    const records = evidence.filter((e) => e.nodeId === nodeId);
    const prior = records.filter((e) => e.sessionId !== sessionId);
    const window = [...records]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, MASTERY_CONFIG.window)
      .map((r) => r.outcome);
    const node = byId.get(nodeId);
    return {
      nodeId,
      node,
      title: node?.title ?? nodeId,
      before: computeNodeScore(prior),
      after: computeNodeScore(records),
      state: getNodeState(records),
      hasEvidence: records.length > 0,
      belowGate: records.length > 0 && records.length < MASTERY_CONFIG.evidenceGate,
      lastOutcomes: window.reverse(),
    };
  });
}

// -- per-question breakdown -------------------------------------------------------------

/** One breakdown row: the revealed result + its material grounding. */
export interface QuizBreakdownRow {
  result: QuizAnswerResult;
  /** The source section's title (null when the material/section no longer resolves). */
  sectionTitle: string | null;
  /** The grader's supporting quote (open graded only; choice has no citation). */
  quote: string | null;
}

/** Per-question rows with source excerpt inputs (section title + citation quote). */
export function quizBreakdownRows(results: QuizAnswerResult[], materials: Material[]): QuizBreakdownRow[] {
  const sectionsByMaterial = new Map(materials.map((m) => [m.id, m.sections]));
  return results.map((result) => {
    const sectionTitle =
      sectionsByMaterial.get(result.sourceMaterialId)?.find((s) => s.id === result.sourceSectionId)?.title ?? null;
    return { result, sectionTitle, quote: result.grading?.citation?.quote ?? null };
  });
}

// -- mistakes ------------------------------------------------------------------------------

/** One wrong answer as the MistakeCompareCard's inputs (UX spine; scaffold pattern). */
export interface QuizMistakeView {
  questionId: string;
  kind: "open" | "choice";
  prompt: string;
  userAnswer: string;
  /** Choice: the correct option TEXT; open: the generator's reference sentence. */
  correctAnswer: string;
  /** The AI 解析 strip: the grader's rationale when carried, else the explanation. */
  note: string;
  sectionTitle: string | null;
  forfeited: boolean;
}

/** The round's wrong answers (forfeit included — forfeit = wrong, ADR-0001). */
export function quizMistakeViews(results: QuizAnswerResult[], materials: Material[]): QuizMistakeView[] {
  return quizBreakdownRows(results, materials)
    .filter(({ result }) => result.outcome === "wrong")
    .map(({ result, sectionTitle }) => ({
      questionId: result.questionId,
      kind: result.kind,
      prompt: result.prompt,
      userAnswer: result.userAnswer,
      correctAnswer:
        result.kind === "choice" && result.correctOptionIndex !== null
          ? (result.options[result.correctOptionIndex] ?? "")
          : result.explanation,
      note: result.grading?.rationale ?? result.explanation,
      sectionTitle,
      forfeited: result.forfeited,
    }));
}

// -- runner helpers -------------------------------------------------------------------------

/**
 * The free hint's content (UX HintButton): the source section's TITLE only —
 * a non-revealing nudge that never carries the explanation (honest + minimal).
 * Null when the section no longer resolves (the hint box hides).
 */
export function quizHintFor(view: Pick<MaskedQuestionView, "sourceMaterialId" | "sourceSectionId">, materials: Material[]): string | null {
  return (
    materials.find((m) => m.id === view.sourceMaterialId)?.sections.find((s) => s.id === view.sourceSectionId)?.title ??
    null
  );
}

/**
 * Materials a quiz may generate from (FR-18 sourcing honesty): parsed with at
 * least one extracted section — a pending/failed/empty material would yield
 * zero questions, so it never offers a scope it cannot serve.
 */
export function quizableMaterials(materials: Material[]): Material[] {
  return materials.filter((m) => m.parseState === "parsed" && m.sections.length > 0);
}

/** The AI seam's MaterialRefs for a set of materials (generation input, AD-5). */
export function quizMaterialRefs(materials: Material[]): MaterialRef[] {
  return quizableMaterials(materials).map((m) => ({ materialId: m.id, sections: m.sections }));
}
