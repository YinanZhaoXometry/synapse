import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, CalendarCheck, Globe, ListChecks } from "lucide-react";
import { useAllMaterialsQuery, usePlansQuery, useTasksQuery } from "@/api";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { NAV_ROUTES, SETTINGS_ROUTE } from "@/components/layout/nav-items";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Northstar ⌘K command bar (docs/design/northstar-import/IMPORT.md §1):
// global ⌘K/Ctrl+K opens a palette with page navigation + language toggle.
// epic-33 T2 adds ENTITY SEARCH — plans, materials, tasks — reading the SAME
// typed-hooks cache the hub pages already populate (cache-first, zero forced
// round trips). Filtering is MANUAL (shouldFilter=false on the root): the
// query is palette state, one includes() rule covers pages and entities
// alike, and entity caps + count hints stay deterministic instead of riding
// cmdk's fuzzy scorer. The entity hooks mount only while the dialog is open
// (Radix unmounts DialogContent on close), so a closed palette costs nothing
// and an open one never blocks the input on the network — groups appear as
// their cached data lands.

const RECENT_PLANS_CAP = 5;
const ENTITY_MATCH_CAP = 8;

const byNewest = (a: { createdAt: string }, b: { createdAt: string }) =>
  b.createdAt.localeCompare(a.createdAt);

export function CommandPalette({ open, onOpenChange }: Props) {
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  // ⌘K/Ctrl+K interception (T03 owner round): CAPTURE phase + preventDefault
  // + stopPropagation — renderer-level browser defaults (Chrome/Firefox's
  // address-bar search) are blocked before they act, and no other page
  // handler sees the key. The keyup listener only preventDefaults: a few
  // browsers act on release, and keyup must never toggle the palette twice.
  // Honest limit: a BROWSER-level ⌘K (Arc's command bar, extension-bound
  // shortcuts) is consumed before the page receives any event — no web page
  // can intercept that; the fix lives in the browser's own shortcut
  // settings, not here.
  useEffect(() => {
    const isToggleCombo = (e: KeyboardEvent) =>
      e.key === "k" && (e.metaKey || e.ctrlKey);
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isToggleCombo(e)) return;
      e.preventDefault();
      e.stopPropagation();
      onOpenChange(!open);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (isToggleCombo(e)) e.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, [open, onOpenChange]);

  // Fresh query each open — the last search never pre-filters the next.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  const q = query.trim().toLocaleLowerCase();
  const searching = q !== "";
  const matches = (label: string) => label.toLocaleLowerCase().includes(q);

  const pageItems = [...NAV_ROUTES, SETTINGS_ROUTE].filter(item => matches(t(item.labelKey)));

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder={t("command.placeholder")}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>{t("command.noResults")}</CommandEmpty>
        <CommandGroup heading={t("common.primaryAria")}>
          {pageItems.map(item => (
            <CommandItem
              key={item.to}
              value={t(item.labelKey)}
              onSelect={() => run(() => navigate(item.to))}
              className="group"
            >
              <item.icon className="w-4 h-4 text-muted-foreground transition-colors group-data-[selected=true]:text-accent-ink" />
              {t(item.labelKey)}
            </CommandItem>
          ))}
        </CommandGroup>
        <EntityGroups
          searching={searching}
          matches={matches}
          onSelect={to => run(() => navigate(to))}
        />
        <CommandSeparator />
        {matches(t("command.toggleLanguage")) && (
          <CommandGroup heading={t("command.groupActions")}>
            <CommandItem
              value={t("command.toggleLanguage")}
              onSelect={() => run(() => setLanguage(language === "zh" ? "en" : "zh"))}
              className="group"
            >
              <Globe className="w-4 h-4 text-muted-foreground transition-colors group-data-[selected=true]:text-accent-ink" />
              {t("command.toggleLanguage")}
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

/**
 * The entity half of the palette (epic-33 T2). Mounted only while the dialog
 * is open, so the three list reads cost nothing while closed. Empty query →
 * the recent-plans shelf (top 5, newest first) — the fastest path back to
 * yesterday's session. Typing → filtered plans/materials/tasks, each capped
 * at ENTITY_MATCH_CAP with a count hint when matches exceed the cap (the cap
 * trades completeness for list lag; the hint names the full match count so
 * nothing silently disappears).
 */
function EntityGroups({
  searching,
  matches,
  onSelect,
}: {
  searching: boolean;
  matches: (label: string) => boolean;
  onSelect: (to: string) => void;
}) {
  const { t } = useLanguage();
  const plansQuery = usePlansQuery();
  const materialsQuery = useAllMaterialsQuery();
  const tasksQuery = useTasksQuery();

  const plans = plansQuery.data;
  const materials = materialsQuery.data;
  const tasks = tasksQuery.data;

  // Loading or error → no entity groups; the input never waits on the network.
  if (!plans && !materials && !tasks) return null;

  const itemClass = "group";
  const iconClass = "w-4 h-4 text-muted-foreground transition-colors group-data-[selected=true]:text-accent-ink";

  // cmdk values carry the id: same-titled rows (forks share a topic) stay
  // distinct as selection targets; ids never match real queries.
  const planItems = (rows: { id: string; topic: string }[]) =>
    rows.map(plan => (
      <CommandItem
        key={plan.id}
        value={`${plan.topic} ${plan.id}`}
        onSelect={() => onSelect(`/plan/${plan.id}`)}
        className={itemClass}
      >
        <CalendarCheck className={iconClass} />
        <span className="truncate">{plan.topic}</span>
      </CommandItem>
    ));

  if (!searching) {
    const recent = (plans ?? []).slice().sort(byNewest).slice(0, RECENT_PLANS_CAP);
    if (recent.length === 0) return null;
    return (
      <>
        <CommandSeparator />
        <CommandGroup heading={t("nav.plansRecent")}>{planItems(recent)}</CommandGroup>
      </>
    );
  }

  const groupHeading = (nameKey: string, total: number) =>
    total > ENTITY_MATCH_CAP
      ? t("command.entityCount", { name: t(nameKey), n: total })
      : t(nameKey);

  const planMatches = (plans ?? []).slice().sort(byNewest).filter(plan => matches(plan.topic));
  const materialMatches = (materials ?? []).filter(material => matches(material.title));
  // Task label = the owned node's title (the TaskRow convention); tasks are
  // plan-free single-node studies, the node IS the study.
  const taskMatches = (tasks ?? [])
    .map(task => ({ task, label: task.node?.title ?? t("command.untitledTask") }))
    .filter(row => matches(row.label));

  return (
    <>
      {planMatches.length > 0 && (
        <>
          <CommandSeparator />
          <CommandGroup heading={groupHeading("nav.plans", planMatches.length)}>
            {planItems(planMatches.slice(0, ENTITY_MATCH_CAP))}
          </CommandGroup>
        </>
      )}
      {materialMatches.length > 0 && (
        <>
          <CommandSeparator />
          <CommandGroup heading={groupHeading("nav.materials", materialMatches.length)}>
            {materialMatches.slice(0, ENTITY_MATCH_CAP).map(material => (
              <CommandItem
                key={material.id}
                value={`${material.title} ${material.id}`}
                onSelect={() => onSelect(`/read/${material.id}`)}
                className={itemClass}
              >
                <BookOpen className={iconClass} />
                <span className="truncate">{material.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </>
      )}
      {taskMatches.length > 0 && (
        <>
          <CommandSeparator />
          <CommandGroup heading={groupHeading("nav.planner", taskMatches.length)}>
            {taskMatches.slice(0, ENTITY_MATCH_CAP).map(({ task, label }) => (
              <CommandItem
                key={task.id}
                value={`${label} ${task.id}`}
                onSelect={() => onSelect(`/task/${task.id}`)}
                className={itemClass}
              >
                <ListChecks className={iconClass} />
                <span className="truncate">{label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </>
      )}
    </>
  );
}
