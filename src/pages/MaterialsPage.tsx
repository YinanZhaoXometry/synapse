import { AnimatedSection, AnimatedCard } from "@/components/shared/AnimatedSection";
import { BookOpen, Upload, Search, FileText, Tag, FolderOpen } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface Material {
  id: number;
  titleKey: string;
  subject: { zh: string; en: string };
  type: "pdf" | "notes" | "slides";
  pages?: number;
  uploadedAt: { zh: string; en: string };
  tags: { zh: string[]; en: string[] };
}

const sampleMaterials: Material[] = [
  { id: 1, titleKey: "material.hciLecture1", subject: { zh: "人机交互", en: "HCI" }, type: "pdf", pages: 42, uploadedAt: { zh: "3月14日", en: "Mar 14" }, tags: { zh: ["人机交互", "入门"], en: ["HCI", "Intro"] } },
  { id: 2, titleKey: "material.usabilityNotes", subject: { zh: "人机交互", en: "HCI" }, type: "notes", uploadedAt: { zh: "3月16日", en: "Mar 16" }, tags: { zh: ["人机交互", "可用性", "nielsen"], en: ["HCI", "Usability", "Nielsen"] } },
  { id: 3, titleKey: "material.cognitiveLoad", subject: { zh: "人机交互", en: "HCI" }, type: "slides", pages: 28, uploadedAt: { zh: "3月18日", en: "Mar 18" }, tags: { zh: ["人机交互", "认知"], en: ["HCI", "Cognition"] } },
  { id: 4, titleKey: "material.userResearch", subject: { zh: "人机交互", en: "HCI" }, type: "pdf", pages: 35, uploadedAt: { zh: "3月19日", en: "Mar 19" }, tags: { zh: ["人机交互", "研究"], en: ["HCI", "Research"] } },
  { id: 5, titleKey: "material.interactionPatterns", subject: { zh: "人机交互", en: "HCI" }, type: "notes", uploadedAt: { zh: "3月20日", en: "Mar 20" }, tags: { zh: ["人机交互", "模式", "设计"], en: ["HCI", "Patterns", "Design"] } },
];

const typeIcon: Record<string, string> = { pdf: "📄", notes: "📝", slides: "📊" };

export default function MaterialsPage() {
  const { t, language } = useLanguage();
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const allTags = Array.from(new Set(sampleMaterials.flatMap(m => m.tags[language])));
  const filtered = sampleMaterials.filter(m => {
    const title = t(m.titleKey).toLowerCase();
    const matchesSearch = !search || title.includes(search.toLowerCase());
    const matchesTag = !activeTag || m.tags[language].includes(activeTag);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <AnimatedSection>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">{t("materials.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("materials.uploaded")} {sampleMaterials.length} {t("materials.files")}</p>
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all active:scale-[0.97]">
            <Upload className="w-4 h-4" /> {t("materials.upload")}
          </button>
        </div>
      </AnimatedSection>

      <AnimatedSection delay={0.05}>
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("materials.search")} className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm outline-none focus:ring-2 ring-primary/20 transition-shadow" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {allTags.slice(0, 5).map(tag => (
              <button key={tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all", activeTag === tag ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                {tag}
              </button>
            ))}
          </div>
        </div>
      </AnimatedSection>

      <div className="space-y-2">
        {filtered.map((m, i) => (
          <AnimatedCard key={m.id} delay={0.08 + i * 0.04}>
            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:shadow-sm transition-shadow cursor-pointer active:scale-[0.995]">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-lg">{typeIcon[m.type]}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{t(m.titleKey)}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">{m.subject[language]}</span>
                  {m.pages && <span className="text-xs text-muted-foreground">· {m.pages} {t("materials.pages")}</span>}
                  <span className="text-xs text-muted-foreground">· {m.uploadedAt[language]}</span>
                </div>
              </div>
              <div className="hidden sm:flex gap-1.5">
                {m.tags[language].slice(0, 2).map(tag => (
                  <span key={tag} className="px-2 py-0.5 rounded-md bg-secondary text-[10px] font-medium text-muted-foreground">{tag}</span>
                ))}
              </div>
            </div>
          </AnimatedCard>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <FolderOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t("materials.noResults")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
