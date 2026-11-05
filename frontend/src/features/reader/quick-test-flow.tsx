/**
 * The reader-level Quick Test flow (FR-14, epic-13 T2) — T1's seam consumer.
 * Registered on the reader route mount, the handler receives the selection
 * bar's captured scope and opens the Quick Test session INSIDE the reader:
 * a full-height takeover of the material zone (reading stays mounted under
 * it; the top bar stays) whose session id lives in the URL —
 * `/read/:materialId?quicktest=<sessionId>` — so the round survives a reload
 * (AD-8: addressable, never a bare modal).
 *
 * The GATE (the kickoff delta decision 4, AD-6): evidence records belong to
 * NODES, so a section/selection Quick Test only exists where the material
 * carries ≥1 CONFIRMED node mapping. The mapping read (the per-material
 * coverage read — `useMaterialNodeMappingsQuery`) resolves the gate the
 * selection bar renders (pending → disabled, failed → disabled + tooltip,
 * none → hidden behind the traceable hint); the handler re-checks the same
 * cache at dispatch time, so a stale click lands an honest no-op rather than
 * a doomed generation.
 *
 * Generation goes through the EXISTING driver (`useQuizSession`): the seam
 * call carries materialId + the selection's sectionId (markdown slug or the
 * PDF `page-N` convention) + targetCount 4; the server gates, assembles, and
 * attributes server-side (each question to its cited section's mapped node);
 * the created session is owned by the material's plan. Answering/grading/
 * completion ride the record-evidence path unchanged — wrong answers land in
 * the Mistakes Notebook with their source section (FR-14's consequence),
 * evidence attributes to the mapped node (AD-6). Nothing about the back half
 * is new: the takeover mounts the same QuizRunner the plan/task routes use.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CircleAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  useAllEvidenceQuery,
  useMaterialNodeMappingsQuery,
  useQuizSessionQuery,
  type KnowledgeNodeView,
  type MaterialView,
  type MaterialNodeMappingView,
} from "@/api";
import type { QuizStartInput } from "@/features/quiz";
import { QuizRunner } from "@/features/quiz";
import { useQuizSession, QUIZ_FRESH_LAUNCH_KEY } from "@/features/quiz";
import type { QuizSessionView } from "@/api/views";
import { quickTestSectionId } from "./quick-test-gate";
import { registerQuickTestHandler, type QuickTestScope } from "./quick-test-seam";

const QUICK_TEST_TARGET_COUNT = 4;

export interface QuickTestFlowProps {
  material: MaterialView;
  /** The plan's SERVER-scored nodes (AD-14) — the mapped ones feed the results' mastery rows. */
  planNodes: KnowledgeNodeView[];
}

export function QuickTestFlow({ material, planNodes }: QuickTestFlowProps) {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const quickTestParam = searchParams.get("quicktest");

  // The gate's truth + the evidence the runner's results pill reads.
  const mappingsQuery = useMaterialNodeMappingsQuery(material.id);
  const evidenceQuery = useAllEvidenceQuery();

  // The session driver — the SAME one the plan/task quiz routes ride.
  const driver = useQuizSession({ materials: [material] });

  // The dispatch this mount is launching (the handler's scope) — non-null
  // opens the takeover's generating card; the session id lands in the URL
  // once it exists. `dismissed` is the exit: the takeover hides until the
  // next dispatch or a fresh ?quicktest param (the component never unmounts).
  const [launch, setLaunch] = useState<{ sectionIds: string[] } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const launchInputRef = useRef<QuizStartInput | null>(null);
  const hydratedRef = useRef<string | null>(null);
  const freshLaunchRef = useRef<string | null>(null);

  // Ref mirror for the seam handler (a stable registration never goes stale
  // on the gate's cache moves).
  const confirmedRows = (mappingsQuery.data ?? []).filter((row) => row.status === "confirmed" && row.nodeId);
  const confirmedRef = useRef(confirmedRows);
  confirmedRef.current = confirmedRows;
  const mappedNodes = planNodes.filter((node) => confirmedRows.some((row) => row.nodeId === node.id));
  const mappedNodesRef = useRef(mappedNodes);
  mappedNodesRef.current = mappedNodes;

  // The seam registration (T1's handoff slot): one handler for this mount,
  // disposed on unmount. The re-check keeps a stale click (the bar rendered
  // "ready", the cache has since emptied) an honest no-op.
  useEffect(() => {
    const dispose = registerQuickTestHandler((scope: QuickTestScope) => {
      if (!confirmedRef.current.length) {
        toast.error(t("reader.quickTestGateHint"));
        return;
      }
      setDismissed(false);
      setLaunch({ sectionIds: [quickTestSectionId(scope.selection)] });
    });
    return dispose;
  }, [t]);

  // The launch: build the exact start input from the dispatch scope and fire
  // the driver once (idle phase + the plan nodes the double's attribution
  // round-robin needs are both present). Failure lands the honest toast; the
  // takeover closes (no session was created).
  useEffect(() => {
    if (!launch || driver.phase !== "idle" || mappedNodes.length === 0) return;
    const sections = material.sections.filter((section) => launch.sectionIds.includes(section.id));
    const input: QuizStartInput = {
      materials: [{ materialId: material.id, sections: sections.length ? sections : material.sections }],
      nodeIds: mappedNodes.map((node) => node.id),
      mode: "mix",
      // The session OWNER (AD-6): the material's plan — the gate's confirmed
      // mappings attach to its nodes. The generation wire strips it (the
      // materialId scope is the FOUR-way xor member).
      planId: material.planId ?? null,
      taskId: null,
      materialId: material.id,
      sectionIds: launch.sectionIds,
      targetCount: QUICK_TEST_TARGET_COUNT,
    };
    launchInputRef.current = input;
    void driver
      .start(input)
      .catch(() => toast(t("quiz.launcher.failed")))
      .finally(() => setLaunch(null));
  }, [launch, driver, driver.phase, mappedNodes, material]); // eslint-disable-line react-hooks/exhaustive-deps

  // The addressability flip (AD-8): once THIS launch's session exists, its id
  // rides the URL (?quicktest=<id>, other params preserved) + the fresh-
  // launch marker keeps the runner's note reload-resume-only (T6's contract).
  useEffect(() => {
    const sessionId = driver.run?.sessionId;
    if (!launchInputRef.current || !sessionId || sessionId === quickTestParam) return;
    try {
      sessionStorage.setItem(QUIZ_FRESH_LAUNCH_KEY, sessionId);
    } catch {
      // sessionStorage unavailable — the runner then errs on the honest note
    }
    const next = new URLSearchParams(searchParams);
    next.set("quicktest", sessionId);
    setSearchParams(next, { replace: true });
  }, [driver.run?.sessionId, quickTestParam, searchParams, setSearchParams]);

  const clearTakeover = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("quicktest");
    setSearchParams(next, { replace: true });
    setDismissed(true);
    setLaunch(null);
  }, [searchParams, setSearchParams]);

  // Hydration (the reload path): ?quicktest=<id> without a live run — an
  // ACTIVE session of THIS material's plan revives once per id; terminal
  // sessions render the honest cards (never resumable); unknown reads as
  // not-found. Skipped while a live run is mounted (the driver owns it) or
  // the takeover is dismissed.
  const sessionQuery = useQuizSessionQuery(driver.run || dismissed ? "" : (quickTestParam ?? ""));
  useEffect(() => {
    if (dismissed || !quickTestParam || sessionQuery.loading || driver.run) return;
    if (hydratedRef.current === quickTestParam) return;
    const session: QuizSessionView | undefined = sessionQuery.data;
    if (!session || session.status !== "active" || session.planId !== material.planId) return;
    hydratedRef.current = quickTestParam;
    if (!driver.hydrate(session)) hydratedRef.current = null;
  }, [dismissed, quickTestParam, sessionQuery.loading, sessionQuery.data, driver]); // eslint-disable-line react-hooks/exhaustive-deps

  // Consume the fresh-launch marker for THIS session id before the runner
  // renders (declaration order — the QuizSessionPage posture): a launch that
  // landed here with ?quicktest already set must not claim 「已恢复」.
  useEffect(() => {
    if (!quickTestParam) return;
    if (sessionStorage.getItem(QUIZ_FRESH_LAUNCH_KEY) === quickTestParam) {
      freshLaunchRef.current = quickTestParam;
      sessionStorage.removeItem(QUIZ_FRESH_LAUNCH_KEY);
    }
  }, [quickTestParam]);

  // Idle: no dispatch in flight and nothing addressable — the reading owns
  // the zone (the flow renders nothing at all).
  const takeoverVisible = !dismissed && (!!quickTestParam || !!launch || !!driver.run);
  if (!takeoverVisible) return null;

  // This mount's launch intent — the generating card from the dispatch click
  // until the session exists (or fails honestly). Cancellable until the first
  // question (a cancel leaves no live session; the driver guarantees it).
  if (launch || driver.phase === "generating") {
    return (
      <div className="absolute inset-0 z-30 bg-background overflow-y-auto" data-testid="quick-test-takeover">
        <div className="mx-auto max-w-[784px] p-6 md:p-8">
          <TakeoverBack label={t("reader.quickTestExit")} onBack={clearTakeover} />
          <div className="mt-6 rounded-2xl border border-border-soft bg-card p-8 shadow-raised text-center">
            <Loader2 className="w-5 h-5 mx-auto animate-spin text-accent-ink" aria-hidden="true" />
            <p className="text-sm font-semibold mt-3" data-testid="quick-test-generating">
              {t("reader.quickTestGenerating")}
            </p>
            <button
              type="button"
              onClick={() => {
                driver.cancelStart();
                clearTakeover();
              }}
              className="mt-4 inline-flex items-center justify-center rounded-xl border border-border bg-[var(--glass-4)] px-4 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-[var(--glass-solid)] active:scale-[0.97] cursor-pointer"
            >
              {t("quiz.launcher.cancel")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // The live run (launched here or hydrated from the URL) — the SAME runner
  // the plan/task routes mount; completion's evidence/mistakes write rides
  // the driver unchanged.
  if (driver.run && driver.run.status !== "abandoned") {
    return (
      <div className="absolute inset-0 z-30 bg-background overflow-y-auto" data-testid="quick-test-takeover">
        <div className="mx-auto max-w-[784px] p-6 md:p-8">
          <QuizRunner
            driver={driver}
            run={driver.run}
            materials={[material]}
            nodes={mappedNodes}
            evidence={evidenceQuery.data ?? []}
            resumed={
              !launchInputRef.current &&
              freshLaunchRef.current !== driver.run.sessionId &&
              quickTestParam === driver.run.sessionId &&
              hydratedRef.current === driver.run.sessionId
            }
            canRetake={!!launchInputRef.current}
            backLabelKey="reader.quickTestExit"
            onRetake={() => {
              const input = launchInputRef.current;
              if (!input) return;
              void driver.start(input).catch(() => toast(t("quiz.launcher.failed")));
            }}
            onBackToPlan={clearTakeover}
            onAbandoned={clearTakeover}
          />
        </div>
      </div>
    );
  }

  // A ?quicktest that is not a live run: the honest per-repository-status card
  // (the QuizSessionPage's wording — terminal sessions never resume).
  if (!dismissed && quickTestParam) {
    if (sessionQuery.loading) return null;
    const session = sessionQuery.data;
    const owns = !!session && session.planId === material.planId;
    const card = (titleKey: string, testId: string) => (
      <div className="absolute inset-0 z-30 bg-background overflow-y-auto" data-testid="quick-test-takeover">
        <div className="mx-auto max-w-[784px] p-6 md:p-8">
          <TakeoverBack label={t("reader.quickTestExit")} onBack={clearTakeover} />
          <div className="mt-6 rounded-2xl border border-border-soft bg-card p-8 shadow-raised text-center" data-testid={testId}>
            <CircleAlert className="w-5 h-5 mx-auto text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-semibold mt-2">{t(titleKey)}</p>
            <p className="text-xs text-muted-foreground mt-1.5">{t("quiz.runner.notResumable")}</p>
          </div>
        </div>
      </div>
    );
    if (!session || !owns) return card("quiz.runner.notFound", "quick-test-session-unknown");
    if (session.status === "completed") return card("quiz.runner.alreadyDone", "quick-test-session-terminal");
    if (session.status === "abandoned") return card("quiz.runner.alreadyAbandoned", "quick-test-session-terminal");
    return null; // active — the hydrate effect owns this tick
  }

  return null;
}

function TakeoverBack({ label, onBack }: { label: string; onBack(): void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
    >
      {label}
    </button>
  );
}
