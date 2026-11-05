/**
 * The annotations list panel (FR-16, epic-13 T3 — the management + keyboard
 * surface): per-material, collapsible, rendered INSIDE the reader's
 * material zone. Pinned here: every row renders textually (AD-9 — the
 * engine's colors are never the only channel: kind label + quote + stale
 * badge), the row is the keyboard path (click-to-scroll through the AD-8
 * anchor channel via onJump), delete is its own button, stale/missing
 * ranges carry the honest 「原文已变化」 badge (never silently misplaced),
 * and the empty state names the entry (select text → the bar's chips).
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { AnnotationsPanel, type AnnotationRow } from "./annotations-panel";
import type { Annotation } from "@/domain/entities";

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const enDict = (translations as Record<string, Record<string, string>>).en;

function row(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: overrides.id ?? "anno-1",
    materialId: "mat-1",
    locator: overrides.locator ?? { kind: "markdown", sectionId: "sec-1" },
    range: overrides.range ?? { sectionId: "sec-1", start: 6, end: 10, quote: "beta" },
    kind: overrides.kind ?? "highlight",
    color: overrides.color ?? "amber",
    body: overrides.body ?? "",
    createdAt: overrides.createdAt ?? "2026-11-05T10:00:00Z",
  };
}

const baseRows: AnnotationRow[] = [
  { annotation: row(), status: "ok" },
  {
    annotation: row({
      id: "anno-2",
      kind: "underline",
      color: "emerald",
      locator: { kind: "pdf", page: 3 },
      range: { page: 3, start: 0, end: 4, quote: "page" },
    }),
    status: "stale",
  },
];

function renderPanel(overrides: {
  rows?: AnnotationRow[];
  onJump?: (annotation: Annotation) => void;
  onRemove?: (id: string) => void;
  onClose?: () => void;
} = {}) {
  const onJump = overrides.onJump ?? vi.fn();
  const onRemove = overrides.onRemove ?? vi.fn();
  const onClose = overrides.onClose ?? vi.fn();
  render(
    <LanguageProvider>
      <AnnotationsPanel
        materialId="mat-1"
        rows={overrides.rows ?? baseRows}
        onJump={onJump}
        onRemove={onRemove}
        onClose={onClose}
      />
    </LanguageProvider>,
  );
  return { onJump, onRemove, onClose };
}

describe("AnnotationsPanel (FR-16 — the list is the textual + keyboard channel)", () => {
  it("renders the title, both rows with their kind labels + quotes (bilingual parity)", () => {
    renderPanel();

    expect(screen.getByText(zhDict["reader.annotationsPanelTitle"])).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
    expect(screen.getByText("page")).toBeInTheDocument();
    expect(screen.getByText(zhDict["reader.annotationKindHighlight"])).toBeInTheDocument();
    expect(screen.getByText(zhDict["reader.annotationKindUnderline"])).toBeInTheDocument();

    for (const key of [
      "reader.annotationsPanelTitle",
      "reader.annotationsPanelCloseAria",
      "reader.annotationsEmpty",
      "reader.annotationKindHighlight",
      "reader.annotationKindUnderline",
      "reader.annotationStale",
      "reader.annotationJumpAria",
      "reader.annotationDeleteAria",
    ]) {
      expect(zhDict[key], `zh copy for ${key}`).toBeTruthy();
      expect(enDict[key], `en copy for ${key}`).toBeTruthy();
    }
  });

  it("carries the honest stale badge on the drifted row only", () => {
    renderPanel();

    expect(screen.getByText(zhDict["reader.annotationStale"])).toBeInTheDocument();
    // exactly one stale badge (anno-1 is ok)
    expect(screen.getAllByText(zhDict["reader.annotationStale"]).length).toBe(1);
  });

  it("jumps through the anchor channel on row click (keyboard path — a real button)", () => {
    const { onJump } = renderPanel();

    const jumpButton = screen.getAllByRole("button", { name: zhDict["reader.annotationJumpAria"] })[0];
    expect(jumpButton.tagName).toBe("BUTTON");
    fireEvent.click(jumpButton);

    expect(onJump).toHaveBeenCalledWith(baseRows[0].annotation);
  });

  it("removes through its own per-row button", () => {
    const { onRemove } = renderPanel();

    fireEvent.click(screen.getAllByRole("button", { name: zhDict["reader.annotationDeleteAria"] })[1]);

    expect(onRemove).toHaveBeenCalledWith("anno-2");
  });

  it("closes through the header button", () => {
    const { onClose } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: zhDict["reader.annotationsPanelCloseAria"] }));

    expect(onClose).toHaveBeenCalled();
  });

  it("shows the honest empty state when the material has no annotations", () => {
    renderPanel({ rows: [] });

    expect(screen.getByText(zhDict["reader.annotationsEmpty"])).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: zhDict["reader.annotationDeleteAria"] })).not.toBeInTheDocument();
  });
});
