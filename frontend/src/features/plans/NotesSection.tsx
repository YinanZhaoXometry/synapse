/**
 * The plan home's 学习笔记 section (FR-40, epic P2-12 T1; delta decision 3 —
 * plan-scoped; epic-35 T02 reshaped the list): the plan's notes (plan + node
 * + material scopes ride the ONE server union) plus the generate control — a
 * scope picker (整个计划 / 选择节点 / 选择资料), the 薄弱点加强 weak-spot
 * toggle (FR-22, epic P2-12 T2 — only enabled on the plan scope; the bias
 * needs a node set, so it passes `targeting: { mode: "weakSpot" }` there and
 * null otherwise), the optional user-requested annotation input ("在指定位置
 * 加插图" — the enrichAt free text, ONE [[enrich|user|…]] marker placed by
 * the server), and the generate action.
 * Each row is now a LINK into the standalone reading page
 * (`/plan/:id/notes/:noteId`, epic-35 T02) with a two-line scanning excerpt —
 * long notes no longer expand inside this ~320px rail; the body renders ONLY
 * through the shared NoteBodyView (this section stays list-only). Export
 * downloads <title>.md via a Blob URL with the markers preserved verbatim —
 * the button rides outside the row's link (no nested interactive content).
 * Failures map the closed api enum through apiErrorKeys("notes.") → sonner
 * toasts.
 */
import { useState } from "react";
import { Download, FileText, RotateCw, Sparkles, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  apiErrorCode,
  apiErrorKeys,
  newClientUuid,
  useGenerateNoteMutation,
  usePlanNotesQuery,
} from "@/api";
import type { KnowledgeNodeView, MaterialView, NoteView } from "@/api/views";
import type { ErrorLike } from "@apollo/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { localeTag } from "./locale";
import { downloadNoteMarkdown, noteExcerpt } from "./note-body-shaping";

const NOTE_ERROR_KEYS: Record<string, string> = apiErrorKeys("notes.");
const NOTE_FAILED_KEY = "notes.failed";

export default function NotesSection({ planId, nodes, materials }: { planId: string; nodes: KnowledgeNodeView[]; materials: MaterialView[] }) {
  const { language, t } = useLanguage();
  const notesQuery = usePlanNotesQuery(planId);
  const [generateNote, generateResult] = useGenerateNoteMutation();

  const [scope, setScope] = useState<"plan" | "node" | "material">("plan");
  const [nodeId, setNodeId] = useState<string>("");
  const [materialId, setMaterialId] = useState<string>("");
  const [enrichAt, setEnrichAt] = useState<string>("");
  const [weakSpot, setWeakSpot] = useState(false);

  const failureToast = (error: ErrorLike | undefined) => {
    const code = apiErrorCode(error);
    toast.error(t(code ? (NOTE_ERROR_KEYS[code] ?? NOTE_FAILED_KEY) : NOTE_FAILED_KEY));
  };

  const runGenerate = async () => {
    const trimmedEnrich = enrichAt.trim();
    try {
      await generateNote({
        variables: {
          input: {
            clientUuid: newClientUuid(),
            scope,
            language,
            planId: scope === "plan" ? planId : null,
            nodeId: scope === "node" ? nodeId : null,
            materialId: scope === "material" ? materialId : null,
            enrichAt: trimmedEnrich.length > 0 ? trimmedEnrich : null,
            // FR-22 (T2): the bias needs a node set — weakSpot rides only on
            // the plan scope; every other shape sends null (the plain note).
            targeting: scope === "plan" && weakSpot ? { mode: "weakSpot" } : null,
          },
        },
      });
      toast.success(t("notes.done"));
    } catch (error) {
      failureToast(error as ErrorLike);
    }
  };

  const generateDisabled =
    generateResult.loading ||
    (scope === "node" && !nodeId) ||
    (scope === "material" && !materialId);

  const notes = notesQuery.data ?? [];
  const loadFailed = Boolean(notesQuery.error);

  return (
    <section data-testid="notes-section" className="mt-6">
      <h2 className="eyebrow mb-2">{t("notes.title")}</h2>

      {loadFailed && (
        <div className="flex items-center gap-2 px-1 py-2" data-testid="notes-load-failed">
          <p className="text-xs text-destructive">{t("notes.loadFailed")}</p>
          <button
            type="button"
            onClick={() => void notesQuery.refetch()}
            disabled={notesQuery.loading}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink cursor-pointer hover:underline disabled:opacity-60 disabled:cursor-wait"
          >
            <RotateCw className={cn("w-3 h-3", notesQuery.loading && "animate-spin")} aria-hidden="true" />
            {t("notes.retryLoad")}
          </button>
        </div>
      )}

      {/* the generate control: scope pills + picker + the optional annotation input */}
      <div className="bg-card border border-border-soft rounded-2xl shadow-raised p-4 mb-3" data-testid="notes-generate">
        <div className="flex items-center gap-2" role="group" aria-label={t("notes.title")}>
          {(["plan", "node", "material"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={scope === value}
              data-testid={`notes-scope-${value}`}
              onClick={() => setScope(value)}
              className={cn("pill cursor-pointer", scope !== value && "pill-muted")}
            >
              {t(`notes.scope${value === "plan" ? "Plan" : value === "node" ? "Node" : "Material"}`)}
            </button>
          ))}
        </div>

        {scope === "node" && (
          <div className="mt-2">
            <NotePicker
              testid="notes-node-picker"
              value={nodeId}
              placeholder={t("notes.nodePlaceholder")}
              onChange={setNodeId}
              options={nodes.map((node) => ({ value: node.id, label: node.title }))}
            />
          </div>
        )}
        {scope === "material" && (
          <div className="mt-2">
            <NotePicker
              testid="notes-material-picker"
              value={materialId}
              placeholder={t("notes.materialPlaceholder")}
              onChange={setMaterialId}
              options={materials.filter((material) => material.parseState === "parsed").map((material) => ({ value: material.id, label: material.title }))}
            />
          </div>
        )}

        {/* the weak-spot toggle (FR-22, T2): the bias needs a node set — enabled on the plan scope only */}
        <div className="mt-2">
          <label
            htmlFor="notes-targeting-toggle"
            title={scope === "plan" ? undefined : t("notes.targetingHint")}
            className={cn(
              "inline-flex items-center gap-2 text-xs text-foreground",
              scope !== "plan" ? "cursor-not-allowed opacity-60" : "cursor-pointer",
            )}
          >
            <input
              type="checkbox"
              id="notes-targeting-toggle"
              checked={weakSpot && scope === "plan"}
              disabled={scope !== "plan"}
              onChange={(event) => setWeakSpot(event.target.checked)}
              data-testid="notes-targeting-toggle"
              className="h-3.5 w-3.5 accent-[var(--accent-ring)] cursor-pointer disabled:cursor-not-allowed"
            />
            {t("notes.targetingToggle")}
          </label>
          {scope !== "plan" && (
            <p className="mt-0.5 text-[10px] text-muted-foreground" data-testid="notes-targeting-hint">
              {t("notes.targetingHint")}
            </p>
          )}
        </div>

        <input
          type="text"
          value={enrichAt}
          onChange={(event) => setEnrichAt(event.target.value)}
          placeholder={t("notes.enrichPlaceholder")}
          aria-label={t("notes.enrichLabel")}
          data-testid="notes-enrich-input"
          className="mt-2 w-full rounded-xl border border-border-soft bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        <button
          type="button"
          onClick={() => void runGenerate()}
          disabled={generateDisabled}
          data-testid="notes-generate-run"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent-ink cursor-pointer hover:underline disabled:opacity-60 disabled:cursor-wait"
        >
          {generateResult.loading ? (
            <RotateCw className="w-3 h-3 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="w-3 h-3" aria-hidden="true" />
          )}
          {generateResult.loading ? t("notes.generating") : t("notes.generate")}
        </button>
      </div>

      {!loadFailed && notes.length === 0 && !generateResult.loading && (
        <p className="text-xs text-muted-foreground px-1" data-testid="notes-empty">
          {t("notes.empty")}
        </p>
      )}

      {notes.length > 0 && (
        <div className="bg-card border border-border-soft rounded-2xl shadow-raised divide-y divide-border-soft">
          {notes.map((note) => (
            <NoteRow key={note.id} note={note} planId={planId} nodes={nodes} materials={materials} />
          ))}
        </div>
      )}
    </section>
  );
}

/** The shadcn-flavored picker (native select — one honest control, both themes via tokens). */
function NotePicker({
  value,
  placeholder,
  options,
  onChange,
  testid,
}: {
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  testid: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={placeholder}
      data-testid={testid}
      className="w-full rounded-xl border border-border-soft bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/**
 * One note row (epic-35 T02): title + scope chip (with the target's resolved
 * title) + a two-line excerpt + date, LINKING to the standalone reading page
 * — the rail stays a scanning list; the body never renders here. The export
 * button sits OUTSIDE the link (no nested interactive content).
 */
function NoteRow({
  note,
  planId,
  nodes,
  materials,
}: {
  note: NoteView;
  planId: string;
  nodes: KnowledgeNodeView[];
  materials: MaterialView[];
}) {
  const { language, t } = useLanguage();

  const scopeChip = note.scope === "plan" ? t("notes.chipPlan") : note.scope === "node" ? t("notes.chipNode") : t("notes.chipMaterial");
  const scopeTarget =
    note.scope === "plan"
      ? null
      : note.scope === "node"
        ? (nodes.find((node) => node.id === note.scopeId)?.title ?? note.scopeId)
        : (materials.find((material) => material.id === note.scopeId)?.title ?? note.scopeId);
  const excerpt = noteExcerpt(note.body);

  const exportNote = () => {
    downloadNoteMarkdown(note);
    toast.success(t("notes.exported"));
  };

  return (
    <div data-testid="note-row" className="flex items-center gap-2 px-4 py-3">
      <FileText className="w-4 h-4 text-muted-foreground flex-none" aria-hidden="true" />
      <Link
        to={`/plan/${planId}/notes/${note.id}`}
        data-testid="note-row-link"
        className="min-w-0 flex-1 text-left cursor-pointer group"
      >
        <span className="block text-sm truncate group-hover:underline">{note.title}</span>
        <span className="flex items-center gap-1.5 mt-0.5">
          <span className="pill pill-muted">{scopeChip}</span>
          {scopeTarget && <span className="text-[10px] text-muted-foreground truncate">{scopeTarget}</span>}
        </span>
        {excerpt && (
          <span className="block text-[11px] text-muted-foreground leading-[1.5] mt-1 line-clamp-2">{excerpt}</span>
        )}
      </Link>
      <span className="text-[10px] text-muted-foreground tabular-nums flex-none">
        {new Date(note.createdAt).toLocaleDateString(localeTag(language))}
      </span>
      <button
        type="button"
        onClick={exportNote}
        data-testid="note-export"
        title={t("notes.export")}
        aria-label={`${t("notes.export")}: ${note.title}`}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink cursor-pointer hover:underline flex-none"
      >
        <Download className="w-3 h-3" aria-hidden="true" />
      </button>
      <ArrowUpRight
        className="w-3.5 h-3.5 text-muted-foreground transition-colors"
        aria-hidden="true"
      />
    </div>
  );
}
