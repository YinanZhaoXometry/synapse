import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import type { Question } from "@/domain/entities";
import { QuizRunner } from "./QuizRunner";
import { forfeitCurrent, selectOption, startQuizRun, submitCurrent, typeOpenAnswer } from "./session-machine";
import type { useQuizSession } from "./use-quiz-session";

/**
 * QuizRunner direct (epic P3-17 ticket 09): the answer-submission contract the
 * page tests only sample, over the REAL session-machine states — the runner
 * renders ONLY the machine's views, so the fixtures are the machine's own
 * outputs (startQuizRun/selectOption/submitCurrent/forfeitCurrent), never
 * hand-built view objects. Pins: gate before submit (no reveal can exist),
 * the confirm guards, the keyboard map, the verdict pacing step, the forfeit
 * variant, the resumed note, and the exit-once abandon.
 */

const CHOICE: Question = {
  id: "q-1",
  sessionId: "s-1",
  nodeId: "node-1",
  kind: "choice",
  prompt: "First?",
  options: ["Alpha", "Beta", "Gamma"],
  correctOptionIndex: 1,
  sourceMaterialId: "mat-1",
  sourceSectionId: "sec-1",
  explanation: "Because Beta.",
};

const SECOND: Question = { ...CHOICE, id: "q-2", prompt: "Second?", correctOptionIndex: 0 };

function driverDouble(overrides: Partial<ReturnType<typeof useQuizSession>> = {}) {
  return {
    select: vi.fn(),
    submit: vi.fn(),
    typeAnswer: vi.fn(),
    hint: vi.fn(),
    forfeit: vi.fn(),
    abandon: vi.fn(),
    results: null,
    ...overrides,
  } as unknown as ReturnType<typeof useQuizSession>;
}

function renderRunner(driver: ReturnType<typeof useQuizSession>, run: ReturnType<typeof startQuizRun>, opts: { resumed?: boolean } = {}) {
  return render(
    <LanguageProvider>
      <QuizRunner
        driver={driver}
        run={run}
        materials={[]}
        nodes={[]}
        evidence={[]}
        resumed={opts.resumed ?? false}
        canRetake={false}
        onRetake={vi.fn()}
        onBackToPlan={vi.fn()}
        onAbandoned={vi.fn()}
      />
    </LanguageProvider>,
  );
}

describe("QuizRunner — the submission contract", () => {
  it("renders the machine's masked view: options without any reveal marking", () => {
    const run = startQuizRun({ mode: "choice", sessionId: "s-1", questions: [CHOICE, SECOND] });
    renderRunner(driverDouble(), run);

    // Before submit: three plain options, aria-pressed false, no verdict anywhere.
    expect(screen.getByTestId("quiz-runner")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^quiz-option-/)).toHaveLength(3);
    expect(screen.queryByTestId("quiz-verdict")).not.toBeInTheDocument();
    expect(screen.queryByTestId("quiz-next")).not.toBeInTheDocument();
  });

  it("refuses to submit an unselected choice (the guard), submits a selected one", async () => {
    const user = userEvent.setup();
    const unselected = startQuizRun({ mode: "choice", sessionId: "s-1", questions: [CHOICE] });
    const driver = driverDouble();
    const { rerender } = renderRunner(driver, unselected);

    await user.click(screen.getByTestId("quiz-confirm"));
    expect(driver.submit).not.toHaveBeenCalled();

    // The machine recorded the tap → the same confirm now submits.
    rerender(
      <LanguageProvider>
        <QuizRunner driver={driver} run={selectOption(unselected, 1)} materials={[]} nodes={[]} evidence={[]}
          resumed={false} canRetake={false} onRetake={vi.fn()} onBackToPlan={vi.fn()} onAbandoned={vi.fn()} />
      </LanguageProvider>,
    );
    await user.click(screen.getByTestId("quiz-confirm"));
    expect(driver.submit).toHaveBeenCalledTimes(1);
  });

  it("refuses to submit an empty open answer; types through the driver", async () => {
    const user = userEvent.setup();
    const run = startQuizRun({
      mode: "open",
      sessionId: "s-1",
      questions: [{ ...CHOICE, kind: "open", options: [], correctOptionIndex: undefined, prompt: "Explain." }],
    });
    const driver = driverDouble();
    renderRunner(driver, run);

    await user.click(screen.getByTestId("quiz-confirm"));
    expect(driver.submit).not.toHaveBeenCalled();

    await user.type(screen.getByTestId("quiz-open-input"), "Raft votes");
    expect(driver.typeAnswer).toHaveBeenCalled();
    // The typed text went through the driver — the run prop (and the DOM value)
    // stay the machine's business, not local state.
    expect(screen.getByTestId("quiz-open-input")).toHaveValue("");
  });

  it("pins the just-revealed question as a verdict step until 下一题 (the pacing contract)", async () => {
    const user = userEvent.setup();
    const started = startQuizRun({ mode: "choice", sessionId: "s-1", questions: [CHOICE, SECOND] });
    const driver = driverDouble();
    const { rerender } = renderRunner(driver, started);

    // The machine graded q1 (a WRONG pick — 0 ≠ correct 1) and advanced to q2.
    const graded = submitCurrent(selectOption(started, 0));
    rerender(
      <LanguageProvider>
        <QuizRunner driver={driver} run={graded} materials={[]} nodes={[]} evidence={[]}
          resumed={false} canRetake={false} onRetake={vi.fn()} onBackToPlan={vi.fn()} onAbandoned={vi.fn()} />
      </LanguageProvider>,
    );

    // The verdict pins q1 — the runner does NOT auto-advance past it.
    expect(screen.getByTestId("quiz-verdict")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-verdict-label")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-next")).toBeInTheDocument();
    // The reveal shows the correct option (Beta) and the wrong pick (Alpha) —
    // the gate is open only after submit.
    expect(screen.getByText("Beta")).toBeInTheDocument();

    await user.click(screen.getByTestId("quiz-next"));
    // Pacing cleared → the machine's next active question shows.
    expect(screen.getByTestId("quiz-runner")).toBeInTheDocument();
    expect(screen.getByText("Second?")).toBeInTheDocument();
  });

  it("shows the forfeit variant as the amber wrong (看答案 shares wrong visuals)", () => {
    const started = startQuizRun({ mode: "choice", sessionId: "s-1", questions: [CHOICE, SECOND] });
    const driver = driverDouble();
    const { rerender } = renderRunner(driver, started);

    const forfeited = forfeitCurrent(started);
    rerender(
      <LanguageProvider>
        <QuizRunner driver={driver} run={forfeited} materials={[]} nodes={[]} evidence={[]}
          resumed={false} canRetake={false} onRetake={vi.fn()} onBackToPlan={vi.fn()} onAbandoned={vi.fn()} />
      </LanguageProvider>,
    );

    expect(screen.getByTestId("quiz-verdict")).toBeInTheDocument();
    // forfeited = wrong (ADR-0001): the forfeited marker rides the verdict pill.
    expect(screen.getByTestId("quiz-verdict-label").textContent).toContain("已放弃");
  });

  it("wires the keyboard map: digits select, Enter confirms, Esc asks exit once and abandons", async () => {
    const user = userEvent.setup();
    const started = startQuizRun({ mode: "choice", sessionId: "s-1", questions: [CHOICE, SECOND] });
    const selected = selectOption(started, 2);
    const driver = driverDouble();
    const onAbandoned = vi.fn();
    const { rerender } = renderRunner(driver, started);

    // Digit select: key "2" selects the SECOND option (index 1).
    await user.keyboard("2");
    expect(driver.select).toHaveBeenCalledWith(1);

    rerender(
      <LanguageProvider>
        <QuizRunner driver={driver} run={selected} materials={[]} nodes={[]} evidence={[]}
          resumed={false} canRetake={false} onRetake={vi.fn()} onBackToPlan={vi.fn()} onAbandoned={onAbandoned} />
      </LanguageProvider>,
    );

    // Enter confirms the selection.
    await user.keyboard("{Enter}");
    expect(driver.submit).toHaveBeenCalledTimes(1);

    // Esc asks exit ONCE; leaving abandons (evidence never lands).
    await user.keyboard("{Escape}");
    expect(await screen.findByTestId("quiz-exit-leave")).toBeInTheDocument();
    await user.click(screen.getByTestId("quiz-exit-leave"));
    expect(driver.abandon).toHaveBeenCalledTimes(1);
    expect(onAbandoned).toHaveBeenCalledTimes(1);
  });

  it("announces an honest resume and forwards hint", async () => {
    const user = userEvent.setup();
    const run = startQuizRun({ mode: "choice", sessionId: "s-1", questions: [CHOICE] });
    const driver = driverDouble();
    const { rerender } = renderRunner(driver, run, { resumed: true });
    expect(screen.getByTestId("quiz-resumed-note")).toBeInTheDocument();

    rerender(
      <LanguageProvider>
        <QuizRunner driver={driver} run={run} materials={[]} nodes={[]} evidence={[]}
          resumed={false} canRetake={false} onRetake={vi.fn()} onBackToPlan={vi.fn()} onAbandoned={vi.fn()} />
      </LanguageProvider>,
    );
    expect(screen.queryByTestId("quiz-resumed-note")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("quiz-hint"));
    expect(driver.hint).toHaveBeenCalledTimes(1);
  });
});
