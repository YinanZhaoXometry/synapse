/**
 * Auto-mapping selection (epic-34 T3; FR-45's automation half; GLOSSARY
 * Auto-mapping): the PURE derivations behind the plan-page effect.
 *
 * `autoMappingTargets` is the fire-selection: materials × the plan-wide
 * mapping rows × this mount session's fired set (+ the cap posture) → the
 * materials to run ONE existing mapping mutation for. The binding criteria
 * per material: `parseState === "parsed"` ∧ sections present ∧ ZERO mapping
 * rows (any status counts — confirmed/rejected decisions are never
 * re-proposed, and even a rejected-only history means the model already had
 * its turn) ∧ not fired this session. Undefined inputs (a read still
 * loading) select nothing — "zero rows" is not known before the mapping
 * read lands. A cap-exhausted session selects nothing at all.
 *
 * `unmappedNodeCount` is the coverage-honesty summary: plan nodes with zero
 * CONFIRMED rows (a proposal is not a decision). The material-mapping axis
 * (GLOSSARY Unmapped node) — the wording never touches the mastery axis's
 * 「uncovered」.
 */
import type { KnowledgeNodeView, MaterialNodeMappingView, MaterialView } from "@/api/views";

export function autoMappingTargets(
  materials: MaterialView[] | undefined,
  mappingRows: MaterialNodeMappingView[] | undefined,
  fired: ReadonlySet<string>,
  capReached: boolean,
): MaterialView[] {
  if (!materials || !mappingRows || capReached) return [];
  const materialIdsWithRows = new Set(mappingRows.map((row) => row.materialId));
  return materials.filter(
    (material) =>
      material.parseState === "parsed" &&
      material.sections.length > 0 &&
      !materialIdsWithRows.has(material.id) &&
      !fired.has(material.id),
  );
}

export function unmappedNodeCount(nodes: KnowledgeNodeView[], mappingRows: MaterialNodeMappingView[]): number {
  const confirmedNodeIds = new Set(
    mappingRows.filter((row) => row.status === "confirmed" && row.nodeId).map((row) => row.nodeId),
  );
  return nodes.filter((node) => !confirmedNodeIds.has(node.id)).length;
}
