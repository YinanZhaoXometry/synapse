import "@testing-library/jest-dom";

import { forceSimulatedCompanion } from "@/ai/seam-preference";

// AD-18 (epic P2-8 T5): the whole vitest suite runs the AI seam against the
// deterministic simulated double — offline, no server, every AI-adjacent spec
// unmodified. ONE explicit flip here; the runtime app never calls it and gets
// the server adapter. (The flag is a dependency-free leaf on purpose — this
// bootstrap must not drag the adapter's Apollo/stream graph into the module
// registry before a test file's vi.mock factories register.)
forceSimulatedCompanion();

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom 20 ships neither ResizeObserver nor IntersectionObserver; today
// nothing in the render tree invokes them only because recharts/responsive
// components happen not to mount them in the exercised paths (epic P3-17
// ticket 04). Stub both so any future observer-dependent component fails on
// behavior, not on a missing constructor.
class ResizeObserverStub {
  observe: () => void = () => {};
  unobserve: () => void = () => {};
  disconnect: () => void = () => {};
}

class IntersectionObserverStub {
  root: Element | null = null;
  rootMargin: string = "0px";
  thresholds: readonly number[] = [0];
  observe: () => void = () => {};
  unobserve: () => void = () => {};
  disconnect: () => void = () => {};
  takeRecords: () => IntersectionObserverEntry[] = () => [];
}

if (typeof window.ResizeObserver === "undefined") {
  (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    ResizeObserverStub as unknown as typeof ResizeObserver;
}
if (typeof window.IntersectionObserver === "undefined") {
  (window as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
    IntersectionObserverStub as unknown as typeof IntersectionObserver;
}

// jsdom ships no scrollIntoView either; cmdk's selection scrolling invokes it
// on every item registration (epic-33 T2's palette). A no-op stub matches the
// headless reality — the call exists purely to bring the selection on-screen.
if (typeof Element.prototype.scrollIntoView === "undefined") {
  Element.prototype.scrollIntoView = () => {};
}
