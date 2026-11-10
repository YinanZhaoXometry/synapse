/**
 * The shared page-loading state (epic-28 T3): the honest wait signal for
 * top-level pages whose queries are in flight — every one of them used to
 * render `null`, so the app looked broken on any slow fetch. One centered
 * glass card, a spinner + the bilingual label. `body.reduce-motion` (the
 * Settings toggle and prefers-reduced-motion) freezes the spin globally —
 * the label carries the meaning alone in that mode. role="status" +
 * aria-busy for assistive tech.
 */
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

export default function PageLoader({ className }: { className?: string }) {
  const { t } = useLanguage();
  return (
    <div role="status" aria-busy="true" className={cn("min-h-[50vh] grid place-items-center", className)}>
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-[var(--glass-4)] px-8 py-6 shadow-sm">
        <Loader2 className="w-6 h-6 animate-spin text-accent-ink" aria-hidden="true" />
        <span className="text-sm font-medium text-muted-foreground">{t("common.loading")}</span>
      </div>
    </div>
  );
}
