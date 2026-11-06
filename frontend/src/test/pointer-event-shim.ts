/**
 * jsdom 20 predates PointerEvent — shim the constructor over MouseEvent so
 * RTL builds real pointer events (fireEvent.pointerDown & co). The gesture
 * contracts (roadmap pinch epic-20 T1, drawer swipe T2) key active pointers
 * by pointerId, which the MouseEvent constructor would silently drop (RTL's
 * createEvent constructs the event and never assigns unconsumed init props
 * onto the instance), so the shim carries pointerId/pointerType/isPrimary
 * itself. Call once at the top of a test file that dispatches pointer
 * sequences; idempotent (the guard keeps already-real PointerEvent hosts).
 */
export function installPointerEventShim() {
  if (typeof window.PointerEvent === "undefined") {
    Object.defineProperty(window, "PointerEvent", {
      writable: true,
      value: class PointerEventShim extends MouseEvent {
        pointerId: number;
        pointerType: string;
        isPrimary: boolean;
        constructor(type: string, init: PointerEventInit = {}) {
          super(type, init);
          this.pointerId = init.pointerId ?? 1;
          this.pointerType = init.pointerType ?? "";
          this.isPrimary = init.isPrimary ?? false;
        }
      },
    });
  }
}
