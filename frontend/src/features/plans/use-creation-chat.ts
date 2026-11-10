/**
 * Creation-chat orchestration (FR-1/Q4; epic-27 rework): ONE free-form
 * message + optional attached materials stream the Companion's plan-structure
 * proposal through the real service (AD-5 — simulated, deterministic, zh/en);
 * never touches the store — confirm belongs to the surface (create mutation +
 * navigation, see CreationChat).
 */
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { getCompanionService } from "@/ai/companion-service";
import type { PlanStructureProposal, ProposalMaterial, UiLanguage } from "@/ai/types";
import { useLanguage } from "@/contexts/LanguageContext";

export type ChatMessage = { role: "user" | "ai"; text: string; materialCount?: number };
export type ChatPhase = "idle" | "streaming" | "proposed";

/** The stated input a draft regenerates from (files-only rounds carry an
 * empty message — the materials are the input; 2026-11-10). */
export interface ChatInput {
  message: string;
  materials: ProposalMaterial[];
}

export function useCreationChat(language: UiLanguage) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<ChatPhase>("idle");
  const [streamText, setStreamText] = useState("");
  const [proposal, setProposal] = useState<PlanStructureProposal | null>(null);
  const buf = useRef("");
  const lastInput = useRef<ChatInput>({ message: "", materials: [] });

  const generate = useCallback(
    (message: string, materials: ProposalMaterial[]) => {
      lastInput.current = { message, materials };
      setPhase("streaming");
      setStreamText("");
      setProposal(null);
      buf.current = "";
      void getCompanionService()
        // The message + the attached materials' client-extracted text are the
        // generation inputs (epic-27): they ride INSIDE the ticket. The
        // trailing options carry the cap-counted restart notice (AD-16, never
        // silent): sonner surfaces it; the stream itself continues.
        .generatePlanStructure(message, materials, language, (chunk) => {
          buf.current += chunk;
          setStreamText(buf.current);
        }, {
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
    (message: string, materials: ProposalMaterial[]) => {
      if (phase === "streaming") return;
      setMessages((m) => [...m, { role: "user", text: message, materialCount: materials.length }]);
      generate(message, materials);
    },
    [generate, phase],
  );

  /** Re-propose from the same message/materials — a bad draft is never a dead end. */
  const regenerate = useCallback(() => {
    generate(lastInput.current.message, lastInput.current.materials);
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
