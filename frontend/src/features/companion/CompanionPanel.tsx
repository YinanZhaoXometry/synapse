/**
 * CompanionPanel (T5 · FR-11/12; plan mode FR-46 · epic P2-12 T3) — the
 * page-aware Companion beside the reading, and (mode="plan") the plan-grounded
 * chat on the plan home and /ai-tutor. Scaffold chat surface pattern
 * (AITutorPage look: avatar chips, bubbles, typing dots, sticky composer,
 * auto-scroll; Enter send / Shift+Enter newline). Both modes stream through
 * the CompanionService seam (AD-5) and render the guardrail ladder from the
 * reply contract, never guessed.
 *
 * Reading mode (default): every request grounds on the reader's CURRENT
 * Reading Position (read at send time from T4's tracker ref). Hint/worked-step
 * rungs labeled as guidance with the quiet EscalationControl (「直接看答案」,
 * always reachable — the ladder is a wall for no one), direct answers labeled
 * 答案/Answer, still cited. CitationChips jump the reader through the AD-8
 * anchor channel (scroll + flash) via the onJumpToLocator command.
 *
 * Plan mode: grounded on the WHOLE plan (no ReadingPosition — the server's
 * plan_grounding assembles the plan scope + confirmed mappings). Always
 * hint-first (the plan_companion payload has no escalation flag — the rung's
 * canEscalate is false and the EscalationControl never renders). Intent
 * shortcuts per the scaffold tutor pattern (explain / quiz me / summarize /
 * analyze my mistakes — the last opens the mistake-entry picker and grounds
 * the turn on the entry's own source section; its citation chip deep-links
 * the reader to that source through the AD-8 anchor channel). Chips resolve
 * their labels against the picked entry's source material.
 *
 * Honest states (UX parse-failure + streaming + error): reading mode's
 * parsing/failed/no-position states gate send honestly; plan mode has no
 * document gate (the plan grounding IS the honest source — empty materials
 * assemble an empty context server-side, which says so). Request failure →
 * neutral toast + one-click retry with the typed text preserved, both modes.
 *
 * Positioning is the MOUNTER's job (this component fills whatever container
 * mounts it) — the reader's dock and responsive ladder in ReaderPage's
 * companion-surfaces, the plan home drawer and /ai-tutor column in theirs.
 */
import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { BookmarkMinus, Check, RotateCw, Send, Sparkles } from "lucide-react";
import type { CompanionReply } from "@/ai/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PlanMistakeEntryView } from "@/api";
import type { Material, ReadingLocator, ReadingPosition } from "@/domain/entities";
import { cn } from "@/lib/utils";
import { CitationChip } from "./citation-chip";
import { locatorDisplayTarget, type BubbleEntry, type CompanionEntry } from "./message-shaping";
import { useCompanionChat } from "./use-companion-chat";
import { usePlanCompanionChat, type PlanCompanionEntry } from "./use-plan-companion-chat";

/**
 * The selection bar's Ask handoff (epic-13 T1, FR-13): the reader hands the
 * panel a pre-fill (a question quoting the selection — the user SEES what
 * rides) plus the pending selection text in a ref; the NEXT send consumes the
 * ref exactly once (use-companion-chat's selection rule). `nonce` makes the
 * identity: re-asking the same quote re-fills the composer.
 */
export interface AskPrefill {
  quote: string;
  nonce: number;
}

export interface ReadingCompanionPanelProps {
  /** "reading" (default) — the in-reader surface. */
  mode?: "reading";
  materialId: string;
  material: Material | null;
  /** T4 tracker surface: the live ReadingPosition, read at SEND time. */
  positionRef: RefObject<ReadingPosition | null>;
  /** Reactive mirror of the position for display (grounded badge + send gating). */
  displayLocator: ReadingLocator | null;
  /** AD-8 in-reader jump: scroll the reader to this locator and flash it. */
  onJumpToLocator(locator: ReadingLocator): void;
  /** The selection bar's pending grounding text — consumed by the next send. */
  selectionRef?: MutableRefObject<string | null>;
  /** The selection bar's composer pre-fill (the quote, honestly displayed). */
  askPrefill?: AskPrefill | null;
}

export interface PlanCompanionPanelProps {
  /** "plan" — the plan-grounded chat surface (FR-46). */
  mode: "plan";
  planId: string;
  /** The plan's materials — chip label resolution + jump targets. */
  materials: Material[];
  /** The plan's mistake entries — the "analyze my mistakes" picker's rows. */
  mistakeEntries: PlanMistakeEntryView[];
}

export type CompanionPanelProps = ReadingCompanionPanelProps | PlanCompanionPanelProps;

export function CompanionPanel(props: CompanionPanelProps) {
  if (props.mode === "plan") {
    return <PlanCompanionSurface {...props} />;
  }
  return <ReadingCompanionSurface {...props} />;
}

// -- shared rows ---------------------------------------------------------------------

/** A transcript row's bubble-rendering slice + retry flag (both modes' entry
 * shapes satisfy it structurally). */
type ChatEntry = BubbleEntry & { failed: boolean };

/** The user's row — a failed turn keeps its text visible with a one-click retry. */
function UserBubble({ entry, onRetry }: { entry: ChatEntry; onRetry(): void }) {
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
  entry: BubbleEntry;
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

/** Streaming row: partial text + the send-time grounding CitationChip (spec:
 * chips render alongside their claims mid-stream — the locator is known at
 * request time, so the chip is here and jumpable the whole turn) + the subtle
 * grounding line. CompanionReply.citations exist on the final reply only, so
 * the reply's full citation list swaps in below when it resolves. */
function StreamingBubble({
  text,
  target,
  groundingLabel,
  locator,
  material,
  onJump,
}: {
  text: string | null;
  target: string | null;
  groundingLabel: string;
  locator: ReadingLocator | null;
  material: Material | null;
  onJump(locator: ReadingLocator): void;
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
        {locator && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            <CitationChip material={material} locator={locator} onJump={onJump} />
          </div>
        )}
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

/** The scaffold's starter row: intent chips (the chip text IS the question). */
function StarterChip({
  label,
  onClick,
  disabled,
  title,
  Icon,
}: {
  label: string;
  onClick(): void;
  disabled?: boolean;
  title?: string;
  Icon: typeof Sparkles;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-[7px] text-xs font-medium text-muted-foreground hover:border-[color:var(--accent-edge)] hover:bg-secondary hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none cursor-pointer disabled:cursor-not-allowed"
    >
      <Icon className="w-3.5 h-3.5 text-accent-ink" aria-hidden="true" />
      {label}
    </button>
  );
}

/** The composer shell both surfaces share (auto-grow textarea + send). */
function Composer({
  inputRef,
  value,
  onChange,
  onSend,
  busy,
  placeholder,
}: {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange(value: string): void;
  onSend(): void;
  busy: boolean;
  placeholder: string;
}) {
  const { t } = useLanguage();
  // Auto-grow (cap ~120px, AITutorPage).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [inputRef, value]);
  const ready = !busy;
  return (
    <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2.5 pl-3.5 shadow-raised">
      <textarea
        ref={inputRef}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        disabled={busy}
        placeholder={placeholder}
        aria-label={placeholder}
        className="flex-1 min-w-0 min-h-6 max-h-[120px] resize-none border-none bg-transparent px-0 py-[5px] text-sm leading-[1.55] placeholder:text-caption-soft focus:outline-none focus-visible:outline-none disabled:opacity-60"
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!ready}
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
  );
}

// -- reading mode (T5, behavior unchanged) -------------------------------------------

function ReadingCompanionSurface({
  materialId,
  material,
  positionRef,
  displayLocator,
  onJumpToLocator,
  selectionRef,
  askPrefill,
}: ReadingCompanionPanelProps) {
  const { t } = useLanguage();
  const chat = useCompanionChat(materialId, positionRef, selectionRef);

  // The selection bar's ask (epic-13 T1): drop the quote into the composer so
  // the user sees exactly what the Companion will be asked about. Identity is
  // the nonce — a re-ask of the same quote re-fills; the user's later typing
  // is never clobbered (the effect runs per prefill, not per render).
  useEffect(() => {
    if (!askPrefill) return;
    chat.setInput(t("companion.askWithSelection", { quote: askPrefill.quote }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askPrefill?.nonce]);

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
      {/* header — min-h so 200% text zoom reflows instead of clipping (a11y floor) */}
      <div className="flex-none flex items-center gap-2.5 min-h-[52px] px-4 border-b border-border-soft">
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
              locator={chat.streamPosition?.locator ?? null}
              material={material}
              onJump={onJumpToLocator}
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
            <StarterChip key={question} label={question} disabled={!sendReady} onClick={() => chat.send(question)} Icon={Sparkles} />
          ))}
        </div>
      )}

      {/* composer + honest states */}
      <div className="flex-none px-4 pb-4 pt-1">
        {canChat ? (
          <>
            <Composer
              inputRef={inputRef}
              value={chat.input}
              onChange={chat.setInput}
              onSend={sendMessage}
              busy={chat.busy || parseFailed}
              placeholder={t("companion.placeholder")}
            />
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

// -- plan mode (FR-46, epic P2-12 T3) -------------------------------------------------

/** The intent shortcuts' sent questions (the scaffold tutor pattern — the chip
 * text IS the question; the mistake shortcut grounds on the picked entry). */
const PLAN_INTENT_KEYS = [ "tutor.suggestExplain", "tutor.suggestQuiz", "tutor.suggestSummary" ] as const;
const PLAN_MISTAKE_INTENT_KEY = "tutor.suggestMistake";

function PlanCompanionSurface({ planId, materials, mistakeEntries }: PlanCompanionPanelProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const chat = usePlanCompanionChat(planId);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Auto-scroll to the newest row / latest streamed token (scaffold pattern).
  const threadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.entries.length, chat.streamText]);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Send gate (epic-25 T2): hydrated AND idle — a pre-hydration turn would be
  // clobbered when this plan's server thread lands (the material hook's same
  // discipline; the reading surface gates on chat.hydrated too).
  const sendReady = chat.hydrated && !chat.busy;
  const idle = chat.entries.length === 0 && !chat.busy;

  /** The material a turn's citation names: the picked mistake entry's source. */
  const mistakeMaterial = (entryId: string | null | undefined): Material | null => {
    if (!entryId) return null;
    const row = mistakeEntries.find((entry) => entry.id === entryId);
    return materials.find((material) => material.id === row?.sourceMaterialId) ?? null;
  };
  const entryMaterial = (entry: PlanCompanionEntry): Material | null =>
    mistakeMaterial(entry.request?.mistakeEntryId);
  const streamMaterial = mistakeMaterial(chat.streamMistakeEntryId);

  /** The plan chip's jump: the AD-8 anchor deep link into the reader (the
   * reader scrolls to the target and flashes it — the same channel the
   * in-reader chips ride, crossed with a navigation since plan scope has no
   * open document). */
  const jumpToLocator = (material: Material | null, locator: ReadingLocator) => {
    if (!material) return; // no source material to open — the chip names it, never a dead jump
    if (locator.kind === "pdf") {
      navigate(`/read/${material.id}?page=${locator.page}&hl=1`);
    } else {
      navigate(`/read/${material.id}?hl=1#${encodeURIComponent(locator.sectionId)}`);
    }
  };

  const sendMistake = (entry: PlanMistakeEntryView) => {
    setPickerOpen(false);
    chat.send(t(PLAN_MISTAKE_INTENT_KEY), entry.id);
  };

  const locatorTargetText = (locator: ReadingLocator, material: Material | null): string | null => {
    const target = locatorDisplayTarget(material, locator);
    return target.page !== null ? t("companion.chipPage", { n: target.page }) : target.text;
  };
  const streamRow = chat.streamMistakeEntryId
    ? mistakeEntries.find((entry) => entry.id === chat.streamMistakeEntryId)
    : undefined;
  const streamLocator = streamRow?.sourceLocation ?? null;
  const streamTarget = streamLocator ? locatorTargetText(streamLocator, streamMaterial) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* header — min-h so 200% text zoom reflows instead of clipping (a11y floor) */}
      <div className="flex-none flex items-center gap-2.5 min-h-[52px] px-4 border-b border-border-soft">
        <span
          aria-hidden="true"
          className="w-8 h-8 rounded-[9px] bg-[var(--accent-tint)] text-accent-ink grid place-items-center text-xs font-bold shrink-0 font-display"
        >
          S
        </span>
        <div className="text-sm font-semibold leading-tight min-w-0 truncate">{t("companion.title")}</div>
        <span className="ml-auto flex-none inline-flex items-center rounded-full bg-[var(--accent-tint)] text-accent-ink px-2 py-0.5 text-[11px] font-semibold">
          {streamTarget
            ? t("companion.groundedBadge", { target: streamTarget })
            : t("companion.planBadge")}
        </span>
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
                material={entryMaterial(entry)}
                onJump={(locator) => jumpToLocator(entryMaterial(entry), locator)}
                onEscalate={() => undefined} // plan turns are hint-first, canEscalate false — never renders
              />
            ),
          )}
          {chat.busy && (
            <StreamingBubble
              text={chat.streamText}
              target={streamTarget}
              groundingLabel={t("companion.groundingStream", { target: streamTarget ?? "" })}
              locator={streamLocator}
              material={streamMaterial}
              onJump={(locator) => jumpToLocator(streamMaterial, locator)}
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

      {/* idle intent shortcuts (FR-46: explain / quiz me / summarize / analyze my mistakes) */}
      {idle && (
        <div className="flex-none flex flex-wrap gap-2 px-4 pb-2">
          {PLAN_INTENT_KEYS.map((key) => (
            <StarterChip
              key={key}
              label={t(key)}
              onClick={() => chat.send(t(key))}
              disabled={!sendReady}
              Icon={Sparkles}
            />
          ))}
          <StarterChip
            label={t(PLAN_MISTAKE_INTENT_KEY)}
            onClick={() => setPickerOpen(true)}
            disabled={mistakeEntries.length === 0}
            title={mistakeEntries.length === 0 ? t("companion.mistakePickerEmpty") : undefined}
            Icon={BookmarkMinus}
          />
        </div>
      )}

      {/* composer — plan scope has no document gate; hydration + busy are the disables */}
      <div className="flex-none px-4 pb-4 pt-1">
        <Composer
          inputRef={inputRef}
          value={chat.input}
          onChange={chat.setInput}
          onSend={() => {
            if (sendReady) chat.send(chat.input);
          }}
          busy={chat.busy}
          placeholder={t("companion.planPlaceholder")}
        />
        <p className="text-[10px] text-caption text-center pt-2">{t("companion.planNote")}</p>
      </div>

      {/* the mistake-entry picker (the 「分析我的错误」 grounding input) */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-lg rounded-2xl border border-border-soft bg-card max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">{t("companion.mistakePickerTitle")}</DialogTitle>
          </DialogHeader>
          {mistakeEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground leading-[1.6] py-4 text-center">
              {t("companion.mistakePickerEmpty")}
            </p>
          ) : (
            <div className="divide-y divide-border-soft">
              {mistakeEntries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => sendMistake(entry)}
                  className="w-full text-left px-3 py-3 hover:bg-[var(--glass-2)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring cursor-pointer"
                >
                  <p className="text-sm leading-[1.5]">{entry.prompt}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 truncate">
                    {t("companion.mistakePickerAnswer", { answer: entry.userAnswer || t("companion.mistakeForfeit") })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
