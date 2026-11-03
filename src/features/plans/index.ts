/**
 * The plans feature's public surface (AD-2, reader/index.ts precedent): what
 * features outside plans may import. The attach-flow validators are the shared
 * upload-validation seam — the task-creation flow (epic-5) reuses them verbatim
 * so both doors (plan attach, task create) reject identically. Creation chat,
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
