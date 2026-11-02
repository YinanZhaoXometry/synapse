/**
 * Session-only blob store (AD-4, owner decision 2026-11-02): Material file
 * bytes live in memory for the tab's lifetime and are GONE on reload — the
 * user re-uploads. Everything else about a Material persists in synapse-db.
 * Nothing here ever touches localStorage.
 */
export interface SessionBlobRegistry {
  put(materialId: string, blob: Blob): void;
  get(materialId: string): Blob | undefined;
  has(materialId: string): boolean;
}

export function createSessionBlobRegistry(): SessionBlobRegistry {
  const blobs = new Map<string, Blob>();
  return {
    put: (id, blob) => blobs.set(id, blob),
    get: (id) => blobs.get(id),
    has: (id) => blobs.has(id),
  };
}

/** The app-wide registry — fresh memory each page load, by design. */
export const sessionBlobs = createSessionBlobRegistry();
