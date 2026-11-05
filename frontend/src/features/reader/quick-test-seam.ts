/**
 * The Quick Test feature-flag seam (FR-13, epic-13 T1 → T2 handoff): the
 * selection bar's 快测 action hands the captured scope to whatever flow
 * registers here. T2 — the NEXT ticket in this epic — fills the registration
 * (its reader-level quick-test flow will call registerQuickTestHandler on
 * mount); until then dispatchQuickTest reports honestly false and the bar
 * toasts 「快测将在下一步开放」 — a live affordance with an honest message,
 * never a dead button. ONE handler slot: the latest registration wins, so a
 * route remount never leaves a stale flow behind.
 *
 * Deliberately dependency-free and reader-scoped: this is the per-ticket
 * seam that keeps the bar shippable while T2 lands (recorded in the T1
 * ticket's ## Comments).
 */
export interface QuickTestScope {
  materialId: string;
  /** The captured selection (AD-2 locator shape + text) that scopes the round. */
  selection:
    | { kind: "markdown"; sectionId: string; text: string }
    | { kind: "pdf"; page: number; text: string };
}

type QuickTestHandler = (scope: QuickTestScope) => void;

let handler: QuickTestHandler | null = null;

/** Register the flow that consumes a Quick Test scope (T2's entry point).
 * Returns the disposer — call on unmount so a stale flow never fires. */
export function registerQuickTestHandler(next: QuickTestHandler): () => void {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}

/** Hand the scope to the registered flow. False = no handler registered —
 * the caller surfaces the honest coming-soon message instead. */
export function dispatchQuickTest(scope: QuickTestScope): boolean {
  if (!handler) return false;
  handler(scope);
  return true;
}
