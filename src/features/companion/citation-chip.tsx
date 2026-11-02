/**
 * CitationChip (T5 · UX CitationChip; AD-8): a reply's source locator rendered
 * as 第 N 页 / section title. The click is an IN-READER command through the
 * AD-8 anchor channel — the reader scrolls to the source and flashes it in the
 * citation tint (ReaderPage's jump handler; no route change, same channel as
 * external deep links). Keyboard-focusable with a visible ring (a11y floor).
 */
import { Paperclip } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Material, ReadingLocator } from "@/domain/entities";
import { citationLabel, companionSectionId } from "./message-shaping";

interface CitationChipProps {
  material: Material | null;
  locator: ReadingLocator;
  onJump(locator: ReadingLocator): void;
}

export function CitationChip({ material, locator, onJump }: CitationChipProps) {
  const { t } = useLanguage();
  const label = citationLabel(material, locator);
  const fallbackId = companionSectionId(locator);
  const page = label.page !== null ? t("companion.chipPage", { n: label.page }) : null;
  // 「📎 第 7 页 · 12.2 集成策略」 — page and section read as one place (mock).
  const text = page
    ? label.title
      ? `${page} · ${label.title}`
      : page
    : (label.title ?? fallbackId);
  const aria = page
    ? t("companion.chipAriaPage", { n: label.page ?? 1 })
    : t("companion.chipAriaSection", { title: text });

  return (
    <button
      type="button"
      onClick={() => onJump(locator)}
      aria-label={aria}
      title={aria}
      className="inline-flex max-w-full items-center gap-1 rounded-[7px] bg-[hsl(var(--citation-tint))] text-[var(--citation-ink)] px-2 py-[3px] text-[11px] font-semibold leading-[1.4] cursor-pointer transition-colors hover:brightness-95 dark:hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Paperclip className="w-3 h-3 flex-none" aria-hidden="true" />
      <span className="truncate">{text}</span>
    </button>
  );
}
