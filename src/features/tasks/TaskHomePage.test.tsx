import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import {
  createFlashcards,
  createQuizSession,
  createStudyTask,
  getReadingProgress,
  loadDb,
  recordEvidence,
  registerMaterial,
  type AnswerResult,
} from "@/data";
import type { MaterialSection, Outcome, ParseState } from "@/domain/entities";
import TaskHomePage from "./TaskHomePage";

/**
 * TaskHomePage observable states (T2 + T4; spec testing seam 4 — component
 * render seam): unknown-id not-found, the normal uncovered home (breadcrumb,
 * reader link, ring + state glyph + label), the REAL quick tiles (T4 — quiz
 * tile opens the QuizLauncher dialog with mode select only, flashcard tile
 * opens the launcher dialog without cards or navigates straight to the study
 * with an existing deck; the epic-5 disabled placeholders are gone), the three
 * node states (uncovered/partial/mastered — evidence recorded through the real
 * repository write path, `recordEvidence`, so the ADR-0001 numbers arrive via
 * the production seam), and the byteless re-upload state after a reload
 * through the reader's re-upload contract. Expected copy reads the copy deck
 * directly (independent source, never recomputed); stub routes capture
 * navigation instead of mounting the reader/pdfjs.
 */

/**
 * jsdom 20's File predates .arrayBuffer(), which the reader's parse seam reads
 * bytes through (TaskCreatePage.test.tsx bridge — the production path runs
 * unmodified).
 */
beforeAll(() => {
  if (!File.prototype.arrayBuffer) {
    File.prototype.arrayBuffer = function (this: File): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }
});

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];
/** The dictionary is the independent source; {var} interpolation mirrors t(). */
const zhN = (key: string, n: number | string) => zh(key).replace("{n}", String(n));

function PlansLanding() {
  return <p data-testid="plans-landing" />;
}
function ReaderLanding() {
  return <p data-testid="reader-landing" />;
}
function QuizLanding() {
  return <p data-testid="quiz-landing" />;
}
function FlashcardsLanding() {
  return <p data-testid="flashcards-landing" />;
}

function renderTaskHome(taskId: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <LanguageProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/task/${taskId}`]}>
          <Toaster />
          <Routes>
            <Route path="/task/:id" element={<TaskHomePage />} />
            {/* stubs for the T4 launches — navigation is the assertion */}
            <Route path="/task/:id/quiz" element={<QuizLanding />} />
            <Route path="/task/:id/flashcards" element={<FlashcardsLanding />} />
            <Route path="/plans" element={<PlansLanding />} />
            <Route path="/read/:materialId" element={<ReaderLanding />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </LanguageProvider>,
  );
}

interface SeedOptions {
  parseState?: ParseState;
  sections?: MaterialSection[];
  withBytes?: boolean;
}

/** A task seeded through the real creation path: register material → createStudyTask. */
function seedTask(options: SeedOptions = {}) {
  const { material } = registerMaterial({
    title: "lecture-04",
    kind: "markdown",
    sizeBytes: 2048,
    planId: null,
    taskId: null,
    sections: options.sections ?? [{ id: "intro", title: "Intro", text: "intro text" }],
    parseState: options.parseState ?? "parsed",
    blob: options.withBytes ? new File(["# intro"], "lecture-04.md", { type: "text/markdown" }) : undefined,
  });
  const { task, node } = createStudyTask({ materialId: material.id });
  return { task, material, node };
}

/** Evidence through THE write path (AD-6): a session whose answers all carry one outcome. */
function recordOutcomes(taskId: string, nodeId: string, materialId: string, outcomes: Outcome[]) {
  const { session, questions } = createQuizSession({
    planId: null,
    taskId,
    mode: "mix",
    questions: outcomes.map((_, i) => ({
      prompt: `q-${i}`,
      nodeId,
      kind: "open",
      sourceMaterialId: materialId,
      sourceSectionId: "intro",
      explanation: "because",
    })),
  });
  const results: AnswerResult[] = questions.map((q, i) => ({
    questionId: q.id,
    outcome: outcomes[i],
    userAnswer: "an answer",
    forfeited: false,
  }));
  recordEvidence({ sessionId: session.id, results });
}

const fileInputOf = (container: HTMLElement) => container.querySelector('input[type="file"]') as HTMLInputElement;
const markdownFile = (name: string) => new File(["# fresh bytes"], name, { type: "text/markdown" });

beforeEach(() => {
  localStorage.clear();
});

describe("TaskHomePage (FR-37; ADR-0001; AD-6/8)", () => {
  it("unknown task id: graceful not-found with the way back, never a blank screen", async () => {
    renderTaskHome("no-such-task");
    expect(await screen.findByText(zh("tasks.notFound"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: zh("tasks.backToPlans") })).toBeInTheDocument();
  });

  it("uncovered home: breadcrumb works, material row opens the reader, ring reads 0 with the glyph label, quick tiles are real and enabled", async () => {
    const { task, material } = seedTask({ withBytes: true });
    const { container } = renderTaskHome(task.id);

    // title from the material; the single node is the page's one row
    expect(await screen.findByRole("heading", { name: "lecture-04" })).toBeInTheDocument();

    // the material row opens the Immersive Reader (no stored progress → 打开)
    // — the name is matched loosely: the icon's JSX spacer leaves a leading space
    const readerLink = screen.getByRole("link", { name: new RegExp(zh("common.open")) });
    expect(readerLink).toHaveAttribute("href", `/read/${material.id}`);

    // the ring carries the task's own rollup — 0 with no evidence
    expect(screen.getByRole("img", { name: zhN("plans.masteryAria", 0) })).toBeInTheDocument();
    // state vocabulary: glyph + label, never color alone
    expect(screen.getByText(zh("plans.stateUncovered"))).toBeInTheDocument();
    // no evidence → the em-dash display contract, never a fabricated 0% row
    expect(screen.getByText("—")).toBeInTheDocument();

    // T4: the epic-5 disabled placeholders are gone — the tiles are real and
    // enabled (a parsed material can serve both); no companion twin here
    expect(screen.getByTestId("task-quiz-tile")).toHaveAttribute("aria-disabled", "false");
    expect(screen.getByTestId("task-flashcards-tile")).toHaveAttribute("aria-disabled", "false");
    expect(screen.queryByRole("button", { name: zh("plans.quickCompanion") })).not.toBeInTheDocument();

    // breadcrumb back to Plans Home works (the task is never a trap) — asserted
    // last because it navigates away from the page under test
    fireEvent.click(screen.getByRole("button", { name: zh("tasks.backToPlans") }));
    expect(await screen.findByTestId("plans-landing")).toBeInTheDocument();
  });

  it("quiz tile: opens the QuizLauncher dialog — mode select only, the single material IS the scope (no scope picker)", async () => {
    const { task } = seedTask({ withBytes: true });
    renderTaskHome(task.id);

    fireEvent.click(await screen.findByTestId("task-quiz-tile"));
    expect(await screen.findByTestId("quiz-launcher")).toBeInTheDocument();
    // the plan twin's mode radios are all here…
    expect(screen.getByTestId("quiz-mode-open")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-mode-choice")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-mode-mix")).toBeInTheDocument();
    // …but the scope picker is not: 「整个计划」 would be a lie on a task surface
    expect(screen.queryByTestId("quiz-scope-plan")).not.toBeInTheDocument();
    expect(screen.getByTestId("quiz-launcher-start")).toBeInTheDocument();
  });

  it("flashcards tile, no cards yet: opens the FlashcardLauncher dialog (generation entry)", async () => {
    const { task } = seedTask({ withBytes: true });
    renderTaskHome(task.id);

    fireEvent.click(await screen.findByTestId("task-flashcards-tile"));
    expect(await screen.findByTestId("flashcards-launcher")).toBeInTheDocument();
    expect(screen.getByTestId("flashcards-launcher-start")).toBeInTheDocument();
    // navigation was NOT the tile's answer — the dialog keeps the user on Task Home
    expect(screen.queryByTestId("flashcards-landing")).not.toBeInTheDocument();
  });

  it("flashcards tile with an existing deck: 「继续学习」 goes straight to the study route (no silent duplication)", async () => {
    const { task, material } = seedTask({ withBytes: true });
    createFlashcards({
      materialId: material.id,
      nodeId: null,
      cards: [{ front: "deck-one-a", back: "back-one-a" }],
    });
    renderTaskHome(task.id);

    // the tile re-labels to the continue state (T3's policy mirrored)
    const tile = await screen.findByTestId("task-flashcards-tile");
    expect(tile.textContent).toContain(zh("flashcards.tileContinue"));
    expect(tile.textContent).toContain(zhN("flashcards.tileContinueDesc", 1));
    fireEvent.click(tile);
    expect(await screen.findByTestId("flashcards-landing")).toBeInTheDocument();
  });

  it("evidence popover on a fresh task names the honest empty state and the shared rule", async () => {
    const { task } = seedTask({ withBytes: true });
    renderTaskHome(task.id);
    fireEvent.click(await screen.findByRole("button", { name: zh("plans.viewEvidenceAria") }));
    expect(await screen.findByText(zh("plans.noEvidence"))).toBeInTheDocument();
    expect(screen.getByText(zh("plans.evidenceRule"))).toBeInTheDocument();
    expect(screen.queryByText(zhN("tasks.cap99Note", 3))).not.toBeInTheDocument();
  });

  it("partial state: 2 corrects → the ring reads the capped 99, glyph reads partial, popover names the cap", async () => {
    const { task, node, material } = seedTask({ withBytes: true });
    recordOutcomes(task.id, node.id, material.id, ["correct", "correct"]);
    renderTaskHome(task.id);

    expect((await screen.findAllByText("99%")).length).toBeGreaterThan(0); // node row + ring text
    expect(screen.getByRole("img", { name: zhN("plans.masteryAria", 99) })).toBeInTheDocument();
    expect(screen.getByText(zh("plans.statePartial"))).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: zh("plans.viewEvidenceAria") }));
    expect(await screen.findByText(zhN("tasks.cap99Note", 3))).toBeInTheDocument();
    expect(screen.getByText(zh("plans.evidenceRule"))).toBeInTheDocument();
  });

  it("mastered state: 3 corrects → 100, glyph reads mastered, ring shows the readiness label", async () => {
    const { task, node, material } = seedTask({ withBytes: true });
    recordOutcomes(task.id, node.id, material.id, ["correct", "correct", "correct"]);
    renderTaskHome(task.id);

    expect((await screen.findAllByText("100%")).length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: zhN("plans.masteryAria", 100) })).toBeInTheDocument();
    expect(screen.getByText(zh("plans.stateMastered"))).toBeInTheDocument();
    expect(screen.getByText(zh("plans.readyLabel"))).toBeInTheDocument(); // ring's 已备绪 pill

    // gate met → the popover lists the marks and never claims the cap
    fireEvent.click(screen.getByRole("button", { name: zh("plans.viewEvidenceAria") }));
    // the marks (sr-only labels) + the legend all carry the outcome's name
    expect((await screen.findAllByText(zh("plans.outcomeCorrect"))).length).toBeGreaterThan(0);
    expect(screen.queryByText(zhN("tasks.cap99Note", 3))).not.toBeInTheDocument();
    // the score moved only via evidence on the task's own node (AD-6)
    expect(getReadingProgress(material.id)).toBeUndefined();
  });

  it("byteless material after a reload: the row names the contract and re-upload restores the honest state", async () => {
    const { task } = seedTask({ parseState: "parsed" }); // metadata persists, bytes are gone
    const { container } = renderTaskHome(task.id);

    expect(await screen.findByText(zh("plans.materialReupload"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: zh("plans.materialReuploadAction") }));
    fireEvent.change(fileInputOf(container), { target: { files: [markdownFile("lecture-04.md")] } });

    // the same-kind re-upload puts fresh session bytes back — the parsed chip
    // (persisted sections stay the truth) replaces the re-upload contract
    await waitFor(() => expect(screen.getByText(zhN("plans.parseParsed", 1))).toBeInTheDocument());
    expect(loadDb().materials[0].parseState).toBe("parsed");
    expect(screen.queryByText(zh("plans.materialReupload"))).not.toBeInTheDocument();
  });

  it("material row wraps at narrow widths: kind/size chips hide below sm and the re-upload cluster stays in the row (FR-29 at 390px)", async () => {
    const { task } = seedTask({ parseState: "parsed" }); // byteless → re-upload cluster visible
    const { container } = renderTaskHome(task.id);

    // the row itself carries the wrap contract (class contract, not pixel math)
    const readerLink = await screen.findByRole("link", { name: new RegExp(zh("common.open")) });
    const row = readerLink.closest(".flex-wrap");
    expect(row).not.toBeNull();
    expect(row).toHaveClass("flex-wrap");

    // the secondary chips carry the responsive-hidden contract at narrow widths
    expect(screen.getByText(zh("plans.materialKindMarkdown"))).toHaveClass("hidden");
    expect(screen.getByText("0.0 MB")).toHaveClass("hidden");

    // the recovery action stays inside the wrapping row — never clipped away
    expect(row?.textContent).toContain(zh("plans.materialReuploadAction"));
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
  });

  it("re-upload validates through the reader's contract: a kind mismatch is rejected with its reason", async () => {
    const { task } = seedTask({ parseState: "parsed" });
    const { container } = renderTaskHome(task.id);

    fireEvent.click(await screen.findByRole("button", { name: zh("plans.materialReuploadAction") }));
    fireEvent.change(fileInputOf(container), {
      target: { files: [new File(["%PDF-"], "wrong.pdf", { type: "application/pdf" })] },
    });

    expect(await screen.findByText(zh("reader.reuploadKindMismatch"))).toBeInTheDocument();
    await waitFor(() => expect(loadDb().materials[0].parseState).toBe("parsed")); // untouched
    expect(screen.getByText(zh("plans.materialReupload"))).toBeInTheDocument();
  });
});
