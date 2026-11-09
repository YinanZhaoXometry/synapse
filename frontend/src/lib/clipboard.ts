/**
 * The one clipboard seam (epic-26 T2): navigator.clipboard first (the secure
 * -context path every real browser serves), the hidden-textarea execCommand
 * fallback second (non-secure contexts / exotic webviews), a boolean result —
 * callers decide the feedback (the CopyButton's ✓ flip vs. its failure toast).
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // secure-context rejection — fall through to the legacy path
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}
