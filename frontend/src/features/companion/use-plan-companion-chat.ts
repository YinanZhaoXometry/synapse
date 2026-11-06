/**
 * Plan-level Companion chat orchestration (FR-46, epic P2-12 T3): the
 * CompanionPanel plan-grounding mode's controller, mirroring
 * use-companion-chat's state machine over the seam's planChat (the
 * plan_companion stream op — plan-grounded, no ReadingPosition, optional
 * mistake-entry grounding input).
 *
 * Ephemeral-transcript honesty rule: the plan scope has no ChatThread entity
 * (thread persistence is material-scoped, AD-3/4 — landing plan-scoped
 * threads is schema movement no ticket owns), so the transcript lives in
 * session-local state and nothing pretends otherwise: the drawer hides
 * instead of unmounting so a collapse never loses it, and a reload starts
 * an empty transcript. Failed or abandoned turns persist nothing — there is
 * nothing to persist to.
 *
 * The mistake entry id rides the REQUEST (the "analyze my mistakes"
 * grounding input): the server grounds on the entry's question + its source
 * section, and the stream's citation event carries the entry's own source
 * locator — the panel resolves the picker row against its mistakeEntries
 * for the streaming chip's label/jump target.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getCompanionService } from "@/ai/companion-service";
import type { CompanionReply } from "@/ai/types";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ReadingLocator } from "@/domain/entities";
import { newClientUuid } from "@/lib/uuid";

export interface PlanTurnRequest {
  question: string;
  mistakeEntryId?: string;
}

export interface PlanCompanionEntry {
  id: string;
  role: "user" | "companion";
  text: string;
  citations: ReadingLocator[];
  reply: CompanionReply | null;
  request: PlanTurnRequest | null;
  failed: boolean;
}

export function usePlanCompanionChat(planId: string) {
  const { t, language } = useLanguage();

  const [entries, setEntries] = useState<PlanCompanionEntry[]>([]);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [streamMistakeEntryId, setStreamMistakeEntryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  // Bumped once per completed reply — the panel's single aria-live status
  // announces completion once (never per token, the same a11y floor as the
  // reading-mode hook).
  const [completionSignal, setCompletionSignal] = useState(0);

  const buf = useRef("");
  const disposedRef = useRef(false);
  const planIdRef = useRef(planId);
  useEffect(() => {
    planIdRef.current = planId;
  }, [planId]);
  useEffect(
    () => () => {
      disposedRef.current = true;
    },
    [],
  );

  // Scope switch (2026-11-06): the tutor's plan picker changes planId without
  // remounting — the transcript (and any mid-flight stream state) MUST reset,
  // or plan A's turns render under plan B. The ephemeral-transcript rule
  // above already says a reload starts empty; a plan switch is the same cut.
  // A mid-flight turn self-abandons (the startedPlanId guard in runTurn), so
  // dropping busy here cannot resurrect it.
  useEffect(() => {
    setEntries([]);
    setStreamText(null);
    setStreamMistakeEntryId(null);
    setBusy(false);
  }, [planId]);

  const runTurn = useCallback(
    (request: PlanTurnRequest, displayText: string, existingEntryId?: string) => {
      if (busy) return;
      const startedPlanId = planIdRef.current;
      setBusy(true);
      setStreamText(null);
      setStreamMistakeEntryId(request.mistakeEntryId ?? null);
      // The sent text leaves the composer; a half-typed draft stays untouched.
      setInput((current) => (current === displayText ? "" : current));

      const userEntryId = existingEntryId ?? newClientUuid();
      if (!existingEntryId) {
        setEntries((prev) => [
          ...prev,
          {
            id: userEntryId,
            role: "user",
            text: displayText,
            citations: [],
            reply: null,
            request,
            failed: false,
          },
        ]);
      } else {
        setEntries((prev) =>
          prev.map((entry) => (entry.id === userEntryId ? { ...entry, failed: false } : entry)),
        );
      }

      buf.current = "";
      void getCompanionService()
        .planChat(
          {
            planId,
            question: request.question,
            language,
            mistakeEntryId: request.mistakeEntryId,
            // The cap-counted restart notice (AD-16, never silent): a drop →
            // fresh-ticket restart counted against the daily AI cap, surfaced
            // as the single toast pattern; the stream itself continues.
            onNotice: (key) => toast(t(key)),
          },
          (chunk) => {
            buf.current += chunk;
            setStreamText(buf.current);
          },
        )
        .then((reply: CompanionReply) => {
          if (disposedRef.current || planIdRef.current !== startedPlanId) return; // abandoned
          setEntries((prev) => [
            ...prev,
            {
              id: newClientUuid(),
              role: "companion",
              text: reply.text,
              citations: reply.citations.map((citation) => citation.locator),
              reply,
              request,
              failed: false,
            },
          ]);
          setStreamText(null);
          setStreamMistakeEntryId(null);
          setBusy(false);
          setCompletionSignal((n) => n + 1);
        })
        .catch(() => {
          if (disposedRef.current || planIdRef.current !== startedPlanId) return;
          setStreamText(null);
          setStreamMistakeEntryId(null);
          setBusy(false);
          // Never silent, never fake success (UX error state): neutral toast,
          // the turn stays visibly failed, and the typed text returns to the
          // composer so nothing the user wrote is lost.
          setEntries((prev) =>
            prev.map((entry) => (entry.id === userEntryId ? { ...entry, failed: true } : entry)),
          );
          setInput(displayText);
          toast.error(t("companion.requestFailed"));
        });
    },
    [busy, language, planId, t],
  );

  /** A new plan-grounded turn; mistakeEntryId grounds "analyze my mistakes". */
  const send = useCallback(
    (rawQuestion: string, mistakeEntryId?: string) => {
      const question = rawQuestion.trim();
      if (!question || busy) return;
      runTurn({ question, mistakeEntryId }, question);
    },
    [busy, runTurn],
  );

  /** One-click retry of a failed turn — same question, same grounding input. */
  const retry = useCallback(
    (entryId: string) => {
      const entry = entries.find((candidate) => candidate.id === entryId);
      if (!entry?.failed || !entry.request || busy) return;
      runTurn(entry.request, entry.text, entryId);
    },
    [busy, entries, runTurn],
  );

  return {
    entries,
    /** Streaming reply text, null when no request is mid-flight. */
    streamText,
    /** The in-flight turn's mistake grounding id, if the turn carried one. */
    streamMistakeEntryId,
    busy,
    input,
    setInput,
    send,
    retry,
    completionSignal,
  };
}
