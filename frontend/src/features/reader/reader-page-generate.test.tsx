/**
 * The ONE-SHOT stream-now command's ReaderPage seam (epic-36 review F4):
 * ?generate=1 on a loaded lesson row is consumed EXACTLY once (start(false)
 * dispatched once) and the param is STRIPPED from the URL — a refresh or a
 * re-mount without the param never re-streams (no auto-resume without the
 * explicit command, spec decision 9). Hook mocks per the AppLayout
 * convention (honest-empty reads, the stream hook itself is the spy).
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import type { MaterialView } from "@/api/views";

const { startSpy, lessonFixture } = vi.hoisted(() => ({
  startSpy: vi.fn(),
  lessonFixture: {
    id: "lesson-1",
    title: "共识协议讲义",
    kind: "markdown",
    sizeBytes: 0,
    planId: "plan-1",
    taskId: null,
    attachmentScope: "plan",
    nodeId: null,
    parseState: "parsed",
    sections: [ { id: "ch-1", title: "第一章", text: "第一章正文。" } ],
    createdAt: "2026-11-12T00:00:00Z",
    downloadUrl: null,
    origin: "generated",
    generation: {
      variant: "material",
      sourceMaterialIds: [ "src-1" ],
      outline: [
        { id: "ch-1", title: "第一章", anchors: [ { materialId: "src-1", sectionId: "sec-1" } ], status: "ready" },
        { id: "ch-2", title: "第二章", anchors: [], status: "pending" },
      ],
      pausedKind: null,
      generatedAt: "2026-11-12T00:00:00Z",
    },
  } as MaterialView,
}));

// The reader's wire reads ride honest-empty (the drawer test's posture) —
// the lesson fixture rides useMaterialQuery alone (a parsed generated row).
vi.mock("@/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useMaterialQuery: () => ({ data: lessonFixture, loading: false, refetch: vi.fn(async () => undefined) }),
  usePlanQuery: () => ({ loading: false, data: undefined }),
  useMaterialNodeMappingsQuery: () => ({ data: undefined, loading: false, error: undefined }),
  useSectionMarkingsQuery: () => ({ data: undefined, loading: false }),
  useClaimSectionMutation: () => [vi.fn()],
  useUnclaimSectionMutation: () => [vi.fn()],
  useAnnotationsQuery: () => ({ data: undefined }),
  useAddAnnotationMutation: () => [vi.fn()],
  useRemoveAnnotationMutation: () => [vi.fn()],
  useStudyFocusQuery: () => ({ data: undefined }),
  useGenerateStudyFocusMutation: () => [vi.fn(), { loading: false }],
  useReadingProgressQuery: () => ({ data: undefined, loading: false }),
  usePlanMaterialsQuery: () => ({ data: undefined }),
  useSetMaterialParseResultMutation: () => [vi.fn()],
}));

// The stream hook IS the unit under observation — the page must dispatch
// start exactly once per consumed command and never on its own initiative.
vi.mock("./use-lesson-stream", () => ({
  useLessonStream: vi.fn(() => ({ start: startSpy, streaming: false, activeSectionId: null, streamText: null })),
}));
// The position tracker, companion surfaces, and the quick-test flow are out
// of scope here — pinned inert so the page mounts standalone (the flow needs
// the Apollo context).
vi.mock("./use-reading-position", () => ({
  useReadingPositionTracker: () => ({ report: vi.fn(), currentPositionRef: { current: null } }),
}));
vi.mock("./quick-test-flow", () => ({
  QuickTestFlow: () => null,
}));
vi.mock("./companion-surfaces", () => ({
  CompanionOverlay: () => null,
  CompanionSheet: () => null,
}));
vi.mock("@/features/companion/CompanionPanel", () => ({
  CompanionPanel: () => null,
}));

import ReaderPage from "./ReaderPage";

/** The live URL inside the test router — the strip assertion's probe. */
function LocationProbe() {
  const location = useLocation();
  return <p data-testid="loc-search">{location.search}</p>;
}

function mountReader(initialEntry: string) {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/read/:materialId" element={<ReaderPage />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </LanguageProvider>,
  );
}

const remountTree = (
  <LanguageProvider>
    <MemoryRouter initialEntries={["/read/lesson-1"]}>
      <Routes>
        <Route path="/read/:materialId" element={<ReaderPage />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  </LanguageProvider>
);

describe("ReaderPage — the one-shot ?generate=1 stream command (review F4)", () => {
  beforeEach(() => {
    startSpy.mockClear();
  });

  it("mounts with ?generate=1 on a loaded lesson row: start(false) exactly once AND the param stripped from the URL", () => {
    mountReader("/read/lesson-1?generate=1");

    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(startSpy).toHaveBeenCalledWith(false);
    expect(screen.getByTestId("loc-search")).toHaveTextContent(""); // consume-once: the URL drops the command
  });

  it("mounts without the param: the stream never starts (resume stays explicit) — across a re-render too", () => {
    const { rerender } = mountReader("/read/lesson-1");
    expect(startSpy).not.toHaveBeenCalled();

    rerender(remountTree);
    expect(startSpy).not.toHaveBeenCalled(); // a re-visit without the command shows the honest 继续 posture, never a stream
  });
});
