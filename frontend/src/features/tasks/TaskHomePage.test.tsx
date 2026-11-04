import { MockedProvider } from "@apollo/client/testing/react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AllEvidenceDocument,
  CreateMaterialUploadDocument,
  FlashcardsByMaterialDocument,
  MaterialsDocument,
  TaskDocument,
} from "@/types/graphql";
import { sessionBlobs } from "@/api";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { MASTERY_CONFIG } from "@/domain/mastery";
import TaskHomePage from "./TaskHomePage";

/**
 * TaskHomePage observable states (T2 + T4; spec testing seam 4 — component
 * render seam over MockedProvider, the cutover's Apollo test seam): unknown-id
 * not-found, the normal uncovered home (breadcrumb, reader link, ring + state
 * glyph + label), the REAL quick tiles (T4 — the quiz tile opens the launcher
 * dialog wired to the task surface, the flashcard tile opens the real
 * launcher dialog without cards or navigates straight to the study with an
 * existing deck), the three node states carried as SERVER fields (AD-14 — the
 * mocked api rows bring the score/state; the evidence marks ride the mocked
 * evidence query), and the byteless re-upload state after a reload through
 * the reader's re-upload contract + the presigned refresh. The quiz launcher
 * is stubbed to a props-capturing stand-in (the wiring is this page's
 * contract; the launcher's own behavior is the quiz feature's suite); the
 * reader's eager-parse hook is stubbed to a spy the same way. Expected copy
 * reads the copy deck directly; stub routes capture navigation.
 */

// The quiz launcher stand-in: same observable dialog testids, captures the
// wiring (taskId/nodeIds/materials) for the task-surface assertions.
interface CapturedLauncherProps {
  taskId?: string | null;
  nodeIds?: string[];
  materials?: Array<{ id: string }>;
}
const quizSeam = vi.hoisted(() => ({ launcherProps: [] as CapturedLauncherProps[] }));

vi.mock("@/features/quiz", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/quiz")>();
  return {
    ...actual,
    QuizLauncher: (props: CapturedLauncherProps) => {
      quizSeam.launcherProps.push(props);
      return (
        <div data-testid="quiz-launcher">
          <span data-testid="quiz-mode-open" />
          <span data-testid="quiz-mode-choice" />
          <span data-testid="quiz-mode-mix" />
          <button type="button" data-testid="quiz-launcher-start">
            start
          </button>
        </div>
      );
    },
  };
});

// The reader's eager-parse spy: one seam override, the same as
// TaskCreatePage.test.tsx — the re-upload tests assert the page's own
// re-parse decision, not the reader's internals.
const parseSeam = vi.hoisted(() => ({ bound: [] as unknown[], calls: [] as string[] }));

vi.mock("@/features/reader", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/reader")>();
  return {
    ...actual,
    useParseMaterialMutation: (material: unknown) => {
      parseSeam.bound.push(material);
      return {
        mutate: (materialId: string) => {
          parseSeam.calls.push(materialId);
        },
      };
    },
  };
});

// The session-blob registry is the app-wide singleton (fresh memory each page
// load) — a reset per test IS the reload semantics the byteless re-upload
// tests exercise. Same shape as the real createSessionBlobRegistry.
const blobStore = vi.hoisted(() => {
  const blobs = new Map<string, Blob>();
  const listeners = new Set<() => void>();
  return {
    sessionBlobs: {
      put: (id: string, blob: Blob) => {
        blobs.set(id, blob);
        for (const listener of listeners) listener();
      },
      get: (id: string) => blobs.get(id),
      has: (id: string) => blobs.has(id),
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    reset: () => blobs.clear(),
  };
});

vi.mock("@/lib/session-blobs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session-blobs")>();
  return { ...actual, sessionBlobs: blobStore.sessionBlobs };
});

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const zh = (key: string) => zhDict[key];
/** The dictionary is the independent source; {var} interpolation mirrors t(). */
const zhN = (key: string, n: number | string) => zh(key).replace("{n}", String(n));

// ---- server-shaped fixtures (the mock data is what the api would return) ----

const TASK_ID = "t-1";
const MATERIAL_ID = "m-1";
const NODE_ID = "n-1";

const serverNode = (masteryScore: string, state: string) => ({
  __typename: "KnowledgeNode",
  id: NODE_ID,
  planId: null,
  taskId: TASK_ID,
  stage: null,
  title: "lecture-04",
  order: 0,
  masteryScore,
  state,
  createdAt: "2026-11-01T00:00:00Z",
});

const serverMaterial = (overrides: Record<string, unknown> = {}) => ({
  __typename: "Material",
  id: MATERIAL_ID,
  title: "lecture-04",
  kind: "markdown",
  sizeBytes: 0,
  planId: null,
  taskId: TASK_ID,
  attachmentScope: "plan",
  nodeId: null,
  parseState: "parsed",
  parseFailureReason: null,
  createdAt: "2026-11-01T00:00:00Z",
  downloadUrl: null,
  sections: [{ __typename: "MaterialSection", id: "intro", title: "Intro", text: "intro text" }],
  ...overrides,
});

const serverEvidence = (id: string, outcome: string, createdAt: string) => ({
  __typename: "EvidenceRecord",
  id,
  nodeId: NODE_ID,
  sessionId: "s-1",
  questionId: "q-1",
  outcome,
  createdAt,
});

const serverCard = (id: string, front: string) => ({
  __typename: "Flashcard",
  id,
  materialId: MATERIAL_ID,
  nodeId: null,
  front,
  back: `back-${id}`,
  difficulty: null,
  createdAt: "2026-11-01T00:00:00Z",
});

interface HomeOptions {
  task?: Record<string, unknown> | null;
  materials?: Record<string, unknown>[];
  evidence?: Record<string, unknown>[];
  cards?: Record<string, unknown>[];
}

function homeMocks(options: HomeOptions = {}) {
  const {
    task = { __typename: "StudyTask", id: TASK_ID, materialId: MATERIAL_ID, nodeId: NODE_ID, createdAt: "2026-11-01T00:00:00Z", node: serverNode("0", "uncovered") },
    materials = [serverMaterial()],
    evidence = [],
    cards = [],
  } = options;
  return [
    { request: { query: TaskDocument, variables: { id: TASK_ID } }, result: { data: { task } }, maxUsageCount: 3 },
    { request: { query: MaterialsDocument, variables: { taskId: TASK_ID } }, result: { data: { materials } }, maxUsageCount: 3 },
    { request: { query: AllEvidenceDocument, variables: {} }, result: { data: { evidence } }, maxUsageCount: 3 },
    {
      request: { query: FlashcardsByMaterialDocument, variables: { materialId: MATERIAL_ID } },
      result: { data: { flashcards: cards } },
      maxUsageCount: 3,
    },
    {
      request: { query: CreateMaterialUploadDocument, variables: () => true },
      result: {
        data: {
          __typename: "Mutation",
          createMaterialUpload: {
            __typename: "CreateMaterialUploadPayload",
            materialId: MATERIAL_ID,
            uploadUrl: "http://storage.test/put",
            expiresAt: "2026-11-04T01:00:00Z",
          },
        },
      },
      maxUsageCount: 5,
    },
  ];
}

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

function renderTaskHome(taskIdOrOptions: string | HomeOptions = TASK_ID, maybeOptions: HomeOptions = {}) {
  const taskId = typeof taskIdOrOptions === "string" ? taskIdOrOptions : TASK_ID;
  const options = typeof taskIdOrOptions === "string" ? maybeOptions : taskIdOrOptions;
  return render(
    <LanguageProvider>
      <MockedProvider mocks={homeMocks(options)}>
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
      </MockedProvider>
    </LanguageProvider>,
  );
}

const fileInputOf = (container: HTMLElement) => container.querySelector('input[type="file"]') as HTMLInputElement;
const markdownFile = (name: string) => new File(["# fresh bytes"], name, { type: "text/markdown" });

beforeEach(() => {
  // the presigned PUT goes straight to storage (never through the api) — a
  // plain ok response stands in for the provider
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200 })),
  );
  blobStore.reset(); // a fresh page load's registry — bytes are gone until put
  parseSeam.bound.length = 0;
  parseSeam.calls.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TaskHomePage (FR-37; ADR-0001; AD-6/8)", () => {
  it("unknown task id: graceful not-found with the way back, never a blank screen", async () => {
    renderTaskHome("no-such-task", { task: null, materials: [] });
    expect(await screen.findByText(zh("tasks.notFound"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: zh("tasks.backToPlans") })).toBeInTheDocument();
  });

  it("uncovered home: breadcrumb works, material row opens the reader, ring reads 0 with the glyph label, quick tiles are real and enabled", async () => {
    sessionBlobs.put(MATERIAL_ID, markdownFile("lecture-04.md")); // this session's bytes are present
    const { container, unmount } = renderTaskHome();

    // title from the material; the single node is the page's one row
    expect(await screen.findByRole("heading", { name: "lecture-04" })).toBeInTheDocument();

    // the material row opens the Immersive Reader (no stored progress → 打开)
    // — the name is matched loosely: the icon's JSX spacer leaves a leading space
    const readerLink = screen.getByRole("link", { name: new RegExp(zh("common.open")) });
    expect(readerLink).toHaveAttribute("href", `/read/${MATERIAL_ID}`);

    // the ring carries the task's own rollup — the SERVER score, 0 with no evidence
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
    unmount();
  });

  it("quiz tile: opens the launcher dialog wired to the task surface — mode select only, the single material IS the scope (no scope picker)", async () => {
    sessionBlobs.put(MATERIAL_ID, markdownFile("lecture-04.md"));
    renderTaskHome();

    fireEvent.click(await screen.findByTestId("task-quiz-tile"));
    expect(await screen.findByTestId("quiz-launcher")).toBeInTheDocument();
    // the mode select is here (all three radios)…
    expect(screen.getByTestId("quiz-mode-open")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-mode-choice")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-mode-mix")).toBeInTheDocument();
    // …but the scope picker is not: 「整个计划」 would be a lie on a task surface
    expect(screen.queryByTestId("quiz-scope-plan")).not.toBeInTheDocument();
    expect(screen.getByTestId("quiz-launcher-start")).toBeInTheDocument();

    // the wiring is the task surface's contract: task-owned (AD-6 — planId
    // never rides; the session is created with taskId set), the single node,
    // the task's materials
    const props = quizSeam.launcherProps.at(-1);
    expect(props.taskId).toBe(TASK_ID);
    expect(props.nodeIds).toEqual([NODE_ID]);
    expect(props.materials.map((m: { id: string }) => m.id)).toEqual([MATERIAL_ID]);
  });

  it("flashcards tile, no cards yet: opens the FlashcardLauncher dialog (generation entry)", async () => {
    sessionBlobs.put(MATERIAL_ID, markdownFile("lecture-04.md"));
    renderTaskHome({ cards: [] });

    fireEvent.click(await screen.findByTestId("task-flashcards-tile"));
    expect(await screen.findByTestId("flashcards-launcher")).toBeInTheDocument();
    expect(screen.getByTestId("flashcards-launcher-start")).toBeInTheDocument();
    // the deck's one source is the task's own parsed material
    expect(screen.getByTestId(`flashcards-source-${MATERIAL_ID}`)).toBeInTheDocument();
    // navigation was NOT the tile's answer — the dialog keeps the user on Task Home
    expect(screen.queryByTestId("flashcards-landing")).not.toBeInTheDocument();
  });

  it("flashcards tile with an existing deck: 「继续学习」 goes straight to the study route (no silent duplication)", async () => {
    sessionBlobs.put(MATERIAL_ID, markdownFile("lecture-04.md"));
    renderTaskHome({ cards: [serverCard("c-1", "deck-one-a")] });

    // the tile re-labels to the continue state (T3's policy mirrored)
    const tile = await screen.findByTestId("task-flashcards-tile");
    expect(tile.textContent).toContain(zh("flashcards.tileContinue"));
    expect(tile.textContent).toContain(zhN("flashcards.tileContinueDesc", 1));
    fireEvent.click(tile);
    expect(await screen.findByTestId("flashcards-landing")).toBeInTheDocument();
  });

  it("evidence popover on a fresh task names the honest empty state and the shared rule", async () => {
    sessionBlobs.put(MATERIAL_ID, markdownFile("lecture-04.md"));
    renderTaskHome();
    fireEvent.click(await screen.findByRole("button", { name: zh("plans.viewEvidenceAria") }));
    expect(await screen.findByText(zh("plans.noEvidence"))).toBeInTheDocument();
    expect(screen.getByText(zh("plans.evidenceRule"))).toBeInTheDocument();
    expect(screen.queryByText(zhN("tasks.cap99Note", 3))).not.toBeInTheDocument();
  });

  it("partial state: the server's capped 99 renders on row + ring, glyph reads partial, popover names the cap", async () => {
    sessionBlobs.put(MATERIAL_ID, markdownFile("lecture-04.md"));
    renderTaskHome({
      task: { __typename: "StudyTask", id: TASK_ID, materialId: MATERIAL_ID, nodeId: NODE_ID, createdAt: "2026-11-01T00:00:00Z", node: serverNode("99", "partial") },
      evidence: [serverEvidence("ev-1", "correct", "2026-11-02T10:00:00Z")],
    });

    expect((await screen.findAllByText("99%")).length).toBeGreaterThan(0); // node row + ring text
    expect(screen.getByRole("img", { name: zhN("plans.masteryAria", 99) })).toBeInTheDocument();
    expect(screen.getByText(zh("plans.statePartial"))).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: zh("plans.viewEvidenceAria") }));
    expect(await screen.findByText(zhN("tasks.cap99Note", MASTERY_CONFIG.evidenceGate))).toBeInTheDocument();
    expect(screen.getByText(zh("plans.evidenceRule"))).toBeInTheDocument();
  });

  it("mastered state: 100 renders, glyph reads mastered, ring shows the readiness label", async () => {
    sessionBlobs.put(MATERIAL_ID, markdownFile("lecture-04.md"));
    renderTaskHome({
      task: { __typename: "StudyTask", id: TASK_ID, materialId: MATERIAL_ID, nodeId: NODE_ID, createdAt: "2026-11-01T00:00:00Z", node: serverNode("100", "mastered") },
      evidence: [
        serverEvidence("ev-1", "correct", "2026-11-02T10:00:00Z"),
        serverEvidence("ev-2", "correct", "2026-11-03T10:00:00Z"),
        serverEvidence("ev-3", "correct", "2026-11-04T10:00:00Z"),
      ],
    });

    expect((await screen.findAllByText("100%")).length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: zhN("plans.masteryAria", 100) })).toBeInTheDocument();
    expect(screen.getByText(zh("plans.stateMastered"))).toBeInTheDocument();
    expect(screen.getByText(zh("plans.readyLabel"))).toBeInTheDocument(); // ring's 已备绪 pill

    // gate met → the popover lists the marks and never claims the cap
    fireEvent.click(screen.getByRole("button", { name: zh("plans.viewEvidenceAria") }));
    // the marks (sr-only labels) + the legend all carry the outcome's name
    expect((await screen.findAllByText(zh("plans.outcomeCorrect"))).length).toBeGreaterThan(0);
    expect(screen.queryByText(zhN("tasks.cap99Note", 3))).not.toBeInTheDocument();
  });

  it("byteless material after a reload: the row names the contract and re-upload restores the honest state", async () => {
    // metadata persists (the api row), the session bytes are gone — no
    // sessionBlobs.put seed, so the row must show the re-upload contract
    const { container } = renderTaskHome();

    expect(await screen.findByText(zh("plans.materialReupload"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: zh("plans.materialReuploadAction") }));
    fireEvent.change(fileInputOf(container), { target: { files: [markdownFile("lecture-04.md")] } });

    // the same-kind re-upload puts fresh session bytes back — the parsed chip
    // (persisted sections stay the truth) replaces the re-upload contract
    await waitFor(() => expect(screen.getByText(zhN("plans.parseParsed", 1))).toBeInTheDocument());
    expect(screen.queryByText(zh("plans.materialReupload"))).not.toBeInTheDocument();
    expect(sessionBlobs.has(MATERIAL_ID)).toBe(true);
    // the parsed row never re-parses; the bytes refresh through a fresh presign
    expect(parseSeam.calls).toHaveLength(0);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
  });

  it("material row wraps at narrow widths: kind/size chips hide below sm and the re-upload cluster stays in the row (FR-29 at 390px)", async () => {
    const { container } = renderTaskHome(); // byteless → re-upload cluster visible

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
    const { container } = renderTaskHome();

    fireEvent.click(await screen.findByRole("button", { name: zh("plans.materialReuploadAction") }));
    fireEvent.change(fileInputOf(container), {
      target: { files: [new File(["%PDF-"], "wrong.pdf", { type: "application/pdf" })] },
    });

    expect(await screen.findByText(zh("reader.reuploadKindMismatch"))).toBeInTheDocument();
    // nothing moved: the row keeps its re-upload contract, no bytes, no presign
    expect(screen.getByText(zh("plans.materialReupload"))).toBeInTheDocument();
    expect(sessionBlobs.has(MATERIAL_ID)).toBe(false);
    expect(parseSeam.calls).toHaveLength(0);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
