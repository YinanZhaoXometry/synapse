/**
 * The Study Focus panel (FR-17, epic-13 T4; OQ-1 — the reader-side
 * 「核心要点」panel): pinned here — items render textually (title + detail,
 * AD-9 — never tints-only), the per-item deep-link fires the AD-8 anchor
 * channel with the locator derived from the server-owned sourceRange (a
 * markdown section and a pdf page both pinned), a range-less item renders
 * honestly unlinkable (text-only, no jump button), the regenerate action
 * is its own button, the generation chip rides the header (vN), and the
 * empty states are honest + bilingual: no annotations → highlight first;
 * annotations but no set → the generate CTA. The i18n parity loop keeps
 * every new key in BOTH dictionaries.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { StudyFocusPanel } from "./study-focus-panel";
import { focusSourceLocator } from "./study-focus-locator";
import type { StudyFocusSetView } from "@/api";

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const enDict = (translations as Record<string, Record<string, string>>).en;

const baseSet: StudyFocusSetView = {
  id: "set-1",
  materialId: "mat-1",
  generation: 2,
  items: [
    {
      id: "item-1",
      title: "任期与领导者",
      detail: "每个任期至多选出一位领导者。",
      sourceRange: { sectionId: "sec-1", start: 6, end: 10, quote: "beta" },
    },
    {
      id: "item-2",
      title: "日志复制",
      detail: "领导者把日志复制到所有跟随者。",
      sourceRange: { page: 3, start: 0, end: 4, quote: "page" },
    },
    {
      id: "item-3",
      title: "无出处要点",
      detail: "来源标注没有范围（导入的旧行）。",
      sourceRange: null,
    },
  ],
  createdAt: "2026-11-05T10:00:00Z",
  updatedAt: "2026-11-05T11:00:00Z",
};

function renderPanel(overrides: {
  hasAnnotations?: boolean | undefined;
  set?: StudyFocusSetView | null | undefined;
  generateLoading?: boolean;
  onGenerate?: () => void;
  onJump?: (locator: { kind: string; page?: number; sectionId?: string }) => void;
  onClose?: () => void;
} = {}) {
  const onGenerate = overrides.onGenerate ?? vi.fn();
  const onJump = overrides.onJump ?? vi.fn();
  const onClose = overrides.onClose ?? vi.fn();
  render(
    <LanguageProvider>
      <StudyFocusPanel
        materialId="mat-1"
        hasAnnotations={overrides.hasAnnotations ?? true}
        set={"set" in overrides ? overrides.set : baseSet}
        generateLoading={overrides.generateLoading ?? false}
        onGenerate={onGenerate}
        onJump={onJump as never}
        onClose={onClose}
      />
    </LanguageProvider>,
  );
  return { onGenerate, onJump, onClose };
}

describe("StudyFocusPanel (FR-17 — the OQ-1 reader-side panel)", () => {
  it("renders the set's items textually with the generation chip (bilingual parity)", () => {
    renderPanel();

    expect(screen.getByText(zhDict["reader.studyFocusPanelTitle"])).toBeInTheDocument();
    expect(screen.getByText("任期与领导者")).toBeInTheDocument();
    expect(screen.getByText("每个任期至多选出一位领导者。")).toBeInTheDocument();
    expect(screen.getByText("日志复制")).toBeInTheDocument();
    expect(screen.getByTestId("study-focus-generation")).toHaveTextContent("v2");

    for (const key of [
      "reader.studyFocusPanelTitle",
      "reader.studyFocusPanelOpenAria",
      "reader.studyFocusPanelCloseAria",
      "reader.studyFocusEmptyNoAnnotations",
      "reader.studyFocusGenerateCta",
      "reader.studyFocusRegenerate",
      "reader.studyFocusLoading",
      "reader.studyFocusGenerating",
      "reader.studyFocusJumpAria",
      "reader.studyFocusGenerateFailed",
    ]) {
      expect(zhDict[key], `zh copy for ${key}`).toBeTruthy();
      expect(enDict[key], `en copy for ${key}`).toBeTruthy();
    }
  });

  it("deep-links a markdown item through the anchor channel (the locator derives from sourceRange)", () => {
    const { onJump } = renderPanel();

    const rows = screen.getAllByTestId("study-focus-item");
    fireEvent.click(rows[0]);

    expect(onJump).toHaveBeenCalledWith({ kind: "markdown", sectionId: "sec-1" });
  });

  it("deep-links a pdf item to its page", () => {
    const { onJump } = renderPanel();

    const rows = screen.getAllByTestId("study-focus-item");
    fireEvent.click(rows[1]);

    expect(onJump).toHaveBeenCalledWith({ kind: "pdf", page: 3 });
  });

  it("renders a range-less item as plain text — honestly unlinkable", () => {
    renderPanel();

    expect(screen.getByText("无出处要点")).toBeInTheDocument();
    // Only the two linkable rows are buttons carrying the jump aria label.
    const jumpButtons = screen.getAllByRole("button", { name: new RegExp(zhDict["reader.studyFocusJumpAria"]) });
    expect(jumpButtons.length).toBe(2);
  });

  it("regenerates through its own button (the server replaces the set)", () => {
    const { onGenerate } = renderPanel();

    fireEvent.click(screen.getByTestId("study-focus-regenerate"));

    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it("shows the honest no-annotations empty state — no generate CTA (the server would refuse)", () => {
    renderPanel({ set: null, hasAnnotations: false });

    expect(screen.getByText(zhDict["reader.studyFocusEmptyNoAnnotations"])).toBeInTheDocument();
    expect(screen.queryByTestId("study-focus-generate")).not.toBeInTheDocument();
    expect(screen.queryByTestId("study-focus-regenerate")).not.toBeInTheDocument();
  });

  it("shows the generate CTA when annotations exist but no set was distilled yet", () => {
    const { onGenerate } = renderPanel({ set: null, hasAnnotations: true });

    const cta = screen.getByTestId("study-focus-generate");
    expect(cta).toHaveTextContent(zhDict["reader.studyFocusGenerateCta"]);
    fireEvent.click(cta);
    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it("shows the loading copy while the set read is in flight", () => {
    renderPanel({ set: undefined });

    expect(screen.getByText(zhDict["reader.studyFocusLoading"])).toBeInTheDocument();
  });

  it("shows the generating copy in place of the items while the mutation is in flight", () => {
    renderPanel({ generateLoading: true });

    expect(screen.getByText(zhDict["reader.studyFocusGenerating"])).toBeInTheDocument();
    expect(screen.queryByTestId("study-focus-regenerate")).not.toBeInTheDocument();
  });

  it("closes through the header button", () => {
    const { onClose } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: zhDict["reader.studyFocusPanelCloseAria"] }));

    expect(onClose).toHaveBeenCalled();
  });
});

describe("focusSourceLocator (the server-owned range → the reader's jump target)", () => {
  it("derives the pdf locator from a page range", () => {
    expect(focusSourceLocator({ page: 3, start: 0, end: 4, quote: "page" })).toEqual({ kind: "pdf", page: 3 });
  });

  it("derives the markdown locator from a sectionId range", () => {
    expect(focusSourceLocator({ sectionId: "sec-2", start: 0, end: 4, quote: "text" })).toEqual({
      kind: "markdown",
      sectionId: "sec-2",
    });
  });
});
