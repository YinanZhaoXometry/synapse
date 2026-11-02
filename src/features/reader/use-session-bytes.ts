/**
 * Reader-side byte-presence read over the session-blob registry (AD-4/AD-2):
 * the mirror of features/plans' use-session-blob, built directly on @/data —
 * the reader must not import plans internals. Re-renders when the material's
 * bytes arrive (attach / re-upload) or the id is re-put, so the re-upload
 * contract stays declarative.
 */
import { useSyncExternalStore } from "react";
import { sessionBlobs } from "@/data";

const subscribe = (onStoreChange: () => void) => sessionBlobs.subscribe(onStoreChange);

export function useSessionBytes(materialId: string): boolean {
  return useSyncExternalStore(subscribe, () => sessionBlobs.has(materialId));
}
