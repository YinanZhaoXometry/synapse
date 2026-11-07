/**
 * One-route-deep "where did the user come from" recorder (2026-11-06 nav fix).
 *
 * Spine-owned surfaces (reader, quiz session, flashcards study) are entered
 * from many origins — hub pages, citations, plan/task homes — but their back
 * affordances hardcoded one spine target, so returning from the materials hub
 * landed on a plan the user never visited (the audited defect #1/#2/#4/#5
 * family). The recorder captures the PREVIOUS in-app pathname as AppLayout
 * renders (parent body runs before children, so a route's first render already
 * sees the route it came from), and `sourceBackTarget` maps that pathname to a
 * labeled return — without every inbound linker carrying router state (which
 * would collide with the in-flight epic branches re-touching those files).
 *
 * Session-scoped by design: a fresh tab or a reload inside a deep route finds
 * no previous path and falls back to the hardcoded spine default — the honest
 * nothing-to-remember case. Plan/task DETAIL origins return null on purpose:
 * the callers' existing spine default already targets exactly those (topic-
 * labeled plan back, homeHref), so only the hub/retained origins need the
 * override.
 */

let previous: string | null = null;
let current: string | null = null;

/** Called from AppLayout's render body on every location change. Defensive
 * search-strip: callers pass location.pathname, but a query-carrying string
 * must still dedupe to the same route (anchor/page tweaks never bump previous). */
export function recordNavPathname(pathname: string): void {
  const path = pathname.split("?")[0];
  if (path === current) return; // same-route re-render (query/anchor tweaks)
  previous = current;
  current = path;
}

/** The previous in-app pathname, or null (first nav / fresh tab / reload). */
export function previousNavPathname(): string | null {
  return previous;
}

/** Test seam: reset the module state between specs. */
export function resetNavHistory(): void {
  previous = null;
  current = null;
}

export interface SourceBack {
  to: string;
  labelKey: string;
}

// The retained/hub origins — the label IS the destination (existing nav.* keys).
// Plan/task detail is deliberately absent: callers' spine defaults cover those.
const SOURCES: Array<{ match: RegExp; labelKey: string }> = [
  { match: /^\/materials/, labelKey: "nav.materials" },
  { match: /^\/mistakes/, labelKey: "nav.mistakes" },
  { match: /^\/ai-tutor/, labelKey: "nav.tutor" },
  { match: /^\/planner/, labelKey: "nav.planner" },
  { match: /^\/quiz/, labelKey: "nav.quiz" },
  { match: /^\/flashcards/, labelKey: "nav.flashcards" },
  { match: /^\/plans/, labelKey: "nav.plans" },
  { match: /^\/dashboard/, labelKey: "nav.dashboard" },
  { match: /^\/achievements/, labelKey: "nav.achievements" },
  { match: /^\/analytics/, labelKey: "nav.analytics" },
  { match: /^\/settings/, labelKey: "nav.settings" },
  // Task HOME only — /task/new is the creation surface: a fresh task id
  // doesn't exist yet, and after the upload lands in the reader a "back" to
  // the emptied form is a dead end. It falls to the callers' spine defaults
  // (所有计划 → /plans, where the new task's card now lives) — the CI e2e
  // journey rides exactly that path (destinations.spec task promotion).
  { match: /^\/task\/(?!new$)[^/]+$/, labelKey: "tasks.backToTask" },
];

/**
 * A labeled return to where the user actually was, when the origin is a hub/
 * retained surface (or a task home — the reader's fallback loses task context,
 * audited defect #2). null → the caller keeps its spine default.
 */
export function sourceBackTarget(previousPathname: string | null): SourceBack | null {
  if (!previousPathname) return null;
  for (const source of SOURCES) {
    if (source.match.test(previousPathname)) return { to: previousPathname, labelKey: source.labelKey };
  }
  return null;
}
