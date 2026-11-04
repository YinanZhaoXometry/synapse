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
