import { useState } from "react";
import { toast } from "sonner";
import { Plus, Search, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { MATERIALS, TAG_IDS, pickL, type MaterialTag } from "@/lib/demo-data";

const TAG_KEYS: Record<(typeof TAG_IDS)[number], string> = {
  all: "materials.tagAll",
  course: "materials.tagCourse",
  notes: "materials.tagNotes",
  exam: "materials.tagExam",
};

function tagKey(tag: (typeof TAG_IDS)[number]) {
  return TAG_KEYS[tag];
}

function materialTagKey(tag: MaterialTag) {
  return `materials.tag${tag.charAt(0).toUpperCase()}${tag.slice(1)}`;
}

export default function MaterialsPage() {
  const { t, language } = useLanguage();
  const [activeTag, setActiveTag] = useState<(typeof TAG_IDS)[number]>("all");
  const [query, setQuery] = useState("");

  // Same filter as the prototype: tag + query against title (zh+en), tag label, and type.
  const items = MATERIALS.filter(m => {
    if (activeTag !== "all" && m.tag !== activeTag) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const tagLabel = t(materialTagKey(m.tag));
    const hay = `${m.title.zh} ${m.title.en} ${tagLabel} ${m.type}`.toLowerCase();
    return hay.includes(q);
  });

  return (
    <div className="p-6 md:p-8 max-w-[1120px] mx-auto">
      {/* Page head */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="eyebrow">{t("materials.eyebrow")}</p>
          <h1 className="page-title mt-1.5">{t("materials.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-[62ch]">{t("materials.subtitle", { n: MATERIALS.length })}</p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2">
          <button
            type="button"
            onClick={() => toast(t("materials.uploadToast"))}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-[18px] py-2.5 text-sm font-semibold bg-gradient-hero text-white shadow-brand hover:shadow-brand-hover hover:brightness-[1.03] transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-[17px] h-[17px]" aria-hidden="true" />
            {t("materials.upload")}
          </button>
          <p className="text-[11px] text-muted-foreground max-w-[240px] leading-relaxed sm:text-right">{t("materials.uploadHint")}</p>
        </div>
      </div>

      {/* Tag filter row */}
      <div className="flex flex-wrap items-center gap-2 mt-5" role="group" aria-label={t("materials.eyebrow")}>
        {TAG_IDS.map(tag => (
          <button
            key={tag}
            type="button"
            onClick={() => setActiveTag(tag)}
            aria-pressed={activeTag === tag}
            className={`px-3.5 py-[7px] rounded-full text-xs font-semibold border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTag === tag
                ? "bg-foreground text-background border-transparent"
                : "bg-[var(--glass-3)] border-border-soft text-muted-foreground hover:bg-white"
            }`}
          >
            {t(tagKey(tag))}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[var(--glass-4)] border border-border mt-3">
        <Search className="w-[18px] h-[18px] text-muted-foreground flex-none" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t("materials.search")}
          aria-label={t("materials.search")}
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm placeholder:text-caption focus-visible:outline-none"
        />
      </div>

      {/* Material rows */}
      <div className="flex flex-col gap-2 mt-4">
        {items.map(m => (
          <div
            key={m.id}
            className="group flex items-center gap-4 px-4 py-3.5 bg-card border border-border-soft rounded-xl shadow-soft transition-all hover:shadow-raised hover:-translate-y-px"
          >
            <span className="w-[42px] h-[42px] rounded-[11px] flex-none grid place-items-center bg-secondary text-lg" aria-hidden="true">
              {m.type === "pdf" ? "📄" : "📝"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{pickL(m.title, language)}</div>
              <div className="flex items-center gap-1.5 flex-wrap mt-[3px] text-[10px] text-muted-foreground">
                <span>{m.type === "pdf" ? t("materials.filePdf") : t("materials.fileMd")}</span>
                <span aria-hidden="true">·</span>
                <span>{t("materials.pages", { n: m.pages })}</span>
                <span aria-hidden="true">·</span>
                <span>{m.size}</span>
                <span aria-hidden="true">·</span>
                <span>{t("materials.updated", { d: pickL(m.updated, language) })}</span>
              </div>
            </div>
            <div className="flex-none flex gap-[5px]">
              <span className="px-2 py-[3px] rounded-full bg-[var(--surface-warm)] border border-border-soft text-[10px] font-semibold text-muted-foreground whitespace-nowrap">
                {t(materialTagKey(m.tag))}
              </span>
            </div>
            <div className="flex-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => toast(t("materials.readerToast"))}
                className="inline-flex items-center justify-center gap-2 rounded-[10px] px-3 py-1.5 text-[13px] font-semibold bg-[var(--glass-4)] border border-border hover:bg-[var(--glass-solid)] transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer whitespace-nowrap"
              >
                {t("materials.open")}
                <ChevronRight className="w-[15px] h-[15px]" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="empty-state">
          <b>{t("materials.empty")}</b>
          <span>{t("materials.emptyHint")}</span>
        </div>
      )}
    </div>
  );
}
