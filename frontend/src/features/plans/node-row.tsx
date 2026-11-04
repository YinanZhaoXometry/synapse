/**
 * One Plan-Home node row (epic P2-10 T3, FR-6/7): the state rides the SHARED
 * node-state contract (node-state.tsx — SERVER fields rendered, never
 * recomputed, AD-14), and the row carries the node's click-through:
 * ≥1 confirmed mapping → the reader at the mapped section through the anchor
 * channel (single target = a direct link; several = a jump menu listing the
 * mapped sections BY TITLE); otherwise — or by choice, the secondary action —
 * the node Quick Test into the plan flow (/plan/:planId/quiz?nodeId=<id>).
 * HONEST SCOPING (ticket Comments): node-scoped quiz GENERATION lands with
 * T5's node_scope; this launch satisfies the click-through at this layer.
 * The row's mappings ride the per-node mapping read
 * (useNodeMaterialMappingsQuery): while it loads there is no honest action to
 * show; a failed read falls back to the always-valid Quick Test. The evidence
 * popover is unchanged (the marks are presentation over evidence, never a
 * score). Keyboard-complete (AD-9): every action is a native link/button.
 */
import { Link } from "react-router-dom";
import { BookOpen, ListChecks, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNodeMaterialMappingsQuery } from "@/api";
import type { MaterialView } from "@/api/views";
import { OutcomeMark } from "./atoms";
import type { NodeRowView } from "./display-shaping";
import { OUTCOME_LABEL_KEY } from "./outcome-labels";
import { NodeStateBadge } from "./node-state-badge";
import { nodeJumpTargets, nodePrimaryAction, nodeQuickTestHref } from "./node-state";
import type { NodePrimaryAction } from "./node-state";

const ACTION_CLASS =
  "inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink cursor-pointer hover:underline flex-none";

export default function NodeRow({ view, planId, materials }: { view: NodeRowView; planId: string; materials: MaterialView[] }) {
  const { t } = useLanguage();
  const mappingsQuery = useNodeMaterialMappingsQuery(view.node.id);
  const quickTestHref = nodeQuickTestHref(planId, view.node.id);
  // While the read is in flight there is no honest action to show (the
  // primary action DEPENDS on it — flip once, never lie); a FAILED read falls
  // back to the always-valid Quick Test (the docstring's promise — the row
  // never renders with NO click-through). Stale data on a refetch failure
  // still wins: real mappings beat the fallback.
  const targets = mappingsQuery.data ? nodeJumpTargets(mappingsQuery.data, materials) : null;
  const action: NodePrimaryAction | null = targets
    ? nodePrimaryAction(targets, planId, view.node.id)
    : mappingsQuery.error
      ? { kind: "quiz", href: quickTestHref }
      : null;
  const quickTestAria = t("plans.nodeQuickTestAria", { node: view.node.title });

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <NodeStateBadge state={view.state} />
      <span className="text-sm font-medium truncate flex-1">{view.node.title}</span>
      <span className="font-display font-bold tabular-nums text-[13px] text-muted-foreground">
        {view.hasEvidence ? `${view.score}%` : "—"}
      </span>
      {action?.kind === "study" && action.targets.length === 1 && (
        <Link
          to={action.targets[0].href}
          aria-label={t("plans.nodeStudyAria", { node: view.node.title })}
          data-testid="node-study-action"
          className={ACTION_CLASS}
        >
          <BookOpen className="w-3 h-3" aria-hidden="true" /> {t("plans.nodeStudyAction")}
        </Link>
      )}
      {action?.kind === "study" && action.targets.length > 1 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t("plans.nodeJumpMenuAria", { node: view.node.title })}
              aria-haspopup="menu"
              data-testid="node-jump-trigger"
              className={ACTION_CLASS}
            >
              <BookOpen className="w-3 h-3" aria-hidden="true" /> {t("plans.nodeStudyAction")}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 text-xs" onOpenAutoFocus={(e) => e.preventDefault()}>
            <p className="eyebrow mb-1.5">{t("plans.nodeJumpMenuLabel")}</p>
            <div className="flex flex-col gap-1" role="menu" aria-label={t("plans.nodeJumpMenuAria", { node: view.node.title })}>
              {action.targets.map((target) => (
                <Link
                  key={target.mappingId}
                  to={target.href}
                  role="menuitem"
                  data-testid="node-jump-item"
                  className="flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-[var(--glass-2)] text-foreground cursor-pointer"
                >
                  <BookOpen className="w-3 h-3 text-accent-ink flex-none" aria-hidden="true" />
                  <span className="truncate">{target.title ?? target.sectionId}</span>
                </Link>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
      {action && (
        <Link
          to={action.kind === "quiz" ? action.href : quickTestHref}
          aria-label={quickTestAria}
          data-testid="node-quick-test"
          className={ACTION_CLASS}
        >
          <ListChecks className="w-3 h-3" aria-hidden="true" /> {t("plans.nodeQuickTest")}
        </Link>
      )}
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
          <div className="flex items-center gap-1.5 mb-2">
            {view.lastOutcomes.length === 0 ? (
              <span className="text-muted-foreground">{t("plans.noEvidence")}</span>
            ) : (
              view.lastOutcomes.map((outcome, i) => <OutcomeMark key={`${outcome}-${i}`} outcome={outcome} />)
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mb-2 text-[10px] text-muted-foreground">
            {(["correct", "partial", "wrong"] as const).map((outcome) => (
              <span key={outcome} className="inline-flex items-center gap-1">
                <OutcomeMark outcome={outcome} small />
                {t(OUTCOME_LABEL_KEY[outcome])}
              </span>
            ))}
          </div>
          <p className="text-muted-foreground leading-[1.5]">{t("plans.evidenceRule")}</p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
