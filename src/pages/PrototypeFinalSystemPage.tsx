/**
 * PROTOTYPE — final-system walkthrough host (throwaway, branch
 * prototype/final-system). Renders 8 scenes of the finished Synapse inside
 * the real AppLayout chrome, switchable via ?scene= and the floating bottom
 * bar (←/→ keys work too). The one shared mutable state is the evidence
 * array — quiz answers append to it, and every mastery number on every scene
 * recomputes through the shipped ADR-0001 functions. Nothing persists.
 */
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SCENES, demoNodes, seedEvidence, type ProtoState, type SceneKey } from "@/features/prototype-final/demo";
import Switcher from "@/features/prototype-final/Switcher";
import SceneOnboarding from "@/features/prototype-final/SceneOnboarding";
import ScenePlans from "@/features/prototype-final/ScenePlans";
import ScenePlanHome from "@/features/prototype-final/ScenePlanHome";
import SceneRoadmap from "@/features/prototype-final/SceneRoadmap";
import SceneReader from "@/features/prototype-final/SceneReader";
import SceneQuiz from "@/features/prototype-final/SceneQuiz";
import SceneTask from "@/features/prototype-final/SceneTask";
import SceneToday from "@/features/prototype-final/SceneToday";
import SceneReview from "@/features/prototype-final/SceneReview";
import SceneTutor from "@/features/prototype-final/SceneTutor";
import SceneNote from "@/features/prototype-final/SceneNote";
import SceneSquare from "@/features/prototype-final/SceneSquare";
import SceneAnalytics from "@/features/prototype-final/SceneAnalytics";
import SceneDashboard from "@/features/prototype-final/SceneDashboard";
import { planCardMetrics, evidenceStreak } from "@/features/plans/display-shaping";

export default function PrototypeFinalSystemPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [evidence, setEvidence] = useState(seedEvidence);
  const [todayDone, setTodayDone] = useState<Record<string, boolean>>({ "t-0": true });

  const param = searchParams.get("scene") as SceneKey | null;
  const scene: SceneKey = param && SCENES.some((s) => s.key === param) ? param : "onboarding";

  const go = (key: SceneKey) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("scene", key);
      return next;
    });
    document.querySelector("main")?.scrollTo({ top: 0 });
  };

  const state: ProtoState = {
    evidence,
    addEvidence: (records) => setEvidence((prev) => [...prev, ...records]),
    todayDone,
    toggleToday: (id) => setTodayDone((prev) => ({ ...prev, [id]: !prev[id] })),
    go,
  };

  const stats = {
    rollup: planCardMetrics(demoNodes.filter((n) => n.planId === "p-ml"), evidence).rollup,
    evidenceCount: evidence.length,
    streak: evidenceStreak(evidence),
  };

  return (
    <>
      {scene === "onboarding" && <SceneOnboarding state={state} />}
      {scene === "plans" && <ScenePlans state={state} />}
      {scene === "plan" && <ScenePlanHome state={state} />}
      {scene === "roadmap" && <SceneRoadmap state={state} />}
      {scene === "reader" && <SceneReader state={state} />}
      {scene === "quiz" && <SceneQuiz state={state} />}
      {scene === "task" && <SceneTask state={state} />}
      {scene === "today" && <SceneToday state={state} />}
      {scene === "review" && <SceneReview state={state} />}
      {scene === "tutor" && <SceneTutor state={state} />}
      {scene === "note" && <SceneNote state={state} />}
      {scene === "square" && <SceneSquare state={state} />}
      {scene === "analytics" && <SceneAnalytics state={state} />}
      {scene === "dashboard" && <SceneDashboard state={state} />}

      <Switcher current={scene} onNavigate={go} stats={stats} />
    </>
  );
}
