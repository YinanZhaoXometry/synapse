/**
 * React seam for the eager parse (AD-7 "callable from plan/task upload flows"):
 * drives the parse state machine pending|failed → parsing → parsed|failed and
 * keeps the material rows fresh via the codebase's TanStack Query invalidation
 * pattern. Retry reuses the same mutation — it only runs while the session
 * bytes exist (after a reload the rows show the re-upload contract instead).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { markMaterialParsing, queryKeys, sessionBlobs } from "@/data";
import { useLanguage } from "@/contexts/LanguageContext";
import { parseFromSessionBlob } from "./parse-material";

export function useParseMaterialMutation() {
  const qc = useQueryClient();
  const { language } = useLanguage();
  return useMutation({
    mutationFn: async (materialId: string) => {
      if (!sessionBlobs.has(materialId)) return; // bytes gone — nothing honest to parse
      markMaterialParsing(materialId); // repo write: pending|failed → parsing
      void qc.invalidateQueries({ queryKey: queryKeys.materials.all }); // rows show the parsing chip
      await parseFromSessionBlob(materialId, { language });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.materials.all }); // parsed | failed chip
    },
  });
}
