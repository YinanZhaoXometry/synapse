/**
 * FlashcardLauncher (epic-6 T3; FR-19; UX spine FlashcardStudy entry): the
 * dialog CONTENT on Plan Home's 闪卡 quick tile and inline on
 * /plan/:id/flashcards when the plan has no cards yet — one component, both
 * surfaces (QuizLauncher precedent). Generation goes through the driver's AI
 * seam: 「来自 N 份材料 · 正在生成闪卡」 stays cancellable until the cards
 * land; failure is a neutral toast with the form intact for retry — no cards
 * created, plan state untouched (spec story 8). No parsed materials →
 * disabled with a bilingual reason (spec story 7). Regeneration policy
 * (spec decision 9, simplest honest shape): this launcher generates only when
 * the plan has NO cards — a plan with cards opens the existing study directly
 * (the tile's 「继续学习」), so cards are never silently duplicated.
 */
import { CircleAlert, FileText, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Material } from "@/domain/entities";
import { flashcardMaterialRefs, studyableMaterials } from "./display-shaping";
import { useFlashcardGeneration } from "./use-flashcard-generation";

export interface FlashcardLauncherProps {
  /** The plan's attached materials (already loaded); parsed ones shape the deck. */
  materials: Material[];
  /** Called once cards EXIST (persisted) — the surface navigates to the study. */
  onCreated: () => void;
}

export function FlashcardLauncher({ materials, onCreated }: FlashcardLauncherProps) {
  const { t } = useLanguage();
  const driver = useFlashcardGeneration();
  const studyable = studyableMaterials(materials);

  if (studyable.length === 0) {
    // The disabled state explains itself (UX spine; spec story 7).
    return (
      <div className="text-center py-6 px-4" data-testid="flashcards-launcher-disabled">
        <CircleAlert className="w-5 h-5 mx-auto text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-semibold mt-2">{t("flashcards.launcher.title")}</p>
        <p className="text-xs text-muted-foreground mt-1.5 leading-[1.6]">{t("flashcards.launcher.needMaterial")}</p>
      </div>
    );
  }

  if (driver.phase === "generating") {
    // 「来自 N 份材料 · 正在生成闪卡」 — cancellable until the cards land.
    return (
      <div className="text-center py-8 px-4" data-testid="flashcards-launcher-generating">
        <Loader2 className="w-5 h-5 mx-auto animate-spin text-accent-ink" aria-hidden="true" />
        <p className="text-sm font-semibold mt-3">{t("flashcards.launcher.generating", { n: studyable.length })}</p>
        <button
          type="button"
          data-testid="flashcards-launcher-cancel"
          onClick={driver.cancelStart}
          className="mt-4 inline-flex items-center justify-center rounded-xl border border-border bg-[var(--glass-4)] px-4 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-[var(--glass-solid)] active:scale-[0.97] cursor-pointer"
        >
          {t("flashcards.launcher.cancel")}
        </button>
      </div>
    );
  }

  const start = async () => {
    try {
      // true only when the cards LANDED — a cancelled start resolves false and
      // must not send the surface to the study
      const created = await driver.start({ materials: flashcardMaterialRefs(studyable) });
      if (created) onCreated();
    } catch {
      // neutral toast, form stays for the retry; plan state untouched, no cards (spec story 8)
      toast(t("flashcards.launcher.failed"));
    }
  };

  return (
    <div data-testid="flashcards-launcher">
      <p className="eyebrow">{t("flashcards.launcher.title")}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-[1.6]">{t("flashcards.launcher.subtitle")}</p>

      {/* the deck's sources — read-only; every parsed material contributes its sections */}
      <div className="mt-4 flex flex-col gap-2">
        {studyable.map((material) => (
          <div
            key={material.id}
            data-testid={`flashcards-source-${material.id}`}
            className="flex items-center gap-2.5 rounded-xl border border-border-soft px-3 py-2.5 text-left text-[13px] min-w-0"
          >
            <FileText className="w-4 h-4 text-muted-foreground flex-none" aria-hidden="true" />
            <span className="truncate font-semibold">{material.title}</span>
            <span className="ml-auto text-[10px] text-muted-foreground flex-none">
              {t("plans.parseParsed", { n: material.sections.length })}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        data-testid="flashcards-launcher-start"
        onClick={() => void start()}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-hero px-5 py-2.5 text-sm font-semibold text-white shadow-brand transition-all hover:-translate-y-px hover:shadow-brand-hover hover:brightness-[1.03] active:scale-[0.97] cursor-pointer"
      >
        <Sparkles className="w-4 h-4" aria-hidden="true" />
        {t("flashcards.launcher.start")}
      </button>
    </div>
  );
}
