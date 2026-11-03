/**
 * Task-name rule (T1): the optional name input defaults to the filename (the
 * page pre-fills it) and is editable; confirming it blank falls back to the
 * filename-derived title — a task is never created nameless. The filename →
 * title derivation is the shared plan-attach validator (same seam, AD-2).
 */
import { titleFromFilename } from "@/features/plans";

export function resolveTaskName(input: string, filename: string): string {
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : titleFromFilename(filename);
}
