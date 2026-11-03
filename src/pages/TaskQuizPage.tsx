/**
 * Task-flow quiz route — /task/:id/quiz (epic-6 T4; FR-37 parity; AD-6/8): a
 * thin task-scoped composition over the quiz feature's shared QuizSessionPage
 * shell — this page owns only the task lookup and the context (back targets,
 * honest not-found copy, the task's single auto-owned node + its single
 * material). All session states live in the shell; the launcher is task-owned
 * (taskId set, planId null — AD-6), so evidence attributes to the task's own
 * node and mastery never bleeds between plans and tasks.
 */
import { useParams } from "react-router-dom";
import { useTaskMaterialsQuery, useTaskNodeQuery, useTaskQuery } from "@/data";
import { QuizSessionPage } from "@/features/quiz";

export default function TaskQuizPage() {
  const { id } = useParams();
  const taskQuery = useTaskQuery(id ?? "");
  const nodeQuery = useTaskNodeQuery(id ?? "");
  const materialsQuery = useTaskMaterialsQuery(id ?? "");

  if (taskQuery.isPending || nodeQuery.isPending || materialsQuery.isPending) return null;

  const task = taskQuery.data;
  const node = nodeQuery.data;
  const materials = materialsQuery.data ?? [];

  return (
    <QuizSessionPage
      context={{
        kind: "task",
        ownerId: task?.id ?? "",
        exists: !!task,
        nodes: node ? [node] : [],
        materials,
        homeHref: task ? `/task/${task.id}` : "/plans",
        homeLabelKey: "tasks.backToTask",
        lostHref: "/plans",
        lostLabelKey: "tasks.backToPlans",
        notFoundKey: "tasks.notFound",
      }}
    />
  );
}
