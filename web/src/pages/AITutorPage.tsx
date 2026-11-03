import { useEffect, useRef, useState } from "react";
import { BookOpen, BookmarkMinus, HelpCircle, Send, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type Intent = "explain" | "quiz" | "summary" | "mistake";

type ChatMessage = { role: "ai"; key: string } | { role: "user"; text: string };

const INTENT_REPLY: Record<Intent, string> = {
  explain: "tutor.replyExplain",
  quiz: "tutor.replyQuiz",
  summary: "tutor.replySummary",
  mistake: "tutor.replyMistake",
};

/** Keyword routing copied from prototype detectIntent (app.js ~1436). */
function detectIntent(text: string): string {
  const s = text.toLowerCase();
  if (/业界|industry|通用|general|outside/.test(s)) return "tutor.replyBeyond";
  if (/错|mistake|wrong|error|错误/.test(s)) return "tutor.replyMistake";
  if (/考|quiz|test|练习/.test(s)) return "tutor.replyQuiz";
  if (/总结|summar|笔记|note/.test(s)) return "tutor.replySummary";
  if (/解释|explain|为什么|why|概念|concept/.test(s)) return "tutor.replyExplain";
  return "tutor.replyGeneric";
}

export default function AITutorPage() {
  const { t } = useLanguage();
  const [chat, setChat] = useState<ChatMessage[]>([{ role: "ai", key: "tutor.initial" }]);
  const [chatBusy, setChatBusy] = useState(false);
  const [input, setInput] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<number | null>(null);

  const suggestions: Array<{ intent: Intent; labelKey: string; icon: typeof Sparkles }> = [
    { intent: "explain", labelKey: "tutor.suggestExplain", icon: Sparkles },
    { intent: "quiz", labelKey: "tutor.suggestQuiz", icon: HelpCircle },
    { intent: "summary", labelKey: "tutor.suggestSummary", icon: BookOpen },
    { intent: "mistake", labelKey: "tutor.suggestMistake", icon: BookmarkMinus },
  ];

  // Auto-grow the composer textarea (cap ~120px like prototype).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  // Keep the thread scrolled to the latest message.
  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [chat, chatBusy]);

  // Clear the pending demo reply on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const sendChat = (text: string, directIntent?: Intent) => {
    if (chatBusy) return;
    const clean = String(text || "").trim();
    if (!clean && !directIntent) return;
    const replyKey = directIntent ? INTENT_REPLY[directIntent] : detectIntent(clean);
    if (clean) setChat(prev => [...prev, { role: "user", text: clean }]);
    setChatBusy(true);
    setInput("");
    timerRef.current = window.setTimeout(() => {
      setChat(prev => [...prev, { role: "ai", key: replyKey }]);
      setChatBusy(false);
    }, 1200);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat(input);
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-[900px] mx-auto px-6 md:px-8 py-6 md:py-8">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border-soft shrink-0">
        <span aria-hidden="true" className="w-10 h-10 rounded-xl bg-gradient-hero shadow-brand grid place-items-center text-white shrink-0">
          <Sparkles className="w-[19px] h-[19px]" />
        </span>
        <div>
          <div className="font-body text-lg font-semibold tracking-[-0.01em]">{t("tutor.title")}</div>
          <div className="text-xs text-caption mt-0.5">{t("tutor.subtitle")}</div>
        </div>
      </div>

      {/* Thread */}
      <div ref={threadRef} className="flex-1 min-h-0 overflow-y-auto py-6">
        <div className="flex flex-col gap-4" aria-live="polite">
          {chat.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex flex-row-reverse gap-2.5 max-w-[88%] self-end">
                <span
                  aria-hidden="true"
                  className="w-[30px] h-[30px] rounded-[9px] bg-foreground text-background grid place-items-center text-xs font-bold shrink-0"
                >
                  Y
                </span>
                <div className="chat-body leading-[1.7] rounded-[14px] rounded-tr-[4px] bg-foreground text-background px-[15px] py-3 whitespace-pre-wrap">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={i} className="flex gap-2.5 max-w-[88%] self-start">
                <span
                  aria-hidden="true"
                  className="w-[30px] h-[30px] rounded-[9px] bg-[var(--accent-tint)] text-accent-ink grid place-items-center text-xs font-bold shrink-0"
                >
                  S
                </span>
                <div className="chat-body leading-[1.7] rounded-[14px] rounded-tl-[4px] bg-card border border-border-soft shadow-soft px-[15px] py-3">
                  {t(m.key)}
                </div>
              </div>
            )
          )}
          {chatBusy && (
            <div className="flex gap-2.5 max-w-[88%] self-start">
              <span
                aria-hidden="true"
                className="w-[30px] h-[30px] rounded-[9px] bg-[var(--accent-tint)] text-accent-ink grid place-items-center text-xs font-bold shrink-0"
              >
                S
              </span>
              <div className="rounded-[14px] rounded-tl-[4px] bg-card border border-border-soft shadow-soft px-[15px] py-3">
                <span role="status" aria-label={t("tutor.typing")} className="inline-flex items-center gap-1 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-caption-soft animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-caption-soft animate-bounce" style={{ animationDelay: "160ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-caption-soft animate-bounce" style={{ animationDelay: "320ms" }} />
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Suggestion chips */}
      <div className="flex flex-wrap gap-2 pb-4 shrink-0">
        {suggestions.map(s => (
          <button
            key={s.intent}
            type="button"
            onClick={() => sendChat(t(s.labelKey), s.intent)}
            disabled={chatBusy}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-[7px] text-xs font-medium text-muted-foreground",
              "hover:border-[color:var(--accent-edge)] hover:bg-secondary hover:text-foreground transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none"
            )}
          >
            <s.icon className="w-3.5 h-3.5 text-accent-ink" aria-hidden="true" />
            {t(s.labelKey)}
          </button>
        ))}
      </div>

      {/* Composer — unified shell (prototype .composer: white card, borderless textarea inside) */}
      <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2.5 pl-3.5 shadow-raised shrink-0">
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("tutor.placeholder")}
          aria-label={t("tutor.placeholder")}
          className="flex-1 min-w-0 min-h-6 max-h-[120px] resize-none border-none bg-transparent px-0 py-[5px] text-sm leading-[1.55] placeholder:text-caption-soft focus:outline-none focus-visible:outline-none"
        />
        <button
          type="button"
          onClick={() => sendChat(input)}
          disabled={chatBusy}
          aria-label={t("tutor.send")}
          className={cn(
            "w-[42px] h-[42px] rounded-xl bg-gradient-hero text-white grid place-items-center shrink-0",
            "shadow-[0_4px_12px_rgba(255,127,95,0.3)] hover:shadow-[0_6px_18px_rgba(255,127,95,0.4)] hover:-translate-y-px transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]",
            "disabled:opacity-50 disabled:pointer-events-none"
          )}
        >
          <Send className="w-[18px] h-[18px]" aria-hidden="true" />
        </button>
      </div>
      <p className="text-[10px] text-caption text-center pt-2 shrink-0">{t("tutor.demoNote")}</p>
    </div>
  );
}
