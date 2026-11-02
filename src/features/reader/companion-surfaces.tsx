/**
 * The responsive ladder's floating surfaces (T6; UX responsive rows): the SAME
 * CompanionPanel the desktop dock mounts, repositioned per width. Tablet
 * 768–1023px → right slide-over above a scrim (scrim tap, Esc, or the top-bar
 * panel toggle dismisses); mobile <768px → bottom sheet at ~65dvh with a drag
 * handle (swipe down past the threshold dismisses; the composer stays usable —
 * the drag lives on the handle strip only, so the reading scroll above is
 * unaffected too: no scrim, the sheet just overlays the column's foot).
 *
 * Both are absolute INSIDE the reader zone (ReaderPage's material row is
 * relative — the surfaces sit under the top bar, leaving the toggle that opens
 * them clickable), so the app's own chrome (icon rail, mobile header/bottom
 * nav) stays untouched — the reader positions the Companion; the panel itself
 * is width-agnostic.
 * Closing unmounts the panel: an in-flight turn abandoned mid-flight persists
 * nothing (use-companion-chat's honesty rule); a finished one re-hydrates from
 * the persisted thread on reopen. Entry animations are CSS keyframes — the
 * global prefers-reduced-motion rule collapses them to instant state changes.
 * Tokens only (scrim/card/glass) — holds in light + dark and every palette.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Swipe-down distance (px) past which the sheet dismisses. */
const SHEET_DISMISS_PX = 80;

export interface CompanionLayerProps {
  /** The dialog's accessible name (companion.title). */
  label: string;
  onClose(): void;
  children: ReactNode;
}

/** Tablet 768–1023px: the Companion as a right slide-over above the reading. */
export function CompanionOverlay({ label, onClose, children }: CompanionLayerProps) {
  return (
    <div role="dialog" aria-label={label} className="absolute inset-0 z-30">
      <div
        className="absolute inset-0 bg-[var(--scrim)] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="absolute inset-y-0 right-0 flex flex-col w-[min(400px,88vw)] bg-card border-l border-border-soft shadow-raised animate-slide-in-right">
        {children}
      </aside>
    </div>
  );
}

/**
 * Mobile <768px: the Companion as a bottom sheet (~65dvh, drag handle). The
 * handle strip is the pointer affordance (aria-hidden — the X button is the
 * keyboard/AT dismissal); dragging translates the sheet live and a swipe past
 * SHEET_DISMISS_PX closes it, snapping back otherwise.
 */
export function CompanionSheet({ label, closeLabel, onClose, children }: CompanionLayerProps & { closeLabel: string }) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    startY.current = e.clientY;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (startY.current === null) return;
    setDragY(Math.max(0, e.clientY - startY.current));
  };
  const endDrag = () => {
    if (startY.current === null) return;
    startY.current = null;
    setDragging(false);
    if (dragY > SHEET_DISMISS_PX) onClose();
    setDragY(0);
  };

  return (
    <div
      role="dialog"
      aria-label={label}
      className="absolute inset-x-0 bottom-0 z-30 flex flex-col bg-card border-t border-border-soft rounded-t-2xl shadow-raised overflow-hidden animate-sheet-up"
      style={{
        height: "65dvh",
        transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
        transition: dragging ? "none" : "transform 180ms cubic-bezier(0.32, 0.72, 0, 1)",
      }}
    >
      {/* handle strip: touch drag/swipe affordance (touch-none keeps the
          gesture from scrolling); the close button beside it is the
          keyboard/AT path */}
      <div
        aria-hidden="true"
        className={cn(
          "relative flex-none flex items-center justify-center h-9 touch-none select-none",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="w-10 h-1 rounded-full bg-border" />
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        title={closeLabel}
        className="absolute top-2 right-2 z-10 w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--glass-2)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
