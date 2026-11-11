/**
 * The note body view (epic-35 T02): the weak-spot provenance strip, the
 * markdown segments through the reader's renderer, and the enrichment marker
 * placeholder cards — extracted verbatim from NotesSection so the plan rail's
 * list and the standalone reading page (`/plan/:id/notes/:noteId`) render the
 * SAME body. Padding belongs to the consumer (the rail's tight px-4 vs the
 * page's 70ch article). The lazy MarkdownView import rides here now — the
 * markdown pipeline keeps living in its own chunk (AD-8, the reader's rule),
 * and this module is the only notes-side importer.
 */
import { Suspense, lazy } from "react";
import {
  BarChart3,
  Crosshair,
  Image as ImageIcon,
  Lightbulb,
  Network,
  User as UserIcon,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { NoteView } from "@/api/views";
import {
  markerKindKey,
  noteTargetingRows,
  splitNoteBody,
  type NoteMarkerToken,
  type NoteTargetingRowView,
} from "./note-body-shaping";

// The app's ONE markdown renderer module (src/features/reader/markdown-view)
// — reused, not duplicated, and lazy-loaded so the markdown pipeline keeps
// living in its own chunk (AD-8, the same rule the reader enforces).
const MarkdownView = lazy(() => import("@/features/reader/markdown-view"));

/** One markdown text segment — flashless (notes have no anchor flash to replay). */
function NoteMarkdownSegment({ text }: { text: string }) {
  return <MarkdownView text={text} flashSection={null} />;
}

export default function NoteBodyView({ note }: { note: NoteView }) {
  const { t } = useLanguage();
  const tokens = splitNoteBody(note.body);
  const targetingRows = noteTargetingRows(note.targeting);

  return (
    <div data-testid="note-body">
      {targetingRows.length > 0 && <TargetingStrip rows={targetingRows} />}
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

/**
 * The weak-spot provenance strip (FR-22, epic P2-12 T2): what this note aimed
 * at — the node titles + coverage-share chips, read ONLY from the server's
 * targeting jsonb (noteTargetingRows reads honest [] for anything else, so
 * untargeted notes never render a strip).
 */
function TargetingStrip({ rows }: { rows: NoteTargetingRowView[] }) {
  const { t } = useLanguage();

  return (
    <div
      data-testid="note-targeting-strip"
      className="mb-3 rounded-xl border border-border-soft bg-[var(--accent-tint)] px-3 py-2"
    >
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-accent-ink">
        <Crosshair className="w-3.5 h-3.5 flex-none" aria-hidden="true" />
        {t("notes.targetingLabel")}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {rows.map((row) => (
          <span
            key={row.nodeId}
            data-testid="note-targeting-chip"
            title={t("notes.targetingShare", { share: row.share })}
            className="pill pill-muted text-[10px]"
          >
            {row.title}
            <span className="ml-1 tabular-nums text-accent-ink">×{row.share}</span>
          </span>
        ))}
      </div>
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
