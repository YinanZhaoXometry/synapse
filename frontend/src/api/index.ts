/**
 * The typed hooks layer (AD-18, epic P2-8 T1) — the successor of the retired
 * `src/data` adapter. Features consume domain data ONLY through these hooks;
 * the Apollo normalized cache is the single client-side owner.
 *
 * Convention (every hook in src/api/queries):
 *   queries   → { data: mapped view | undefined, loading, error, refetch }
 *               (`data` is undefined while loading — Phase-1's honest-empty posture)
 *   mutations → raw Apollo [mutate, result] tuples; refetch sweeps are declared
 *               on the hook, call sites pass { variables: { input }, onCompleted, onError }
 *   creates   → mint the client uuid with newClientUuid() at the call site (AD-12)
 *
 * Server scores (AD-14): plans/nodes carry the api's masteryScore/state —
 * rendering reads them; no client recompute anywhere.
 */
export { newClientUuid } from "./queries/material-queries";
export { apiErrorCode, apiErrorKeys, isNetworkError } from "./errors";
export type { ApiErrorCode } from "./errors";
export type { KnowledgeNodeView, MaterialView, StudyPlanView, StudyTaskView, MasteryScoreString } from "./views";
export type { PlanEdgeView } from "./views";
export type { MaterialNodeMappingView, NoteMarkerView, NoteView } from "./views";
export type { SectionMarkingView } from "./views";
export type { StudyMark } from "./views";
export type { StudyFocusItemView, StudyFocusSetView } from "./views";
export { MATERIAL_SECTION_MAX_CHARS } from "@/lib/material-bounds";
export { AppError } from "@/lib/app-error";
export { sessionBlobs, createSessionBlobRegistry, type SessionBlobRegistry } from "@/lib/session-blobs";
export type { PlanDetail } from "./queries/plan-queries";

export * from "./queries/auth-queries";
export * from "./queries/settings-queries";
export * from "./queries/annotation-queries";
export * from "./queries/plan-queries";
export * from "./queries/material-queries";
export * from "./queries/mapping-queries";
export * from "./queries/marking-queries";
export * from "./queries/study-mark-queries";
export * from "./queries/note-queries";
export * from "./queries/study-focus-queries";
export * from "./queries/scope-queries";
export * from "./queries/import-queries";
export * from "./queries/study-queries";
export * from "./queries/quiz-queries";
export * from "./queries/hub-queries";
export * from "./queries/square-queries";
