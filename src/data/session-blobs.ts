/**
 * Session-only blob store (AD-4, owner decision 2026-11-02): Material file
 * bytes live in memory for the tab's lifetime and are GONE on reload — the
 * user re-uploads. Everything else about a Material persists in synapse-db.
 * Nothing here ever touches localStorage.
 *
 * The registry stays session-only and outside React Query by design; the
 * subscribe/notify pair exists purely so UI can observe presence via
 * `useSyncExternalStore` (see features/plans/use-session-blob.ts) instead of
 * manual re-render ticks.
 */
export interface SessionBlobRegistry {
  put(materialId: string, blob: Blob): void;
  get(materialId: string): Blob | undefined;
  has(materialId: string): boolean;
  /** Store-subscription seam for useSyncExternalStore; returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
}

export function createSessionBlobRegistry(): SessionBlobRegistry {
  const blobs = new Map<string, Blob>();
  const listeners = new Set<() => void>();
  return {
    put: (id, blob) => {
      blobs.set(id, blob);
      for (const listener of listeners) listener();
    },
    get: (id) => blobs.get(id),
    has: (id) => blobs.has(id),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The app-wide registry — fresh memory each page load, by design. */
export const sessionBlobs = createSessionBlobRegistry();
