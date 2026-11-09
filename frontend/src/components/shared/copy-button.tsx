/**
 * The chat bubbles' copy affordance (epic-26 T2): hover/focus-revealed by the
 * mounting bubble (`group` + the reveal classes it passes), Copy → Check for
 * ~1.5s → revert; a clipboard failure toasts. Copies the caller's RAW text —
 * the markdown source, the way agent apps copy.
 */
import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { copyTextToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

export function CopyButton({
  text,
  className,
  testId = "chat-copy",
}: {
  text: string;
  /** Positioning + reveal classes the mounting bubble owns (absolute corner). */
  className?: string;
  testId?: string;
}) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const onCopy = () => {
    void copyTextToClipboard(text).then((ok) => {
      if (!ok) {
        toast.error(t("chat.copyFailed"));
        return;
      }
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    });
  };

  const label = copied ? t("chat.copied") : t("chat.copy");
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      title={label}
      onClick={onCopy}
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-full border border-border-soft bg-[var(--glass-4)] text-muted-foreground shadow-soft backdrop-blur-sm transition-colors hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {copied ? (
        <Check className="w-3 h-3 text-mastered-ink" aria-hidden="true" />
      ) : (
        <Copy className="w-3 h-3" aria-hidden="true" />
      )}
    </button>
  );
}
