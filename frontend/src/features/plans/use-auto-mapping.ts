/**
 * useAutoMapping — the plan-page auto-fire effect (epic-34 T3; FR-45's
 * automation half; GLOSSARY Auto-mapping): while the plan page is mounted,
 * every material with `parseState === "parsed"` ∧ sections present ∧ ZERO
 * mapping rows gets the existing mapping mutation fired for it EXACTLY ONCE
 * per mount session. The session guard is a component-lifetime ref — zero
 * persistence, zero new storage; the next visit naturally retries (a
 * transient failure self-heals), and confirmed/rejected decisions can never
 * be overwritten (the rows criterion excludes them server-side too — the
 * command's in-place state machine is the second lock).
 *
 * Posture (spec decisions 12–13):
 *   - silent on start and success (the coverage panel is the surface);
 *   - exactly ONE failure toast per failed fire, through the established
 *     closed-enum → t() map (`apiErrorKeys("mapping.")` / mapping.failed);
 *   - CAP_REACHED additionally flips the hook's cap state — the coverage
 *     panel renders the「额度已用完」state from it, and the selection
 *     empties so this mount session spends nothing further (the manual
 *     button stays the explicit retry).
 *
 * Firing is one-in-flight: the queue walks target-by-target as each call
 * settles, so a cap failure mid-train stops the remaining materials before
 * they can waste a call. The CreationChat confirm path is deliberately NOT
 * instrumented (it navigates immediately) — this effect is the single
 * trigger point, and a material attached later fires the same way on
 * arrival.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiErrorCode, apiErrorKeys, useMapMaterialSectionsMutation } from "@/api";
import type { ErrorLike } from "@apollo/client";
import { useLanguage } from "@/contexts/LanguageContext";
import type { MaterialNodeMappingView, MaterialView } from "@/api/views";
import { autoMappingTargets } from "./auto-mapping";

/** The mapping mutations' closed-enum → t() key map (one place, AD-9). */
const MAPPING_ERROR_KEYS: Record<string, string> = apiErrorKeys("mapping.");
const MAPPING_FAILED_KEY = "mapping.failed";

export function useAutoMapping({ materials, mappingRows }: { materials?: MaterialView[]; mappingRows?: MaterialNodeMappingView[] }) {
  const { language, t } = useLanguage();
  const [mapSections] = useMapMaterialSectionsMutation();
  // The session guard: material ids fired (or attempted) this mount —
  // component-lifetime only; a remount IS the natural retry.
  const firedRef = useRef<Set<string>>(new Set());
  // The material whose mapping call is in flight right now (the panel's
  // 「正在 AI 映射…」 signal rides this) — null = idle.
  const [autoRunningFor, setAutoRunningFor] = useState<string | null>(null);
  // The cap posture: once CAP_REACHED lands, this mount session stops
  // selecting (next visit retries naturally; the manual button remains).
  const [capReached, setCapReached] = useState(false);

  useEffect(() => {
    if (capReached || autoRunningFor) return;
    // The head of the eligible queue only — one call at a time keeps a
    // mid-train cap failure from spending the rest.
    const [target] = autoMappingTargets(materials, mappingRows, firedRef.current, capReached);
    if (!target) return;
    // Mark BEFORE the call: the effect re-runs on every re-render (the reads
    // map fresh arrays), and the guard must hold no matter when it lands.
    firedRef.current.add(target.id);
    setAutoRunningFor(target.id);
    void (async () => {
      try {
        await mapSections({ variables: { input: { materialId: target.id, language } } });
      } catch (error) {
        const code = apiErrorCode(error as ErrorLike);
        if (code === "CAP_REACHED") setCapReached(true);
        // Exactly one failure toast, through the established path (AD-9).
        toast.error(t(code ? (MAPPING_ERROR_KEYS[code] ?? MAPPING_FAILED_KEY) : MAPPING_FAILED_KEY));
      } finally {
        setAutoRunningFor((current) => (current === target.id ? null : current));
      }
    })();
  }, [materials, mappingRows, capReached, autoRunningFor, language, mapSections, t]);

  return { autoRunningFor, capReached };
}
