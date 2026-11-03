import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import type { EvidenceRecord } from "@/domain/entities";
import { QuizResults } from "./QuizResults";
import type { QuizAnswerResult } from "./session-machine";

/**
 * Review P2-1: the evidence pill derives from the REAL records passed in —
 * never from the machine's in-memory results. A run whose evidence write
 * failed (empty records for the session) must not claim 「已记录」.
 */

const result: QuizAnswerResult = {
  questionId: "q-1",
  nodeId: "node-1",
  kind: "choice",
  prompt: "Which holds?",
  outcome: "correct",
  outcomeValue: 1,
  userAnswer: "the correct option",
  forfeited: false,
  hintUsed: false,
  sourceMaterialId: "m-1",
  sourceSectionId: "sec-1",
  correctOptionIndex: 1,
  options: ["wrong", "the correct option"],
  explanation: "the explanation",
  grading: null,
};

const evidenceLanded = (sessionId: string): EvidenceRecord => ({
  id: "ev-1",
  sessionId,
  nodeId: "node-1",
  questionId: "q-1",
  outcome: "correct",
  createdAt: new Date().toISOString(),
});

function renderResults(evidence: EvidenceRecord[], sessionId = "s-9") {
  return render(
    <LanguageProvider>
      <QuizResults
        results={[result]}
        sessionId={sessionId}
        nodes={[]}
        materials={[]}
        evidence={evidence}
        canRetake={false}
        onBackToPlan={() => {}}
        onRetake={() => {}}
      />
    </LanguageProvider>,
  );
}

describe("QuizResults — the evidence claim is failure-honest (review P2-1)", () => {
  it("claims 「已记录」 only with the session's real records on hand", () => {
    renderResults([evidenceLanded("s-9")]);
    expect(screen.getByTestId("quiz-results").textContent).toContain("1 条证据已记录");
    expect(screen.queryByText("证据记录中…")).toBeNull();
  });

  it("a failed write (no records for the session) shows the honest pending pill, never a logged lie", () => {
    renderResults([]); // the write failed — nothing for this session
    expect(screen.getByTestId("quiz-results").textContent).toContain("证据记录中…");
    expect(screen.queryByText(/条证据已记录/)).toBeNull();
  });

  it("another session's records do not count as mine", () => {
    renderResults([evidenceLanded("s-other")]);
    expect(screen.getByTestId("quiz-results").textContent).toContain("证据记录中…");
  });
});
