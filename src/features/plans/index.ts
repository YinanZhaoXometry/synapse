/**
 * The plans feature's public surface (AD-2, reader/index.ts precedent): what
 * features outside plans may import. The attach-flow validators are the shared
 * upload-validation seam — the task-creation flow (epic-5) reuses them verbatim
 * so both doors (plan attach, task create) reject identically. The mastery
 * atoms (ring, state glyph, outcome mark) and the session-blob presence hook
 * are the shared mastery/session display vocabulary — Task Home (epic-5 T2)
 * renders the same visual language through this surface. Creation chat,
 * display shaping, and page internals stay private to the feature.
 */
export {
  MAX_UPLOAD_BYTES,
  titleFromFilename,
  validateUpload,
  type UploadFileSpec,
  type UploadKind,
  type UploadRejectionKey,
  type UploadValidation,
} from "./upload-validation";
export { useSessionBlob } from "./use-session-blob";
export { OUTCOME_LABEL_KEY } from "./outcome-labels";
export { ContractNote, MasteryRing, OutcomeMark, StateGlyph } from "./atoms";
