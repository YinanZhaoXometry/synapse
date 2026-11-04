/**
 * The AI seam's implementation-preference flag (epic P2-8 T5, AD-18) — a
 * dependency-free leaf so the vitest bootstrap (src/test/setup.ts) can flip
 * the whole suite to the simulated double WITHOUT dragging the adapter's
 * Apollo/stream import chain into the pre-test module graph (test-file
 * vi.mock factories must register before those modules load — the T4
 * harness depends on that order).
 *
 * The runtime app never imports this module; the factory in
 * companion-service.ts reads the flag and defaults to the server adapter.
 */
let preferSimulated = false;

/** The vitest flip: every AI-adjacent spec runs against the double. */
export function forceSimulatedCompanion(): void {
  preferSimulated = true;
}

/** The factory's read side. */
export function prefersSimulatedCompanion(): boolean {
  return preferSimulated;
}
