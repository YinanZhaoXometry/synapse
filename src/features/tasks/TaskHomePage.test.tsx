import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import {
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
 * TaskHomePage observable states (T2; spec testing seam 4 — component render
 * seam): unknown-id not-found, the normal uncovered home (breadcrumb, reader
 * link, ring + state glyph + label, disabled slice tiles with their reason),
 * the three node states (uncovered/partial/mastered — evidence recorded through
 * the real repository write path, `recordEvidence`, so the ADR-0001 numbers
 * arrive via the production seam), and the byteless re-upload state after a
 * reload through the reader's re-upload contract. Expected copy reads the copy
 * deck directly (independent source, never recomputed); stub routes capture
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

  it("uncovered home: breadcrumb works, material row opens the reader, ring reads 0 with the glyph label, slice tiles are disabled placeholders", async () => {
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

    // epic-6 placeholders: visible, disabled, with a reason; no companion twin here
    expect(screen.getByRole("button", { name: zh("plans.quickQuiz") })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: zh("plans.quickFlashcards") })).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("button", { name: zh("plans.quickCompanion") })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: zh("plans.quickQuiz") }));
    expect(await screen.findByText(zh("tasks.sliceQuiz"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: zh("plans.quickFlashcards") }));
    expect(await screen.findByText(zh("tasks.sliceFlashcards"))).toBeInTheDocument();

    // breadcrumb back to Plans Home works (the task is never a trap) — asserted
    // last because it navigates away from the page under test
    fireEvent.click(screen.getByRole("button", { name: zh("tasks.backToPlans") }));
    expect(await screen.findByTestId("plans-landing")).toBeInTheDocument();
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
