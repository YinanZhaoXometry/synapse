/**
 * The reader feature's public surface (AD-2): the parse(file) API — parse +
 * reason→i18n mapping, the Material session-blob bridge, and the eager-parse
 * React seam. The only imports features outside the reader may take; the
 * flows, tracker, and render internals stay private to the feature.
 */
export {
  classifyParseFailure,
  parseFile,
  PARSE_REASON_MESSAGE_KEY,
  type ParseInput,
  type ParseOutcome,
} from "./parse";
export { parseFromSessionBlob } from "./parse-material";
export { useParseMaterialMutation } from "./use-parse-material";
