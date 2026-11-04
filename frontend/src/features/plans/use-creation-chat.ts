/**
 * Creation-chat orchestration (FR-1/Q4): the state machine shared by the
 * Plans-Home empty state and the /plan/new route. Streams the Companion's
 * plan-structure proposal through the real service (AD-5 — simulated,
 * deterministic, zh/en); never touches the store — confirm belongs to the
 * surface (create mutation + navigation, see CreationChat).
 */
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { getCompanionService } from "@/ai/companion-service";
import type { PlanStructureProposal, UiLanguage } from "@/ai/types";
import { useLanguage } from "@/contexts/LanguageContext";

export type ChatMessage = { role: "user" | "ai"; text: string; goal?: string | null };
export type ChatPhase = "idle" | "streaming" | "proposed";

/** The stated input a draft regenerates from (topic required, goal optional). */
export interface ChatInput {
  topic: string;
  goal: string | null;
}

export function useCreationChat(language: UiLanguage) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<ChatPhase>("idle");
  const [streamText, setStreamText] = useState("");
  const [proposal, setProposal] = useState<PlanStructureProposal | null>(null);
  const buf = useRef("");
  const lastInput = useRef<ChatInput>({ topic: "", goal: null });

  const generate = useCallback(
    (topic: string, goal: string | null) => {
      lastInput.current = { topic, goal };
      setPhase("streaming");
      setStreamText("");
      setProposal(null);
      buf.current = "";
      void getCompanionService()
        // The goal rides the proposal stream (T5 · A3/FR-1): a named selection
        // or the free-text override — a generation input either way. The
        // trailing options carry the cap-counted restart notice (AD-16, never
        // silent): sonner surfaces it; the stream itself continues.
        .generatePlanStructure(topic, language, (chunk) => {
          buf.current += chunk;
          setStreamText(buf.current);
        }, goal, {
          onNotice: (key) => toast(t(key)),
        })
        .then((p) => {
          setProposal(p);
          setPhase("proposed");
        })
        .catch(() => {
          // Failure is never silent (review): back to idle with a clean stream so
          // the chat stays usable — the user can send again or hit regenerate.
          setPhase("idle");
          setStreamText("");
          setProposal(null);
          buf.current = "";
          toast.error(t("errors.planGenerationFailed"));
        });
    },
    [language, t],
  );

  const send = useCallback(
    (topic: string, goal: string | null) => {
      if (phase === "streaming") return;
      setMessages((m) => [...m, { role: "user", text: topic, goal }]);
      generate(topic, goal);
    },
    [generate, phase],
  );

  /** Re-propose from the same topic/goal (Q4) — a bad draft is never a dead end. */
  const regenerate = useCallback(() => {
    generate(lastInput.current.topic, lastInput.current.goal);
  }, [generate]);

  const reset = useCallback(() => {
    setMessages([]);
    setPhase("idle");
    setStreamText("");
    setProposal(null);
    buf.current = "";
  }, []);

  return {
    messages,
    phase,
    streamText,
    proposal,
    send,
    regenerate,
    reset,
    /** Non-reactive read for the confirm handler — a proposal only exists after a send. */
    lastInput: lastInput.current,
  };
}
