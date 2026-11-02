/**
 * Reading-position persistence glue (FR-10; AD-3): holds the reader's CURRENT
 * ReadingPosition and writes it through the existing ReadingProgress mutation
 * — debounced on change (trailing 1.5s), flushed on unmount. All selection
 * math lives in position-tracking.ts (pure); this hook only dedupes reports
 * and schedules saves, so persistence lands only when the material is parsed
 * and the position actually moved.
 *
 * Baseline rule (the anchor contract, AD-8): the first reported locator IS the
 * baseline — the initial view an anchor or a stored-progress restore put the
 * reader at. Reports equal to it persist nothing, so opening a deep link or
 * restoring never overwrites stored progress until the reader actually moves;
 * every move after that persists (then the baseline rule retires — a move back
 * to the baseline is a real change against the last persisted locator).
 *
 * T5 surface: `currentPositionRef` always mirrors the current position
 * (`ReadingPosition | null`, null until the flow's first report) — the
 * CompanionPanel grounds on it by reading `.current` at chat time.
 */
import { useCallback, useEffect, useRef } from "react";
import { saveReadingProgress, useSaveReadingProgressMutation } from "@/data";
import type { Material, ReadingLocator, ReadingPosition } from "@/domain/entities";
import { locatorsEqual, positionText } from "./position-tracking";

/** Trailing debounce: quiet page/section flips coalesce into one write (FR-10). */
export const READING_POSITION_SAVE_DEBOUNCE_MS = 1500;

export function useReadingPositionTracker(materialId: string, material: Material | null) {
  const saveProgress = useSaveReadingProgressMutation();

  // Latest-value refs: report() stays referentially stable for the flows'
  // callbacks while material identity churns with query refetches.
  const materialRef = useRef<Material | null>(material);
  useEffect(() => {
    materialRef.current = material;
  }, [material]);

  /** T5 surface: the current ReadingPosition, null until the flow's first report. */
  const currentPositionRef = useRef<ReadingPosition | null>(null);
  const baselineRef = useRef<ReadingLocator | null>(null);
  const lastPersistedRef = useRef<ReadingLocator | null>(null);
  const timerRef = useRef<number | null>(null);

  const persist = useCallback(
    (position: ReadingPosition) => {
      // Only a parsed material has the sections the text grounds on (AD-4) —
      // pending/parsing/failed states persist nothing.
      const current = materialRef.current;
      if (!current || current.parseState !== "parsed") return;
      lastPersistedRef.current = position.locator;
      saveProgress.mutate({ materialId, position });
    },
    [materialId, saveProgress],
  );

  /** Feed a page/section report from a flow (PDF page change, markdown scroll-spy). */
  const report = useCallback(
    (locator: ReadingLocator) => {
      const previous = currentPositionRef.current;
      if (previous && locatorsEqual(previous.locator, locator)) return;
      const position: ReadingPosition = { locator, text: positionText(materialRef.current, locator) };
      currentPositionRef.current = position;
      // The first report is the initial view (anchor or restore put the reader
      // there) — it becomes the baseline and persists nothing. The baseline
      // rule retires at the first write: afterwards every change from the last
      // persisted locator is real reading movement, a move back to the
      // baseline included.
      if (baselineRef.current === null) {
        baselineRef.current = locator;
        return;
      }
      if (lastPersistedRef.current === null && locatorsEqual(baselineRef.current, locator)) return;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        const pending = currentPositionRef.current;
        if (!pending) return;
        // A wiggle that settled back on the initial view writes nothing, and
        // a position already written is not rewritten (only change persists).
        const settled = lastPersistedRef.current ?? baselineRef.current;
        if (settled && locatorsEqual(settled, pending.locator)) return;
        persist(pending);
      }, READING_POSITION_SAVE_DEBOUNCE_MS);
    },
    [persist],
  );

  // Unmount flush (FR-10): a pending debounce is lost with the reader, so the
  // final position is written directly through the repository. No invalidation
  // needed — the reader is leaving, and every next mount refetches its queries.
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      const position = currentPositionRef.current;
      if (!position) return;
      const settled = lastPersistedRef.current ?? baselineRef.current;
      if (!settled || locatorsEqual(settled, position.locator)) return;
      if (materialRef.current && materialRef.current.parseState === "parsed") {
        saveReadingProgress(materialId, position);
      }
    },
    [materialId],
  );

  return { report, currentPositionRef };
}
