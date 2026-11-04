/**
 * One material row's attachment-scope controls (FR-44, epic P2-10 T2): the
 * scope chip (整个计划 / 仅节点 X — the pinned node's title resolved against
 * the plan's nodes) + the pin action (a node picker limited to the plan's
 * nodes) and the unpin/widen action (改回整个计划). Task materials render
 * nothing — the task triangle has no node pinning (the api refuses it; the
 * row has no honest scope affordance). All copy bilingual via the
 * dictionary; failure toasts map the closed api enum through
 * apiErrorKeys("scope."). Semantic tokens only — reads in both themes.
 */
import { toast } from "sonner";
import { Pin } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiErrorCode, apiErrorKeys, useSetMaterialScopeMutation } from "@/api";
import type { KnowledgeNodeView, MaterialView } from "@/api/views";
import type { ErrorLike } from "@apollo/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

/** The scope mutation's closed-enum → t() key map (one place, AD-9). */
const SCOPE_ERROR_KEYS: Record<string, string> = apiErrorKeys("scope.");
const SCOPE_FAILED_KEY = "scope.failed";

export default function MaterialScopeControls({ material, nodes }: { material: MaterialView; nodes: KnowledgeNodeView[] }) {
  const { t } = useLanguage();
  const [setScope, setScopeResult] = useSetMaterialScopeMutation();

  // The task triangle has no node pinning — render nothing rather than an
  // affordance the api would refuse.
  if (material.taskId) return null;

  const pinned = material.attachmentScope === "node";
  const pinnedNodeTitle = pinned
    ? (nodes.find((node) => node.id === material.nodeId)?.title ?? material.nodeId)
    : null;
  // The picker offers the plan's nodes only — a pin outside the material's
  // plan is refused server-side, so the UI never offers it.
  const pickerNodes = nodes.filter((node) => node.planId === material.planId);
  const canOfferPin = !pinned && !!material.planId && pickerNodes.length > 0;

  const failureToast = (error: ErrorLike | undefined) => {
    const code = apiErrorCode(error);
    toast.error(t(code ? (SCOPE_ERROR_KEYS[code] ?? SCOPE_FAILED_KEY) : SCOPE_FAILED_KEY));
  };

  const pinTo = async (node: KnowledgeNodeView) => {
    try {
      await setScope({ variables: { input: { materialId: material.id, attachmentScope: "node", nodeId: node.id } } });
      toast.success(t("scope.pinnedToast", { node: node.title }));
    } catch (error) {
      failureToast(error as ErrorLike);
    }
  };

  const widen = async () => {
    try {
      await setScope({ variables: { input: { materialId: material.id, attachmentScope: "plan" } } });
      toast.success(t("scope.widenedToast"));
    } catch (error) {
      failureToast(error as ErrorLike);
    }
  };

  return (
    <span className="flex items-center gap-1.5 flex-none" data-testid="scope-controls">
      <span
        className={cn("pill cursor-help flex-none", pinned ? "pill-partial" : "pill-muted")}
        data-testid="scope-chip"
        title={pinned ? t("scope.widenHint") : t("scope.pinHint")}
      >
        {pinned ? t("scope.chipNode", { node: pinnedNodeTitle ?? "" }) : t("scope.chipPlan")}
      </span>
      {pinned ? (
        <button
          type="button"
          onClick={() => void widen()}
          disabled={setScopeResult.loading}
          data-testid="scope-widen"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink cursor-pointer hover:underline disabled:opacity-60 disabled:cursor-wait"
        >
          {t("scope.widenAction")}
        </button>
      ) : canOfferPin ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-testid="scope-pin"
              disabled={setScopeResult.loading}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink cursor-pointer hover:underline disabled:opacity-60 disabled:cursor-wait"
            >
              <Pin className="w-3 h-3" aria-hidden="true" />
              {t("scope.pinAction")}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-2" align="end">
            <p className="text-[11px] text-muted-foreground mb-1.5">{t("scope.pinHint")}</p>
            <div className="max-h-48 overflow-y-auto flex flex-col">
              {pickerNodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => void pinTo(node)}
                  data-testid="scope-node-option"
                  className="text-left text-xs px-2 py-1.5 rounded-md hover:bg-[var(--glass-2)] cursor-pointer truncate"
                >
                  {node.title}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </span>
  );
}
