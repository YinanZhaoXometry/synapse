# Spec: Epic 28 (Phase 3) — Roadmap parity: full-page spine, roadmap.sh skin, Study Mark

Status: ready-for-agent
Milestone: Phase 3 — optimization season

> Authored 2026-11-11 after a live teardown of roadmap.sh (anonymous + logged-in pass on
> `/ai/roadmap/game-design-m4wyu` and the public `/frontend` page, style parameters extracted from
> the rendered SVG DOM) and a four-round owner grill (every decision below is owner-settled or an
> explicit default the owner may still veto line-by-line). **Amends two epic-16 rulings by owner
> decision 2026-11-11:** (a) the manual-progress-marking ban — now allowed as the orthogonal
> Study Mark (this spec; ADR to follow); (b) "no copied colors" — style parameters are now copied
> verbatim (unprotectable style facts; the license still forbids content, which we copy none of;
> FR-43 wontfix stands).

## Problem Statement

The plan graph is a fixed 440px pannable/zoomable widget with our own visual language. The owner
wants the roadmap.sh reading experience instead: a full-page, tall-and-narrow roadmap you browse by
scrolling down — no zoom, no pan, no horizontal scroll — with roadmap.sh's exact node and edge
styles. On top of that, the owner wants roadmap.sh's Learning/Done/Skip check-in affordance; our
glossary forbids "done" as a mastery word and ADR-0001/AD-6/AD-14 make mastery strictly
evidence-derived, so the check-in must land as a new, clearly separated self-declared status that
never touches mastery math.

## Solution — five tickets

1. **Study Mark data (T1):** a nullable per-node `study_mark` column + a set/clear command +
   GraphQL surface (codegen-gated). Pure data; no consumer computations.
2. **Spine layout (T2):** one deterministic pure layout module replacing both existing layout
   engines — stage hubs stacked vertically on a center spine, stage nodes fanned left/right,
   prerequisites as long dotted curves; byte-identical determinism pinned.
3. **Full-page canvas + skin (T3):** the graph leaves the bounded widget — SVG inline in page
   flow, scaled to content width, page-scroll only; pan/zoom/pinch deleted; verbatim roadmap.sh
   skin (fills, borders, edges, Balsamiq Sans); dual corner badges; legend reworked badge-style.
4. **Chips + Sheet (T4):** hover chips (status toggles + actions) and the Sheet gains a status
   row, the evidence bar, and the Ask-AI handoff (reader deep link with a one-shot prefill
   parameter).
5. **E2E + docs + close (T5):** e2e extended to the spine and the mark flow; PRD/glossary/ADR
   updates; spine delta record; board update.

## User Stories

1. As a learner, I want the roadmap to fill the page and read top-to-bottom by scrolling, so that
   browsing a plan feels like reading a long guide instead of operating a map widget.
2. As a learner, I want no zoom or pan controls at all, so that there is exactly one way to
   navigate (scroll) and nothing to get lost with.
3. As a learner, I want the roadmap never to scroll sideways, so that on any screen width the
   whole width of the graph is always visible.
4. As a learner, I want stage headers styled as prominent main nodes on a central spine, so that
   the skeleton of the plan is legible at every scroll depth.
5. As a learner, I want each stage's knowledge nodes fanning out left and right of their hub, so
   that the structure mirrors the roadmap.sh roadmaps I already know.
6. As a learner, I want node and edge styles copied exactly from roadmap.sh (yellow hubs, lighter
   yellow leaves, black rounded borders, blue solid spine, blue dotted fans, Balsamiq Sans), so
   that the visual language is the one I asked for.
7. As a learner, I want to mark a node 学习中 / 已完成 / 已跳过 from a hover chip in one click, so
   that I can track where I am without leaving the graph.
8. As a learner, I want to revoke a mark by clicking it again, so that a mis-tap never sticks.
9. As a learner, I want my marks to follow my account across devices, so that switching machines
   doesn't lose my self-tracked progress.
10. As a learner, I want marks and mastery to look like two different things on a node (colored
    corner chip vs mastery glyph), so that "where I say I am" never masquerades as "what evidence
    says I know".
11. As a learner, I want the plan progress bar to keep counting only evidence-derived mastery, so
    that the number stays honest when I optimistically mark things 已完成.
12. As a learner, I want a small text line under the progress bar counting marked nodes, so that
    my self-tracked state is visible without polluting the mastery bar.
13. As a learner, I want the hover chips to also offer 去学习 / 节点速测 / 问 AI 导师, so that the
    three real actions are one hover away instead of a sheet deep.
14. As a learner, I want 问 AI 导师 to jump me into the reader with the Companion already open and
    my question drafted about this node, so that asking is zero-typing.
15. As a learner, I want the drafted question sent only when I press send, so that no AI quota is
    spent silently on my behalf.
16. As a learner, I want the node sheet to show my recent evidence outcomes (the ●◐✕ window), so
    that the detail view explains the mastery score, not just displays it.
17. As a keyboard user, I want the roving-tabindex arrow navigation kept (re-pointed at the spine
    geometry), so that accessibility does not regress when the canvas is rebuilt.
18. As a keyboard user, I want Enter to open the node sheet as before, so that the full action
    surface stays reachable without a pointer.
19. As a learner, I want `?node=` deep links to scroll the node into view and open its sheet, so
    that shared/bookmarked pointers keep working.
20. As a learner with an older edge-less plan, I want it to render through the same spine, so that
    nothing breaks and everything looks uniform.
21. As a learner with stage-less nodes, I want them grouped under a synthetic 未分组 hub, so that
    every node has a home on the spine.
22. As a learner on a phone, I want the same single layout scaled down to the screen, so that the
    roadmap is consistent across devices even if nodes render small.
23. As a learner in dark mode or any palette, I want the node/edge colors unchanged (the copied
    yellows and blues), so that the roadmap keeps its identity; only the canvas background follows
    the theme.
24. As a learner who toggles to the list view, I want it to keep working unchanged, so that my
    fast-scan fallback survives the redesign.
25. As the product owner, I want the PRD, glossary, and an ADR updated to record Study Mark as
    orthogonal to mastery, so that future work doesn't accidentally fuse self-declared status
    with evidence-derived score.

## Implementation Decisions

### Form factor

- The roadmap is a full-page, scroll-down-only surface. The SVG renders inline in the document
  flow at content width; its height follows the layout's aspect (tall and narrow). The page's
  native scrollbar is the only navigation. No horizontal scroll exists by construction (the scale
  factor is derived from the container width; the layout cannot exceed it).
- Scale = container width / layout width, recomputed via resize observation. One layout for all
  viewports — no per-breakpoint layouts (keeps layout a pure function of data; narrow screens get
  proportionally smaller nodes, roadmap.sh's own posture).
- Deleted outright: zoom buttons, wheel-zoom listener, pointer-drag pan, two-finger pinch, Safari
  gesture guards, fit-view, translate-based pan-into-view. The epic-20 pinch investment and the
  epic-16 zoom posture retire here (git history is the archive). `?node=` deep-link and keyboard
  focus-into-view switch to native scroll-into-view.
- The plan page's other sections (header, progress, materials/uploads) stack above and below the
  roadmap in natural document flow; the materials section sits below the (tall) roadmap. Nothing
  sticky. The 图谱/列表 toggle stays; the list view is untouched.

### Layout (one engine)

- One deterministic pure layout module replaces the epic-10 derived-sequence engine and the
  epic-16 swimlane DAG engine. Input: nodes (with stage, order, optional), persisted edges.
  Output: positions + edge geometry, byte-identical under shuffled input (pinned by test).
- Geometry: stage hubs stacked on a vertical center spine in stage order; each stage's nodes fan
  to the left and right of their hub, stacked top-to-bottom; side assignment deterministic
  (balance by count, tie-break by node id). Stage-less nodes attach to a synthetic 未分组 hub.
  Same-stage prerequisite pairs render as a short outer arc between the siblings.
- Edge classes: hub→hub spine edges are solid; hub→leaf fan edges are dotted; node→node
  prerequisite edges are dotted curves routed on the fan side. **No arrowheads anywhere** —
  stage-forward ordering makes direction implicit in the top-down geometry (zero information
  lost; verbatim roadmap.sh posture). This amends epic-16's DAG arrowhead vocabulary.
- Node boxes sized to the copied geometry (~297×51 units at 28px text); titles truncate (~18
  chars) with the full title available in chips/sheet/list.

### Skin (verbatim copy, license-honest)

- Copied verbatim from the measured roadmap.sh SVG: hub fill `#fdff00`, leaf fill `#ffe599`,
  node border black `2.7` with corner radius `5`, edge color `#2b78e4` at `3.5` width, fan
  dasharray `0.8 8`, Balsamiq Sans 28px for node text. These land as CSS-variable tokens with
  the copied values as defaults in both light and dark modes; only the canvas background follows
  the theme token. No raw hex in components.
- Balsamiq Sans is self-hosted (woff2 + OFL LICENSE file) and scoped to the roadmap canvas via a
  dedicated font-family token; global fonts unchanged.
- License honesty: style parameters (colors, strokes, radii, typeface choice) are unprotectable
  facts and are copied; no roadmap.sh content, copy, node data, brand assets, or SVG sources are
  copied or redistributed. The roadmap.sh content import ban (FR-43 wontfix) stands.

### State visibility

- Node fills are always the copied values (no mastery tinting — NODE_STATE_FACE retires from the
  graph). Two corner badges per node: **Study Mark chip top-right** (blue=学习中, green=已完成,
  gray=已跳过) and **mastery glyph bottom-left** (✦/◐/○, unchanged vocabulary, AD-9
  not-color-only rule extended to badges). Optional nodes keep the dashed border.
- The legend reworks to badge-style (mark colors + mastery glyphs); the progress bar stays
  mastered/total off server states (AD-14) plus a new small text line counting marks
  (已标记完成 X · 学习中 Y · 已跳过 Z). Stage hub cards keep the per-stage mastered/total count.

### Study Mark (the domain addition)

- New concept **Study Mark (学习标记)** — a per-node, per-user, self-declared status, enum
  `learning | finished | skipped`, nullable, revocable. UI copy: 学习中 / 已完成 / 已跳过 (the
  string "Done" is never used — glossary avoid-word discipline).
- **Orthogonality is the contract:** nothing computational reads the mark in v1 — no Mastery
  Score, readiness, targeting, quiz generation, streak, badges, or Today hub input. It renders
  (graph chip, sheet row, list badge optionally later) and nothing else. ADR to record the
  trade-off and the fuse point (what would have to be true to let marks feed computations).
- Backend: nullable `study_mark` string column on the plan-node table (plans are user-scoped; no
  join table needed) + a set/clear command following the command-layer-first contract (closed
  error enum, validation: node belongs to caller's plan, enum membership). GraphQL: field on the
  node payload + one set mutation (input: node id + mark-or-null); codegen-gated; op-count DB
  floor widened for the new op. Client hook updates the cached plan optimistically with rollback.
- Docs: PRD gains an FR for Study Mark (+ §3 vocabulary entry); GLOSSARY.md gains the engineering
  term with the enum, explicitly separate from the mastery-state vocabulary; the ADR is written
  in T5 (or T1, wherever it lands first in review) — draft reference: "Study Mark is orthogonal
  to mastery".

### Hover chips

- Hovering a node shows a compact two-row chip strip anchored above the node (HTML overlay, not
  SVG-internal): row 1 = three status toggles (current mark highlighted; clicking the active one
  clears the mark); row 2 = 去学习 / 节点速测 / 问 AI 导师 (去学习 keeps the existing
  single-vs-multi mapping jump semantics). The former 查看-details chip is dropped — clicking
  the node itself opens the sheet.
- Behavior: ~150ms hover-intent; hides on pointer-leave; suppressed entirely for touch pointers
  (tap opens the sheet — unchanged) and never shown on keyboard focus (Enter → sheet carries the
  same actions). Hub cards get no chips (not knowledge nodes).

### Sheet

- The node sheet gains: a Study Mark row (same three toggles), the evidence bar (the list view's
  ●◐✕ mastery-window popover extracted into a shared component; honest "—" when no evidence), and
  the 问 AI 导师 button (same target as the chip). Existing actions (去学习 / 节点速测) unchanged.

### Ask-AI handoff

- 问 AI 导师 navigates to the mapped reader anchor with a one-shot `companionAsk` parameter
  carrying a drafted, node-scoped question. The reader's Companion consumes it once on mount
  (ref-guarded against replays), opens itself, and **prefills without sending** — the user
  presses send (respects the AI daily cap; no silent spend). Rendered only when a confirmed
  material mapping exists (same condition as 去学习). Zero server changes; no stream-protocol
  changes.

### Keyboard

- Roving tabindex preserved over knowledge nodes in deterministic document order (stage by
  stage, left fan before right fan). Arrows re-pointed: Up/Down = previous/next in reading
  order; Left/Right = same-row opposite-side leaf. Hubs are not tab stops. Enter opens the
  sheet; Esc closes; scroll-into-view keeps the focused node visible.

### Defaults adopted (owner may veto line-by-line)

Progress bar + legend stay in natural flow above the roadmap (no sticky) · ungrouped nodes under
a synthetic hub · single scaled layout on narrow screens · ~18-char truncation · companionAsk
prefill-only · keyboard semantics as above · materials section below the roadmap.

## Testing Decisions

- Good tests assert external behavior only: what the command accepts/rejects, what the layout
  computes for a given graph, what the rendered surface exposes (roles, labels, states,
  transforms of state) — never internal call shapes.
- Four seams, all existing patterns (owner-confirmed 2026-11-11):
  1. **Graph component seam** (vitest + RTL): spine rendering, dual badges, chips (presence,
     toggling, revocation, touch suppression, hover-intent), sheet rows, evidence bar, ask-AI
     href, keyboard contract, deep-link scroll, legend/progress rework. The retired pan/zoom/
     pinch/wheel/fit-view assertion blocks are deleted with their features; every surviving
     aria/behavior assertion carries over. Prior art: the existing graph suite.
  2. **Spine layout seam** (pure function vitest): determinism (byte-identical under shuffled
     input), hub stacking order, side assignment, ungrouped hub, same-stage arcs, edge class
     assignment (solid spine / dotted fan / dotted prerequisite), no-overlap geometry, 16-node
     case, empty input. Prior art: the two retiring layout suites are the template.
  3. **Command seam** (rspec): set/clear round-trip, enum membership rejection, foreign-plan
     node rejection, unauthenticated, field on the node payload read; op-count floor widened.
     Prior art: the Phase-2 command specs.
  4. **e2e seam** (Playwright, stub provider): spine visible + scrollable, mark → chip color on
     canvas → reload persistence, chips actions navigate, progress bar ignores marks. Study Mark
     is not AI-gated so it is fully e2e-able. Prior art: the roadmap-graph spec.
- Gates: `just spec` (web + api), codegen freshness, e2e suite; mastery-vector anti-drift
  untouched (no mastery math changes — regression-guarded by it).

## Out of Scope

- Marks feeding any computation: Today hub tasks, targeting, quiz generation, readiness,
  streak, badges (explicitly rejected for v1; the ADR records the fuse).
- Arrowheads on any edge class (rejected — direction is geometric).
- Horizontal scrolling or per-breakpoint layout variants on narrow screens.
- Sticky progress/legend bars.
- Auto-sending the companionAsk draft.
- Restyling the list view (it keeps the current look, mastery tints included).
- Minimap, roadmap editor, node unlock/gating, node-cap changes.
- roadmap.sh content import (FR-43 wontfix stands); copying any roadmap.sh text/assets/brand.
- Renaming or touching mastery states or ADR-0001 math.

## Further Notes

- Two epic-16 rulings are amended here by owner decision (2026-11-11): the manual-marking ban
  (→ Study Mark, orthogonal) and the no-copied-colors posture (→ verbatim style parameters,
  content still banned). Both amendments are recorded in this spec's header and must land in the
  spine delta record at T5 alongside the new ADR.
- The retiring interaction tests pin exact behaviors by design; their deletion is the pinned
  behavior changing, not test rot. The e2e visual-smoke zoom flow converts to a scroll + keyboard
  flow.
- Everything above the roadmap on the plan page (header/progress) and below (materials) keeps
  its current components; only the nodes zone is rebuilt.
