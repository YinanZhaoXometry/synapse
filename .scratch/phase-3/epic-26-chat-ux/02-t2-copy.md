# T2 — message copy affordance (epic-26)

Status: in-progress

Hover-reveal copy on user + AI bubbles, the general agent-app pattern the owner
named.

## Scope

- `lib/clipboard.ts` — `copyTextToClipboard`: navigator.clipboard first, the
  hidden-textarea `execCommand` fallback second, boolean result.
- `components/shared/copy-button.tsx` — the button: Copy → Check for 1.5s →
  revert; failure → sonner toast. i18n `chat.copy` / `chat.copied` /
  `chat.copyFailed` (zh/en parity via the full-table test).
- Mount: CompanionPanel UserBubble + CompanionBubble (hover/focus-reveal at the
  bubble's top edge); CreationChat transcript rows. StreamingBubble gets none
  (transient — the completed bubble it becomes carries one).

## AC

- [ ] Click writes the raw text to the clipboard and shows ✓ for ~1.5s (test).
- [ ] Clipboard failure toasts `chat.copyFailed` (test).
- [ ] Streaming bubble has no copy; completed bubbles do.
- [ ] i18n parity test green (keys added on both language tables).
