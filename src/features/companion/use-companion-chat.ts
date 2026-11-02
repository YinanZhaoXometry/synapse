/**
 * Companion chat orchestration (T5 · FR-11/12): the state machine between the
 * CompanionPanel surface and the CompanionService seam (AD-5 — the only AI
 * path; prior art: plans/use-creation-chat.ts streaming pattern). Streams
 * grounded replies token-by-token, renders the transcript, and persists
 * through the existing ChatThread repository (AD-3/4).
 *
 * Persistence honesty rule: a turn is written to the thread ONLY when its
 * request completes — user message first, then the companion reply with its
 * citation locators. Failed, aborted, or abandoned (material switched /
 * unmounted) requests persist nothing, so a reload never replays a turn the
 * Companion never answered (the repository has no delete, so "optimistic" is
 * the UI transcript only, never the store).
 *
 * Grounding honesty rule: the position is read from the tracker ref AT SEND
 * TIME (T4's currentPositionRef surface). Before the reader's first report
 * there is no honest position to ground on — the panel disables send with an
 * explanatory hint rather than guessing sections[0] (a restored deep link
 * would ground the wrong page).
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { getCompanionService } from "@/ai/companion-service";
import type { CompanionReply } from "@/ai/types";
import { useAppendChatMessageMutation, useChatThreadQuery } from "@/data";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ReadingPosition } from "@/domain/entities";
import {
  entriesFromThread,
  replyCitationLocators,
  type CompanionEntry,
} from "./message-shaping";

export interface TurnRequest {
  question: string;
  position: ReadingPosition;
  escalated?: boolean;
}

export function useCompanionChat(
  materialId: string,
  positionRef: RefObject<ReadingPosition | null>,
) {
  const { t, language } = useLanguage();
  const appendMessage = useAppendChatMessageMutation();
  const threadQuery = useChatThreadQuery(materialId);

  const [entries, setEntries] = useState<CompanionEntry[]>([]);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [streamPosition, setStreamPosition] = useState<ReadingPosition | null>(null);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  // Bumped once per completed reply — the panel's single aria-live status
  // announces completion once (never per token, UX a11y floor).
  const [completionSignal, setCompletionSignal] = useState(0);

  const buf = useRef("");
  const disposedRef = useRef(false);
  // The material the panel hydrated its transcript for — a material switch
  // (route param change, no remount) re-hydrates exactly once.
  const hydratedForRef = useRef<string | null>(null);
  const materialIdRef = useRef(materialId);
  useEffect(() => {
    materialIdRef.current = materialId;
  }, [materialId]);
  useEffect(
    () => () => {
      disposedRef.current = true;
    },
    [],
  );

  // Restore (AD-3/4): the persisted thread shapes into the transcript once per
  // material, when the query first settles. Later refetches (our own appends)
  // never re-shape — the live transcript is the state above.
  useEffect(() => {
    if (threadQuery.isPending) return;
    if (hydratedForRef.current === materialId) return;
    hydratedForRef.current = materialId;
    setEntries(entriesFromThread(threadQuery.data));
  }, [threadQuery.isPending, threadQuery.data, materialId]);

  const runTurn = useCallback(
    (request: TurnRequest, displayText: string, existingUserId?: string) => {
      if (busy) return;
      const turnMaterialId = materialId;
      const startedMaterialId = materialIdRef.current;
      setBusy(true);
      setStreamText(null);
      setStreamPosition(request.position);
      // The sent text leaves the composer; a half-typed draft (a starter
      // clicked mid-typing, a new draft beside a retry) stays untouched.
      setInput((current) => (current === displayText ? "" : current));

      // Optimistic user row (UI only — see the persistence honesty rule).
      const userEntryId = existingUserId ?? crypto.randomUUID();
      if (!existingUserId) {
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
        .chat(
          {
            question: request.question,
            position: request.position,
            language,
            escalated: request.escalated,
          },
          (chunk) => {
            buf.current += chunk;
            setStreamText(buf.current);
          },
        )
        .then((reply: CompanionReply) => {
          if (disposedRef.current || materialIdRef.current !== startedMaterialId) return; // abandoned — persist nothing
          const citations = replyCitationLocators(reply);
          appendMessage.mutate({ materialId: turnMaterialId, message: { role: "user", text: displayText, citations: [] } });
          appendMessage.mutate({
            materialId: turnMaterialId,
            message: { role: "companion", text: reply.text, citations },
          });
          setEntries((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "companion",
              text: reply.text,
              citations,
              reply,
              request,
              failed: false,
            },
          ]);
          setStreamText(null);
          setStreamPosition(null);
          setBusy(false);
          setCompletionSignal((n) => n + 1);
        })
        .catch(() => {
          if (disposedRef.current || materialIdRef.current !== startedMaterialId) return;
          setStreamText(null);
          setStreamPosition(null);
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
    [appendMessage, busy, language, materialId, t],
  );

  /** A new grounded turn — the position is the tracker's CURRENT one. */
  const send = useCallback(
    (rawQuestion: string) => {
      const question = rawQuestion.trim();
      if (!question || busy) return;
      const position = positionRef.current;
      if (!position) return; // gated in the UI; guarded here as the honest backstop
      runTurn({ question, position }, question);
    },
    [busy, positionRef, runTurn],
  );

  /** One-click retry of a failed turn — same question, same send-time position. */
  const retry = useCallback(
    (entryId: string) => {
      const entry = entries.find((candidate) => candidate.id === entryId);
      if (!entry?.failed || !entry.request || busy) return;
      runTurn(entry.request, entry.text, entryId);
    },
    [busy, entries, runTurn],
  );

  /**
   * Escalation (FR-12): re-send the hint turn's ORIGINAL question + position
   * with `escalated: true` — the ladder is a ladder, never a wall. The turn
   * reads as the user's 「直接看答案」 line, so the restored thread stays
   * self-explanatory.
   */
  const escalate = useCallback(
    (entryId: string) => {
      const entry = entries.find((candidate) => candidate.id === entryId);
      if (!entry?.reply || !entry.request || busy) return;
      runTurn(
        { question: entry.request.question, position: entry.request.position, escalated: true },
        t("companion.escalate"),
      );
    },
    [busy, entries, runTurn, t],
  );

  const hydrated = !threadQuery.isPending && hydratedForRef.current === materialId;

  return {
    entries,
    /** Streaming reply text, null when no request is mid-flight. */
    streamText,
    /** The in-flight turn's grounding position (the streaming line's target). */
    streamPosition,
    busy,
    hydrated,
    input,
    setInput,
    send,
    retry,
    escalate,
    completionSignal,
  };
}
