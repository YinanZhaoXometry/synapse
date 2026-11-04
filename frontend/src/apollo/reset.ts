/**
 * The auth-change seam (epic P2-8 T1): login, logout, and account switches all
 * funnel through resetApiClient(). It wipes the normalized cache — no trace of
 * the previous identity's data can render (FR-4) — and terminates every live
 * SSE stream (the ai surface registers its terminators here; ticket 04 wires
 * the EventSource wrapper's registration). The cross-user isolation
 * regression test pins this contract.
 */
import { getApolloClient } from "./client";

export type StreamTerminator = () => void;

const terminators = new Set<StreamTerminator>();

/**
 * Register a live-stream killer. Returns the unsubscribe — the SSE wrapper
 * unregisters on teardown so terminators never stack across mounts.
 */
export function registerStreamTerminator(terminator: StreamTerminator): () => void {
  terminators.add(terminator);
  return () => {
    terminators.delete(terminator);
  };
}

export async function resetApiClient(): Promise<void> {
  for (const terminator of terminators) {
    terminator();
  }
  await getApolloClient().clearStore();
}
