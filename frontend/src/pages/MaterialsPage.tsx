/**
 * The materials library (epic P3-18 T3): the retained page leaves the demo
 * fixtures for the server read — useAllMaterialsQuery (the MistakesPage-
 * consumed surface) renders every row with wire truth only: title, kind
 * label, human-readable sizeBytes, createdAt date, and the parseState chip
 * (only `failed` is emphasized, its reason on the title attr — the reader
 * owns parse state, the hub just says so). The scope chip is real and
 * per-row: the owning plan topic / task node title resolved through the same
 * label-lookup list reads MistakesPage uses; unresolvable → chip hidden
 * (never a raw id). Open walks the existing reader deep link
 * (/read/:materialId); the upload button is an honest pointer CTA to
 * attach-in-plan — no upload flow on the hub (spec decision 1: the attach
 * flow needs a plan/task owner, Plans Home owns that UX). The kind filter
 * (all / pdf / markdown) replaces the demo tag row; search keeps matching
 * titles; server-empty vs filter-empty are distinct honest states.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Plus, Search } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAllMaterialsQuery, usePlansQuery, useTasksQuery, type MaterialView } from "@/api";
import { localeTag } from "@/features/plans";
import { PARSE_REASON_MESSAGE_KEY } from "@/features/reader";

const KINDS = ["all", "pdf", "markdown"] as const;
type KindFilter = (typeof KINDS)[number];

const KIND_KEYS: Record<KindFilter, string> = {
  all: "materials.filterAll",
  pdf: "materials.filterPdf",
  markdown: "materials.filterMd",
};

/** bytes → human-readable (display formatting, not data fabrication). */
function formatSize(bytes: number, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (bytes < 1024) return t("materials.sizeB", { n: bytes });
  if (bytes < 1024 * 1024) return t("materials.sizeKb", { n: (bytes / 1024).toFixed(1) });
  return t("materials.sizeMb", { n: (bytes / (1024 * 1024)).toFixed(1) });
}

/** One library row: wire-truth meta (kind · size · date), the parseState
 * chip (failed emphasized + reason on hover — the PlanHome pill vocabulary),
 * the resolved scope chip, and the reader deep link. */
function MaterialRow({ material, scopeLabel }: { material: MaterialView; scopeLabel: string | null }) {
  const { t, language } = useLanguage();
  const dateLabel = new Date(material.createdAt).toLocaleDateString(localeTag(language));

  return (
    <div className="group flex items-center gap-4 px-4 py-3.5 bg-card border border-border-soft rounded-xl shadow-soft transition-all hover:shadow-raised hover:-translate-y-px">
      <span className="w-[42px] h-[42px] rounded-[11px] flex-none grid place-items-center bg-secondary text-lg" aria-hidden="true">
        {material.kind === "pdf" ? "📄" : "📝"}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{material.title}</div>
        <div className="flex items-center gap-1.5 flex-wrap mt-[3px] text-[10px] text-muted-foreground">
          <span>{material.kind === "pdf" ? t("materials.filePdf") : t("materials.fileMd")}</span>
          <span aria-hidden="true">·</span>
          <span>{formatSize(material.sizeBytes, t)}</span>
          <span aria-hidden="true">·</span>
          <span>{dateLabel}</span>
        </div>
      </div>
      <div className="flex-none flex items-center gap-[5px]">
        {material.parseState === "failed" ? (
          <span
            className="pill tint-danger cursor-help whitespace-nowrap"
            title={t(PARSE_REASON_MESSAGE_KEY[material.parseFailureReason ?? "unknown"])}
          >
            {t("plans.parseFailed")}
          </span>
        ) : material.parseState === "parsing" ? (
          <span className="pill pill-muted whitespace-nowrap">{t("plans.parseParsing")}</span>
        ) : material.parseState === "parsed" ? (
          <span className="pill pill-mastered whitespace-nowrap">{t("plans.parseParsed", { n: material.sections.length })}</span>
        ) : (
          <span className="pill pill-muted cursor-help whitespace-nowrap" title={t("plans.parsePendingNote")}>
            {t("plans.parsePending")}
          </span>
        )}
        {/* The real scope chip: the owning plan topic / task node title via
            the label-lookup list reads; unresolvable → hidden (never a raw
            id on this page — spec decision 3). Display-only: the pin/widen
            affordances live on the plan's material rows (PlanHome). */}
        {scopeLabel && (
          <span
            data-testid="scope-chip"
            className="px-2 py-[3px] rounded-full bg-[var(--glass-3)] border border-border-soft text-[10px] font-semibold text-muted-foreground whitespace-nowrap"
          >
            {scopeLabel}
          </span>
        )}
      </div>
      <Link
        to={`/read/${material.id}`}
        className="flex-none inline-flex items-center justify-center gap-2 rounded-[10px] px-3 py-1.5 text-[13px] font-semibold bg-[var(--glass-4)] border border-border hover:bg-[var(--glass-solid)] transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap"
        aria-label={t("materials.openAria", { title: material.title })}
      >
        {t("materials.open")}
        <ChevronRight className="w-[15px] h-[15px]" aria-hidden="true" />
      </Link>
    </div>
  );
}

export default function MaterialsPage() {
  const { t } = useLanguage();
  const materialsQuery = useAllMaterialsQuery();
  const plansQuery = usePlansQuery();
  const tasksQuery = useTasksQuery();
  const [kind, setKind] = useState<KindFilter>("all");
  const [query, setQuery] = useState("");

  const materials = materialsQuery.data ?? [];
  const plans = plansQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];

  // Label resolvers (the MistakesPage pattern): the material carries ids —
  // display titles come from the list reads; unresolvable → null, the chip
  // hides (never a raw id on this page — spec decision 3).
  const scopeLabel = (m: MaterialView): string | null => {
    if (m.taskId) return tasks.find((task) => task.id === m.taskId)?.node.title ?? null;
    if (m.planId) return plans.find((plan) => plan.id === m.planId)?.topic ?? null;
    return null;
  };

  // Kind filter + title search: rendering over the flat server list.
  const items = materials.filter((m) => {
    if (kind !== "all" && m.kind !== kind) return false;
    const q = query.trim().toLowerCase();
    return !q || m.title.toLowerCase().includes(q);
  });

  // Honest-empty posture: nothing renders until the reads land (no demo
  // fallback, no flash of stale copy).
  if (materialsQuery.loading || plansQuery.loading || tasksQuery.loading) return null;

  return (
    <div className="p-6 md:p-8 max-w-[1120px] mx-auto">
      {/* Page head */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="eyebrow">{t("materials.eyebrow")}</p>
          <h1 className="page-title mt-1.5">{t("materials.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-[62ch]">{t("materials.subtitle", { n: materials.length })}</p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2">
          {/* The honest upload pointer (spec decision 1): attach lives inside
              a plan/task flow — Plans Home owns that UX — so the hub's CTA
              walks there instead of faking an upload. */}
          <Link
            to="/plans"
            className="inline-flex items-center justify-center gap-2 rounded-xl px-[18px] py-2.5 text-sm font-semibold bg-gradient-hero text-white shadow-brand hover:shadow-brand-hover hover:brightness-[1.03] transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap"
          >
            <Plus className="w-[17px] h-[17px]" aria-hidden="true" />
            {t("materials.upload")}
          </Link>
          <p className="text-[11px] text-muted-foreground max-w-[240px] leading-relaxed sm:text-right">{t("materials.uploadHint")}</p>
        </div>
      </div>

      {materialsQuery.error ? (
        <div className="bg-card border border-border-soft rounded-2xl p-6 shadow-raised mt-6" role="alert">
          <p className="text-sm font-semibold">{t("materials.loadFailed")}</p>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => void materialsQuery.refetch()}
          >
            {t("materials.retry")}
          </button>
        </div>
      ) : materials.length === 0 ? (
        <div className="bg-card border border-border-soft rounded-2xl p-8 shadow-raised mt-6 text-center">
          <p className="text-sm font-semibold">{t("materials.emptyTitle")}</p>
          <p className="text-sm text-muted-foreground mt-1.5">{t("materials.emptyBody")}</p>
        </div>
      ) : (
        <>
          {/* Kind filter row (all / pdf / markdown) — the demo tag row's
              replacement (spec decision 2: kind is the real facetable). */}
          <div className="flex flex-wrap items-center gap-2 mt-5" role="group" aria-label={t("materials.filterLabel")}>
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={`px-3.5 py-[7px] rounded-full text-xs font-semibold border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  kind === k
                    ? "bg-foreground text-background border-transparent"
                    : "bg-[var(--glass-3)] border-border-soft text-muted-foreground hover:bg-[var(--glass-solid)]"
                }`}
              >
                {t(KIND_KEYS[k])}
              </button>
            ))}
          </div>

          {/* Search (titles — the wire title is a plain string) */}
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[var(--glass-4)] border border-border mt-3">
            <Search className="w-[18px] h-[18px] text-muted-foreground flex-none" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("materials.search")}
              aria-label={t("materials.search")}
              className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm placeholder:text-caption focus-visible:outline-none"
            />
          </div>

          {/* Material rows */}
          <div className="flex flex-col gap-2 mt-4">
            {items.map((m) => (
              <MaterialRow key={m.id} material={m} scopeLabel={scopeLabel(m)} />
            ))}
          </div>

          {items.length === 0 && (
            <div className="empty-state">
              <b>{t("materials.filterEmptyTitle")}</b>
              <span>{t("materials.filterEmptyBody")}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
