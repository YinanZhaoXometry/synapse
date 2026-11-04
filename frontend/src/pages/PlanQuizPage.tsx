/**
 * Plan-flow quiz route — /plan/:id/quiz (epic-6 T2, T4 refactor; FR-18; AD-8):
 * a thin plan-scoped composition over the quiz feature's shared QuizSessionPage
 * shell — this page owns only the plan lookup and the context (back targets,
 * honest not-found copy, the plan's nodes/materials). All session states live
 * in the shell: no ?session → the QuizLauncher inline (mode + scope); a
 * ?session=<active> hydrates and runs (reload-resumable, resumption lands on
 * question 1, announced honestly); a terminal session shows the honest
 * already-done/abandoned card; unknown or foreign-plan ids read as not-found.
 */
import { useParams } from "react-router-dom";
import { usePlanMaterialsQuery, usePlanNodesQuery, usePlanQuery } from "@/api";
import { QuizSessionPage } from "@/features/quiz";

export default function PlanQuizPage() {
  const { id } = useParams();
  const planQuery = usePlanQuery(id ?? "");
  const nodesQuery = usePlanNodesQuery(id ?? "");
  const materialsQuery = usePlanMaterialsQuery(id ?? "");

  if (planQuery.loading || nodesQuery.loading || materialsQuery.loading) return null;

  const plan = planQuery.data;
  const nodes = nodesQuery.data ?? [];
  const materials = materialsQuery.data ?? [];

  return (
    <QuizSessionPage
      context={{
        kind: "plan",
        ownerId: plan?.plan.id ?? "",
        exists: !!plan,
        nodes,
        materials,
        homeHref: plan ? `/plan/${plan.plan.id}` : "/plans",
        homeLabelKey: "quiz.backToPlan",
        lostHref: "/plans",
        lostLabelKey: "plans.backToPlans",
        notFoundKey: "plans.notFound",
      }}
    />
  );
}
