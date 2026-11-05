/**
 * The Quick Test gate + scope naming (FR-14, epic-13 T2; the kickoff delta
 * decision 4, AD-6): a section/selection Quick Test generates NODE-attributed
 * evidence only where the material carries ≥1 CONFIRMED section→node mapping,
 * so the mapping read's outcome resolves the gate the selection bar renders.
 * Pure module (no component exports — react-refresh; the flow component is
 * the consumer, quick-test-flow.tsx).
 */
import type { MaterialNodeMappingView } from "@/api/views";
import type { QuickTestScope } from "./quick-test-seam";

/**
 * The gate state, resolved purely from the mapping read's outcome (the
 * selection bar's `quickTestGate` input; ReaderPage hands it through).
 * `undefined` data means the read has not LANDED — in-flight ("loading", no
 * premature clicks) or failed ("error", the fallback posture); a landed read
 * with no node-attached confirmed row is "none" (the traceable hint),
 * otherwise "ready" (the dispatch enables).
 */
export type QuickTestGateState = "loading" | "error" | "none" | "ready";

export function quickTestGate(
  data: MaterialNodeMappingView[] | undefined,
  error: unknown,
): QuickTestGateState {
  if (data === undefined) return error ? "error" : "loading";
  return data.some((row) => row.status === "confirmed" && row.nodeId) ? "ready" : "none";
}

/** The selection's section id under the parse convention (markdown slug |
 * PDF `page-N` — the same ids mappings and questions cite). */
export function quickTestSectionId(selection: QuickTestScope["selection"]): string {
  return selection.kind === "markdown" ? selection.sectionId : `page-${selection.page}`;
}
