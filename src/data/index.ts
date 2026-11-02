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
  listMaterials,
  listMaterialsByPlan,
  listMaterialsByTask,
  markMaterialParsing,
  registerMaterial,
  setMaterialParseResult,
  type MaterialParseResult,
  type RegisterMaterialInput,
} from "./material-repository";
export { createStudyTask, getTask, getTaskNode, listTasks } from "./task-repository";
export {
  appendChatMessage,
  getChatThread,
  getReadingProgress,
  isOnboardingComplete,
  listReadingProgress,
  markOnboardingComplete,
  saveReadingProgress,
} from "./progress-repository";
export { createSessionBlobRegistry, sessionBlobs, type SessionBlobRegistry } from "./session-blobs";
export {
  createQuizSession,
  getQuizSession,
  listEvidence,
  listEvidenceByNode,
  recordEvidence,
  type AnswerResult,
  type QuestionInput,
} from "./quiz-repository";
export {
  createFlashcards,
  listFlashcardsByMaterial,
  listFlashcardsByPlan,
  rateFlashcard,
  type FlashcardInput,
} from "./flashcard-repository";
export {
  useAllEvidenceQuery,
  useCreateFlashcardsMutation,
  useCreateQuizSessionMutation,
  useFlashcardsByMaterialQuery,
  useFlashcardsByPlanQuery,
  useNodeEvidenceQuery,
  useQuizSessionQuery,
  useRateFlashcardMutation,
  useRecordEvidenceMutation,
} from "./quiz-queries";
export {
  useAllMaterialsQuery,
  useMaterialQuery,
  usePlanMaterialsQuery,
  useRegisterMaterialMutation,
  useTaskMaterialsQuery,
} from "./material-queries";
export {
  useAllReadingProgressQuery,
  useAppendChatMessageMutation,
  useChatThreadQuery,
  useCreateTaskMutation,
  useReadingProgressQuery,
  useSaveReadingProgressMutation,
  useTaskNodeQuery,
  useTaskQuery,
  useTasksQuery,
} from "./study-queries";
