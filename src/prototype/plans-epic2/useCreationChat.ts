/**
 * PROTOTYPE (epic-2 UI) — creation-chat orchestration shared by the variants.
 * Logic only; each variant renders its own chat surface. Uses the REAL simulated
 * CompanionService (read-only, deterministic, streams zh/en markdown-ish lines) —
 * but never writes synapse-db: confirm builds a LOCAL StudyPlan.
 */
import { useCallback, useRef, useState } from "react";
import { getCompanionService } from "@/ai/companion-service";
import type { PlanStructureProposal } from "@/ai/types";
import type { UiLanguage } from "@/ai/types";
import type { KnowledgeNode, StudyPlan } from "@/domain/entities";

export type ChatMsg = { role: "user" | "ai"; text: string };
export type ChatPhase = "idle" | "streaming" | "proposed";

export function useCreationChat(language: UiLanguage) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [phase, setPhase] = useState<ChatPhase>("idle");
  const [streamText, setStreamText] = useState("");
  const [proposal, setProposal] = useState<PlanStructureProposal | null>(null);
  const buf = useRef("");
  const lastTopic = useRef<{ topic: string; goal: string | null }>({ topic: "", goal: null });

  const generate = useCallback((topic: string, goal: string | null) => {
    lastTopic.current = { topic, goal };
    setPhase("streaming");
    setStreamText("");
    setProposal(null);
    buf.current = "";
    getCompanionService().generatePlanStructure(topic, language, chunk => {
      buf.current += chunk;
      setStreamText(buf.current);
    }).then(p => {
      setProposal(p);
      setPhase("proposed");
    });
  }, [language]);

  const send = useCallback((userText: string, topic: string, goal: string | null) => {
    if (phase === "streaming") return;
    setMessages(m => [...m, { role: "user", text: userText }]);
    generate(topic, goal);
  }, [generate, phase]);

  const regenerate = useCallback(() => generate(lastTopic.current.topic, lastTopic.current.goal), [generate]);

  const reset = useCallback(() => {
    setMessages([]); setPhase("idle"); setStreamText(""); setProposal(null); buf.current = "";
  }, []);

  /** Build a LOCAL plan from the proposal (no db write — prototype only). */
  const buildPlan = useCallback((renames: Record<string, string> = {}): { plan: StudyPlan; nodes: KnowledgeNode[] } => {
    const p = proposal;
    if (!p) throw new Error("no proposal");
    const planId = `p-proto-${Date.now()}`;
    const nodes: KnowledgeNode[] = [];
    let order = 0;
    p.stages.forEach(s =>
      s.nodeTitles.forEach(t => {
        nodes.push({ id: `${planId}-n${order}`, planId: planId, taskId: null, stage: s.name, title: renames[t] ?? t, order });
        order += 1;
      })
    );
    const plan: StudyPlan = {
      id: planId,
      topic: lastTopic.current.topic,
      goal: lastTopic.current.goal,
      nodeIds: nodes.map(n => n.id),
      materialIds: [],
      createdAt: new Date().toISOString(),
    };
    return { plan, nodes };
  }, [proposal]);

  return { messages, phase, streamText, proposal, send, regenerate, reset, buildPlan, topic: lastTopic.current };
}
