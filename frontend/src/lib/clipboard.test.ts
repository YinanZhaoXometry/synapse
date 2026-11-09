import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTextToClipboard } from "./clipboard";

/**
 * The clipboard seam (epic-26 T2): navigator.clipboard wins when present,
 * the execCommand fallback answers when absent, and both failing → false
 * (the caller toasts, the seam never throws).
 */

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("copyTextToClipboard", () => {
  it("writes via navigator.clipboard and answers true", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(copyTextToClipboard("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to execCommand when navigator.clipboard is absent", async () => {
    vi.stubGlobal("navigator", {} as Navigator);
    const exec = vi.fn().mockReturnValue(true);
    document.execCommand = exec as unknown as typeof document.execCommand;
    await expect(copyTextToClipboard("hello")).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
  });

  it("answers false when both paths fail — never throws", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    const exec = vi.fn().mockReturnValue(false);
    document.execCommand = exec as unknown as typeof document.execCommand;
    await expect(copyTextToClipboard("hello")).resolves.toBe(false);
  });

  it("answers false when no clipboard API exists at all and execCommand throws", async () => {
    vi.stubGlobal("navigator", {} as Navigator);
    document.execCommand = (() => {
      throw new Error("not supported");
    }) as unknown as typeof document.execCommand;
    await expect(copyTextToClipboard("hello")).resolves.toBe(false);
  });
});
