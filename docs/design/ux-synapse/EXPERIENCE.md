---
name: Synapse
status: final
sources:
  - ../../product/brief-synapse/brief-synapse.md
  - ../../product/prd-synapse/prd-synapse.md
created: 2026-11-01
updated: 2026-11-01
ui_system: shadcn/ui + Tailwind CSS-variable tokens (scaffold-inherited)
---

# Synapse — Experience Spine

Phase-1-first lean run: the front door (entry states), Study Task, Immersive Reader + Companion, quiz flow, and the light plan home are specified in depth. Phase 2 surfaces (Roadmap graph, Square, Notes, hubs' full build, analytics) hold named IA positions only. DESIGN.md is the visual identity reference; this spine is the behavior. Glossary terms are used verbatim from the PRD (§3).

## Foundation

Responsive web app — no native surfaces. Desktop/laptop ≥1024px is the primary surface (student laptop + the Nov 6 live demo on a projector); tablet 768–1023px is reading-competent; mobile <768px keeps reading and chat usable via a bottom-sheet Companion. The UI system is the scaffold's shadcn/ui + Tailwind token set; both spines inherit it — DESIGN.md holds the visual deltas, this file the behavioral deltas. Data is local-first in Phase 1 (browser persistence, no accounts — FR-29); no offline claims.

**Legacy retirement is part of this IA** (AGENTS.md, PRD FR-36 platform note): `LearningModeContext`, the `aiOnly` nav gating, the AI/manual mode toggle, and the ten-page tool-menu navigation are removed in the first implementation pass. Onboarding's mode step dies with it.

## Information Architecture

The Study Plan is the front door. Generation lives in-flow; the sidebar aggregates study output (FR-36).

| Surface | Route / entry | Purpose | Phase |
|---|---|---|---|
| Plans Home (front door) | `/` | Entry states: no plans → agent-style creation chat; plans exist → continue + list + create | 1 |
| Plan creation chat | `/plan/new` (or inline in empty state) | State topic/goal → AI proposes Knowledge Node structure → confirm | 1 |
| Plan Home (light) | `/plan/:id` | Mastery rollup + node list + Materials + continue-reading + recent activity + quick-actions grid + streak (FR-25); Roadmap graph lands here in Phase 2 | 1 |
| Study Task create | `/task/new` | Upload one Material, no plan ceremony | 1 |
| Study Task home | `/task/:id` | Single-material twin of Plan Home | 1 |
| Immersive Reader | `/read/:materialId` | Flagship: Material + page-aware Companion | 1 |
| Quiz session | Launched in-flow from plan/task | Focused quiz surface (mode select → questions → results) | 1 |
| Flashcards study | Launched in-flow from plan/task | Flip-card study of a generated deck | 1 |
| Mistakes Notebook | `/mistakes` (sidebar) | Aggregated mistakes — placeholder in Phase 1 | 2 |
| Today (今日学习) | `/today` (sidebar) | Daily tasks: AI-suggested weak-spot tasks + due reviews + manual tasks (FR-27) — placeholder in Phase 1 | 2 |
| Flashcards Hub | `/flashcards` (sidebar) | Aggregated decks — placeholder in Phase 1 | 2 |
| Quiz Hub | `/quiz-hub` (sidebar) | Quiz history — placeholder in Phase 1 | 2 |
| Settings | `/settings` | Language, data (Phase 1); account, cost caps later | 1 |

Phase 2 positions (named, not specified): **Roadmap graph** = a view tab inside Plan Home; **Square** = sidebar section below the hubs; **Note** = generated from plan/task context, surfaces as a Material-like item; **Today (今日学习)** = the daily task list that replaced the former Calendar position (FR-27: AI-suggested weak-spot tasks + due Re-queue reviews + manual tasks, scaffold Planner's task-list patterns — duration estimate, priority chip, completion toggle, day-progress; history demoted to a light week strip); **Plan-level Companion** (FR-46) = the Companion's second home — chat on Plan Home grounded in all attached Materials, intent chips per the scaffold tutor's pattern (解释 / 考我 / 总结 / 分析错题); the zh label 学习计划 stays reserved for Study Plan; **Plan creation goal step** (FR-1, Phase 2) = goal-selection chips from the scaffold onboarding feeding AI plan generation; **Analytics** (FR-26) = plan-scoped: mastery-by-node horizontal bars (scaffold topic-strength pattern) + accuracy trend; ai-vs-manual charts are legacy dual-mode and excluded; **Achievements** (FR-28) = the scaffold's 12-badge taxonomy as reference set, no XP/level economy. Retired top-level destinations: AI Tutor, Materials, Achievements, Analytics — their jobs moved into plan/task context.

Sidebar final order: Synapse mark → Plans (front door) → hubs group (Mistakes Notebook, Today (今日学习), Flashcards Hub, Quiz Hub) → footer: language toggle + Settings. The mobile bottom nav carries Plans + the two hubs students check between sessions.

→ Visual reference: [mockups/key-plans-home-empty.html](mockups/key-plans-home-empty.html) (front door, empty state) · [mockups/key-plan-home.html](mockups/key-plan-home.html) (Plan Home) · [mockups/key-reader-companion.html](mockups/key-reader-companion.html) (Immersive Reader + Companion) · [mockups/key-quiz.html](mockups/key-quiz.html) (quiz runner + results). Spine wins on conflict with any mock.

## Voice and Tone

Microcopy. Brand voice lives in DESIGN.md · Brand & Style. Every string ships zh+en in parity (NFR-5) — the pair *is* the string. Tone: a calm study companion — coach, not examiner; honest numbers, no hype, no praise inflation (anti-sycophancy), no engagement bait.

| Moment | 中文 | English |
|---|---|---|
| Plans Home, empty | 「想学什么？说个主题，我来搭计划。」 | "What are we mastering? Name a topic, I'll draft the plan." |
| Plans Home, returning | 「继续：COMP5241 期末 — 上次读到 Lecture 4」 | "Continue: COMP5241 final — last at Lecture 4" |
| Study Task pitch | 「只想搞懂一份文档？不需要计划 — 直接开始。」 | "Just one document to crack? Skip the plan — start a Study Task." |
| Companion idle | 「我在读你正在看的这一页。」 | "I'm reading the page you're on." |
| Hint-first answer | 「先往这个方向想：… 再试试？需要更多提示随时说。」 | "Try this direction first: … Give it another shot? More hints whenever you ask." |
| Escalation control | 「直接看答案」 | "Show the answer" |
| Ungrounded honesty | 「这一页答不了这个问题。我可以基于通用知识回答，但会明确标注不是来自你的材料。」 | "This page can't answer that. I can answer from general knowledge — clearly labeled as outside your material." |
| Quiz forfeit | 「看了答案 = 放弃此题 · 已记入错题」 | "Revealed = forfeited · logged as a mistake" |
| Open-question grading | 「对照材料评分 · 理由如下」 | "Graded against your material · rationale below" |
| Mastery 100% | 「可以进考场了。」 | "Ready." |
| Uncovered node | 「还没有证据 · 先学再测」 | "No evidence yet · study it, then test it" |
| Hub placeholder | 「演示之后上线 · 在计划里学习，在这里回顾」 | "Arrives after the demo · study in plans, review here" |
| Quiz hint button | 「✦ 提示（免费 · 不扣分）」 | "✦ Hint (free, no penalty)" |
| Streak chip | 「连续 5 天 · 每天至少一次有效作答」 | "5-day streak · ≥1 evidence session a day" |
| Upload reject | 「只支持 PDF 和 Markdown（PPT 排队中）」 | "PDF and Markdown only (PPT is queued)" |

## AI Behavior & Guardrails

The behavioral spec PRD FR-12 deferred here. Stance (NFR-2): the Companion guides before it answers — a posture, not a settings toggle. The guardrail is a ladder, never a wall: direct answers are always reachable, on explicit request.

**Intent handling** (Companion classifies, applies the posture):

| Intent (example) | Posture |
|---|---|
| Explain / why / how («为什么这里要集成测试？») | Scaffolded explanation: decompose, hint at the mechanism, end with a guiding question back. Direct statement only after escalation. |
| Direct request («直接告诉我答案») | Escalation honored — full answer, labeled 答案 / Answer, still cited. |
| Quiz-me («考考我这一页») | Socratic: ask from current Reading Position, evaluate the reply, then deepen. Never reveals before an attempt (NFR-8). |
| Define / compare / list | Grounded short answer + citation chip. Low guardrail friction — reference intents aren't learning moments. |
| Beyond material («这个算法业界还用吗？») | Honest fallback: says the page doesn't cover it, offers clearly-labeled general knowledge (NFR-1). |
| Analyze my mistakes («分析我的错题») `[Phase 2 · FR-46]` | Takes a Mistakes Notebook item, re-grounds it against its source section, explains the gap, offers a targeted re-test. Plan-scope Companion only. |

**Escalation ladder:** hint → worked step → full answer. After each rung, the `EscalationControl` stays quietly present. Skipping rungs is always allowed — the user owns the pace; the product owns the default. On quiz surfaces the ladder is two visible controls adopted from the scaffold's quiz page: `HintButton` (✦ 提示, before answering, free, no penalty — rungs 1–2) and the forfeit 「直接看答案」 (final rung: reveals, counts wrong, feeds mistakes).

**Grounding contract:** every factual claim about the Material carries ≥1 `CitationChip` (page/section); chip click scrolls the Reader to source. Companion replies in the active UI language, switching with the toggle.

**Anti-sycophancy:** no 「好问题！」, no praise on correct answers beyond a checkmark verdict. Wrong answers get analysis, never consolation.

## Mastery Score Presentation

The UX half of OQ-9 (computation/weighting/decay → architecture + spec).

- **State vocabulary per Knowledge Node:** `uncovered` (no evidence — the default, reads as neutral gray, **never** as weakly-mastered; SM-3), `partial` (evidence below threshold), `mastered` (≥ threshold). Display thresholds [ASSUMPTION]: partial 1–79%, mastered ≥80% — value tunable at spec time without UX change.
- **Rollup rule (display contract):** the plan rollup renders 100% only when every node is mastered. One uncovered node caps the ring below 100 — the readiness promise stays honest (SM-C2).
- **Evidence visibility:** every node's `EvidencePopover` lists what moved it — quiz, date, per-question outcome. A score is never an unexplained number.
- **Readiness state:** 100% renders `ReadinessBadge` + one confetti burst (once per plan, ever). Copy 「可以进考场了。/ Ready.」 — restrained by design.
- **Phase 2 slot (shape reserved):** freshness decay — a stale node shows an amber ring + 「上次验证：X 天前 / Last evidenced X days ago」 and stops counting toward 100 until re-verified.

## Component Patterns

Behavioral specs; visuals in DESIGN.md · Components.

| Component | Use | Behavioral rules |
|---|---|---|
| PlansHome | `/` | Two states (below). Continue card deep-links into last-read Material at last Reading Position. Create-new and Study Task actions persist in both states. |
| PlanCreationChat | Empty state, `/plan/new` | Chat input → Companion proposes `StructureCard` (stage-grouped nodes). Confirm → plan created → land on Plan Home with attach-Materials CTA. Regenerate = re-propose. Phase 1 editing = rename nodes inline; add/remove nodes arrives with FR-45 in Phase 2. `[Phase 2]` Goal-selection chips (exam / understand / revise / practice — scaffold onboarding's set) feed AI generation (FR-1). |
| PlanHome | `/plan/:id` | MasteryRing rollup + NodeRow list + Materials strip + continue-reading + recent quizzes + QuickActionCard grid (出题 / 闪卡 / 上传 / 问 Companion) + StreakChip in the header (FR-25). Node click → filter actions: read related sections / quiz this node. Materials strip = attach (UploadDropzone) + open in Reader. `[Phase 2]` Plan-level Companion mounts here (FR-46). |
| UploadDropzone | Plan Home, Study Task create | Click + drag-and-drop. Accepts PDF/Markdown ≤20 MB; rejects others bilingually with reason. Parsing progress visible; on done → Material card with parse state. |
| ReaderShell | `/read/:materialId` | Split view: material left, CompanionPanel right (collapsible). Tracks Reading Position (current PDF page by visibility / current Markdown section). Immersive mode hides all chrome. Chat history persists per Material across sessions. |
| CompanionPanel | Reader `[Phase 1]`; Plan Home + creation chat `[Phase 2 · FR-46]` | Built on the scaffold's chat surface pattern (ex-AITutorPage: avatar chips, bubbles, typing indicator, suggestion starters, sticky input, auto-scroll). Chat transcript + input (Enter send, Shift+Enter newline). Streaming answers; suggested starters when idle — reader-scope: «解释这一页 / Explain this page», «考考我 / Quiz me»; plan-scope (P2): 解释 / 考我 / 总结 / 分析错题. Follows AI Behavior & Guardrails. |
| CitationChip | Companion answers, flashcard backs, quiz rationale | Click → Reader scrolls to page/section and briefly highlights it (citation-tint). |
| QuizLauncher | Plan Home, Study Task home | Mode select (Open / Choice / Mix) + scope (whole plan / this material; Phase 2: this node). Generates only from attached Materials (FR-18). |
| QuizRunner | Quiz session | One question at a time; progress (Q 3/8); attempt gate — nothing reveals before submit or forfeit (NFR-8). `HintButton` (✦ 提示) available before answering — free, no penalty, scaffold's hint pattern. Choice: select + confirm; Open: textarea + submit → grading wait → verdict + rationale. Forfeit = "Show answer" → marked wrong, logged as mistake, no mastery credit. Exit asks once (progress would be lost). Keyboard-complete. |
| QuizResults | Quiz session end | Score, per-question breakdown (verdict + rationale + source chip), Mastery Score deltas per node rendered as NodeRow updates — the moment evidence lands (FR-3). Wrong answers render as `MistakeCompareCard` (你的答案 vs 正确答案 + AI 解析 — scaffold MistakesPage pattern) under 「错题 / Mistakes」 with Phase 2 pointer to the Notebook. |
| FlashcardStudy | In-flow from plan/task | Flip card (Space / click); arrow keys navigate; front → recall attempt → flip to verify (NFR-8 order is user-enforced here; copy reminds). Post-flip `DifficultyRating` (难 / 中 / 易 — scaffold's trio) records self-rated difficulty; feeds Re-queue scheduling in Phase 2. Session ends with back-to-plan summary. |
| MasteryRing | Plan Home, Task home | Rollup per display contract above; click → node list anchor. |
| NodeRow | Plan Home | State glyph + tint + label (never color alone); EvidencePopover on demand; click → read/quiz actions. |
| HubPlaceholder | 4 hub routes, Phase 1 | Honest single card: what lands post-demo (copy above). No fake data, no dead interactions. |
| StreakChip | Plan Home header | Flame + N 天; counts **consecutive days with ≥1 evidence-producing session** — never minutes, never logins (FR-25, SM-C3-compatible). Tooltip states the rule. |
| QuickActionCard | Plan Home | Scaffold dashboard's action-tile pattern: icon tile + label + one-line desc + arrow; grid of 4 (出题 / 闪卡 / 上传 / 问 Companion). The only "toolbox" surface in the product. |
| MistakeCompareCard | QuizResults; Mistakes Notebook `[P2]` | Two-column 你的答案 (destructive tint) vs 正确答案 (mastered tint) + AI 解析 strip + source chip; topic tag + date. Scaffold MistakesPage pattern adopted verbatim. |
| HintButton | QuizRunner | ✦ 提示 ghost chip, pre-answer, free, no penalty; expands to the hint box (scaffold QuizPage pattern). |
| DifficultyRating | FlashcardStudy | 难 / 中 / 易 three buttons post-flip (destructive / amber / emerald outline trio — scaffold pattern); self-rating only, feeds P2 Re-queue. |
| TodayTaskRow `[Phase 2]` | Today (今日学习) | Scaffold Planner's row: completion toggle (strike-through on done), duration estimate, priority chip, ✦ AI-suggested marker on weak-spot tasks; day-progress bar at top (FR-27). |
| SelectionBar `[stretch]` | Reader, on text selection | Floating bar: 问 Companion / 快测 (FR-13). Dismisses on scroll/click-away; keyboard-accessible via selection menu. |
| MasteryMarkButton `[stretch]` | Markdown sections | Mark/unmark per section; marked → green tint immediately as a *claim*; invites confirm quiz; never moves the score (FR-15). |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| No plans (empty) | Plans Home | Agent-style creation chat surface + Study Task secondary path. The AI-first story from second one. |
| Plans exist | Plans Home | Continue hero (last plan, last position) + plan list (rollup chip each) + create/task actions. |
| Cold load | All | Skeletons matching layout (scaffold pattern); resolve from local store — no spinners-as-art. |
| Fresh plan, no Materials | Plan Home | Nodes visible (uncovered), attach CTA primary; quiz actions disabled with reason 「先附上材料 / Attach a Material first」. |
| Evidence exists | Plan Home | Node states differentiate; rollup live; recent activity populated. |
| Reader: parsing | Reader | Page-skeleton + parse progress; Companion waits (idle copy). |
| Reader: parse failure | Reader | Card with retry + reject reason; Companion disabled for this Material — never chats against a document it can't see. |
| Companion: streaming | Reader | pulse-glow indicator; text arrives progressively; citation chips render with the claims they support. |
| Companion: ungroundable | Reader | Honest-fallback bubble (copy above) + labeled general-knowledge offer; the offer is a distinct action, not auto-mixed. |
| Companion: error / timeout | Reader | Neutral toast + one-click retry; input preserved. Never silent, never fake success. |
| Quiz: generating | Quiz session | Waiting state with source summary (「来自 3 份材料 · 正在出题」); cancel allowed until first question renders. |
| Quiz: answered | Quiz session | Per-question verdict + rationale (Open) or correct/wrong reveal (Choice); forfeit variant labeled. Next question on confirm (pace belongs to the user). |
| Quiz: grading (Open) | Quiz session | Shimmer + 「对照材料评分中 / Grading against your material」; result replaces in place. |
| Quiz: results | Quiz session | Score + breakdown + mastery deltas; wrong-answer list; actions: back to plan / 再来一轮 (fresh questions — retake never re-asks, FR-42 stance). |
| Upload: reject type | Dropzone | Bilingual reason; suggests converting; PPT noted as queued (Phase 2). |
| Upload: reject size | Dropzone | 「超过 20 MB / Over 20 MB」+ guidance. |
| Task complete-ish | Task home | Same mastery presentation as Plan Home, single-node scope. |
| Hubs (Phase 1) | 4 hub routes | HubPlaceholder — one honest card each. |
| Language switch | Global | Instant, no reload; persists (`synapse-lang`); Companion replies follow on next message. |

## Interaction Primitives

- **Reader:** ←/→ page-step (PDF), citation-chip click jumps, immersive toggle, Companion collapse/expand. Page follows scroll (visibility-based tracking).
- **Quiz:** 1–4 select option, Enter confirm, Enter next after verdict, Esc exit-with-confirm. Open questions: textarea focus on render.
- **Chat:** Enter send / Shift+Enter newline; citation chips focusable; suggested starters clickable.
- **Selection `[stretch]`:** select text → SelectionBar appears (问 / 快测); Esc or click-away dismisses.
- **Flashcards:** Space flip, ←/→ navigate, Esc ends session with summary.
- **Language toggle:** sidebar footer, one click, persists.
- **Banned everywhere:** hover-only affordances on touch, modal stacks >1 deep, infinite scroll, auto-playing audio, engagement toasts («快来学习吧!» — no).

## Accessibility Floor

Behavioral; visual contrast lives in DESIGN.md · Colors.

- WCAG 2.2 AA across the responsive surface.
- Quiz fully keyboard-complete (above); focus moves question-to-question, verdict announced `aria-live=polite`.
- Companion streaming announced once on completion, not per token.
- Study states never color-only — glyph + label + tint everywhere (NodeRow, QuizResults, mastery marking).
- `Tab` order matches reading order; `Esc` closes the topmost layer, always.
- 200% text zoom reflows (reader measure + flex layouts); no horizontal scrolling traps in quiz/plan surfaces.
- `prefers-reduced-motion`: all animations collapse to instant state changes; confetti becomes a static badge state.

## Responsive & Platform

| Breakpoint | Behavior |
|---|---|
| ≥1024px (`lg`) | Full sidebar; Reader split view (Companion docked 400–420px); Plan Home two-zone. |
| 768–1023px (`md`) | Sidebar collapses to icon rail; Reader toggles Companion as right overlay; quiz/plans stack. |
| <768px | Mobile header + bottom nav (Plans + 2 hubs); Reader full-bleed, Companion = bottom sheet (~65dvh, drag handle); uploads via native picker. |

Responsive web, not native. Phone use = read + chat + review; generation and quiz sessions work but are not optimized.

## Inspiration & Anti-patterns

- **Lifted from roadmap.sh:** node/state vocabulary for the Phase 2 Roadmap (done / in-progress → mastered / partial / uncovered); click-through-into-content idiom.
- **Lifted from the scaffold (owner adoption round, PRD memlog 2026-11-01):** the chat surface pattern (ex-AITutorPage) as the Companion's base; the quiz hint button; the flashcard difficulty trio; the mistakes compare card; the Planner task-row vocabulary (→ Today, FR-27); the dashboard's quick-action tiles (→ FR-25); the 12-badge taxonomy (→ FR-28); topic-strength bars (→ FR-26 analytics).
- **Lifted from modern chat surfaces:** streaming answers, citation chips, suggested starters — but grounded in *this* page, and hint-first by default (the anti-ChatGPT detail is the product).
- **Lifted from Anki:** the flip-card rhythm — recall attempt before flip (NFR-8 in miniature).
- **Adopted then bounded — motivation layer (owner decision, supersedes this run's earlier rejection):** evidence-based streak (FR-25: consecutive days with ≥1 evidence-producing session) + FR-28 badges. **XP / points / level economies stay rejected** — they reward activity volume, which SM-C3 forbids optimizing. Celebration stays restrained: one confetti at 100%, ever.
- **Rejected — engagement nudges / time-in-app displays:** Synapse serves study efficiency, not retention theater. Streak counts evidence days, never minutes.
- **Rejected — ai-vs-manual analytics charts:** legacy dual-mode comparison; explicitly excluded from FR-26.
- **Rejected — "AI magic" sparkle-mania:** one pulse-glow thinking indicator; no sparkle-storm chrome.
- **Rejected — dark mode in Phase 1:** no token set exists; demo days beat theme days.

## Key Flows

### UJ-5. Yinan opens the app and lands on a plan, not a menu

1. Yinan opens the deployed URL. Plans Home: he has no plans — the agent-style creation chat greets him (「想学什么？」).
2. He types 「5 天后 COMP5241 期末」. The Companion replies with a `StructureCard`: ~12 Knowledge Nodes across 4 stages (软件过程 / 需求 / 设计 / 测试与交付).
3. He renames two nodes inline, confirms. Plan created; he lands on Plan Home — all nodes uncovered, attach-Materials CTA primary.
4. He attaches three lecture PDFs + his Markdown summary (drag-drop). Parse completes; Material cards light up.
5. He opens Lecture 4 → Immersive Reader (next flow). Later, from the Plan Home quick-actions grid he launches a Mix quiz (8 questions).
6. Quiz: attempt-gated, one at a time; one hint taken (✦ 提示, free), one forfeit (「看了答案 = 放弃此题」); results show per-node deltas — 设计 nodes climb to partial.
7. **Climax:** over days the rollup climbs 40% → 75%; finally the last uncovered node's quiz lands and the ring flips to **100%** — `ReadinessBadge`, one confetti burst, 「可以进考场了。」
8. Resolution: plan stays as coverage evidence; the streak chip counts his evidence days (连续 5 天); wrong-answer history remains for the final pass.

Failure beats: upload rejects a .pptx with bilingual guidance; quiz generation fails → neutral toast + retry, plan state untouched; a node with no questions ever asked reads `uncovered`, never accidentally green.

### UJ-6. Wei just wants one PDF understood tonight

1. Wei opens the URL — empty state. She ignores plan creation and clicks 「新建 Study Task」.
2. Uploads the paper (PDF), names it, lands in the Reader. No plan UI ever appeared.
3. Reads with the Companion; takes a Mix quiz on it; the task shows its own single-node Mastery Score.
4. **Climax:** understanding lands without ceremony — nothing stood between her and the PDF.
5. Resolution: the task stays in her library under Plans Home (task section); Phase 2 promotion to a plan is a pointer, not built.

### UJ-1. Yinan reads a lecture PDF with the Companion beside him

1. From Plan Home, Yinan opens Lecture 4 in the Immersive Reader — split view, Companion docked right.
2. He reads to page 7; the Reader tracks Reading Position (page 7, its text).
3. He types 「为什么这里的集成测试和上一章不一样？」. The Companion answers hint-first, citing page 7's section with a `CitationChip`.
4. **Climax:** the answer quotes the exact section he is looking at — he clicks the chip, the page scrolls and flashes the cited passage. No re-explaining, no copy-paste.
5. Resolution: he keeps reading; history stays anchored to this Material across sessions.

Failure beat: he asks something the page can't answer → honest-fallback bubble with labeled general-knowledge offer (NFR-1).

### UJ-2. Confusion becomes a Quick Test in one click `[stretch]`

Yinan selects a dense paragraph → `SelectionBar` → 快测 → 3–5-question mini-quiz overlays the Reader on that selection; wrong answers queue for the Mistakes Notebook. (Designed, built only if the core lands early.)

### UJ-3. Wei paints the page green before the exam `[stretch]`

Wei re-reads her Markdown summary, marks each verified section — backgrounds turn green as *claims* — each mark inviting a confirm quiz; Roadmap nodes flip green in step with quiz passes (Phase 2 graph). The score moves only on quiz evidence (FR-15).

### UJ-4. Yinan turns a week of highlights into a study plan `[Phase 2 position]`

Annotations accumulate → Study Focus generates core study items from them, surfacing as a panel inside the Reader (OQ-1 direction). Not designed further this run.

## Open Items

Non-blocking; logged to the run memlog. Mastery display thresholds (80/1–79) tunable at spec; Phase 2 detail owed: Study Focus panel layout, Square listing order (OQ-12 residual), Note enrichment placement (OQ-11), grade-appeal flow beyond Phase 1's acknowledge-only stance.
