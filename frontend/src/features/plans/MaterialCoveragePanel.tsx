/**
 * The per-material coverage panel (FR-45, epic P2-10 T1; delta decision 3):
 * four collapsible groups — Mapped (section → node, one line each) ·
 * Proposed (grouped by proposed node, bulk confirm/reject per group) ·
 * Rejected (muted rows, never re-proposed) · Unmapped (explicit list) —
 * every mapping row lands in exactly ONE group, so every section is visible
 * in one final state and nothing is silently dropped. The "Map sections"
 * action runs the AI mapping mutation (cap-counted server-side); verdict
 * buttons ride the bulk mutations. A failed coverage read renders an inline
 * failure + retry — never the affirmative empty state. All copy bilingual
 * via the dictionary; error toasts map the closed api enum through
 * apiErrorKeys("mapping.").
 *
 * epic-34 T3 (Auto-mapping · coverage honesty): the panel surfaces the
 * plan-page effect's states without ever firing anything itself —
 * `autoRunning` renders the「正在 AI 映射…」line (and holds the manual
 * button for the moment), `capReached` renders the「额度已用完」state in
 * place of the empty state (the manual button stays the explicit retry),
 * and `unmappedNodes` is the page-computed summary line (GLOSSARY Unmapped
 * node — the material-mapping axis, never the mastery axis's wording).
 */
import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, ChevronDown, CircleSlash, ListChecks, Map as MapIcon, RotateCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  apiErrorCode,
  apiErrorKeys,
  useConfirmMappingProposalsMutation,
  useMapMaterialSectionsMutation,
  useMaterialNodeMappingsQuery,
  useRejectMappingProposalsMutation,
} from "@/api";
import type { KnowledgeNodeView, MaterialNodeMappingView, MaterialView } from "@/api/views";
import type { ErrorLike } from "@apollo/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { coverageGroups, type ProposedGroup } from "./coverage-grouping";

/** The mapping mutations' closed-enum → t() key map (one place, AD-9). */
const MAPPING_ERROR_KEYS: Record<string, string> = apiErrorKeys("mapping.");
const MAPPING_FAILED_KEY = "mapping.failed";

function sectionTitle(material: MaterialView, sectionId: string): string {
  return material.sections.find((section) => section.id === sectionId)?.title ?? sectionId;
}

function nodeTitle(nodes: KnowledgeNodeView[], nodeId: string | null | undefined): string | null {
  if (!nodeId) return null;
  return nodes.find((node) => node.id === nodeId)?.title ?? nodeId;
}

/** One collapsible group shell: a count chip + the fold chevron. */
function GroupShell({
  label,
  count,
  chipClass,
  children,
  defaultOpen = true,
}: {
  label: string;
  count: number;
  chipClass: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        type="button"
        className="flex w-full items-center gap-2 px-1 py-1.5 text-xs font-semibold text-foreground/80 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        aria-label={label}
      >
        <ChevronDown className={cn("w-3 h-3 transition-transform", !open && "-rotate-90")} aria-hidden="true" />
        <span>{label}</span>
        <span className={cn("pill", chipClass)}>{count}</span>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

export default function MaterialCoveragePanel({
  material,
  nodes,
  autoRunning = false,
  capReached = false,
  unmappedNodes = 0,
}: {
  material: MaterialView;
  nodes: KnowledgeNodeView[];
  /** epic-34 T3: the plan-page effect is mapping THIS material right now. */
  autoRunning?: boolean;
  /** epic-34 T3: the daily AI cap is exhausted — the honest paused state. */
  capReached?: boolean;
  /** epic-34 T3: the page-computed unmapped-nodes count (zero CONFIRMED rows). */
  unmappedNodes?: number;
}) {
  const { language, t } = useLanguage();
  const mappingsQuery = useMaterialNodeMappingsQuery(material.id);
  const [mapSections, mapResult] = useMapMaterialSectionsMutation();
  const [confirmProposals, confirmResult] = useConfirmMappingProposalsMutation();
  const [rejectProposals, rejectResult] = useRejectMappingProposalsMutation();

  const groups = useMemo(
    () => coverageGroups(mappingsQuery.data ?? []),
    [mappingsQuery.data],
  );

  const failureToast = (error: ErrorLike | undefined) => {
    const code = apiErrorCode(error);
    toast.error(t(code ? (MAPPING_ERROR_KEYS[code] ?? MAPPING_FAILED_KEY) : MAPPING_FAILED_KEY));
  };

  const runMap = async () => {
    try {
      const payload = await mapSections({
        variables: { input: { materialId: material.id, language } },
      });
      const placed = payload.data?.mapMaterialSections?.mappings.length ?? 0;
      toast.success(t("mapping.done"), { description: t("mapping.doneDetail", { n: placed }) });
    } catch (error) {
      failureToast(error as ErrorLike);
    }
  };

  const confirmGroup = async (rows: MaterialNodeMappingView[]) => {
    try {
      await confirmProposals({ variables: { input: { mappingIds: rows.map((row) => row.id) } } });
      toast.success(t("mapping.confirmedToast"));
    } catch (error) {
      failureToast(error as ErrorLike);
    }
  };

  const rejectGroup = async (rows: MaterialNodeMappingView[]) => {
    try {
      await rejectProposals({ variables: { input: { mappingIds: rows.map((row) => row.id) } } });
      toast.success(t("mapping.rejectedToast"));
    } catch (error) {
      failureToast(error as ErrorLike);
    }
  };

  const rows = mappingsQuery.data ?? [];
  const mapping = mapResult.loading;
  const decided = confirmResult.loading || rejectResult.loading;
  const hasRows = rows.length > 0;
  // A failed mappings read is a FAILURE, never the honest initial state —
  // it renders its own line + retry instead of "no mappings yet".
  const loadFailed = Boolean(mappingsQuery.error);

  /** A node-keyed proposed group labels itself with the REAL node's title. */
  const groupLabel = (group: ProposedGroup) =>
    group.key.startsWith("node:") ? (nodeTitle(nodes, group.label) ?? group.label) : group.label;

  return (
    <div className="px-4 pb-3 pt-1" data-testid="coverage-panel">
      <div className="flex items-center gap-2 px-1">
        <p className="eyebrow">{t("mapping.title")}</p>
        <span className="flex-1 h-px bg-border" aria-hidden="true" />
        <button
          type="button"
          onClick={runMap}
          disabled={mapping || autoRunning}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink cursor-pointer hover:underline disabled:opacity-60 disabled:cursor-wait"
        >
          {mapping ? (
            <RotateCw className="w-3 h-3 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="w-3 h-3" aria-hidden="true" />
          )}
          {mapping ? t("mapping.working") : hasRows ? t("mapping.remapping") : t("mapping.mapAction")}
        </button>
      </div>

      {/* epic-34 T3: the computed coverage-honesty summary — the plan's nodes
          with zero CONFIRMED mappings (the page derives it from the batch
          mapping read it already loads). Always visible; the count answers
          "which nodes have nothing to study FROM" (the material-mapping
          axis), distinct from anything mastery-related. */}
      <p
        className="text-[11px] leading-[1.5] text-muted-foreground px-1 pt-1"
        data-testid="coverage-unmapped-summary"
      >
        {t("mapping.unmappedNodesSummary", { n: unmappedNodes })}
      </p>

      {loadFailed && (
        <div className="flex items-center gap-2 px-1 py-2" data-testid="coverage-load-failed">
          <p className="text-xs text-destructive">{t("mapping.loadFailed")}</p>
          <button
            type="button"
            onClick={() => void mappingsQuery.refetch()}
            disabled={mappingsQuery.loading}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink cursor-pointer hover:underline disabled:opacity-60 disabled:cursor-wait"
          >
            <RotateCw className={cn("w-3 h-3", mappingsQuery.loading && "animate-spin")} aria-hidden="true" />
            {t("mapping.retryLoad")}
          </button>
        </div>
      )}

      {/* The zero-rows states, most specific first (epic-34 T3): the effect's
          in-flight line, then the cap-exhausted state (the manual button
          stays the explicit retry), then the honest initial empty state. */}
      {!hasRows && !loadFailed && autoRunning && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground px-1 py-2" data-testid="coverage-auto-working">
          <RotateCw className="w-3 h-3 animate-spin flex-none" aria-hidden="true" />
          {t("mapping.autoWorking")}
        </p>
      )}

      {!hasRows && !loadFailed && !autoRunning && capReached && (
        <p className="text-xs text-muted-foreground px-1 py-2" data-testid="coverage-cap">
          {t("mapping.capExhausted")}
        </p>
      )}

      {!hasRows && !mapping && !loadFailed && !autoRunning && !capReached && (
        <p className="text-xs text-muted-foreground px-1 py-2">{t("mapping.noMappings")}</p>
      )}

      {hasRows && (
        <div className="flex flex-col gap-1 mt-1">
          {groups.mapped.length > 0 && (
            <GroupShell label={t("mapping.groupMapped")} count={groups.mapped.length} chipClass="pill-mastered">
              <ul className="flex flex-col gap-1 px-1 pb-1">
                {groups.mapped.map((row) => (
                  <li key={row.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ListChecks className="w-3 h-3 text-mastered-ink flex-none" aria-hidden="true" />
                    <span className="truncate text-foreground">{sectionTitle(material, row.sectionId)}</span>
                    <ArrowRight className="w-3 h-3 flex-none" aria-hidden="true" />
                    <span className="truncate">{nodeTitle(nodes, row.nodeId)}</span>
                  </li>
                ))}
              </ul>
            </GroupShell>
          )}

          {groups.proposedGroups.map((group) => (
            <GroupShell key={group.key} label={`${t("mapping.groupProposed")} · ${groupLabel(group)}`} count={group.rows.length} chipClass="pill-partial">
              <div className="flex flex-col gap-1 px-1 pb-1">
                <ul className="flex flex-col gap-1">
                  {group.rows.map((row) => (
                    <li key={row.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapIcon className="w-3 h-3 text-partial-ink flex-none" aria-hidden="true" />
                      <span className="truncate text-foreground">{sectionTitle(material, row.sectionId)}</span>
                      <ArrowRight className="w-3 h-3 flex-none" aria-hidden="true" />
                      <span className="truncate">{row.proposedNodeTitle ?? nodeTitle(nodes, row.nodeId)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void confirmGroup(group.rows)}
                    disabled={decided}
                    className="text-[11px] font-semibold text-mastered-ink cursor-pointer hover:underline disabled:opacity-60"
                  >
                    {t("mapping.confirmGroup")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void rejectGroup(group.rows)}
                    disabled={decided}
                    className="text-[11px] font-semibold text-muted-foreground cursor-pointer hover:underline disabled:opacity-60"
                  >
                    {t("mapping.rejectGroup")}
                  </button>
                </div>
              </div>
            </GroupShell>
          ))}

          {groups.unmapped.length > 0 && (
            <GroupShell label={t("mapping.groupUnmapped")} count={groups.unmapped.length} chipClass="pill-muted">
              <ul className="flex flex-col gap-1 px-1 pb-1">
                {groups.unmapped.map((row) => (
                  <li key={row.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CircleSlash className="w-3 h-3 flex-none" aria-hidden="true" />
                    <span className="truncate">{sectionTitle(material, row.sectionId)}</span>
                  </li>
                ))}
              </ul>
            </GroupShell>
          )}

          {groups.rejected.length > 0 && (
            <GroupShell label={t("mapping.groupRejected")} count={groups.rejected.length} chipClass="pill-muted" defaultOpen={false}>
              <ul className="flex flex-col gap-1 px-1 pb-1">
                {groups.rejected.map((row) => (
                  <li key={row.id} className="flex items-center gap-1.5 text-xs text-muted-foreground/70 line-through decoration-muted-foreground/40">
                    <CircleSlash className="w-3 h-3 flex-none" aria-hidden="true" />
                    <span className="truncate">{sectionTitle(material, row.sectionId)}</span>
                  </li>
                ))}
              </ul>
            </GroupShell>
          )}
        </div>
      )}
    </div>
  );
}
