/**
 * The node click-through actions (FR-7, epic P2-10 T3 — T4 folds the roadmap
 * graph's detail onto the SAME implementation; epic-34 T2 replaces the old
 * mapping-gated 「问 AI 导师」 reader jump with the ALWAYS-rendered 「AI 讲解」
 * teaching entry): the study link (one confirmed mapping), the jump menu
 * (several, listed BY TITLE), the always-reachable node Quick Test secondary,
 * and the always-reachable teach action — it opens the plan Companion drawer
 * through the plan page shell (onTeach) with a short prefill the user sends
 * themselves (no silent AI spend), mapped or not (GLOSSARY AI 讲解: never
 * mapping-gated). ONE implementation for every node-shaped surface — the
 * PlanHome tree row and the graph's hover strip + detail sheet render this
 * verbatim.
 *
 * The targets ride the REAL anchor builders (AD-8, node-state.ts consumed
 * verbatim). In flight (`targets` null, `failed` false) there is no honest
 * study/quiz action to show; a failed read falls back to the always-valid
 * Quick Test (the row never renders with NO click-through). HONEST SCOPING
 * (ticket Comments): node-scoped quiz GENERATION lands with T5's node_scope.
 */
import { Link } from "react-router-dom";
import { BookOpen, ListChecks, MessageCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { nodePrimaryAction, nodeQuickTestHref, type NodeJumpTarget, type NodePrimaryAction } from "./node-state";

const ACTION_CLASS =
  "inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink cursor-pointer hover:underline flex-none";

export default function NodeActions({
  targets,
  failed,
  planId,
  nodeId,
  nodeTitle,
  onTeach,
}: {
  targets: NodeJumpTarget[] | null;
  failed: boolean;
  planId: string;
  nodeId: string;
  nodeTitle: string;
  /** The AI 讲解 entry: the plan page shell opens its Companion drawer. */
  onTeach: (nodeId: string, nodeTitle: string) => void;
}) {
  const { t } = useLanguage();
  const quickTestHref = nodeQuickTestHref(planId, nodeId);
  const action: NodePrimaryAction | null = targets
    ? nodePrimaryAction(targets, planId, nodeId)
    : failed
      ? { kind: "quiz", href: quickTestHref }
      : null;
  const quickTestAria = t("plans.nodeQuickTestAria", { node: nodeTitle });

  return (
    <>
      {action?.kind === "study" && action.targets.length === 1 && (
        <Link
          to={action.targets[0].href}
          aria-label={t("plans.nodeStudyAria", { node: nodeTitle })}
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
              aria-label={t("plans.nodeJumpMenuAria", { node: nodeTitle })}
              aria-haspopup="menu"
              data-testid="node-jump-trigger"
              className={ACTION_CLASS}
            >
              <BookOpen className="w-3 h-3" aria-hidden="true" /> {t("plans.nodeStudyAction")}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 text-xs" onOpenAutoFocus={(e) => e.preventDefault()}>
            <p className="eyebrow mb-1.5">{t("plans.nodeJumpMenuLabel")}</p>
            <div className="flex flex-col gap-1" role="menu" aria-label={t("plans.nodeJumpMenuAria", { node: nodeTitle })}>
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
      {/* The AI 讲解 teaching entry (epic-34 T2): opens the plan Companion
          drawer pre-filled with the short teaching ask — PREFILL ONLY, the
          user presses send. ALWAYS rendered (no mapping gate — every node,
          mapped or unmapped, has a way to start learning it); the retired
          action here was the mapping-gated 「问 AI 导师」 reader jump. */}
      <button
        type="button"
        onClick={() => onTeach(nodeId, nodeTitle)}
        aria-label={t("plans.nodeTeachAria", { node: nodeTitle })}
        data-testid="node-teach"
        className={ACTION_CLASS}
      >
        <MessageCircle className="w-3 h-3" aria-hidden="true" /> {t("plans.nodeTeachAction")}
      </button>
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
    </>
  );
}
