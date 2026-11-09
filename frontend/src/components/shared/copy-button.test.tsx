import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { Toaster } from "@/components/ui/sonner";
import { CopyButton } from "./copy-button";

/**
 * The copy affordance (epic-26 T2): click writes the raw text, flips to ✓
 * (aria-label 已复制) for ~1.5s, then reverts; a clipboard failure toasts
 * instead of flipping.
 */

function renderButton(text = "hello **world**") {
  return render(
    <LanguageProvider>
      {/* Toaster mounted so the failure toast is an observable DOM state (the
          TaskCreatePage test's pattern) */}
      <Toaster />
      <CopyButton text={text} testId="chat-copy" />
    </LanguageProvider>,
  );
}

describe("CopyButton", () => {
  it("click writes the raw text to the clipboard and flips to 已复制", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const view = renderButton();
    const button = view.container.querySelector('[data-testid="chat-copy"]')!;
    expect(button.getAttribute("aria-label")).toBe("复制");
    await user.click(button);
    expect(writeText).toHaveBeenCalledWith("hello **world**");
    await waitFor(() => {
      expect(button.getAttribute("aria-label")).toBe("已复制");
    });
  });

  it("reverts to 复制 after ~1.5s", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const view = renderButton();
    const button = view.container.querySelector('[data-testid="chat-copy"]')!;
    await user.click(button);
    await waitFor(() => {
      expect(button.getAttribute("aria-label")).toBe("已复制");
    });
    await waitFor(
      () => {
        expect(button.getAttribute("aria-label")).toBe("复制");
      },
      { timeout: 2500 },
    );
  });

  it("clipboard failure toasts 复制失败 and never flips", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    // execCommand absent + jsdom's not-implemented default → the fallback
    // path also fails; the toast is the honest outcome.
    document.execCommand = (() => {
      return false;
    }) as unknown as typeof document.execCommand;
    const view = renderButton();
    const button = view.container.querySelector('[data-testid="chat-copy"]')!;
    await user.click(button);
    await waitFor(() => {
      expect(document.querySelector('[data-sonner-toast]')).not.toBeNull();
    });
    expect(button.getAttribute("aria-label")).toBe("复制");
  });
});
