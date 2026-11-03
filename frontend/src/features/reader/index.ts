/**
 * The reader feature's public surface (AD-2): the parse(file) API — parse +
 * reason→i18n mapping, the Material session-blob bridge, the eager-parse
 * React seam, and the re-upload contract (kind-matched validation, FR-29) so
 * external material rows (Task Home, epic-5 T2) offer re-upload through the
 * same seam as the reader's own card. The anchor href builders (?page=N /
 * #section-id — the cross-feature command channel, epic-5 T3's continue links)
 * are exported so external rows deep-link through the same seam. The flows,
 * tracker, and render internals stay private to the feature.
 */
export {
  classifyParseFailure,
  parseFile,
  PARSE_REASON_MESSAGE_KEY,
  type ParseInput,
  type ParseOutcome,
} from "./parse";
export { parseFromSessionBlob } from "./parse-material";
export { validateReupload } from "./reupload";
export { readerAnchorHref, readerSectionHref } from "./anchors";
export { useParseMaterialMutation } from "./use-parse-material";
