/** Centralized TanStack Query keys (spine conventions): one place, no ad-hoc arrays. */
export const queryKeys = {
  plans: {
    all: ["plans"] as const,
    detail: (planId: string) => ["plans", planId] as const,
    nodes: (planId: string) => ["plans", planId, "nodes"] as const,
  },
} as const;
