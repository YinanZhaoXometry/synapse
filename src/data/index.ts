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
export {
  MATERIAL_SECTION_MAX_CHARS,
  getMaterial,
  listMaterialsByPlan,
  listMaterialsByTask,
  registerMaterial,
  type RegisterMaterialInput,
} from "./material-repository";
export { createStudyTask, getTask, getTaskNode, listTasks } from "./task-repository";
export {
  appendChatMessage,
  getChatThread,
  getReadingProgress,
  isOnboardingComplete,
  markOnboardingComplete,
  saveReadingProgress,
} from "./progress-repository";
export { createSessionBlobRegistry, sessionBlobs, type SessionBlobRegistry } from "./session-blobs";
export {
  useMaterialQuery,
  usePlanMaterialsQuery,
  useRegisterMaterialMutation,
  useTaskMaterialsQuery,
} from "./material-queries";
export {
  useAppendChatMessageMutation,
  useChatThreadQuery,
  useCreateTaskMutation,
  useReadingProgressQuery,
  useSaveReadingProgressMutation,
  useTaskNodeQuery,
  useTaskQuery,
  useTasksQuery,
} from "./study-queries";
