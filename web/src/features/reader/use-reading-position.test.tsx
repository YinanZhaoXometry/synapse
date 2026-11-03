import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { getReadingProgress } from "@/data";
import { LanguageProvider } from "@/contexts/LanguageContext";
import type { Material } from "@/domain/entities";
import {
  READING_POSITION_SAVE_DEBOUNCE_MS,
  useReadingPositionTracker,
} from "./use-reading-position";

/**
 * Persistence glue (FR-10): baseline rule (the first report — the anchor or
 * restore landing — persists nothing), trailing debounce, unmount flush, and
 * the parsed-only guard. Asserted through the real repository over
 * localStorage — the save path is useSaveReadingProgressMutation, exactly the
 * production seam (which needs the LanguageProvider the app mounts: the
 * mutation toasts persistence failures in the app language). Prior art:
 * material-repository.test.ts.
 */

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

/** Wrapper owns one QueryClient for the hook's lifetime, under the same
 * LanguageProvider the app mounts (the mutation's error toast reads it). */
function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <LanguageProvider>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </LanguageProvider>
    );
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useReadingPositionTracker (FR-10 persistence glue)", () => {
  it("the first report is the baseline — the anchor/restore landing persists nothing", () => {
    const { result } = renderHook(() => useReadingPositionTracker("m1", parsedMaterial()), {
      wrapper: makeWrapper(),
    });
    act(() => result.current.report({ kind: "pdf", page: 2 }));
    act(() => {
      vi.advanceTimersByTime(READING_POSITION_SAVE_DEBOUNCE_MS * 2);
    });
    expect(getReadingProgress("m1")).toBeUndefined();
  });

  it("moving away persists debounced — locator AND the bounded section text (AD-4)", async () => {
    const { result } = renderHook(() => useReadingPositionTracker("m1", parsedMaterial()), {
      wrapper: makeWrapper(),
    });
    act(() => result.current.report({ kind: "pdf", page: 1 }));
    act(() => result.current.report({ kind: "pdf", page: 2 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(READING_POSITION_SAVE_DEBOUNCE_MS - 1);
    });
    expect(getReadingProgress("m1")).toBeUndefined(); // trailing debounce, not yet
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    const stored = getReadingProgress("m1");
    expect(stored?.position.locator).toEqual({ kind: "pdf", page: 2 });
    expect(stored?.position.text).toBe("page two 文本"); // FROM Material.sections, never raw bytes
  });

  it("rapid moves coalesce — the settled position persists, not an intermediate one", async () => {
    const { result } = renderHook(() => useReadingPositionTracker("m1", parsedMaterial()), {
      wrapper: makeWrapper(),
    });
    act(() => result.current.report({ kind: "pdf", page: 1 }));
    act(() => result.current.report({ kind: "pdf", page: 2 }));
    act(() => result.current.report({ kind: "pdf", page: 3 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(READING_POSITION_SAVE_DEBOUNCE_MS);
    });
    expect(getReadingProgress("m1")?.position.locator).toEqual({ kind: "pdf", page: 3 });
  });

  it("a wiggle that settles back on the initial view within the window writes nothing", async () => {
    const { result } = renderHook(() => useReadingPositionTracker("m1", parsedMaterial()), {
      wrapper: makeWrapper(),
    });
    act(() => result.current.report({ kind: "pdf", page: 1 }));
    act(() => result.current.report({ kind: "pdf", page: 2 }));
    act(() => result.current.report({ kind: "pdf", page: 1 })); // back at the baseline before the debounce fires
    await act(async () => {
      await vi.advanceTimersByTimeAsync(READING_POSITION_SAVE_DEBOUNCE_MS);
    });
    expect(getReadingProgress("m1")).toBeUndefined();
  });

  it("a move back to the baseline is a real change after something was persisted", async () => {
    const { result } = renderHook(() => useReadingPositionTracker("m1", parsedMaterial()), {
      wrapper: makeWrapper(),
    });
    act(() => result.current.report({ kind: "pdf", page: 1 }));
    act(() => result.current.report({ kind: "pdf", page: 2 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(READING_POSITION_SAVE_DEBOUNCE_MS);
    });
    act(() => result.current.report({ kind: "pdf", page: 1 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(READING_POSITION_SAVE_DEBOUNCE_MS);
    });
    expect(getReadingProgress("m1")?.position.locator).toEqual({ kind: "pdf", page: 1 });
  });

  it("unmount flushes a pending debounce; leaving at the baseline persists nothing", () => {
    const moved = renderHook(() => useReadingPositionTracker("m1", parsedMaterial()), {
      wrapper: makeWrapper(),
    });
    act(() => moved.result.current.report({ kind: "pdf", page: 1 }));
    act(() => moved.result.current.report({ kind: "pdf", page: 2 }));
    moved.unmount(); // before the debounce fires
    expect(getReadingProgress("m1")?.position.locator).toEqual({ kind: "pdf", page: 2 });

    localStorage.clear();
    const still = renderHook(() => useReadingPositionTracker("m1", parsedMaterial()), {
      wrapper: makeWrapper(),
    });
    act(() => still.result.current.report({ kind: "pdf", page: 2 }));
    still.unmount(); // never moved off the baseline
    expect(getReadingProgress("m1")).toBeUndefined();
  });

  it("only a parsed material persists — pending/failed parse states save nothing", async () => {
    const pending = { ...parsedMaterial(), parseState: "pending" as const, sections: [] };
    const { result, unmount } = renderHook(() => useReadingPositionTracker("m1", pending), {
      wrapper: makeWrapper(),
    });
    act(() => result.current.report({ kind: "pdf", page: 1 }));
    act(() => result.current.report({ kind: "pdf", page: 2 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(READING_POSITION_SAVE_DEBOUNCE_MS);
    });
    unmount();
    expect(getReadingProgress("m1")).toBeUndefined();
  });

  it("markdown locators persist through the same seam with their section text", async () => {
    const markdown = { ...parsedMaterial(), kind: "markdown" as const };
    const { result } = renderHook(() => useReadingPositionTracker("m1", markdown), {
      wrapper: makeWrapper(),
    });
    act(() => result.current.report({ kind: "markdown", sectionId: "page-1" }));
    act(() => result.current.report({ kind: "markdown", sectionId: "page-2" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(READING_POSITION_SAVE_DEBOUNCE_MS);
    });
    const stored = getReadingProgress("m1");
    expect(stored?.position.locator).toEqual({ kind: "markdown", sectionId: "page-2" });
    expect(stored?.position.text).toBe("page two 文本");
  });

  it("exposes the current position for the Companion (T5 surface): ref mirrors the latest report", () => {
    const { result } = renderHook(() => useReadingPositionTracker("m1", parsedMaterial()), {
      wrapper: makeWrapper(),
    });
    expect(result.current.currentPositionRef.current).toBeNull();
    act(() => result.current.report({ kind: "pdf", page: 1 }));
    expect(result.current.currentPositionRef.current).toEqual({
      locator: { kind: "pdf", page: 1 },
      text: "page one 文本",
    });
  });
});
