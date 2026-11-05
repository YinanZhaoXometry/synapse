/**
 * The selection bar (FR-13, epic-13 T1): the floating 「问 Companion / 快测」
 * pair anchored to a reader text selection (UX spine's SelectionBar row).
 * Pinned here: the two REAL buttons (keyboard-reachable — native focusable
 * buttons, the a11y floor AD-9) carrying their bilingual labels (read from the
 * dictionary, never recomputed; zh/en parity asserted), Ask delivering the
 * captured selection to onAsk, Quick Test dispatching through the feature-flag
 * seam (handler registered → the handler's scope; not → the honest
 * coming-soon toast, never a dead affordance), Escape dismissing, and the
 * bar's mousedown being suppressed so clicking an action never collapses the
 * selection it acts on (the bar never blocks re-selection).
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { registerQuickTestHandler } from "./quick-test-seam";
import { SelectionBar } from "./selection-bar";
import type { CapturedSelection } from "./selection-capture";

const zhDict = (translations as Record<string, Record<string, string>>).zh;
const enDict = (translations as Record<string, Record<string, string>>).en;

const mdSelection: CapturedSelection = {
  kind: "markdown",
  sectionId: "sec-a",
  text: "alpha content here",
};

function renderBar(overrides: {
  onAsk?: (selection: CapturedSelection) => void;
  onDismiss?: () => void;
  materialId?: string;
  selection?: CapturedSelection;
} = {}) {
  const onAsk = overrides.onAsk ?? vi.fn();
  const onDismiss = overrides.onDismiss ?? vi.fn();
  render(
    <LanguageProvider>
      <SelectionBar
        selection={overrides.selection ?? mdSelection}
        materialId={overrides.materialId ?? "mat-1"}
        anchor={{ x: 120, y: 200 }}
        onAsk={onAsk}
        onDismiss={onDismiss}
      />
    </LanguageProvider>,
  );
  return { onAsk, onDismiss };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SelectionBar (the UX spine's SelectionBar row)", () => {
  it("renders the two actions as real buttons with the bilingual labels (AD-9 keyboard reachability)", () => {
    renderBar();

    const ask = screen.getByRole("button", { name: zhDict["reader.selectionAsk"] });
    const quickTest = screen.getByRole("button", { name: zhDict["reader.selectionQuickTest"] });
    expect(ask.tagName).toBe("BUTTON");
    expect(quickTest.tagName).toBe("BUTTON");

    // i18n parity (AD-9): both languages carry non-empty copy for the pair
    for (const key of ["reader.selectionAsk", "reader.selectionQuickTest", "reader.selectionBarLabel", "reader.quickTestComingSoon"]) {
      expect(zhDict[key], `zh copy for ${key}`).toBeTruthy();
      expect(enDict[key], `en copy for ${key}`).toBeTruthy();
    }
  });

  it("delivers the captured selection to onAsk (Ask = the quote rides)", () => {
    const { onAsk } = renderBar();

    fireEvent.click(screen.getByRole("button", { name: zhDict["reader.selectionAsk"] }));

    expect(onAsk).toHaveBeenCalledWith(mdSelection);
  });

  it("dismisses on Escape (keyboard path out)", () => {
    const { onDismiss } = renderBar();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onDismiss).toHaveBeenCalled();
  });

  it("keeps the selection alive when an action button is pressed (mousedown suppressed)", () => {
    renderBar();

    // the suppressor is preventDefault on the bar container's mousedown (the
    // browser would otherwise collapse the selection before click lands) —
    // fireEvent returns false exactly when the event's default got prevented
    const prevented = fireEvent.mouseDown(screen.getByRole("button", { name: zhDict["reader.selectionQuickTest"] }));
    expect(prevented).toBe(false);
  });

  it("dispatches the scope through the seam when a Quick Test handler is registered (T2 landed)", () => {
    const toastSpy = vi.spyOn(toast, "info").mockImplementation(() => "");
    const handler = vi.fn();
    const unregister = registerQuickTestHandler(handler);
    renderBar({ materialId: "mat-9" });

    fireEvent.click(screen.getByRole("button", { name: zhDict["reader.selectionQuickTest"] }));

    expect(handler).toHaveBeenCalledWith({ materialId: "mat-9", selection: mdSelection });
    expect(toastSpy).not.toHaveBeenCalled();

    unregister();
  });

  it("toasts the honest coming-soon copy when no handler is registered (T2 pending)", () => {
    const toastSpy = vi.spyOn(toast, "info").mockImplementation(() => "");
    renderBar();

    fireEvent.click(screen.getByRole("button", { name: zhDict["reader.selectionQuickTest"] }));

    expect(toastSpy).toHaveBeenCalledWith(zhDict["reader.quickTestComingSoon"]);
  });
});
