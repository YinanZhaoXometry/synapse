/**
 * The parse(file) → Material bridge for the attach flows (AD-7 eager parse):
 * reads a registered material's session-only bytes, runs the public parse, and
 * writes the honest outcome back through the repository. Returns null when the
 * bytes are already gone (reload) — that is the re-upload contract, never a
 * fake parse. The pending|failed → parsing transition is the caller's (the
 * mutation hook), so this stays a plain async function, testable without React.
 */
import { getMaterial, sessionBlobs, setMaterialParseResult } from "@/data";
import type { UiLanguage } from "@/ai/types";
import { parseFile, type ParseOutcome } from "./parse";

export async function parseFromSessionBlob(
  materialId: string,
  options: { language?: UiLanguage } = {},
): Promise<ParseOutcome | null> {
  const material = getMaterial(materialId);
  const blob = sessionBlobs.get(materialId);
  if (!material || !blob) return null;
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const outcome = await parseFile({ bytes, kind: material.kind, language: options.language });
    setMaterialParseResult(materialId, outcome);
    return outcome;
  } catch {
    // blob.arrayBuffer() is the only step parseFile does not already guard.
    const outcome: ParseOutcome = { sections: [], state: "failed", reason: "unknown" };
    setMaterialParseResult(materialId, outcome);
    return outcome;
  }
}
