/**
 * The Mistakes hub (FR-23, epic P2-09 T2): every wrong answer — Choice + Open
 * — from the mistakesHub read model (T1's api aggregation), grouped by Study
 * Plan with task-context entries under their task, filterable, each rendering
 * the question prompt, the user's answer, the node chip, the log date, a
 * source deep link through the AD-8 anchor channel (readerSectionHref /
 * readerAnchorHref verbatim), and the re-quiz launch — /plan/:id/quiz?nodeId=
 * (nodeQuickTestHref; the node-scoped generation loop lands the evidence) or
 * the task's quiz route. The read model is flat and newest-first: grouping is
 * client rendering over it, never a re-aggregation. The Phase-1 demo engine
 * (MISTAKES fixture + weak-topics card) retired with this re-point — the
 * empty state is honest, the page consumes only the hub hook plus the
 * label-lookup list reads.
 *
 * The resolve lifecycle (epic-18 T4, spec decision 4): each card toggles the
 * user-marked `resolved` boolean BOTH ways through setMistakeEntryResolved —
 * read-back-is-truth (the scope-mutation posture: the mutation + the
 * mistakesHub refetch re-render server truth, no optimistic write). The
 * client uuid is minted ONCE per entry and reused across toggles/retries
 * (replay-safe — the server's replay answer is the state comparison).
 * Resolved cards go visually quiet (opacity) but stay readable; a second
 * dropdown filters open/resolved. Forfeited entries toggle identically.
 */
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Check, ChevronDown, RotateCcw, Undo2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  newClientUuid,
  resolveMistakeAnswer,
  useAllMaterialsQuery,
  useMistakesHubQuery,
  usePlanNodesQuery,
  usePlansQuery,
  useSetMistakeEntryResolvedMutation,
  useTasksQuery,
  type HubMistakeEntryView,
} from "@/api";
import { localeTag, nodeQuickTestHref } from "@/features/plans";
import { readerAnchorHref, readerSectionHref } from "@/features/reader";
import { cn } from "@/lib/utils";
import PageLoader from "@/components/shared/PageLoader";

/** One grouping unit over the flat hub list: a plan's context or a task's
 * (FR-23's rule — task-context entries render under their task). */
interface MistakeGroup {
  kind: "plan" | "task";
  /** The plan/task uuid (the node's owner; the hub guarantees one). */
  id: string;
  entries: HubMistakeEntryView[];
}

/** Group the flat newest-first hub list: first occurrence drives group order
 * (recency-shaped, matching the server order) — rendering, not re-aggregation. */
function groupMistakes(entries: HubMistakeEntryView[]): MistakeGroup[] {
  const groups: MistakeGroup[] = [];
  const byKey = new Map<string, MistakeGroup>();
  for (const entry of entries) {
    const kind = entry.taskId ? "task" : "plan";
    const id = entry.taskId ?? entry.planId ?? entry.nodeId;
    const key = `${kind}:${id}`;
    let group = byKey.get(key);
    if (!group) {
      group = { kind, id, entries: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.entries.push(entry);
  }
  return groups;
}

const FOLD_TRIGGER =
  "flex w-full items-center gap-2 px-1 py-1.5 text-sm font-semibold text-foreground/80 cursor-pointer " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md";

/** One collapsible group section (MaterialCoveragePanel's GroupShell shape):
 * fold chevron + title + kind chip + count. */
function MistakeGroupSection({
  title,
  kindChipKey,
  count,
  children,
}: {
  title: string;
  kindChipKey: string;
  count: number;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-5">
      <CollapsibleTrigger type="button" className={FOLD_TRIGGER} aria-label={title}>
        <ChevronDown className={cn("w-4 h-4 transition-transform", !open && "-rotate-90")} aria-hidden="true" />
        <span>{title}</span>
        <span className="pill pill-muted">{t(kindChipKey)}</span>
        <span className="pill">{count}</span>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-3 mt-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** One wrong answer card: prompt, the user's answer, node chip, log date, the
 * source deep link, the re-quiz launch, and the resolve toggle. A resolved
 * card goes visually quiet (opacity) but stays readable. */
function MistakeCard({
  entry,
  materialTitle,
  sectionTitle,
  nodeTitle,
  onToggleResolved,
}: {
  entry: HubMistakeEntryView;
  materialTitle: (materialId: string) => string;
  sectionTitle: (materialId: string, sectionId: string) => string;
  nodeTitle: (nodeId: string) => string;
  onToggleResolved: (entry: HubMistakeEntryView) => void;
}) {
  const { t, language } = useLanguage();
  const answer = resolveMistakeAnswer(entry);
  const dateLabel = new Date(entry.createdAt).toLocaleDateString(localeTag(language));

  // AD-8: the source deep link through the anchor channel verbatim (hl=1).
  const locator = entry.sourceLocation;
  const sourceHref =
    locator.kind === "pdf"
      ? readerAnchorHref(entry.materialId, locator.page, true)
      : readerSectionHref(entry.materialId, locator.sectionId, true);
  const locatorLabel =
    locator.kind === "pdf"
      ? t("mistakes.pageLocator", { page: locator.page })
      : sectionTitle(entry.materialId, locator.sectionId);

  // The re-quiz launch: plan-context entries relaunch the node-scoped plan
  // flow (nodeQuickTestHref — the T5-completed ?nodeId= loop); task-context
  // entries launch the task's quiz route (the task's single material IS its
  // scope — no nodeId param on the task route).
  const requizHref = entry.taskId
    ? `/task/${encodeURIComponent(entry.taskId)}/quiz`
    : entry.planId
      ? nodeQuickTestHref(entry.planId, entry.nodeId)
      : null;

  return (
    <article className={cn("bg-card border border-border-soft rounded-2xl p-5 shadow-raised", entry.resolved && "opacity-60")}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="flex items-center gap-1.5 flex-wrap">
          <span className="pill">{nodeTitle(entry.nodeId)}</span>
          {entry.resolved && <span className="pill pill-muted">{t("mistakes.resolvedChip")}</span>}
        </span>
        <span className="text-[10px] text-caption">{dateLabel}</span>
      </div>
      <h3 className="font-body text-[15px] font-semibold leading-snug mt-2 line-clamp-2">{entry.question.prompt}</h3>
      <div className="mt-3">
        <div className="compare-box compare-wrong">
          <div className="compare-label">{t("mistakes.yourAnswer")}</div>
          {entry.forfeited ? t("mistakes.forfeited") : answer || "—"}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap mt-3">
        <Link className="citation" to={sourceHref}>
          <BookOpen className="w-3 h-3" aria-hidden="true" />
          {materialTitle(entry.materialId)} · {locatorLabel}
        </Link>
        <span className="flex items-center gap-2 flex-wrap">
          {/* The lifecycle toggle (both ways; the read-back sweep re-renders
              server truth — aria-pressed carries the state). */}
          <button
            type="button"
            onClick={() => onToggleResolved(entry)}
            aria-pressed={entry.resolved}
            aria-label={entry.resolved ? t("mistakes.resolveReopenAria") : t("mistakes.resolveDoneAria")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:shadow-brand-hover hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          >
            {entry.resolved ? <Undo2 className="w-3.5 h-3.5" aria-hidden="true" /> : <Check className="w-3.5 h-3.5" aria-hidden="true" />}
            {entry.resolved ? t("mistakes.resolveReopen") : t("mistakes.resolveDone")}
          </button>
          {requizHref && (
            <Link
              to={requizHref}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:shadow-brand-hover hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("mistakes.requizAria", { node: nodeTitle(entry.nodeId) })}
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              {t("mistakes.requiz")}
            </Link>
          )}
        </span>
      </div>
    </article>
  );
}

/** A plan group: its node titles resolve through the plan's own node read
 * (the light plans list carries no node tree). */
function PlanMistakesSection({
  planId,
  title,
  entries,
  materialTitle,
  sectionTitle,
  onToggleResolved,
}: {
  planId: string;
  title: string;
  entries: HubMistakeEntryView[];
  materialTitle: (materialId: string) => string;
  sectionTitle: (materialId: string, sectionId: string) => string;
  onToggleResolved: (entry: HubMistakeEntryView) => void;
}) {
  const nodesQuery = usePlanNodesQuery(planId);
  const nodes = nodesQuery.data ?? [];
  const nodeTitle = (nodeId: string) => nodes.find((n) => n.id === nodeId)?.title ?? nodeId;
  return (
    <MistakeGroupSection title={title} kindChipKey="mistakes.kindPlan" count={entries.length}>
      {entries.map((entry) => (
        <MistakeCard key={entry.id} entry={entry} materialTitle={materialTitle} sectionTitle={sectionTitle} nodeTitle={nodeTitle} onToggleResolved={onToggleResolved} />
      ))}
    </MistakeGroupSection>
  );
}

function TaskMistakesSection({
  taskId,
  title,
  entries,
  materialTitle,
  sectionTitle,
  onToggleResolved,
}: {
  taskId: string;
  title: string;
  entries: HubMistakeEntryView[];
  materialTitle: (materialId: string) => string;
  sectionTitle: (materialId: string, sectionId: string) => string;
  onToggleResolved: (entry: HubMistakeEntryView) => void;
}) {
  const nodeTitle = (nodeId: string) => title || nodeId;
  return (
    <MistakeGroupSection title={title} kindChipKey="mistakes.kindTask" count={entries.length}>
      {entries.map((entry) => (
        <MistakeCard key={entry.id} entry={entry} materialTitle={materialTitle} sectionTitle={sectionTitle} nodeTitle={nodeTitle} onToggleResolved={onToggleResolved} />
      ))}
    </MistakeGroupSection>
  );
}

export default function MistakesPage() {
  const { t } = useLanguage();
  const hubQuery = useMistakesHubQuery();
  const materialsQuery = useAllMaterialsQuery();
  const plansQuery = usePlansQuery();
  const tasksQuery = useTasksQuery();
  const resolveToggle = useSetMistakeEntryResolvedMutation();
  const [filter, setFilter] = useState("");
  const [stateFilter, setStateFilter] = useState<"" | "open" | "resolved">("");
  // ONE stable client uuid per entry, minted on first toggle and reused
  // across toggles + retries (replay-safe: the server's replay answer is the
  // entry's state comparison). The map lives at page level so it survives
  // the sections' re-renders.
  const resolveUuids = useRef(new Map<string, string>());

  const materials = materialsQuery.data ?? [];
  const plans = plansQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];

  // Label resolvers: the hub carries ids — display titles come from the list
  // reads; an unresolvable id renders raw (honest, never a guessed title).
  const materialTitle = (materialId: string) => materials.find((m) => m.id === materialId)?.title ?? materialId;
  const sectionTitle = (materialId: string, sectionId: string) =>
    materials.find((m) => m.id === materialId)?.sections.find((s) => s.id === sectionId)?.title ?? sectionId;
  const planTopic = (planId: string) => plans.find((p) => p.id === planId)?.topic ?? planId;
  const taskTitle = (taskId: string) => tasks.find((task) => task.id === taskId)?.node.title ?? taskId;

  const toggleResolved = (entry: HubMistakeEntryView) => {
    let clientUuid = resolveUuids.current.get(entry.id);
    if (!clientUuid) {
      clientUuid = newClientUuid();
      resolveUuids.current.set(entry.id, clientUuid);
    }
    resolveToggle.mutate({ variables: { input: { clientUuid, id: entry.id, resolved: !entry.resolved } } });
  };

  // Filtering is rendering over the flat list: the state filter runs first,
  // then grouping, then the plan/task picker (the read model stays flat).
  const data = hubQuery.data;
  const stateFiltered = useMemo(
    () => (stateFilter ? (data ?? []).filter((entry) => entry.resolved === (stateFilter === "resolved")) : data ?? []),
    [data, stateFilter],
  );
  const groups = useMemo(() => groupMistakes(stateFiltered), [stateFiltered]);
  const visibleGroups = filter ? groups.filter((g) => `${g.kind}:${g.id}` === filter) : groups;

  // Honest-empty posture: nothing renders until the reads land (no demo
  // fallback, no flash of stale copy).
  if (hubQuery.loading || materialsQuery.loading || plansQuery.loading || tasksQuery.loading) return <PageLoader />;

  const entries = data ?? [];

  return (
    <div className="max-w-[984px] mx-auto px-6 py-8">
      {/* Page head */}
      <div>
        <p className="eyebrow">{t("mistakes.eyebrow")}</p>
        <h1 className="page-title mt-1.5">{t("mistakes.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1.5">{t("mistakes.subtitle", { n: entries.length })}</p>
      </div>

      {hubQuery.error ? (
        <div className="bg-card border border-border-soft rounded-2xl p-6 shadow-raised mt-6" role="alert">
          <p className="text-sm font-semibold">{t("mistakes.loadFailed")}</p>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => void hubQuery.refetch()}
          >
            {t("mistakes.retry")}
          </button>
        </div>
      ) : entries.length === 0 || (visibleGroups.length === 0 && stateFilter === "") ? (
        // The regular empty card covers BOTH genuinely-no-mistakes AND the
        // (defensive) picker-driven emptiness — the state note below is the
        // STATE filter's alone (epic-18 T6 review: state copy never speaks
        // for a picker-driven empty).
        <div className="bg-card border border-border-soft rounded-2xl p-8 shadow-raised mt-6 text-center">
          <p className="text-sm font-semibold">{t("mistakes.emptyTitle")}</p>
          <p className="text-sm text-muted-foreground mt-1.5">{t("mistakes.emptyBody")}</p>
          <Link
            to="/plans"
            className="inline-flex items-center gap-2 mt-4 rounded-xl bg-gradient-hero text-white shadow-brand px-4 py-2 text-sm font-semibold transition-all hover:shadow-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("mistakes.emptyCta")}
          </Link>
        </div>
      ) : (
        <>
          {/* The filter row (the read model is flat — filtering is rendering):
              plan/task picker + the open/resolved state picker. */}
          <div className="flex items-center gap-4 flex-wrap mt-5 text-xs text-muted-foreground">
            <label className="flex items-center gap-2">
              {t("mistakes.filterLabel")}
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="min-w-0 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{t("mistakes.filterAll")}</option>
                {groups.map((group) => (
                  <option key={`${group.kind}:${group.id}`} value={`${group.kind}:${group.id}`}>
                    {group.kind === "plan" ? planTopic(group.id) : taskTitle(group.id)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              {t("mistakes.stateFilterLabel")}
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value as "" | "open" | "resolved")}
                className="min-w-0 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{t("mistakes.stateAll")}</option>
                <option value="open">{t("mistakes.stateOpen")}</option>
                <option value="resolved">{t("mistakes.stateResolved")}</option>
              </select>
            </label>
          </div>

          {visibleGroups.length === 0 ? (
            // Reached ONLY with the state filter active — the all-states empty
            // fell to the regular empty card above.
            <p className="text-sm text-muted-foreground mt-6">{t("mistakes.stateEmpty")}</p>
          ) : (
            <div className="flex flex-col">
              {visibleGroups.map((group) =>
                group.kind === "plan" ? (
                  <PlanMistakesSection
                    key={group.id}
                    planId={group.id}
                    title={planTopic(group.id)}
                    entries={group.entries}
                    materialTitle={materialTitle}
                    sectionTitle={sectionTitle}
                    onToggleResolved={toggleResolved}
                  />
                ) : (
                  <TaskMistakesSection
                    key={group.id}
                    taskId={group.id}
                    title={taskTitle(group.id)}
                    entries={group.entries}
                    materialTitle={materialTitle}
                    sectionTitle={sectionTitle}
                    onToggleResolved={toggleResolved}
                  />
                ),
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
