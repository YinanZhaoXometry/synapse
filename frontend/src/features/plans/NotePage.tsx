/**
 * The standalone note reading page (epic-35 T02, `/plan/:id/notes/:noteId`):
 * long notes leave the ~320px plan-home rail — the ReaderPage full-page shell
 * (slim header + one scrolling 70ch column) over the SAME NoteBodyView the
 * rail's list links to. Data rides the ONE PlanNotes read (no per-note query
 * — the plan page's cache warms it); the scope's resolved target title comes
 * from the Plan detail read (chip + title only until it lands). An unknown or
 * deleted id is an honest not-found (AD-8), never a fake body.
 */
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import { usePlanNotesQuery, usePlanQuery } from "@/api";
import type { NoteView } from "@/api/views";
import { useLanguage } from "@/contexts/LanguageContext";
import PageLoader from "@/components/shared/PageLoader";
import { localeTag } from "./locale";
import { downloadNoteMarkdown } from "./note-body-shaping";
import NoteBodyView from "./NoteBodyView";

export default function NotePage() {
  const { id: planId, noteId } = useParams();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const notesQuery = usePlanNotesQuery(planId ?? "");
  const planQuery = usePlanQuery(planId ?? "");

  const notes = notesQuery.data;
  const note = notes?.find((row) => row.id === noteId);

  const scopeChip = (row: NoteView) =>
    row.scope === "plan" ? t("notes.chipPlan") : row.scope === "node" ? t("notes.chipNode") : t("notes.chipMaterial");
  const scopeTarget = (row: NoteView) => {
    if (row.scope === "plan") return null;
    if (row.scope === "node") {
      return planQuery.data?.nodes.find((node) => node.id === row.scopeId)?.title ?? row.scopeId;
    }
    return planQuery.data?.materials.find((material) => material.id === row.scopeId)?.title ?? row.scopeId;
  };

  const back = (
    <button
      type="button"
      onClick={() => navigate(`/plan/${planId}`)}
      data-testid="note-back"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer flex-none"
    >
      <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> {t("reader.backToPlan")}
    </button>
  );

  if (notesQuery.loading) return <PageLoader />;

  if (notesQuery.error || !planId) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 md:p-8 max-w-[1080px] mx-auto" data-testid="note-load-failed">
            {back}
            <p className="page-title mt-6 text-lg">{t("notes.loadFailed")}</p>
            <button
              type="button"
              onClick={() => void notesQuery.refetch()}
              disabled={notesQuery.loading}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink cursor-pointer hover:underline disabled:opacity-60 disabled:cursor-wait"
            >
              {t("notes.retryLoad")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!note) {
    // Honest not-found (AD-8): an unknown or deleted id never pretends.
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 md:p-8 max-w-[1080px] mx-auto" data-testid="note-not-found">
            {back}
            <p className="page-title mt-6 text-lg">{t("notes.notFound")}</p>
            <p className="text-xs text-muted-foreground mt-2">{t("notes.notFoundBody")}</p>
          </div>
        </div>
      </div>
    );
  }

  const target = scopeTarget(note);

  const exportNote = () => {
    downloadNoteMarkdown(note);
    toast.success(t("notes.exported"));
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="flex-none flex items-center gap-3 min-h-[52px] px-4 md:px-5 bg-card border-b border-border-soft">
        {back}
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold truncate" data-testid="note-page-title">{note.title}</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="pill pill-muted">{scopeChip(note)}</span>
            {target && <span className="text-[10px] text-muted-foreground truncate">{target}</span>}
            <span className="text-[10px] text-muted-foreground tabular-nums flex-none">
              {new Date(note.createdAt).toLocaleDateString(localeTag(language))}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={exportNote}
          data-testid="note-export"
          title={t("notes.export")}
          aria-label={`${t("notes.export")}: ${note.title}`}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink cursor-pointer hover:underline flex-none"
        >
          <Download className="w-3 h-3" aria-hidden="true" /> {t("notes.export")}
        </button>
      </header>
      <div className="flex-1 overflow-y-auto" data-testid="note-page-scroll">
        {/* No .reader-prose here — MarkdownView owns that class (nested
            .reader-prose is the double-paper bug); the article only sets the
            reading column (the MarkdownFlow 70ch precedent). */}
        <article className="w-full max-w-[70ch] mx-auto px-6 py-8">
          <NoteBodyView note={note} />
        </article>
      </div>
    </div>
  );
}
