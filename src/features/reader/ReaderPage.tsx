/**
 * The Immersive Reader route (FR-8; AD-8): `/read/:materialId`, lazy-loaded
 * under AppLayout. Reading is sacred — maximal area, minimal chrome: a slim
 * top bar (back link, title, page pager, panel-collapse + immersive toggles)
 * over the material zone, with the Companion panel side structurally reserved
 * (its content is T5's — an honest placeholder, never a chat that pretends).
 *
 * Parse states land here exactly as the UX spine specifies: parsing →
 * page-skeleton + progress copy; failed → card with the bilingual reason and
 * a retry while the session bytes exist (T1's parse mutation); parsed-but-
 * byteless (post-reload) → the epic-2 re-upload affordance re-registers bytes
 * and re-runs the parse. An unknown material reads honestly as not-found.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  RotateCw,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  sessionBlobs,
  useMaterialQuery,
  usePlanQuery,
} from "@/data";
import { cn } from "@/lib/utils";
import { PARSE_REASON_MESSAGE_KEY } from "./parse";
import { parseReaderSearchParams, type ReaderAnchor } from "./anchors";
import { PdfPageFlow, type PdfFlowHandle } from "./PdfPageFlow";
import { useParseMaterialMutation } from "./use-parse-material";
import { useSessionBytes } from "./use-session-bytes";
import { stepPage } from "./pager";
import { validateReupload } from "./reupload";

export default function ReaderPage() {
  const { materialId } = useParams();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const materialQuery = useMaterialQuery(materialId ?? "");
  const planQuery = usePlanQuery(materialQuery.data?.planId ?? "");
  const hasBytes = useSessionBytes(materialId ?? "");
  const parseMaterial = useParseMaterialMutation();

  const [panelOpen, setPanelOpen] = useState(true);
  const [immersive, setImmersive] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const flowRef = useRef<PdfFlowHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The anchor parses ONCE on mount — later URL edits are T4's business, and
  // the flags below must not move mid-read.
  const anchorRef = useRef<ReaderAnchor | null>(null);
  if (anchorRef.current === null) anchorRef.current = parseReaderSearchParams(searchParams.toString());
  const anchor = anchorRef.current;

  // ?hl=1 is transient (AD-8): the flag is consumed into the anchor above, so
  // the URL drops it immediately — a refresh never re-flashes.
  useEffect(() => {
    if (searchParams.has("hl")) {
      const next = new URLSearchParams(searchParams);
      next.delete("hl");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const material = materialQuery.data;

  // Stable reports from the PDF flow → top-bar pager.
  const handlePageChange = useCallback((page: number) => setCurrentPage(page), []);
  const handleTotalPages = useCallback((total: number) => setTotalPages(total), []);

  // A deep link into a still-pending material self-heals: with session bytes
  // present the reader can run the same eager parse the attach flow runs.
  const parseState = material?.parseState;
  useEffect(() => {
    if (materialId && parseState === "pending" && sessionBlobs.has(materialId)) {
      parseMaterial.mutate(materialId);
    }
    // The mutation is a stable hook contract (same shape as Plan Home's usage).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialId, parseState, hasBytes]);

  // Re-upload (FR-29 relaxed; the epic-2 contract): fresh session bytes for the
  // SAME material — metadata and extracted sections stay the row's truth — and
  // a pending/failed material re-runs the parse right away.
  const handleReuploadFile = (file: File) => {
    if (!material) return;
    const verdict = validateReupload(file, material.kind);
    // `in`-narrowing (Plan Home's verdict pattern — strictNullChecks is off,
    // so boolean-discriminant narrowing does not apply).
    if ("messageKey" in verdict) {
      toast.error(t(verdict.messageKey));
      return;
    }
    sessionBlobs.put(material.id, file);
    if (material.parseState === "pending" || material.parseState === "failed") {
      parseMaterial.mutate(material.id);
    }
  };

  if (materialQuery.isPending) return null;

  if (!material) {
    // Honest not-found (AD-8): an unknown or deleted id never pretends.
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 md:p-8 max-w-[1080px] mx-auto">
            <button
              type="button"
              onClick={() => navigate("/plans")}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> {t("plans.backToPlans")}
            </button>
            <p className="page-title mt-6 text-lg">{t("errors.materialNotFound")}</p>
            <p className="text-xs text-muted-foreground mt-2">{t("reader.notFoundBody")}</p>
          </div>
        </div>
      </div>
    );
  }

  const pagerVisible = totalPages !== null;
  const step = (delta: number) => {
    if (totalPages === null) return;
    flowRef.current?.scrollToPage(stepPage(currentPage, delta, totalPages));
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept={material.kind === "pdf" ? ".pdf,application/pdf" : ".md,.markdown,text/markdown"}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleReuploadFile(file);
          e.target.value = "";
        }}
      />

      {!immersive && (
        <header className="flex-none flex items-center gap-3 h-[52px] px-4 md:px-5 bg-card border-b border-border-soft">
          <button
            type="button"
            onClick={() => navigate(material.planId ? `/plan/${material.planId}` : "/plans")}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer flex-none min-w-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="truncate max-w-[180px]">
              {material.planId ? (planQuery.data?.topic ?? t("reader.backToPlan")) : t("plans.backToPlans")}
            </span>
          </button>
          <span className="text-sm font-semibold truncate min-w-0 flex-1" title={material.title}>
            {material.title}
          </span>

          <div className="flex items-center gap-2 flex-none">
            {pagerVisible && (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label={t("reader.prevPageAria")}
                  disabled={currentPage <= 1}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--glass-2)] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <span className="font-display font-semibold tabular-nums text-[13px]" aria-live="polite">
                  {t("reader.pager", { n: currentPage, m: totalPages ?? 1 })}
                </span>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label={t("reader.nextPageAria")}
                  disabled={totalPages !== null && currentPage >= totalPages}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--glass-2)] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <span className="w-px h-4 bg-border" aria-hidden="true" />
              </>
            )}
            <IconToggle
              label={panelOpen ? t("reader.panelCollapseAria") : t("reader.panelExpandAria")}
              onClick={() => setPanelOpen((open) => !open)}
            >
              {panelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </IconToggle>
            <IconToggle
              label={t("reader.immersiveOnAria")}
              onClick={() => setImmersive(true)}
            >
              <Maximize2 className="w-4 h-4" />
            </IconToggle>
          </div>
        </header>
      )}

      <div className="flex flex-1 min-h-0">
        {/* material zone */}
        <div className="flex-1 min-w-0 flex flex-col">
          {parseState === "parsing" ? (
            <ParsingSkeleton />
          ) : parseState === "failed" ? (
            <ParseFailedCard
              materialId={material.id}
              reasonKey={PARSE_REASON_MESSAGE_KEY[material.parseFailureReason ?? "unknown"]}
              hasBytes={hasBytes}
              onRetry={(id) => parseMaterial.mutate(id)}
              onReupload={() => fileInputRef.current?.click()}
            />
          ) : parseState === "pending" ? (
            // Bytes present → the self-heal parse above is about to flip this
            // to parsing (skeleton); bytes gone → the re-upload contract.
            hasBytes ? (
              <ParsingSkeleton />
            ) : (
              <ReuploadCard onReupload={() => fileInputRef.current?.click()} />
            )
          ) : material.kind === "markdown" ? (
            // Markdown branch is T3 — the route/structure already hosts it.
            <MarkdownPlaceholder />
          ) : hasBytes ? (
            <PdfPageFlow
              ref={flowRef}
              blob={sessionBlobs.get(material.id)}
              initialPage={anchor.page}
              flashTarget={anchor.highlight}
              onPageChange={handlePageChange}
              onTotalPages={handleTotalPages}
            />
          ) : (
            <ReuploadCard onReupload={() => fileInputRef.current?.click()} />
          )}
        </div>

        {/* Companion side — structurally reserved; content is T5's. */}
        {!immersive && (
          panelOpen ? (
            <aside
              className="hidden lg:flex w-[400px] xl:w-[420px] flex-none border-l border-border-soft bg-card flex-col items-center justify-center gap-2 px-6 text-center"
              aria-label={t("reader.panelPlaceholder")}
            >
              <p className="text-xs text-muted-foreground leading-[1.6] max-w-[26ch]">
                {t("reader.panelPlaceholder")}
              </p>
            </aside>
          ) : (
            <div className="hidden lg:flex w-10 flex-none border-l border-border-soft flex-col items-center pt-3">
              <IconToggle label={t("reader.panelExpandAria")} onClick={() => setPanelOpen(true)}>
                <PanelRightOpen className="w-4 h-4" />
              </IconToggle>
            </div>
          )
        )}
      </div>

      {immersive && (
        <button
          type="button"
          onClick={() => setImmersive(false)}
          aria-label={t("reader.immersiveOffAria")}
          className="fixed top-3 right-3 z-20 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--glass-5)] border border-border-soft shadow-raised text-xs text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function IconToggle({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--glass-2)] cursor-pointer"
    >
      {children}
    </button>
  );
}

/** Parsing state (UX spine): page-skeleton + progress copy, never a spinner-as-art. */
function ParsingSkeleton() {
  const { t } = useLanguage();
  return (
    <div className="flex-1 overflow-y-auto bg-secondary/50">
      <div className="mx-auto w-full max-w-[980px] px-4 md:px-8 py-6 md:py-8 flex flex-col items-center gap-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="w-full max-w-[640px] aspect-[1/1.414] rounded-[4px] bg-card border border-border-soft" />
        ))}
        <p className="text-sm font-semibold">{t("reader.parsing")}</p>
        <p className="text-xs text-muted-foreground -mt-4">{t("reader.parsingHint")}</p>
      </div>
    </div>
  );
}

/** Failed state: honest bilingual reason + retry while the bytes exist (AD-7). */
function ParseFailedCard({
  materialId,
  reasonKey,
  hasBytes,
  onRetry,
  onReupload,
}: {
  materialId: string;
  reasonKey: string;
  hasBytes: boolean;
  onRetry(materialId: string): void;
  onReupload(): void;
}) {
  const { t } = useLanguage();
  return (
    <StateZone>
      <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-6 max-w-md text-center">
        <FileText className="w-5 h-5 mx-auto text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-semibold mt-2">{t("reader.parseFailedTitle")}</p>
        <p className="text-xs text-muted-foreground leading-[1.6] mt-1.5">{t(reasonKey)}</p>
        {hasBytes ? (
          <button
            type="button"
            onClick={() => onRetry(materialId)}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-accent-ink cursor-pointer hover:underline"
          >
            <RotateCw className="w-3 h-3" aria-hidden="true" /> {t("plans.parseRetry")}
          </button>
        ) : (
          <ReuploadAction onReupload={onReupload} hint />
        )}
      </div>
    </StateZone>
  );
}

/** Parsed-but-byteless (post-reload): the re-upload affordance (FR-29 relaxed). */
function ReuploadCard({ onReupload }: { onReupload(): void }) {
  const { t } = useLanguage();
  return (
    <StateZone>
      <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-6 max-w-md text-center">
        <Upload className="w-5 h-5 mx-auto text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-semibold mt-2">{t("reader.reuploadTitle")}</p>
        <p className="text-xs text-muted-foreground leading-[1.6] mt-1.5">{t("reader.bytesGone")}</p>
        <ReuploadAction onReupload={onReupload} />
      </div>
    </StateZone>
  );
}

function ReuploadAction({ onReupload, hint }: { onReupload(): void; hint?: boolean }) {
  const { t } = useLanguage();
  return (
    <>
      <button
        type="button"
        onClick={onReupload}
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-accent-ink cursor-pointer hover:underline"
      >
        <Upload className="w-3 h-3" aria-hidden="true" /> {t("plans.materialReuploadAction")}
      </button>
      {hint && <p className="text-[11px] text-muted-foreground mt-2">{t("plans.materialsSessionNote")}</p>}
    </>
  );
}

/** Markdown branch placeholder — T3 renders the real thing here (honest copy only). */
function MarkdownPlaceholder() {
  const { t } = useLanguage();
  return (
    <StateZone>
      <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-6 max-w-md text-center">
        <FileText className="w-5 h-5 mx-auto text-muted-foreground" aria-hidden="true" />
        <p className="text-xs text-muted-foreground leading-[1.6] mt-2">{t("reader.markdownPending")}</p>
      </div>
    </StateZone>
  );
}

function StateZone({ children }: { children: ReactNode }) {
  return (
    <div className={cn("flex-1 overflow-y-auto bg-secondary/50 flex items-center justify-center p-6")}>{children}</div>
  );
}
