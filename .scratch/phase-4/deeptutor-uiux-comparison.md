# DeepTutor × Synapse — UI/UX comparison (nav, order, core flows)

Status: research artifact · 2026-11-11 · companion piece to `deeptutor-comparison.md` (learning-engine comparison). All `web/…` paths are under `../DeepTutor-main`; Synapse paths are main @ `be06070`. Product stance reminder: design import only, and Synapse's plan-first front door (FR-36) is settled — nothing here proposes reverting it.

---

## 1. The two IA philosophies in one line

- **DeepTutor**: chat-first workspace; the sidebar is a **browser for what you own** (5 category shelves, each = entries + that domain's records tree), not a page list.
- **Synapse**: plan-first product; the sidebar is a **page list** (10 flat routes in 4 groups) — clean, but it holds no records, so every session starts with "go to /plans, find your plan".

## 2. Menu structures, side by side

**DeepTutor sidebar** (`web/components/sidebar/CategoryNavigation.tsx:46-58`): 5 category tabs — Home(chat) / Learning / Resources(space) / Partners / Personalization. Workspace shelves first; account-level shelves sit past a divider so "the bar itself says which half a switch of workspace changes" (`CategoryNavigation.tsx:41-45`). Each shelf panel = an overview row ("All X") + a create row + the domain's **record tree**; panels stay mounted (`hidden`, not unmounted) once visited — instant switches (`CategoryNavigation.tsx:255-274`).

- Learning conversations are **fileed under the record they were held in** — a path/book/collection is one entry, its chats nest inside ("what was said while studying it is filed inside it rather than in a second list beside it", `LearningNavigation.tsx:20-26`). Chat home holds only non-learning sessions.
- Nav entries carry `requires: Capability` + `surfaces` — an account without a capability doesn't see the entry at all (`nav-entries.ts:17-30, 113-122`).
- The arrangement is user-owned: reorder + fold into "More", stored per-machine in localStorage; new features **weave in next to the neighbour they were designed to follow** instead of sinking to the bottom ("appending them to the bottom would bury every new feature … exactly where nobody looks", `lib/sidebar-layout.ts:64-100`).
- ⌘K palette searches **everything the sidebar holds** — places, conversations, learning records, partners — from the same client cache, no extra round trip (`CommandPalette.tsx:37-41`); loaded on first ⌘K, never in the initial shell (`SidebarShell.tsx:44-48`).
- Keyboard: ⌘K search, ⌘J-ish new chat, per-category position shortcuts (`SidebarShell.tsx:166-195`); collapsible to a 60px rail; drag-resizable with `role="separator"` + aria-valuenow (`SidebarShell.tsx:444-460`).
- Streaming sessions sort to the top of the list (client-side runtime status is the only honest "still running" source — `WorkspaceSidebar.tsx:96-121`).

**Synapse sidebar today** (`frontend/src/components/layout/nav-items.ts:13-56`, `AppLayout.tsx:201-240`): 10 flat routes in 4 groups (总览/学习/练习/进度) + settings footer; ⌘K = page navigation + language toggle only (`CommandPalette.tsx:30-34`). Responsive: full sidebar lg+, icon rail md, drawer + bottom nav on mobile (with swipe-to-close — already better than DeepTutor's mobile drawer in gesture terms).

## 3. Page order & front doors

- DeepTutor `/` redirects to `/chat` (`app/(workspace)/page.tsx:3-10`) — chat is home. **Not for us** — plan-first is the product (FR-36).
- Learning hub surfaces order: Books / Mastery Path / Practice / Immersive Reading (`components/learning/surfaces.ts:26-91`) — study → practise → read. Synapse's group order (计划/导师/资料 → 错题/今日/闪卡/测验) is comparable; no change indicated.
- Learning hub page structure worth stealing: filter chips + search on top, then a **"What needs your attention"** section (due reviews with per-path due counts, stuck/paused books) **above** the all-records grid (`LearningDashboard.tsx:72-118`). Clicking a due-review card routes into a review session with the opening prompt already assembled (`LearningDashboard.tsx:78-98`).

## 4. Core work flows

**DeepTutor creation flow**: Learning hub → `/learning/new` — a **bookmarkable creation page, not a transient menu** ("All creation entry points share a bookmarkable page instead of a transient menu", `LearningCreateMenu.tsx:10`) with one card per surface → `?create=1` opens the wizard → on created, route into the outline session **with the opening message pre-sent**: "The button they pressed is the request; the conversation opens by sending it rather than by asking them to phrase it again" (`app/(workspace)/learning/mastery/page.tsx:79-94`, `setPendingPrompt`).

**DeepTutor study session** (`components/space/learning/MasteryStudy.tsx`): chat + collapsible outline sidebar (StudyOutline) + mode switch (outline/study/review) + progress ring + **next-step cursor copy** — every state has a verb, one honest sentence, and a CTA (`next-step-copy.ts`): probe → "先用一道探查题看看你是否已经掌握" / teach → "先讲解…再检查" / practice → "继续练习，直到稳定越过掌握门槛" / assess → "用自己的话讲清楚" / review / complete → "整片疆域已经点亮".

**DeepTutor practice flow**: `/learning/practice` with no params renders **ReviewHome** (due-first) by default; the bank/mistakes tabs live behind it (`components/learning/practice/PracticePage.tsx:18-20`).

**Synapse flows today**: Plans Home → creation chat (single message + attachments, epic-26/27) → plan detail (vertical roadmap spine, in flight) → node → reader + companion → quiz → mastery. Creation is already bookmarkable (`/plan/new`, `/task/new`) and companion pre-fill (`companionAsk`) is in the roadmap-parity plan.

**Context-keeping navigation details** (small, cheap, very visible):
- Deleting the open session leaves you **on the material it was held beside**, never dumps you to /chat (`WorkspaceSidebar.tsx:186-199`).
- A study conversation opens **on its own path** (outline + waypoint header + tutor composer are the context it was held in; /chat would drop all three, `WorkspaceSidebar.tsx:150-158`).

## 5. What Synapse should borrow — priority order

1. **Records in the sidebar** (biggest navigation gap). The 学习 group gets the user's recent plans as a second-level tree (plan → its companion thread), filed the way DeepTutor files chats under records (`LearningNavigation.tsx`). Today every session costs two hops (Plans Home → card). Scope: sidebar only — a `useRecentPlans` read off the existing typed hooks layer, no new server surface needed; companion threads already exist per plan (epic-12).
2. **⌘K entity search**. Extend the palette beyond page-nav + language: search plans/materials/tasks from the Apollo cache (DeepTutor's posture: the palette reads the same sources as the sidebar, zero extra round trips, `CommandPalette.tsx:37-41`). Cheap: the typed hooks layer already exposes the lists.
3. **"Needs attention" section on Today / Plans Home** (due reviews with counts, stale plans below the freshness cap, failed generations) above the plain lists — direct landing surface for epic-29's gate cursor; DeepTutor's template is `LearningDashboard.tsx:72-118` including the pre-assembled review opening.
4. **Next-step cursor copy shape for epic-29**: state verb + one sentence + CTA per state, zh/en side by side. `next-step-copy.ts` is a ready-made template — Synapse needs the same for its states (推荐/讲解/练习/讲解门/复习/完成). Fits the FR-15 honesty ethos verbatim.
5. **Pre-sent opening (pendingPrompt) vs pre-fill**: the in-flight roadmap-parity plan has companion **pre-fill**; DeepTutor goes one step further and **sends** the opening message on entry. Worth a grill decision when that plan lands — pre-send removes one more "phrase it again" moment in creation → outline.
6. **Context-keeping delete/exit rules** (park-small): deleting a task/plan should drop you where you came from (nav-history already records one-deep origin, `AppLayout.tsx:48-52` — the seam exists); epic-28's deleteTask cascade was the same instinct.

## 6. Explicitly not borrowing (so this doesn't get re-litigated)

- **5-shelf category sidebar** — a second IA level for 10 destinations is over-modelling; Synapse's grouped flat nav is right at this scale. Records-in-nav (item 1) is the separable good half of this model.
- **Chat-first front door** — product stance is plan-first (FR-36); DeepTutor's redirect exists because its tutor *is* the product.
- **Sidebar reorder / "More" folding** — solves a problem Synapse doesn't have at 10 items; revisit if the menu ever doubles. (The weave-in-place algorithm note in `sidebar-layout.ts:96-99` is worth remembering if it ever does.)
- **Surface-intro empty states** (LearningWays cards → shared-element dialog with intro + 3 highlights) — Synapse has an onboarding wizard; a first-visit intro per hub would be redundant this season.
- **Capability/policy-gated nav entries** — DeepTutor needs it for its plugin model; Synapse has no capability tiers.
- **Drag-resizable sidebar** — nice-to-have, low value here; Synapse already ships collapse-equivalents via responsive tiers.

## 7. What Synapse already does as well or better

- Responsive tiers (rail + drawer + swipe-to-close with engage-slop + spring-back) exceed DeepTutor's drawer.
- Bilingual-first i18n discipline (zh/en parity CI-gated) — DeepTutor's zh is a locale, Synapse's is a co-first language.
- The accent-confinement rule DeepTutor states ("per-surface colour is confined to the icon tile … so four surfaces read as one page", `surfaces.ts:19-24`) is the same philosophy as Synapse's glass/accent-tint token rules — mutual confirmation, no action.
