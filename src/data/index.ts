/** Data module barrel (AD-3): features import repositories, hooks, and errors from here. */
export { AppError } from "./errors";
export { SCHEMA_VERSION, STORAGE_KEY, emptyDb, type SynapseDb } from "./document";
export { loadDb, resetDb, saveDb, updateDb } from "./store";
export {
  createPlan,
  deletePlan,
  getPlan,
  listNodesByPlan,
  listPlans,
  updatePlan,
  type CreatePlanNodeInput,
} from "./plan-repository";
export { queryKeys } from "./query-keys";
export {
  useCreatePlanMutation,
  useDeletePlanMutation,
  usePlanNodesQuery,
  usePlanQuery,
  usePlansQuery,
  useUpdatePlanMutation,
} from "./plan-queries";
