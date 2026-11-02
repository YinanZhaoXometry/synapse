/**
 * Study Task repository (AD-3). A task owns exactly ONE auto-created
 * KnowledgeNode (planId null, taskId set) — its mastery is that node's (AD-6).
 */
import type { KnowledgeNode, StudyTask } from "@/domain/entities";
import { loadDb, saveDb } from "./store";

export function createStudyTask(input: { materialId: string }): { task: StudyTask; node: KnowledgeNode } {
  const db = loadDb();
  const material = db.materials.find((m) => m.id === input.materialId);
  if (!material) throw new Error(`Material not found: ${input.materialId}`);

  const now = new Date().toISOString();
  const node: KnowledgeNode = {
    id: crypto.randomUUID(),
    planId: null,
    taskId: null, // set below alongside the task id
    stage: null,
    title: material.title,
    order: 0,
  };
  const task: StudyTask = {
    id: crypto.randomUUID(),
    materialId: input.materialId,
    nodeId: node.id,
    createdAt: now,
  };
  node.taskId = task.id;
  material.taskId = task.id;

  db.tasks.push(task);
  db.nodes.push(node);
  saveDb(db);
  return { task, node };
}

export function getTask(id: string): StudyTask | undefined {
  return loadDb().tasks.find((t) => t.id === id);
}

export function listTasks(): StudyTask[] {
  return loadDb().tasks;
}

/** The task's single owned node — always exists (created with the task). */
export function getTaskNode(taskId: string): KnowledgeNode | undefined {
  return loadDb().nodes.find((n) => n.taskId === taskId);
}
