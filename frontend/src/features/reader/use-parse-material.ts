/**
 * React seam for the eager parse (AD-7 "callable from plan/task upload flows"):
 * drives the parse state machine pending|failed → parsing → parsed|failed over
 * the SetMaterialParseResult mutation. Bytes resolve session-first (the
 * attach/re-upload flow's registry); with no session copy the row's presigned
 * downloadUrl re-fetches the server copy (post-reload re-parse, epic P2-6);
 * neither → resolve nothing honestly (the re-upload contract, never a fake
 * parse). The parsing chip paints through the optimistic response while the
 * client-side parse runs; the final write-back returns the full material and
 * Apollo lands it in the cache. Retry reuses the same flow — it only runs
 * while bytes exist somewhere.
 */
import { useCallback } from "react";
import { toast } from "sonner";
import { sessionBlobs, useSetMaterialParseResultMutation } from "@/api";
import type { MaterialView } from "@/api/views";
import { useLanguage } from "@/contexts/LanguageContext";
import type { SetMaterialParseResultMutation } from "@/types/graphql";
import { parseMaterialBytes } from "./parse-material";

export function useParseMaterialMutation(material?: MaterialView | null | undefined) {
  const [setParseResult] = useSetMaterialParseResultMutation();
  const { language, t } = useLanguage();

  const mutate = useCallback(
    // Two call shapes: a row-scoped instance (MaterialRow) calls mutate(id)
    // against its bound material; flow callers (the attach flow) hand the
    // freshly-attached row explicitly — mutate(id, row).
    (materialId: string, rowOverride?: MaterialView) => {
      const row = rowOverride ?? material;
      if (!row || row.id !== materialId) return; // no honest row to write back against
      void (async () => {
        // Byte resolution: session registry first, then the server copy via the
        // presigned GET — landed in the registry so every reader path rides it.
        let blob = sessionBlobs.get(materialId);
        if (!blob && row.downloadUrl) {
          try {
            const response = await fetch(row.downloadUrl);
            if (response.ok) {
              blob = await response.blob();
              sessionBlobs.put(materialId, blob);
            }
          } catch {
            blob = undefined; // fetch failed — the re-upload contract stays honest
          }
        }
        if (!blob) return; // bytes gone, no server copy — nothing honest to parse

        // Optimistic flip: pending|failed → parsing so rows show the parsing
        // chip while the client-side parse runs. The wire's write-back states
        // are parsed|failed only, so this ride is a local paint (the server
        // rejects a parsing state); the final mutation below lands the truth.
        // The paint carries __typename (normalized ids) — the generated data
        // type omits them, hence the targeted cast (Apollo's own
        // optimisticResponse TS pattern).
        const parsingPaint = {
          setMaterialParseResult: {
            __typename: "SetMaterialParseResultPayload",
            material: {
              __typename: "Material",
              id: row.id,
              title: row.title,
              kind: row.kind,
              sizeBytes: row.sizeBytes,
              planId: row.planId,
              taskId: row.taskId,
              parseState: "parsing",
              parseFailureReason: null,
              createdAt: row.createdAt,
              downloadUrl: row.downloadUrl,
              sections: row.sections.map((section) => ({
                __typename: "MaterialSection",
                ...section,
              })),
            },
          },
        } as unknown as SetMaterialParseResultMutation;
        await setParseResult({
          variables: { input: { id: materialId, state: "parsing", sections: [] } },
          optimisticResponse: parsingPaint,
        }).catch(() => undefined); // the paint is the point; the wire rejection is corrected below

        const outcome = await parseMaterialBytes(row, blob, { language });
        if (!outcome) return;
        await setParseResult({
          variables: {
            input: {
              id: materialId,
              state: outcome.state,
              sections: outcome.sections,
              reason: outcome.reason,
            },
          },
        }).catch(() => {
          // Never silent: the parse succeeded locally but the write-back
          // failed — same failure class as progress/chat persistence, same
          // neutral retry toast (the row keeps its honest pre-parse state).
          toast.error(t("errors.persistFailed"));
        });
      })();
    },
    [material, language, t, setParseResult],
  );

  return { mutate };
}
