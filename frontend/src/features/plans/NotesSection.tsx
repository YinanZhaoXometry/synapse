/**
 * The plan home's 学习笔记 section (FR-40, epic P2-12 T1; delta decision 3 —
 * plan-scoped, no new route): the plan's notes (plan + node + material
 * scopes ride the ONE server union) plus the generate control — a scope
 * picker (整个计划 / 选择节点 / 选择资料), the optional user-requested
 * annotation input ("在指定位置加插图" — the enrichAt free text, ONE
 * [[enrich|user|…]] marker placed by the server), and the generate action.
 * Note detail = an expandable view: the markdown body renders through the
 * reader's markdown view (lazy-loaded, the app's ONE renderer module — the
 * reader-only chunk discipline survives), with enrichment markers rendered
 * as styled placeholder cards between the blocks (diagram/chart/image/user
 * get distinct icons; unknown kinds fall back honestly). Export downloads
 * <title>.md via a Blob URL with the markers preserved verbatim. Failures
 * map the closed api enum through apiErrorKeys("notes.") → sonner toasts.
 */
import { useState, Suspense, lazy } from "react";
import {
  BarChart3,
  ChevronDown,
  Download,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  Network,
  RotateCw,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { localeTag } from "./locale";
import { downloadNoteMarkdown, markerKindKey, splitNoteBody, type NoteMarkerToken } from "./note-body-shaping";

const NOTE_ERROR_KEYS: Record<string, string> = apiErrorKeys("notes.");
const NOTE_FAILED_KEY = "notes.failed";

// The app's ONE markdown renderer module (src/features/reader/markdown-view)
// — reused, not duplicated, and lazy-loaded so the markdown pipeline keeps
// living in its own chunk (AD-8, the same rule the reader enforces).
const MarkdownView = lazy(() => import("@/features/reader/markdown-view"));

/** One markdown text segment — flashless (notes have no anchor flash to replay). */
function NoteMarkdownSegment({ text }: { text: string }) {
  return <MarkdownView text={text} flashSection={null} />;
}

export default function NotesSection({ planId, nodes, materials }: { planId: string; nodes: KnowledgeNodeView[]; materials: MaterialView[] }) {
  const { language, t } = useLanguage();
  const notesQuery = usePlanNotesQuery(planId);
  const [generateNote, generateResult] = useGenerateNoteMutation();

  const [scope, setScope] = useState<"plan" | "node" | "material">("plan");
  const [nodeId, setNodeId] = useState<string>("");
  const [materialId, setMaterialId] = useState<string>("");
  const [enrichAt, setEnrichAt] = useState<string>("");

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
            <NoteRow key={note.id} note={note} nodes={nodes} materials={materials} />
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

/** One note row: title + scope chip (with the target's resolved title) + date, expanding to the body. */
function NoteRow({ note, nodes, materials }: { note: NoteView; nodes: KnowledgeNodeView[]; materials: MaterialView[] }) {
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);

  const scopeChip = note.scope === "plan" ? t("notes.chipPlan") : note.scope === "node" ? t("notes.chipNode") : t("notes.chipMaterial");
  const scopeTarget =
    note.scope === "plan"
      ? null
      : note.scope === "node"
        ? (nodes.find((node) => node.id === note.scopeId)?.title ?? note.scopeId)
        : (materials.find((material) => material.id === note.scopeId)?.title ?? note.scopeId);

  const exportNote = () => {
    downloadNoteMarkdown(note);
    toast.success(t("notes.exported"));
  };

  return (
    <div data-testid="note-row">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2 px-4 py-3">
          <FileText className="w-4 h-4 text-muted-foreground flex-none" aria-hidden="true" />
          <CollapsibleTrigger
            type="button"
            aria-expanded={open}
            className="min-w-0 flex-1 text-left cursor-pointer group"
          >
            <span className="block text-sm truncate group-hover:underline">{note.title}</span>
            <span className="flex items-center gap-1.5 mt-0.5">
              <span className="pill pill-muted">{scopeChip}</span>
              {scopeTarget && <span className="text-[10px] text-muted-foreground truncate">{scopeTarget}</span>}
            </span>
          </CollapsibleTrigger>
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
          <ChevronDown
            className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform flex-none", !open && "-rotate-90")}
            aria-hidden="true"
          />
        </div>
        <CollapsibleContent>
          <NoteBody note={note} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/** The expandable body: markdown segments through the reader's renderer, markers as placeholder cards. */
function NoteBody({ note }: { note: NoteView }) {
  const { t } = useLanguage();
  const tokens = splitNoteBody(note.body);

  return (
    <div className="px-4 pb-4 pt-1" data-testid="note-body">
      {tokens.map((token, index) =>
        token.kind === "text" ? (
          <Suspense key={index} fallback={null}>
            <NoteMarkdownSegment text={token.text} />
          </Suspense>
        ) : (
          <MarkerCard key={index} token={token} />
        ),
      )}
      {tokens.every((token) => token.kind === "marker") && (
        <p className="text-[11px] text-muted-foreground">{t("notes.exportHint")}</p>
      )}
    </div>
  );
}

function MarkerCard({ token }: { token: NoteMarkerToken }) {
  const { t } = useLanguage();
  const markerKey = markerKindKey(token.markerKind);
  const labelKey = markerKey ? `notes.kind.${markerKey}` : null;
  const icon =
    markerKey === "diagram" ? (
      <Network className="w-3.5 h-3.5 text-accent-ink flex-none" aria-hidden="true" />
    ) : markerKey === "chart" ? (
      <BarChart3 className="w-3.5 h-3.5 text-accent-ink flex-none" aria-hidden="true" />
    ) : markerKey === "image" ? (
      <ImageIcon className="w-3.5 h-3.5 text-accent-ink flex-none" aria-hidden="true" />
    ) : markerKey === "user" ? (
      <UserIcon className="w-3.5 h-3.5 text-accent-ink flex-none" aria-hidden="true" />
    ) : (
      <Lightbulb className="w-3.5 h-3.5 text-accent-ink flex-none" aria-hidden="true" />
    );

  return (
    <div
      data-testid="note-marker-card"
      data-marker-kind={token.markerKind}
      className="my-3 flex items-start gap-2 rounded-xl border-[1.5px] border-dashed border-[var(--accent-edge)] bg-[var(--accent-tint)] px-3 py-2.5"
    >
      {icon}
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-accent-ink">
          {labelKey ? t(labelKey) : token.markerKind}
        </p>
        <p className="text-xs text-muted-foreground leading-[1.5] mt-0.5">{token.suggestion}</p>
      </div>
    </div>
  );
}
