# T2 — Annotation hover-remove popover (markdown)

Status: done
Epic: [epic-24](../epic.md) · Spec: [spec.md](../spec.md) §Q2

## Goal

Hover a painted highlight/underline in the markdown reader → popover (note body
+ 移除标注) → the existing remove mutation. Heading marking controls untouched.

## Changes

- `frontend/src/features/reader/annotation-engine.ts`: export
  `hitTestMarkdownAnnotation(article, items, introSectionId, node, offset)` —
  the offset math (node → section region → accumulated offset → covering item),
  reused by the caret bridge; pure DOM-walk, jsdom-testable.
- NEW `frontend/src/features/reader/annotation-hover.ts`: the pointer bridge —
  rAF-throttled pointermove on the article; fallback path via
  `mark[data-annotation-id]` delegation; Highlight path via
  `caretRangeFromPoint`/`caretPositionFromPoint` → the engine hit-test; returns
  `{ id, x, y }` anchors or null. Returns a disposer.
- `markdown-view.tsx`: optional `onRemoveAnnotation?(id)` prop (absent = off —
  the optional-group pattern); renders `AnnotationPopover` (fixed, z-40, body
  text when present, trash button, `data-testid="annotation-remove"`);
  dismiss on leave/scroll/Escape/outside-click; i18n keys
  `reader.annotationRemove` (+ aria).
- `MarkdownFlow.tsx` / `ReaderPage.tsx`: pass-through prop →
  `handleRemoveAnnotation`.

## AC

- Fallback-path tests (jsdom wraps marks): hover mark → popover visible with
  body; click remove → `onRemoveAnnotation(id)`; Escape/leave hides.
- Hit-test unit tests: covering/non-covering offsets, stale item never
  hoverable, intro region addressed.
- No regression: marking-view / annotation tests green; tsc/eslint/vitest green.

## Close-out

Engine hit-test + pointer bridge + popover landed; ReaderPage wired. PDF
hit-testing stays parked (epic record).
