/**
 * CompanionPanel (T5 · FR-11/12) — the page-aware Companion beside the
 * reading; the companion feature's public surface (AD-2). Scaffold chat
 * surface pattern (AITutorPage look: avatar chips, bubbles, typing dots,
 * sticky composer, auto-scroll; Enter send / Shift+Enter newline). Every
 * request grounds on the reader's CURRENT Reading Position (read at send time
 * from T4's tracker ref) and streams through the CompanionService seam (AD-5).
 *
 * The guardrail ladder is rendered from the reply contract, never guessed:
 * quiz-me replies labeled as the user's attempt first, hint/worked-step rungs
 * labeled as guidance with the quiet EscalationControl (「直接看答案」, always
 * reachable — the ladder is a wall for no one), direct answers labeled
 * 答案/Answer, still cited. CitationChips jump the reader through the AD-8
 * anchor channel (scroll + flash) via the onJumpToLocator command.
 *
 * Honest states (UX parse-failure + streaming + error): parsing → waiting
 * copy; parse failed → disabled with honest copy (never chats against a
 * document it can't see); no position yet → send disabled with a hint (the
 * honest wait — see use-companion-chat); request failure → neutral toast +
 * one-click retry with the typed text preserved.
 *
 * Positioning is the READER's job (this component fills whatever container
 * mounts it) — the desktop dock lives in ReaderPage, the responsive ladder is
 * T6's seam.
 */
import { useEffect, useRef, type RefObject } from "react";
import { Check, RotateCw, Send, Sparkles } from "lucide-react";
import type { CompanionReply } from "@/ai/types";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Material, ReadingLocator, ReadingPosition } from "@/domain/entities";
import { cn } from "@/lib/utils";
import { CitationChip } from "./citation-chip";
import { locatorDisplayTarget, type CompanionEntry } from "./message-shaping";
import { useCompanionChat } from "./use-companion-chat";

export interface CompanionPanelProps {
  materialId: string;
  material: Material | null;
  /** T4 tracker surface: the live ReadingPosition, read at SEND time. */
  positionRef: RefObject<ReadingPosition | null>;
  /** Reactive mirror of the position for display (grounded badge + send gating). */
  displayLocator: ReadingLocator | null;
  /** AD-8 in-reader jump: scroll the reader to this locator and flash it. */
  onJumpToLocator(locator: ReadingLocator): void;
}

export function CompanionPanel({
  materialId,
  material,
  positionRef,
  displayLocator,
  onJumpToLocator,
}: CompanionPanelProps) {
  const { t } = useLanguage();
  const chat = useCompanionChat(materialId, positionRef);

  const parseState = material?.parseState ?? "pending";
  const parseFailed = parseState === "failed";
  const canChat = parseState === "parsed";
  const positionReady = displayLocator !== null;
  const sendReady = canChat && chat.hydrated && !chat.busy && positionReady;

  // Auto-scroll to the newest row / latest streamed token (scaffold pattern).
  const threadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.entries.length, chat.streamText]);

  // Auto-grow composer (cap ~120px, AITutorPage).
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [chat.input]);

  const sendMessage = () => {
    if (sendReady) chat.send(chat.input);
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Grounded badge (mock: ◎ 已定位 · 第 7 页) — the panel's quiet proof of grounding.
  const locatorTargetText = (locator: ReadingLocator): string | null => {
    if (!material) return null;
    const target = locatorDisplayTarget(material, locator);
    return target.page !== null ? t("companion.chipPage", { n: target.page }) : target.text;
  };
  const badgeTarget = displayLocator ? locatorTargetText(displayLocator) : null;
  const streamTarget = chat.streamPosition ? locatorTargetText(chat.streamPosition.locator) : null;

  const idle = canChat && chat.entries.length === 0 && !chat.busy;
  const starters = [
    t("companion.starterExplain"),
    t("companion.starterQuiz"),
    t("companion.starterSummarize"),
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* header */}
      <div className="flex-none flex items-center gap-2.5 h-[52px] px-4 border-b border-border-soft">
        <span
          aria-hidden="true"
          className="w-8 h-8 rounded-[9px] bg-[var(--accent-tint)] text-accent-ink grid place-items-center text-xs font-bold shrink-0 font-display"
        >
          S
        </span>
        <div className="text-sm font-semibold leading-tight min-w-0 truncate">{t("companion.title")}</div>
        {badgeTarget && (
          <span className="ml-auto flex-none inline-flex items-center rounded-full bg-[var(--accent-tint)] text-accent-ink px-2 py-0.5 text-[11px] font-semibold">
            {t("companion.groundedBadge", { target: badgeTarget })}
          </span>
        )}
      </div>

      {/* transcript */}
      <div ref={threadRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-4">
          {chat.entries.map((entry) =>
            entry.role === "user" ? (
              <UserBubble key={entry.id} entry={entry} onRetry={() => chat.retry(entry.id)} />
            ) : (
              <CompanionBubble
                key={entry.id}
                entry={entry}
                material={material}
                onJump={onJumpToLocator}
                onEscalate={() => chat.escalate(entry.id)}
              />
            ),
          )}
          {chat.busy && (
            <StreamingBubble
              text={chat.streamText}
              target={streamTarget}
              groundingLabel={t("companion.groundingStream", { target: streamTarget ?? "" })}
            />
          )}
        </div>
        {chat.completionSignal > 0 && (
          // Announced ONCE per completed reply — never per token (a11y floor).
          <span key={chat.completionSignal} role="status" className="sr-only">
            {t("companion.replyComplete")}
          </span>
        )}
      </div>

      {/* idle starters (FR-11) */}
      {idle && !parseFailed && (
        <div className="flex-none flex flex-wrap gap-2 px-4 pb-2">
          {starters.map((question) => (
            <button
              key={question}
              type="button"
              disabled={!sendReady}
              onClick={() => chat.send(question)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-[7px] text-xs font-medium text-muted-foreground hover:border-[color:var(--accent-edge)] hover:bg-secondary hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-accent-ink" aria-hidden="true" />
              {question}
            </button>
          ))}
        </div>
      )}

      {/* composer + honest states */}
      <div className="flex-none px-4 pb-4 pt-1">
        {canChat ? (
          <>
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2.5 pl-3.5 shadow-raised">
              <textarea
                ref={inputRef}
                rows={1}
                value={chat.input}
                onChange={(e) => chat.setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={chat.busy || parseFailed}
                placeholder={t("companion.placeholder")}
                aria-label={t("companion.placeholder")}
                className="flex-1 min-w-0 min-h-6 max-h-[120px] resize-none border-none bg-transparent px-0 py-[5px] text-sm leading-[1.55] placeholder:text-caption-soft focus:outline-none focus-visible:outline-none disabled:opacity-60"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={!sendReady}
                aria-label={t("companion.send")}
                className={cn(
                  "w-[42px] h-[42px] rounded-xl bg-gradient-hero text-white grid place-items-center shrink-0",
                  // Token-driven brand glow (grad-a) — palette-coherent in every
                  // theme, unlike a hardcoded coral rgba (AGENTS conventions).
                  "shadow-brand hover:shadow-brand-hover hover:-translate-y-px transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]",
                  "disabled:opacity-50 disabled:pointer-events-none",
                )}
              >
                <Send className="w-[18px] h-[18px]" aria-hidden="true" />
              </button>
            </div>
            {!positionReady && (
              <p className="text-[10px] text-caption text-center pt-2">{t("companion.waitingPosition")}</p>
            )}
          </>
        ) : parseFailed ? (
          // Companion disabled honestly — never chats against a document it can't see.
          <p className="text-xs text-muted-foreground leading-[1.6] text-center border border-dashed border-border rounded-xl px-3 py-2.5 bg-secondary/50">
            {t("companion.disabledFailed")}
          </p>
        ) : (
          // Parsing / pending (self-heal fires) — the panel waits, it never pretends.
          <p className="text-xs text-muted-foreground leading-[1.6] text-center border border-dashed border-border rounded-xl px-3 py-2.5 bg-secondary/50">
            {t("companion.waitingParsing")}
          </p>
        )}
      </div>
    </div>
  );
}

/** The user's row — a failed turn keeps its text visible with a one-click retry. */
function UserBubble({ entry, onRetry }: { entry: CompanionEntry; onRetry(): void }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-row-reverse gap-2.5 max-w-[88%] self-end">
      <span
        aria-hidden="true"
        className="w-[30px] h-[30px] rounded-[9px] bg-foreground text-background grid place-items-center text-xs font-bold shrink-0"
      >
        Y
      </span>
      <div className="flex flex-col items-end gap-1 min-w-0">
        <div className="chat-body leading-[1.7] rounded-[14px] rounded-tr-[4px] bg-foreground text-background px-[15px] py-3 whitespace-pre-wrap">
          {entry.text}
        </div>
        {entry.failed && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            <RotateCw className="w-3 h-3" aria-hidden="true" /> {t("companion.retry")}
          </button>
        )}
      </div>
    </div>
  );
}

/** The Companion's row — rung label, CitationChips, escalation, honest fallback. */
function CompanionBubble({
  entry,
  material,
  onJump,
  onEscalate,
}: {
  entry: CompanionEntry;
  material: Material | null;
  onJump(locator: ReadingLocator): void;
  onEscalate(): void;
}) {
  const { t } = useLanguage();
  const reply = entry.reply;
  const rungLabel = reply ? replyLabel(reply, t) : null;
  return (
    <div className="flex gap-2.5 max-w-[88%] self-start">
      <span
        aria-hidden="true"
        className="w-[30px] h-[30px] rounded-[9px] bg-[var(--accent-tint)] text-accent-ink grid place-items-center text-xs font-bold shrink-0"
      >
        S
      </span>
      <div className="chat-body leading-[1.7] rounded-[14px] rounded-tl-[4px] bg-card border border-border-soft shadow-soft px-[15px] py-3 min-w-0">
        <p className="whitespace-pre-wrap">{entry.text}</p>
        {entry.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {entry.citations.map((locator, i) => (
              <CitationChip key={`${entry.id}-${i}`} material={material} locator={locator} onJump={onJump} />
            ))}
          </div>
        )}
        {(rungLabel || (reply && reply.canEscalate && reply.rung !== "answer")) && (
          <div className="mt-2.5 flex items-center gap-2.5 flex-wrap">
            {rungLabel && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                <Check className="w-3 h-3 text-accent-ink" aria-hidden="true" />
                {rungLabel}
              </span>
            )}
            {reply && reply.canEscalate && reply.rung !== "answer" && (
              // Quiet EscalationControl (FR-12): skips the remaining rungs —
              // the same question + send-time position, escalated: true.
              <button
                type="button"
                onClick={onEscalate}
                className="text-[11px] font-semibold text-accent-ink hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                {t("companion.escalate")}
              </button>
            )}
          </div>
        )}
        {reply && reply.intent === "beyond-material" && (
          // The general-knowledge offer, distinct — never blended into course
          // authority, never auto-mixed (NFR-1; UX ungroundable state).
          <div className="mt-2.5 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-[11px] text-muted-foreground">
            {t("companion.generalKnowledgeLabel")}
          </div>
        )}
      </div>
    </div>
  );
}

/** Streaming row: partial text + the subtle grounding line (mock) — chips swap
 * in when the reply object resolves with its citations (contract note:
 * CompanionReply.citations exist on the final reply only). */
function StreamingBubble({
  text,
  target,
  groundingLabel,
}: {
  text: string | null;
  target: string | null;
  groundingLabel: string;
}) {
  return (
    <div className="flex gap-2.5 max-w-[88%] self-start">
      <span
        aria-hidden="true"
        className="w-[30px] h-[30px] rounded-[9px] bg-[var(--accent-tint)] text-accent-ink grid place-items-center text-xs font-bold shrink-0"
      >
        S
      </span>
      <div className="chat-body leading-[1.7] rounded-[14px] rounded-tl-[4px] bg-card border border-border-soft shadow-soft px-[15px] py-3 min-w-0">
        {text !== null && text.length > 0 && <p className="whitespace-pre-wrap">{text}</p>}
        <div className="flex items-center gap-1 mt-1" aria-hidden="true">
          <span className="w-1.5 h-1.5 rounded-full bg-caption-soft animate-bounce" />
          <span className="w-1.5 h-1.5 rounded-full bg-caption-soft animate-bounce" style={{ animationDelay: "160ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-caption-soft animate-bounce" style={{ animationDelay: "320ms" }} />
          {target && <span className="text-[11px] text-muted-foreground ml-1">{groundingLabel}</span>}
        </div>
      </div>
    </div>
  );
}

/** The rung label from the structured reply, never guessed (NFR-2; intent table). */
function replyLabel(reply: CompanionReply, t: (key: string, vars?: Record<string, string | number>) => string): string {
  if (reply.intent === "quiz-me") return t("companion.rungQuiz"); // Socratic — never reveals before an attempt
  if (reply.rung === "hint") return t("companion.rungHint");
  if (reply.rung === "worked-step") return t("companion.rungWorkedStep");
  return t("companion.rungAnswer"); // direct answers are labeled 答案 / Answer
}
