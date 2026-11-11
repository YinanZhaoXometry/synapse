/**
 * Plan-level Companion chat orchestration (FR-46, epic P2-12 T3): the
 * CompanionPanel plan-grounding mode's controller, mirroring
 * use-companion-chat's state machine over the seam's planChat (the
 * plan_companion stream op — plan-grounded, no ReadingPosition, optional
 * mistake-entry grounding input).
 *
 * Persistence honesty rule (REWRITTEN by epic-25 T2 — the schema movement the
 * old ephemeral-transcript rule described has landed): the plan scope now HAS
 * a ChatThread (plan-scoped, the chat_threads_one_scope floor), so a completed
 * turn is written to the server thread exactly like the reader's
 * material-scoped one — user message first, then the companion reply with its
 * citation locators: EXACTLY two appends per completed turn (the append is not
 * idempotent and has no delete — the driver owns exactly-once, the UI
 * transcript is the only "optimistic" half). A reload hydrates from
 * planChatThread(planId) instead of starting empty. Failed, aborted, or
 * abandoned (plan switched / unmounted) requests persist nothing, so a reload
 * never replays a turn the Companion never answered.
 *
 * Hydration rule: the transcript shapes from the server thread once per plan
 * (the hydratedForRef pattern + entriesFromThread shaping the material hook
 * pins) — later refetches (our own appends) never re-shape the live
 * transcript.
 *
 * The mistake entry id rides the REQUEST (the "analyze my mistakes"
 * grounding input): the server grounds on the entry's question + its source
 * section, and the stream's citation event carries the entry's own source
 * locator — the panel resolves the picker row against its mistakeEntries
 * for the streaming chip's label/jump target.
 *
 * The AI 讲解 session memory (epic-34 T2, frontend state only — zero server
 * thread state): beginTeaching(nodeId) marks the drawer session as a node
 * teaching session; EVERY turn sent while the mark holds rides `nodeId` on
 * the ticket (follow-ups keep the node grounding — decision 9), and
 * clearTeaching() drops it (the generic plan Companion entry). Teaching a
 * different node replaces the mark. A plan switch clears it with the rest
 * of the transcript reset.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getCompanionService } from "@/ai/companion-service";
import type { CompanionReply } from "@/ai/types";
import { useAppendPlanChatMessageMutation, usePlanChatThreadQuery } from "@/api";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ReadingLocator } from "@/domain/entities";
import { newClientUuid } from "@/lib/uuid";
import { entriesFromThread } from "./message-shaping";

export interface PlanTurnRequest {
  question: string;
  mistakeEntryId?: string;
  /** The AI 讲解 session's node — rides every turn of a teaching session. */
  nodeId?: string;
}

/** The drawer session's teaching mark: which node this session teaches. */
export interface TeachNode {
  id: string;
  title: string;
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
  const { mutate: appendMessage } = useAppendPlanChatMessageMutation();
  const threadQuery = usePlanChatThreadQuery(planId);

  const [entries, setEntries] = useState<PlanCompanionEntry[]>([]);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [streamMistakeEntryId, setStreamMistakeEntryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  // The AI 讲解 drawer-session mark (epic-34 T2): while set, EVERY turn rides
  // its nodeId; cleared by the generic entry, replaced by another node's 讲解.
  const [teachNode, setTeachNode] = useState<TeachNode | null>(null);
  // Bumped once per completed reply — the panel's single aria-live status
  // announces completion once (never per token, the same a11y floor as the
  // reading-mode hook).
  const [completionSignal, setCompletionSignal] = useState(0);

  const buf = useRef("");
  const disposedRef = useRef(false);
  // The plan the panel hydrated its transcript for — a plan switch (route or
  // picker change, no remount) re-hydrates exactly once from the NEW plan's
  // server thread.
  const hydratedForRef = useRef<string | null>(null);
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

  // Scope switch: the tutor's plan picker changes planId without remounting —
  // the transcript (and any mid-flight stream state) MUST reset, or plan A's
  // turns render under plan B. A mid-flight turn self-abandons (the
  // startedPlanId guard in runTurn), so dropping busy here cannot resurrect
  // it. The hydration effect below then re-shapes the NEW plan's server
  // thread over the emptied transcript — a plan switch is a re-hydration cut,
  // not a data loss (epic-25 T2: the thread persists server-side).
  useEffect(() => {
    setEntries([]);
    setStreamText(null);
    setStreamMistakeEntryId(null);
    setBusy(false);
    setTeachNode(null);
  }, [planId]);

  // Restore (epic-25 T2): the persisted plan thread shapes into the transcript
  // once per plan, when the query first settles. Later refetches (our own
  // appends) never re-shape — the live transcript is the state above. Declared
  // AFTER the reset effect so a switch with cached data hydrates over the
  // reset, not under it.
  useEffect(() => {
    if (threadQuery.loading) return;
    if (hydratedForRef.current === planId) return;
    hydratedForRef.current = planId;
    setEntries(entriesFromThread(threadQuery.data));
  }, [threadQuery.loading, threadQuery.data, planId]);

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
            planId: startedPlanId,
            question: request.question,
            language,
            mistakeEntryId: request.mistakeEntryId,
            nodeId: request.nodeId,
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
          if (disposedRef.current || planIdRef.current !== startedPlanId) return; // abandoned — persist nothing
          const citations = reply.citations.map((citation) => citation.locator);
          // The append is NOT idempotent on the wire — exactly two calls per
          // completed turn, in this order: the user row, then the companion
          // row with its citation locators (the persistence honesty rule
          // above). The api hook toasts persistence failures itself; no
          // double-toast here.
          appendMessage({
            variables: {
              input: {
                planId: startedPlanId,
                message: { role: "user", text: displayText, citations: [] },
              },
            },
          });
          appendMessage({
            variables: {
              input: {
                planId: startedPlanId,
                message: { role: "companion", text: reply.text, citations },
              },
            },
          });
          setEntries((prev) => [
            ...prev,
            {
              id: newClientUuid(),
              role: "companion",
              text: reply.text,
              citations,
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
          // composer so nothing the user wrote is lost. Persisted: nothing —
          // a failed turn never reaches the thread.
          setEntries((prev) =>
            prev.map((entry) => (entry.id === userEntryId ? { ...entry, failed: true } : entry)),
          );
          setInput(displayText);
          toast.error(t("companion.requestFailed"));
        });
    },
    [appendMessage, busy, language, t],
  );

  /** A new plan-grounded turn; mistakeEntryId grounds "analyze my mistakes".
   * A teaching session's mark (epic-34 T2) rides its nodeId on every turn. */
  const send = useCallback(
    (rawQuestion: string, mistakeEntryId?: string) => {
      const question = rawQuestion.trim();
      if (!question || busy) return;
      runTurn({ question, mistakeEntryId, nodeId: teachNode?.id }, question);
    },
    [busy, runTurn, teachNode],
  );

  /**
   * The AI 讲解 entry (epic-34 T2): mark the drawer session as teaching THIS
   * node — every later turn in the session carries the node grounding until
   * the generic entry clears it or another node's 讲解 replaces it. Pure
   * frontend state; the prefill itself is the panel's composer concern.
   */
  const beginTeaching = useCallback((node: TeachNode) => {
    setTeachNode(node);
  }, []);

  /** The generic plan Companion entry: drop the teaching mark. */
  const clearTeaching = useCallback(() => {
    setTeachNode(null);
  }, []);

  /** One-click retry of a failed turn — same question, same grounding input. */
  const retry = useCallback(
    (entryId: string) => {
      const entry = entries.find((candidate) => candidate.id === entryId);
      if (!entry?.failed || !entry.request || busy) return;
      runTurn(entry.request, entry.text, entryId);
    },
    [busy, entries, runTurn],
  );

  const hydrated = !threadQuery.loading && hydratedForRef.current === planId;

  return {
    entries,
    /** Streaming reply text, null when no request is mid-flight. */
    streamText,
    /** The in-flight turn's mistake grounding id, if the turn carried one. */
    streamMistakeEntryId,
    /** The drawer session's AI 讲解 mark, null outside a teaching session. */
    teachNode,
    busy,
    /** True once this plan's server thread has shaped into the transcript —
     * the send gate that keeps a pre-hydration turn from being clobbered by
     * the hydration landing (the material hook's same discipline). */
    hydrated,
    input,
    setInput,
    send,
    retry,
    /** epic-34 T2: the AI 讲解 session memory (begin/clear; per-turn nodeId). */
    beginTeaching,
    clearTeaching,
    completionSignal,
  };
}
