/**
 * The materials feature's public surface (AD-2, reader/index.ts precedent):
 * epic-36 T3's hub-row lesson parts — the pure entry derivations (per-source
 * singleton, gate, generation-state chip) and the presentational row pieces
 * (chips + the action with its read-only outline gate). The page wiring and
 * internals stay private.
 */
export {
  lessonGateReason,
  lessonRowState,
  materialLessonMaterial,
  type LessonGateReason,
} from "./lesson-entry";
export { MaterialLessonAction, MaterialLessonChips, type LessonOutlineProposal } from "./lesson-row-parts";
