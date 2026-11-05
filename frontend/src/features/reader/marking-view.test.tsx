/**
 * The reader's Mastery Marking affordance, markdown half (FR-15, epic-15 T3).
 * MarkdownView stays presentational — these pin the contract the mounter
 * (ReaderPage) consumes: absent props = NO claim state at all (the honest
 * loading posture — an in-flight read renders neither affordance nor green),
 * unclaimed = the claim affordance, claimed = the green start + unmark + the
 * gated confirm-quiz launcher (the selection bar's exact gate postures:
 * loading/error disable — error under the honest tooltip — none hides, ready
 * enables). Real buttons with bilingual names (AD-9); component depth matches
 * the reader's house precedent (selection-bar.test.tsx — the bar's gate
 * suite is the posture model; markdown-anchor-agreement.test.tsx renders
 * MarkdownView directly).
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import MarkdownView from "./markdown-view";

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const enDict = (translations as Record<string, Record<string, string>>).en;

const DOC = "# Getting started\n\nalpha body\n";
const SECTION = "getting-started";
const MULTI_DOC = "# Getting started\n\nalpha body\n\n## Next\n\nbeta body\n";

function renderView(
  overrides: {
    claimed?: string[];
    onToggleClaim?: (sectionId: string) => void;
    onConfirmQuiz?: (sectionId: string) => void;
    quickTestGate?: "loading" | "error" | "none" | "ready";
  } = {},
  doc = DOC,
) {
  const onToggleClaim = overrides.onToggleClaim ?? vi.fn();
  const onConfirmQuiz = overrides.onConfirmQuiz ?? vi.fn();
  const marking =
    overrides.claimed === undefined
      ? {}
      : { claimedSectionIds: new Set(overrides.claimed), onToggleClaim, onConfirmQuiz };
  render(
    <LanguageProvider>
      <MarkdownView text={doc} flashSection={null} {...marking} quickTestGate={overrides.quickTestGate} />
    </LanguageProvider>,
  );
  return { onToggleClaim, onConfirmQuiz };
}

describe("MarkdownView marking — the honest postures (epic-15 T3)", () => {
  it("renders NO claim state when the marking props are absent (feature off — the loading reader's posture)", () => {
    render(
      <LanguageProvider>
        <MarkdownView text={DOC} flashSection={null} />
      </LanguageProvider>,
    );

    expect(screen.queryByTestId("marking-claim")).not.toBeInTheDocument();
    expect(screen.queryByTestId("marking-unmark")).not.toBeInTheDocument();
    expect(screen.queryByTestId("marking-confirm-quiz")).not.toBeInTheDocument();
    expect(screen.queryByTestId("marking-section-tint")).not.toBeInTheDocument();
  });

  it("renders the claim affordance on an unclaimed section and hands the section id to onToggleClaim", () => {
    const { onToggleClaim } = renderView({ claimed: [] });

    const claim = screen.getByTestId("marking-claim");
    expect(claim.tagName).toBe("BUTTON");
    expect(claim).toHaveAttribute("aria-label", zhDict["marking.claim"]);
    expect(screen.queryByTestId("marking-confirm-quiz")).not.toBeInTheDocument(); // unclaimed never offers the launch

    fireEvent.click(claim);
    expect(onToggleClaim).toHaveBeenCalledWith(SECTION);
  });

  it("renders the claimed state — green tint + edge — with unmark and the confirm-quiz launcher", () => {
    const { onToggleClaim, onConfirmQuiz } = renderView({ claimed: [SECTION] });

    expect(screen.getByTestId("marking-section-tint")).toBeInTheDocument();
    expect(screen.getByTestId("marking-section-edge")).toBeInTheDocument();

    const unmark = screen.getByTestId("marking-unmark");
    expect(unmark.tagName).toBe("BUTTON");
    expect(unmark).toHaveAttribute("aria-label", zhDict["marking.unmark"]);
    expect(screen.queryByTestId("marking-claim")).not.toBeInTheDocument();

    fireEvent.click(unmark);
    expect(onToggleClaim).toHaveBeenCalledWith(SECTION);

    const confirm = screen.getByTestId("marking-confirm-quiz");
    expect(confirm).toHaveAttribute("aria-label", zhDict["marking.confirmQuiz"]);
    fireEvent.click(confirm);
    expect(onConfirmQuiz).toHaveBeenCalledWith(SECTION);
  });

  it("keeps the green and the claimed controls scoped to the claimed section only (unclaimed siblings stay plain)", () => {
    renderView({ claimed: [SECTION] }, MULTI_DOC);

    expect(screen.getByTestId("marking-section-tint")).toBeInTheDocument();
    expect(screen.getAllByTestId("marking-unmark")).toHaveLength(1);
    expect(screen.getAllByTestId("marking-claim")).toHaveLength(1); // `## Next` stays claimable
  });
});

describe("MarkdownView marking — the confirm-quiz gate (the selection bar's postures)", () => {
  it("hides the launcher behind no confirmed mapping (gate 'none'), keeping unmark", () => {
    const onConfirmQuiz = vi.fn();
    renderView({ claimed: [SECTION], quickTestGate: "none", onConfirmQuiz });

    expect(screen.queryByTestId("marking-confirm-quiz")).not.toBeInTheDocument();
    expect(screen.getByTestId("marking-unmark")).toBeInTheDocument(); // the gate scopes Quick Test only
  });

  it("disables the launcher honestly while the mapping read is in flight (gate 'loading')", () => {
    const onConfirmQuiz = vi.fn();
    renderView({ claimed: [SECTION], quickTestGate: "loading", onConfirmQuiz });

    const confirm = screen.getByTestId("marking-confirm-quiz");
    expect(confirm).toBeDisabled();
    expect(confirm).not.toHaveAttribute("title", zhDict["reader.quickTestUnavailable"]);
    fireEvent.click(confirm);
    expect(onConfirmQuiz).not.toHaveBeenCalled();
  });

  it("keeps the launcher disabled under the honest tooltip when the read failed (gate 'error')", () => {
    const onConfirmQuiz = vi.fn();
    renderView({ claimed: [SECTION], quickTestGate: "error", onConfirmQuiz });

    const confirm = screen.getByTestId("marking-confirm-quiz");
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAttribute("title", zhDict["reader.quickTestUnavailable"]);
    fireEvent.click(confirm);
    expect(onConfirmQuiz).not.toHaveBeenCalled();
  });

  it("enables the launcher on a landed confirmed mapping (gate 'ready')", () => {
    const onConfirmQuiz = vi.fn();
    renderView({ claimed: [SECTION], quickTestGate: "ready", onConfirmQuiz });

    expect(screen.getByTestId("marking-confirm-quiz")).not.toBeDisabled();
  });

  it("defaults the gate to ready when the mounter omits it (the bar's pre-gate posture)", () => {
    const onConfirmQuiz = vi.fn();
    renderView({ claimed: [SECTION], onConfirmQuiz });

    expect(screen.getByTestId("marking-confirm-quiz")).not.toBeDisabled();
  });

  it("never gates the claim affordance itself — unclaimed sections offer the claim under every gate", () => {
    renderView({ claimed: [], quickTestGate: "none" });

    expect(screen.getByTestId("marking-claim")).toBeInTheDocument();
    expect(screen.queryByTestId("marking-confirm-quiz")).not.toBeInTheDocument();
  });
});

describe("MarkdownView marking — i18n (AD-9)", () => {
  it("carries the marking copy bilingually (zh/en parity)", () => {
    for (const key of ["marking.claim", "marking.unmark", "marking.confirmQuiz", "marking.claimFailed", "marking.unmarkFailed"]) {
      expect(zhDict[key], `zh copy for ${key}`).toBeTruthy();
      expect(enDict[key], `en copy for ${key}`).toBeTruthy();
    }
  });
});
