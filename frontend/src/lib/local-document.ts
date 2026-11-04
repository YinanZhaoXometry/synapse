/**
 * Read-only accessor for the legacy local document (`synapse-db:v1`) — the
 * Phase-1 persistence. The Apollo cutover (epic P2-8) retires it from the
 * runtime, but the document itself is NEVER deleted (rollback substrate,
 * AD-20), and two readers keep it honest:
 *   - the entry gate's first-run flag (until ticket 02's login wall re-shapes
 *     entry state),
 *   - ticket 03's first-login import, whose whole job is carrying this
 *     document to the api.
 * Only this module touches the key — the grep guard pins that.
 */
export const LOCAL_DOC_KEY = "synapse-db:v1";

/** The entry-gate flag, read straight off the local document (AD-8). */
export function readLocalOnboardingComplete(): boolean {
  try {
    const raw = localStorage.getItem(LOCAL_DOC_KEY);
    if (!raw) return false;
    const doc = JSON.parse(raw) as { onboardingComplete?: boolean };
    return doc.onboardingComplete === true;
  } catch {
    return false;
  }
}
