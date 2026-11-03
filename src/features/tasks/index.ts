/**
 * The tasks feature's public surface (AD-2, plans/index.ts precedent): what
 * features outside tasks may import. The pure display-shaping selectors are
 * the library seam — Plans Home (epic-5 T3) renders its Study Tasks section
 * through them, the same way Task Home renders through the plans surface's
 * mastery atoms. The pages (TaskCreatePage, TaskHomePage) stay reachable
 * directly from App.tsx (pages → features), not through this barrel.
 */
export { taskContinueTarget, taskMasteryView, tasksNewestFirst, type TaskContinueTarget } from "./display-shaping";
