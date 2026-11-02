/**
 * Creation-chat orchestration (FR-1/Q4): the state machine shared by the
 * Plans-Home empty state and the /plan/new route. Streams the Companion's
 * plan-structure proposal through the real service (AD-5 — simulated,
 * deterministic, zh/en); never touches the store — confirm belongs to the
 * surface (create mutation + navigation, see CreationChat).
 */
import { useCallback, useRef, useState } from "react";
import { getCompanionService } from "@/ai/companion-service";
import type { PlanStructureProposal, UiLanguage } from "@/ai/types";

export type ChatMessage = { role: "user" | "ai"; text: string; goal?: string | null };
export type ChatPhase = "idle" | "streaming" | "proposed";

/** The stated input a draft regenerates from (topic required, goal optional). */
export interface ChatInput {
  topic: string;
  goal: string | null;
}

export function useCreationChat(language: UiLanguage) {
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
        .generatePlanStructure(topic, language, (chunk) => {
          buf.current += chunk;
          setStreamText(buf.current);
        })
        .then((p) => {
          setProposal(p);
          setPhase("proposed");
        });
    },
    [language],
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
