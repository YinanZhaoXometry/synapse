/**
 * One Plan-Home node row (epic P2-10 T3, FR-6/7; T4 swaps the data source):
 * the state rides the SHARED node-state contract (node-state.ts — SERVER
 * fields rendered, never recomputed, AD-14), and the row carries the node's
 * click-through: ≥1 confirmed mapping → the reader at the mapped section
 * through the anchor channel (single target = a direct link; several = a jump
 * menu listing the mapped sections BY TITLE); otherwise — or by choice, the
 * secondary action — the node Quick Test into the plan flow
 * (/plan/:planId/quiz?nodeId=<id>). The actions render through the shared
 * NodeActions (node-actions.tsx) — the graph's detail sheet uses the same.
 *
 * T4 BINDING (ticket 03's Comments): the row's mappings ride the PLAN-SCOPE
 * batch read (usePlanNodeMappingsQuery at PlanHomePage — the per-row
 * materialNodeMappings(nodeId:) read was an eager N+1 at the 30+ node bar),
 * passed down pre-read; the row filters its own node's rows (same wire shape
 * — every status rides, nodeJumpTargets filters confirmed). While the batch
 * read is in flight there is no honest action to show; a failed read falls
 * back to the always-valid Quick Test (the docstring's promise — the row
 * never renders with NO click-through). The evidence popover is unchanged
 * (the marks are presentation over evidence, never a score). Keyboard-
 * complete (AD-9): every action is a native link/button.
 */
import { Sparkles } from "lucide-react";
import EvidenceMarks from "./evidence-marks";
import { useLanguage } from "@/contexts/LanguageContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { MaterialNodeMappingView, MaterialView } from "@/api/views";
import type { NodeRowView } from "./display-shaping";
import NodeActions from "./node-actions";
import { NodeStateBadge } from "./node-state-badge";
import { nodeJumpTargets } from "./node-state";

export default function NodeRow({
  view,
  planId,
  materials,
  mappings,
  mappingsFailed = false,
}: {
  view: NodeRowView;
  planId: string;
  materials: MaterialView[];
  /** The plan-scope batch rows (T4); undefined while the batch read is in flight. */
  mappings?: MaterialNodeMappingView[];
  mappingsFailed?: boolean;
}) {
  const { t } = useLanguage();
  // The node's rows off the batch, resolved into REAL jump targets (the
  // anchor channel — nodeJumpTargets filters confirmed + parsed + present).
  const targets = mappings ? nodeJumpTargets(nodeRowsFor(mappings, view.node.id), materials) : null;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <NodeStateBadge state={view.state} />
      <span className="text-sm font-medium truncate flex-1">{view.node.title}</span>
      <span className="font-display font-bold tabular-nums text-[13px] text-muted-foreground">
        {view.hasEvidence ? `${view.score}%` : "—"}
      </span>
      <NodeActions
        targets={targets}
        failed={mappingsFailed}
        planId={planId}
        nodeId={view.node.id}
        nodeTitle={view.node.title}
      />
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("plans.viewEvidenceAria")}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 text-xs">
          <p className="font-semibold mb-2">{view.node.title}</p>
          <EvidenceMarks outcomes={view.lastOutcomes} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** The node's own rows off the plan-scope batch (same shape as the per-node read answered). */
function nodeRowsFor(mappings: MaterialNodeMappingView[], nodeId: string): MaterialNodeMappingView[] {
  return mappings.filter((row) => row.nodeId === nodeId);
}
