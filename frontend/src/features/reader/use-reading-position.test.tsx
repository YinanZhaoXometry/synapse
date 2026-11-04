import { MockedProvider } from "@apollo/client/testing/react";
import type { MockedProviderProps } from "@apollo/client/testing/react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import type { Material, ReadingLocator } from "@/domain/entities";
import {
  ReadingProgressListDocument,
  SaveReadingProgressDocument,
  SaveReadingProgressMutationVariables,
} from "@/types/graphql";
import {
  READING_POSITION_SAVE_DEBOUNCE_MS,
  useReadingPositionTracker,
} from "./use-reading-position";

/**
 * Persistence glue (FR-10): baseline rule (the first report — the anchor or
 * restore landing — persists nothing), trailing debounce, unmount flush, and
 * the parsed-only guard. Asserted through MockedProvider over the production
 * SaveReadingProgress seam: every save mock carries the EXACT variables the
 * write must carry (a mismatch misses the mock and the assertion fails), and
 * its result function records the persisted write. The refetch sweep the api
 * mutation hook declares (ReadingProgressList) is mocked one-for-one. Prior
 * art: material-repository.test.ts's debounce/baseline matrix, now riding the
 * Apollo seam instead of localStorage.
 */

type AnyMock = NonNullable<MockedProviderProps["mocks"]>[number];

const parsedMaterial = (): Material => ({
  id: "m1",
  title: "Lecture 4.pdf",
  kind: "pdf",
  sizeBytes: 10,
  planId: null,
  taskId: null,
  parseState: "parsed",
  sections: [
    { id: "page-1", title: "Page 1", text: "page one 文本" },
    { id: "page-2", title: "Page 2", text: "page two 文本" },
  ],
  createdAt: "2026-11-01T00:00:00Z",
});

/** Domain locator → the wire's ReadingLocatorInput (only the relevant fields). */
const locatorWire = (locator: ReadingLocator) =>
  locator.kind === "pdf"
    ? { kind: "pdf", page: locator.page }
    : { kind: "markdown", sectionId: locator.sectionId };

/** Server-shaped SaveReadingProgress payload for the given write (the row the
 * api returns; Apollo lands it in the cache through the normalized write).
 * Inferred shape — __typename rides along for the normalized cache write. */
const savePayload = (locator: ReadingLocator, text: string) => ({
  saveReadingProgress: {
    __typename: "SaveReadingProgressPayload",
    readingProgress: {
      __typename: "ReadingProgress",
      id: "rp-1",
      materialId: "m1",
      updatedAt: "2026-11-04T00:00:00Z",
      position: {
        __typename: "ReadingPosition",
        text,
        locator: {
          __typename: "ReadingLocator",
          kind: locator.kind,
          page: locator.kind === "pdf" ? locator.page : null,
          sectionId: locator.kind === "markdown" ? locator.sectionId : null,
        },
      },
    },
  },
});

interface PersistedWrite {
  materialId: string;
  position: { locator: unknown; text: string };
}

/** One harness per hook instance: exact-variables save mocks (one per expected
 * write, recording what it served) + the declared list-refetch mocks. */
function makeHarness(writes: Array<{ locator: ReadingLocator; text: string }>) {
  const persisted: PersistedWrite[] = [];
  const mocks: AnyMock[] = writes.map((write) => ({
    request: {
      query: SaveReadingProgressDocument,
      variables: {
        input: {
          materialId: "m1",
          position: { locator: locatorWire(write.locator), text: write.text },
        },
      } satisfies SaveReadingProgressMutationVariables,
    },
    delay: 0,
    result: (variables: SaveReadingProgressMutationVariables) => {
      persisted.push(variables.input);
      return { data: savePayload(write.locator, write.text) };
    },
  }));
  for (let i = 0; i < writes.length; i += 1) {
    mocks.push({
      request: { query: ReadingProgressListDocument, variables: {} },
      delay: 0,
      result: { data: { readingProgressList: [] } },
    });
  }
  const wrapper = function Wrapper({ children }: { children: ReactNode }) {
    return (
      <LanguageProvider>
        <MockedProvider mocks={mocks} mockLinkDefaultOptions={{ delay: 0 }}>
          {children}
        </MockedProvider>
      </LanguageProvider>
    );
  };
  return { persisted, wrapper };
}

/** Fire the debounced write AND deliver the mutation across the faked link
 * timer (MockLink schedules its response on setTimeout — faked, like the
 * debounce itself, so one async advance flushes the whole chain). */
async function flushPersistence() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(READING_POSITION_SAVE_DEBOUNCE_MS + 200);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useReadingPositionTracker (FR-10 persistence glue)", () => {
  it("the first report is the baseline — the anchor/restore landing persists nothing", async () => {
    const harness = makeHarness([]);
    const { result } = renderHook(() => useReadingPositionTracker("m1", parsedMaterial()), {
      wrapper: harness.wrapper,
    });
    act(() => result.current.report({ kind: "pdf", page: 2 }));
    await flushPersistence();
    expect(harness.persisted).toEqual([]);
  });

  it("moving away persists debounced — locator AND the bounded section text (AD-4)", async () => {
    const harness = makeHarness([{ locator: { kind: "pdf", page: 2 }, text: "page two 文本" }]);
    const { result } = renderHook(() => useReadingPositionTracker("m1", parsedMaterial()), {
      wrapper: harness.wrapper,
    });
    act(() => result.current.report({ kind: "pdf", page: 1 }));
    act(() => result.current.report({ kind: "pdf", page: 2 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(READING_POSITION_SAVE_DEBOUNCE_MS - 1);
    });
    expect(harness.persisted).toEqual([]); // trailing debounce, not yet
    await flushPersistence();
    expect(harness.persisted).toEqual([
      { materialId: "m1", position: { locator: { kind: "pdf", page: 2 }, text: "page two 文本" } },
    ]);
  });

  it("rapid moves coalesce — the settled position persists, not an intermediate one", async () => {
    // page 3 has no matching section — the extracted text is honestly empty.
    const harness = makeHarness([{ locator: { kind: "pdf", page: 3 }, text: "" }]);
    const { result } = renderHook(() => useReadingPositionTracker("m1", parsedMaterial()), {
      wrapper: harness.wrapper,
    });
    act(() => result.current.report({ kind: "pdf", page: 1 }));
    act(() => result.current.report({ kind: "pdf", page: 2 }));
    act(() => result.current.report({ kind: "pdf", page: 3 }));
    await flushPersistence();
    expect(harness.persisted).toEqual([
      { materialId: "m1", position: { locator: { kind: "pdf", page: 3 }, text: "" } },
    ]);
  });

  it("a wiggle that settles back on the initial view within the window writes nothing", async () => {
    const harness = makeHarness([]);
    const { result } = renderHook(() => useReadingPositionTracker("m1", parsedMaterial()), {
      wrapper: harness.wrapper,
    });
    act(() => result.current.report({ kind: "pdf", page: 1 }));
    act(() => result.current.report({ kind: "pdf", page: 2 }));
    act(() => result.current.report({ kind: "pdf", page: 1 })); // back at the baseline before the debounce fires
    await flushPersistence();
    expect(harness.persisted).toEqual([]);
  });

  it("a move back to the baseline is a real change after something was persisted", async () => {
    const harness = makeHarness([
      { locator: { kind: "pdf", page: 2 }, text: "page two 文本" },
      { locator: { kind: "pdf", page: 1 }, text: "page one 文本" },
    ]);
    const { result } = renderHook(() => useReadingPositionTracker("m1", parsedMaterial()), {
      wrapper: harness.wrapper,
    });
    act(() => result.current.report({ kind: "pdf", page: 1 }));
    act(() => result.current.report({ kind: "pdf", page: 2 }));
    await flushPersistence();
    act(() => result.current.report({ kind: "pdf", page: 1 }));
    await flushPersistence();
    expect(harness.persisted).toEqual([
      { materialId: "m1", position: { locator: { kind: "pdf", page: 2 }, text: "page two 文本" } },
      { materialId: "m1", position: { locator: { kind: "pdf", page: 1 }, text: "page one 文本" } },
    ]);
  });

  it("unmount flushes a pending debounce; leaving at the baseline persists nothing", async () => {
    const moved = makeHarness([{ locator: { kind: "pdf", page: 2 }, text: "page two 文本" }]);
    const first = renderHook(() => useReadingPositionTracker("m1", parsedMaterial()), {
      wrapper: moved.wrapper,
    });
    act(() => first.result.current.report({ kind: "pdf", page: 1 }));
    act(() => first.result.current.report({ kind: "pdf", page: 2 }));
    first.unmount(); // before the debounce fires
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200); // the flush write still delivers
    });
    expect(moved.persisted).toEqual([
      { materialId: "m1", position: { locator: { kind: "pdf", page: 2 }, text: "page two 文本" } },
    ]);

    const still = makeHarness([]);
    const second = renderHook(() => useReadingPositionTracker("m1", parsedMaterial()), {
      wrapper: still.wrapper,
    });
    act(() => second.result.current.report({ kind: "pdf", page: 2 }));
    second.unmount(); // never moved off the baseline
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(still.persisted).toEqual([]);
  });

  it("only a parsed material persists — pending/failed parse states save nothing", async () => {
    const pending = { ...parsedMaterial(), parseState: "pending" as const, sections: [] };
    const harness = makeHarness([]);
    const { result, unmount } = renderHook(() => useReadingPositionTracker("m1", pending), {
      wrapper: harness.wrapper,
    });
    act(() => result.current.report({ kind: "pdf", page: 1 }));
    act(() => result.current.report({ kind: "pdf", page: 2 }));
    await flushPersistence();
    unmount();
    expect(harness.persisted).toEqual([]);
  });

  it("markdown locators persist through the same seam with their section text", async () => {
    const markdown = { ...parsedMaterial(), kind: "markdown" as const };
    const harness = makeHarness([{ locator: { kind: "markdown", sectionId: "page-2" }, text: "page two 文本" }]);
    const { result } = renderHook(() => useReadingPositionTracker("m1", markdown), {
      wrapper: harness.wrapper,
    });
    act(() => result.current.report({ kind: "markdown", sectionId: "page-1" }));
    act(() => result.current.report({ kind: "markdown", sectionId: "page-2" }));
    await flushPersistence();
    expect(harness.persisted).toEqual([
      { materialId: "m1", position: { locator: { kind: "markdown", sectionId: "page-2" }, text: "page two 文本" } },
    ]);
  });

  it("exposes the current position for the Companion (T5 surface): ref mirrors the latest report", () => {
    const harness = makeHarness([]);
    const { result } = renderHook(() => useReadingPositionTracker("m1", parsedMaterial()), {
      wrapper: harness.wrapper,
    });
    expect(result.current.currentPositionRef.current).toBeNull();
    act(() => result.current.report({ kind: "pdf", page: 1 }));
    expect(result.current.currentPositionRef.current).toEqual({
      locator: { kind: "pdf", page: 1 },
      text: "page one 文本",
    });
  });
});
