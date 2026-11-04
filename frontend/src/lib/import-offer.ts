/**
 * The one-time import offer's marker (epic P2-8 T3, AD-15): "the legacy
 * document was offered for import and the learner decided" — imported, or
 * dismissed on purpose. The key is its OWN localStorage entry — the legacy
 * document's own key stays untouched (the rollback substrate, AD-20), and
 * the UI pref keys are never written here. Written on success AND on "not
 * now" — either way the offer never nags again.
 */
import { localDocumentHasData, readLocalDocument } from "@/lib/local-document";

export const IMPORT_DONE_KEY = "synapse-import:done";

/** True once the learner has decided (imported or dismissed). */
export function importOfferDone(): boolean {
  try {
    return localStorage.getItem(IMPORT_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

/** The learner decided — the one-time offer is spent. */
export function markImportOfferDone(): void {
  try {
    localStorage.setItem(IMPORT_DONE_KEY, "1");
  } catch {
    // storage refused (private mode) — the offer would re-show; that is the
    // honest degradation, never a fake "done".
  }
}

/** The offer's gate: a legacy document that holds data and an unspent offer. */
export function shouldOfferImport(): boolean {
  if (importOfferDone()) return false;
  const doc = readLocalDocument();
  return doc !== null && localDocumentHasData(doc);
}
