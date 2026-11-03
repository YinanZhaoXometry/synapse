/**
 * Declarative presence read over the session-blob registry (review fix): rows
 * re-render when bytes arrive (attach / re-upload) or the row's id is (re)put —
 * no manual tick state after `sessionBlobs.put`. The registry itself stays
 * session-only and outside Query by design; the snapshot is the plain boolean
 * `has(id)`, so identity stays stable across reads.
 */
import { useSyncExternalStore } from "react";
import { sessionBlobs } from "@/data";

const subscribe = (onStoreChange: () => void) => sessionBlobs.subscribe(onStoreChange);

export function useSessionBlob(materialId: string): boolean {
  return useSyncExternalStore(subscribe, () => sessionBlobs.has(materialId));
}
