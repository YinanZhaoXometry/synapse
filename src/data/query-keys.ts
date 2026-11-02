/** Centralized TanStack Query keys (spine conventions): one place, no ad-hoc arrays. */
export const queryKeys = {
  plans: {
    all: ["plans"] as const,
    detail: (planId: string) => ["plans", planId] as const,
    nodes: (planId: string) => ["plans", planId, "nodes"] as const,
  },
  materials: {
    all: ["materials"] as const,
    detail: (materialId: string) => ["materials", materialId] as const,
    byPlan: (planId: string) => ["materials", "plan", planId] as const,
    byTask: (taskId: string) => ["materials", "task", taskId] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    detail: (taskId: string) => ["tasks", taskId] as const,
    node: (taskId: string) => ["tasks", taskId, "node"] as const,
  },
  evidence: {
    all: ["evidence"] as const,
    byNode: (nodeId: string) => ["evidence", "node", nodeId] as const,
  },
  quiz: {
    all: ["quiz"] as const,
    session: (sessionId: string) => ["quiz", sessionId] as const,
  },
  flashcards: {
    all: ["flashcards"] as const,
    byMaterial: (materialId: string) => ["flashcards", "material", materialId] as const,
    byPlan: (planId: string) => ["flashcards", "plan", planId] as const,
  },
  progress: {
    all: ["progress"] as const,
    byMaterial: (materialId: string) => ["progress", materialId] as const,
  },
  chat: {
    byMaterial: (materialId: string) => ["chat", materialId] as const,
  },
} as const;
