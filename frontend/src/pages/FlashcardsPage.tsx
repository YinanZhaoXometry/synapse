/**
 * The Flashcards hub (FR-41, epic P2-09 T4): every generated deck across
 * plans and tasks, from the flashcardDecksHub read model (T1's api
 * aggregation — one row per material that has flashcards, server-ordered by
 * the deck material's creation moment). Grouping (plan sections + task
 * sections) and the plan/task filter are client RENDERING over the flat
 * server-ordered list, never a re-aggregation. The study action deep-links
 * into the EXISTING flow routes — /plan/:id/flashcards or /task/:id/
 * flashcards per the deck's origin kind — so hub-launched study mounts the
 * real study surface without entering the plan flow (AD-8 addressable
 * sub-routes); generation stays in-flow (FR-19/FR-36) — the hub never
 * generates. The origin-less row: a material ALWAYS has a plan or a task (the
 * attach contract — every attachMaterial names exactly one owner), so the
 * study link is `planId ? planRoute : taskRoute` by construction; if the data
 * ever violates that contract, the row renders WITHOUT a study action — an
 * honest degradation, never an invented route. The Phase-1 demo deck fixture
 * (and its flash.* copy) retired with this re-point — the empty state is
 * honest, the page consumes only the hub hook plus the tasks list read (the
 * task group's title resolution off the wire's task ids).
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Layers, Play } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFlashcardDecksHubQuery, useTasksQuery, type HubDeckView } from "@/api";
import { localeTag } from "@/features/plans";
import { cn } from "@/lib/utils";

/** One grouping unit over the flat hub list: a plan's decks, a task's, or —
 * only when the attach contract is violated in data — an unattached deck. */
interface DeckGroup {
  kind: "plan" | "task" | "unattached";
  /** The plan/task uuid (the row's origin; first occurrence drives order). */
  id: string;
  decks: HubDeckView[];
}

/** Group the flat newest-first hub list: first occurrence drives group order
 * (recency-shaped, matching the server order) — rendering, not re-aggregation. */
function groupDecks(decks: HubDeckView[]): DeckGroup[] {
  const groups: DeckGroup[] = [];
  const byKey = new Map<string, DeckGroup>();
  for (const deck of decks) {
    const kind = deck.taskId ? "task" : deck.planId ? "plan" : "unattached";
    const id = deck.taskId ?? deck.planId ?? deck.materialId;
    const key = `${kind}:${id}`;
    let group = byKey.get(key);
    if (!group) {
      group = { kind, id, decks: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.decks.push(deck);
  }
  return groups;
}

/** The deck's study route: the EXISTING flow sub-route per origin kind — null
 * only for the attach-contract-violating origin-less row (no invented route). */
function deckStudyHref(deck: HubDeckView): string | null {
  if (deck.taskId) return `/task/${encodeURIComponent(deck.taskId)}/flashcards`;
  if (deck.planId) return `/plan/${encodeURIComponent(deck.planId)}/flashcards`;
  return null;
}

const FOLD_TRIGGER =
  "flex w-full items-center gap-2 px-1 py-1.5 text-sm font-semibold text-foreground/80 cursor-pointer " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md";

/** One collapsible group section (the MistakesPage shape): fold chevron +
 * title + kind chip (absent on the honest unattached section) + count. */
function DeckGroupSection({
  title,
  kindChipKey,
  count,
  children,
}: {
  title: string;
  kindChipKey: string | null;
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
        {kindChipKey && <span className="pill pill-muted">{t(kindChipKey)}</span>}
        <span className="pill">{count}</span>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-3 mt-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** One deck row: material title (the deck), origin chip, card count, created
 * date, and the study deep link (honestly absent without an origin). */
function DeckRow({ deck, taskTitle }: { deck: HubDeckView; taskTitle: (taskId: string) => string }) {
  const { t, language } = useLanguage();
  const originLabel = deck.taskId ? taskTitle(deck.taskId) : deck.planTitle ?? deck.planId;
  const studyHref = deckStudyHref(deck);
  const dateLabel = new Date(deck.createdAt).toLocaleDateString(localeTag(language));

  return (
    <article className="bg-card border border-border-soft rounded-2xl p-5 shadow-raised">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="pill">{originLabel}</span>
        <span className="text-[10px] text-caption">{dateLabel}</span>
      </div>
      <h3 className="font-body text-[15px] font-semibold leading-snug mt-2 line-clamp-2">{deck.materialTitle}</h3>
      <div className="flex items-center justify-between gap-3 flex-wrap mt-3">
        <span className="pill pill-muted">
          <Layers className="w-3 h-3" aria-hidden="true" />
          {t("flashcards.hub.cardCount", { n: deck.cardCount })}
        </span>
        {studyHref && (
          <Link
            to={studyHref}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:shadow-brand-hover hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t("flashcards.hub.studyAria", { deck: deck.materialTitle })}
          >
            <Play className="w-3.5 h-3.5" aria-hidden="true" />
            {t("flashcards.hub.study")}
          </Link>
        )}
      </div>
    </article>
  );
}

export default function FlashcardsPage() {
  const { t } = useLanguage();
  const hubQuery = useFlashcardDecksHubQuery();
  const tasksQuery = useTasksQuery();
  const [filter, setFilter] = useState("");

  const tasks = tasksQuery.data ?? [];

  // The task group's title resolves off the tasks list read (the wire carries
  // the task ID only — the MistakesPage convention); an unresolvable id
  // renders raw (honest, never a guessed title).
  const taskTitle = (taskId: string) => tasks.find((task) => task.id === taskId)?.node.title ?? taskId;

  const groups = useMemo(() => groupDecks(hubQuery.data ?? []), [hubQuery.data]);
  const visibleGroups = filter ? groups.filter((g) => `${g.kind}:${g.id}` === filter) : groups;

  // Honest-empty posture: nothing renders until the reads land (no demo
  // fallback, no flash of stale copy).
  if (hubQuery.loading || tasksQuery.loading) return null;

  const decks = hubQuery.data ?? [];

  return (
    <div className="max-w-[984px] mx-auto px-6 py-8">
      {/* Page head */}
      <div>
        <p className="eyebrow">{t("flashcards.hub.eyebrow")}</p>
        <h1 className="page-title mt-1.5">{t("flashcards.hub.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1.5">{t("flashcards.hub.subtitle", { n: decks.length })}</p>
      </div>

      {hubQuery.error ? (
        <div className="bg-card border border-border-soft rounded-2xl p-6 shadow-raised mt-6" role="alert">
          <p className="text-sm font-semibold">{t("flashcards.hub.loadFailed")}</p>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => void hubQuery.refetch()}
          >
            {t("flashcards.hub.retry")}
          </button>
        </div>
      ) : decks.length === 0 ? (
        <div className="bg-card border border-border-soft rounded-2xl p-8 shadow-raised mt-6 text-center">
          <p className="text-sm font-semibold">{t("flashcards.hub.emptyTitle")}</p>
          <p className="text-sm text-muted-foreground mt-1.5">{t("flashcards.hub.emptyBody")}</p>
          <Link
            to="/plans"
            className="inline-flex items-center gap-2 mt-4 rounded-xl bg-gradient-hero text-white shadow-brand px-4 py-2 text-sm font-semibold transition-all hover:shadow-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("flashcards.hub.emptyCta")}
          </Link>
        </div>
      ) : (
        <>
          {/* The plan/task filter (the read model is flat — filtering is rendering) */}
          <label className="flex items-center gap-2 mt-5 text-xs text-muted-foreground">
            {t("flashcards.hub.filterLabel")}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="min-w-0 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{t("flashcards.hub.filterAll")}</option>
              {groups.map((group) => (
                <option key={`${group.kind}:${group.id}`} value={`${group.kind}:${group.id}`}>
                  {group.kind === "plan"
                    ? group.decks[0]?.planTitle ?? group.id
                    : group.kind === "task"
                      ? taskTitle(group.id)
                      : group.decks[0]?.materialTitle ?? group.id}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col">
            {visibleGroups.map((group) => (
              <DeckGroupSection
                key={`${group.kind}:${group.id}`}
                title={
                  group.kind === "plan"
                    ? group.decks[0]?.planTitle ?? group.id
                    : group.kind === "task"
                      ? taskTitle(group.id)
                      : group.decks[0]?.materialTitle ?? group.id
                }
                kindChipKey={
                  group.kind === "plan" ? "flashcards.hub.kindPlan" : group.kind === "task" ? "flashcards.hub.kindTask" : null
                }
                count={group.decks.length}
              >
                {group.decks.map((deck) => (
                  <DeckRow key={deck.materialId} deck={deck} taskTitle={taskTitle} />
                ))}
              </DeckGroupSection>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
