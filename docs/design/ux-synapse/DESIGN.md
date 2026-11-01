---
name: Synapse
description: Bilingual AI-guided study platform — plan-first entry, immersive reader with a page-aware Companion, evidence-based mastery. shadcn/ui + the scaffold's Tailwind token set inherited; this file pins the study-semantic brand layer.
status: final
created: 2026-11-01
updated: 2026-11-01
ui_system: shadcn/ui + Tailwind CSS-variable tokens (scaffold-inherited)
colors:
  # Full mirror of the scaffold's HSL tokens (src/index.css), hex-converted so
  # {colors.*} references resolve here; the CSS variables remain the truth.
  background: '#F4F6FA'       # --background  hsl(220 40% 97%)
  foreground: '#1F242E'       # --foreground  hsl(220 20% 15%)
  card: '#FFFFFF'             # --card
  secondary: '#EDF1F7'        # --secondary  hsl(220 40% 95%)
  muted: '#E7E9EF'            # --muted  hsl(220 20% 92%)
  muted-foreground: '#6A7181' # --muted-foreground  hsl(220 10% 46%)
  primary: '#406ABF'          # --primary  hsl(220 50% 50%)
  primary-foreground: '#FFFFFF'
  accent: '#6B8AC7'           # --accent  hsl(220 45% 60%) (shadcn hover tint)
  destructive: '#DC2828'      # --destructive  hsl(0 72% 51%)
  border: '#D9DEE8'           # --border / --input / --ring  hsl(220 25% 88%)
  # Sidebar token set (--sidebar-*) — the chrome voice of the app shell.
  sidebar-background: '#F0F3F9'   # hsl(220 45% 96%) (declared; shell uses bg-card)
  sidebar-foreground: '#363D49'   # hsl(220 15% 25%)
  sidebar-accent: '#DFE5F1'       # hsl(220 40% 91%) — active nav fill
  sidebar-accent-foreground: '#345EB2'  # hsl(220 55% 45%) — active nav text
  sidebar-border: '#DFE3EC'       # hsl(220 25% 90%)
  # Study-state semantics — the Synapse brand layer on top of the scaffold.
  mastered: '#39AC86'         # scaffold --emerald  hsl(160 50% 45%)
  mastered-tint: '#E6F4EE'    # mastered at ~12% over card white
  partial: '#E86E30'          # scaffold --amber  hsl(20 80% 55%)
  partial-tint: '#FBEEE6'     # partial at ~12% over white
  uncovered-tint: '#EDF0F7'   # scaffold --secondary — uncovered node fill
  citation-tint: '#ECF0F9'    # primary at ~10% over white
  # Chart accents (recharts on the retained Analytics page) — chart-scoped data
  # colors, never chrome. Phase 2 re-points topic bars at mastery state colors.
  chart-accent: '#0D968B'     # hardcoded hsl(175 84% 32%) — weekly bars, trend line
  chart-grid: 'hsl(216 12% 90%)'   # dashed grid + tooltip border (as authored)
  chart-axis: 'hsl(215 14% 46%)'   # 12px axis ticks
  # Per-topic bar hues on the demo Analytics page: 可用性 chart-accent ·
  # 认知 hsl(38 92% 50%) · 设计 hsl(160 84% 39%) · 研究 hsl(0 72% 51%).
  # Annotation palette — user marks on their own material (content, not chrome).
  highlight-yellow: '#FEF3C7'
  highlight-pink: '#FCE7F3'
  highlight-blue: '#DBEAFE'
  highlight-green: '#D1FAE5'
typography:
  # display (Outfit) and body (Inter) roles inherit the scaffold; deltas below.
  reader-body:
    fontFamily: "'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', system-ui, sans-serif"
    fontSize: 17px
    lineHeight: '1.75'   # CJK content: 1.9
  chat-body:
    fontFamily: "'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', system-ui, sans-serif"
    fontSize: 14px
    lineHeight: '1.6'
  mastery-number:
    fontFamily: "'Outfit', 'PingFang SC', system-ui, sans-serif"
    fontWeight: '700'
    fontVariantNumeric: tabular-nums
rounded:
  # Scaffold --radius scale inherited (sm 6px / md 8px / lg 10px / DEFAULT 10px).
  sm: 6px
  md: 8px
  lg: 10px
  full: 9999px
spacing:
  # Tailwind 4px grid inherited. Named deltas:
  companion-panel: 400px      # 420px at ≥1280px
  sidebar: 256px
  reader-measure: 70ch        # Markdown max line length
components:
  mastery-ring:
    track: '{colors.uncovered-tint}'
    fill: '{colors.primary}'
    fill-complete: '{colors.mastered}'
    number: '{typography.mastery-number}'
  node-row:
    fill-uncovered: '{colors.uncovered-tint}'
    fill-partial: '{colors.partial-tint}'
    fill-mastered: '{colors.mastered-tint}'
    radius: '{rounded.md}'
  citation-chip:
    background: '{colors.citation-tint}'
    foreground: '{colors.primary}'
    radius: '{rounded.sm}'
  companion-bubble-ai:
    background: '#FFFFFF'     # card token
    border: '1px solid hsl(var(--border))'
    radius: '{rounded.lg}'
  companion-bubble-user:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.lg}'
  streak-chip:
    background: '{colors.partial-tint}'
    foreground: '{colors.partial}'
    radius: '{rounded.full}'
  hint-button:
    foreground: '{colors.primary}'
    background: 'transparent'
    radius: '{rounded.sm}'
  quiz-option-correct:
    background: '{colors.mastered-tint}'
    border: '1.5px solid {colors.mastered}'
  quiz-option-wrong:
    background: 'hsl(var(--destructive) / 0.08)'
    border: '1.5px solid hsl(var(--destructive))'
  quiz-option-forfeit:
    background: '{colors.partial-tint}'
    border: '1.5px solid {colors.partial}'
  mastery-marked-section:
    background: '{colors.mastered-tint}'
---

## Brand & Style

Synapse is a calm, focused study companion — **quiet intelligence**. The AI is present on every surface but never loud: no sparkle-storms, no engagement nudges, no celebration theater. Three postures drive every visual decision:

1. **Reading is sacred.** The Immersive Reader gives the material maximal area and minimal chrome. The Companion sits beside the reading, never over it.
2. **Progress is honest.** Numbers come from evidence. Uncovered reads as uncovered, never as weakly-green. No vanity metrics, no time-in-app displays (counter-metric SM-C3). The one motivational glyph — the streak flame — counts *evidence days* (consecutive days with ≥1 evidence-producing session, FR-25), never minutes or logins. **Owner round 2026-11-01:** the scaffold's existing points/level display stays visible as read-only status garnish on the retained demo surfaces (sidebar profile footer, Achievements) — it matches the built app and earns nothing new: no engagement mechanics are ever built on points, minutes, or logins, and plan-first surfaces keep the evidence-only posture (streak + mastery numbers + Phase 2 badges).
3. **The connection metaphor stays subtle.** Learning = connections strengthening. It appears as structure (Knowledge Node lists, Roadmap graph in Phase 2) and one moment of life (the pulse-glow thinking indicator) — not as neural-network wallpaper.

The scaffold's identity is inherited wholesale: hue-220 blue, Outfit display over Inter body, soft 10px corners, light theme only. This file adds the layer the scaffold lacks: **study-state semantics** (mastered / partial / uncovered) and the reading-surface typography.

## Colors

The palette is the scaffold's plus one semantic layer. Blue is brand and action; the study states get their own hues; user annotations get a separate pastel set.

- **Primary Blue `{colors.primary}`** — brand, primary actions, active nav, links, AI-action accents (citation chips, "generate" moments). It is *not* a progress color and *not* a mastery color.
- **Mastered `{colors.mastered}` / `{colors.mastered-tint}`** — emerald. Means exactly one thing: demonstrated mastery (node ≥ threshold, marked section, correct-answer reveal). Never decorative, never "success toast" (toasts stay neutral or destructive). The solid hue fails AA as small-text color (2.8:1) — it carries state via tint fills, icons, and borders; any text inside a mastered context uses `foreground`.
- **Partial `{colors.partial}` / `{colors.partial-tint}`** — amber. Means "evidence exists, threshold not met" and "attention" (forfeited questions, stale scores in Phase 2), and carries the `StreakChip` (the flame's warmth is the point — it is the product's single motivational accent). Same large-only rule as text color (3.1:1).
- **Uncovered `{colors.uncovered-tint}`** — the scaffold's secondary gray-blue. Means "no evidence yet." Deliberately the quietest state: uncovered is the default condition of learning, not a failure.
- **Citation tint `{colors.citation-tint}`** — where the Companion's grounding shows. Any answer content that draws on the current Material carries this tint on its chips and grounded passages.
- **Annotation palette** (`highlight-yellow/pink/blue/green`) — the user's marks on *their own* material: Phase 2 highlights, underlines anchor colors. System chrome never uses these pastels, so a highlight on a page is unmistakably the user's voice, not the system's.
- **Contrast targets:** `{colors.primary}` on white 5.2:1 (AA body ✓). `muted-foreground` on `background` ≈ 4.4:1 — captions and secondary labels only; body-critical text uses `foreground`. All state text on tints uses `foreground` or `muted-foreground` at ≥14px.

No dark mode in Phase 1 — the scaffold has no dark token set and building one is not worth demo days. Revisit scoped to the Reader in Phase 2.

## Typography

Roles inherit the scaffold: **Outfit** for display (headings, big numbers, empty-state headlines), **Inter** for body/UI. Two deltas:

- **The CJK stack rides every text style.** Inter covers Latin only; Chinese text falls to PingFang SC / Microsoft YaHei / Noto Sans SC. Outfit is Latin-only too — Chinese in display sizes renders in the platform CJK sans, by design: the brand ("Synapse") is Latin in both languages, and CJK display in system sans is the normal bilingual-tech posture.
- **`reader-body`** is the reading-optimized role: 17px, line-height 1.75 Latin / 1.9 for CJK content, measure capped at `{spacing.reader-measure}`. Markdown materials render in this role; PDFs render as authored (we do not restyle the user's document).
- **`chat-body`** for Companion transcript — 14px, tighter, conversational.
- **`mastery-number`** — every Mastery Score digit renders in Outfit bold with tabular numerals, so 40% → 75% → 100% reads as one climbing instrument, not shifting labels.

Chinese and English strings must survive each other's layouts: English runs ~30% longer — buttons and chips are sized for the English string, never the Chinese one (NFR-5 made visible).

**Scale in use (Tailwind steps, as implemented):** page titles `text-2xl` (`md:text-3xl` on Dashboard) `font-display font-bold tracking-tight`; section labels `text-sm`/`text-xs` `font-display font-semibold` often in `muted-foreground` as a quiet label style; UI body `text-sm`; captions `text-xs`; micro-labels and tag chips `text-[10px]`; quiz question stems `text-lg font-display font-semibold`; hero numbers `text-2xl`–`text-3xl` Outfit bold. Headings get `text-wrap: balance`, paragraphs `text-wrap: pretty` (index.css base). Scrollbars are slimmed app-wide: 6px, border-colored thumb, 3px radius.

## Layout & Spacing

Tailwind's 4px grid inherited. Named decisions:

- **App shell (as implemented, retained):** fixed sidebar `{spacing.sidebar}` (`w-64`, `bg-card`, `border-r`) + fluid content; sidebar hidden below `md` (mobile header + bottom nav). Sidebar anatomy, top to bottom: **logo row** (32px favicon, `rounded-lg` + Outfit-bold wordmark, `border-b`) → **language toggle** (full-width ghost button: Globe glyph + target-language label 「English/中文」, `text-xs`) → **nav group** — 9 destinations (仪表盘 / AI 导师 / 学习资料 / 测验 / 闪卡 / 错题本 / 学习计划 / 成就 / 数据分析), rows `px-3 py-2.5 rounded-lg text-sm`, 18px icon; active = `bg-sidebar-accent` + `sidebar-accent-foreground` text + icon in `primary`; idle = `sidebar-foreground/70`, hover `bg-secondary` → **user profile footer** (`border-t`, `p-4`; spec below).
- **Mobile shell (<md):** top header (`border-b`, `bg-card`) — logo + language Globe + streak pill 「🔥 N」; bottom nav — 5 destinations (Dashboard / AI Tutor / Quiz / Flashcards / Achievements), icon-over-`text-[10px]` label, active `text-primary`.
- **Content containers** (`p-6 md:p-8` throughout): Dashboard, Analytics `max-w-6xl`; Materials, Achievements `max-w-4xl`; Mistakes, Planner `max-w-3xl`; Quiz, Flashcards, Settings `max-w-2xl`; AI Tutor = full-height flex column, chat column `max-w-3xl` between sticky header and composer; Onboarding = centered `max-w-md`.
- **Immersive Reader split:** material column fluid, Companion panel `{spacing.companion-panel}` docked right (420px ≥1280px). Panel collapses to a rail; immersive mode removes all chrome. Reading measure for Markdown: `{spacing.reader-measure}` centered.
- **Quiz surface:** single centered column, `max-w-2xl` — one question at a time, nothing else on screen.
- **Plan home:** two-zone layout — mastery summary rail (ring + rollup) left, node list + materials + activity right; stacks below `lg`. The quick-actions grid (FR-25) sits at the top of the right zone — a 2×2 of `QuickActionCard`s, the product's only toolbox surface.

**Entrance rhythm (adopted from the scaffold's `AnimatedSection` / `AnimatedCard`):** page sections enter with a blur-in fade-and-rise (~0.55s, `cubic-bezier(0.16, 1, 0.3, 1)`), staggered 40–80ms per section; list cards stagger ~40ms per row; cards lift 2px on hover. Interaction feedback stays ≤500ms. This rhythm is the standard page entrance everywhere; `prefers-reduced-motion` collapses it to instant (EXPERIENCE · Accessibility Floor).

## Elevation & Depth

Scaffold posture: flat surfaces, 1px borders, tonal fills. Shadows appear only on **floating layers** — the selection toolbar `[stretch]`, sheets, popovers, toasts — never as a hierarchy device inside content. The reader's PDF page container gets the one large shadow in the app (a page is a physical object).

## Shapes

Scaffold radius scale inherited (`{rounded.sm/md/lg}`). Pills (`{rounded.full}`) are reserved for status badges (mastery-state chips, language values). The Mastery Ring is the only circular data element; avatars stay circular per scaffold convention.

## Components

Visual specs. Behavioral rules live in EXPERIENCE.md · Component Patterns. Visual references: [mockups/key-reader-companion.html](mockups/key-reader-companion.html) · [mockups/key-quiz.html](mockups/key-quiz.html) · [mockups/key-plan-home.html](mockups/key-plan-home.html) · [mockups/key-plans-home-empty.html](mockups/key-plans-home-empty.html) — this spine wins on conflict.

- **MasteryRing** — plan-level rollup. Track `{colors.uncovered-tint}`, progress arc `{colors.primary}` switching to `{colors.mastered}` at 100%, `{typography.mastery-number}` centered. Implementation base: the scaffold's shared `ProgressRing` (animated dash-offset), extended with the mastery state colors. 100% renders a `ReadinessBadge` (pill, mastered tint, check icon).
- **NodeRow** — one Knowledge Node. Leading state glyph (○ uncovered / ◐ partial / ● mastered — icon + tint + label, never color alone), node name, trailing tabular %. Row fill = state tint. Trailing "evidence" affordance opens `EvidencePopover` (which quiz, which questions, when).
- **CitationChip** — `{colors.citation-tint}` fill, `{colors.primary}` text, page/section glyph, `{rounded.sm}`. Hover: underline. The grounding contract made visible (NFR-1).
- **CompanionBubble** — AI: white card, 1px border, `{rounded.lg}`, leading avatar chip (S mark, primary); the pattern is the scaffold's chat surface (ex-AITutorPage) extended. User: solid `{colors.primary}` fill, `{colors.primary-foreground}` text (adopted from the scaffold — the stronger presence is correct; citation-tint stays reserved for `CitationChip`). Streaming state: pulse-glow caret. Verdict/rationale blocks inside AI bubbles carry a left border in the verdict color.
- **EscalationControl** — ghost text-button ("直接看答案 / Show the answer") at the foot of a hint-first answer. Quiet by design: present, never flashing.
- **HintButton** — `{colors.hint-button}` ghost chip (✦ 提示 / Hint) beside the quiz confirm action, pre-answer; expands to a hint box (primary-tint background, sparkles glyph — scaffold QuizPage pattern). Free, no penalty, visually quieter than the primary confirm button.
- **StreakChip** — `{components.streak-chip}` pill (flame glyph + N 天) in the Plan Home header. One per surface. Tooltip states the evidence rule; never rendered as a bare number or a progress bar.
- **QuizOptionRow** — option letter chip (A–D) + text. Selected: primary border + ring. Post-reveal: correct `{colors.quiz-option-correct}`, wrong `{colors.quiz-option-wrong}`, forfeited `{colors.quiz-option-forfeit}` + "未作答 · 看了答案" label.
- **OpenAnswerBox** — textarea (min 3 rows), submit button; grading state = skeleton shimmer + pulse-glow; verdict banner ✓ / ◐ / ✗ with rationale (collapsible, open by default).
- **UploadDropzone** — dashed 1.5px border, `{rounded.lg}`; drag-over: primary ring + tint; parsing: progress bar; reject states carry bilingual copy + the reason (type / size).
- **QuickActionCard** — scaffold action tile: 40px icon tile (semantic tint: primary / amber / emerald at 10%), label, one-line description, trailing arrow that nudges right on hover; `{rounded.lg}`, card surface, `hover:shadow-md` + `active:scale-[0.98]`. Grid of 4 on Plan Home (出题 / 闪卡 / 上传 / 问 Companion — the last tagged P2); a second set of 4 (开始测验 / 闪卡复习 / 学习资料 / AI 导师) lives on the retained Dashboard — Plan Home stays the canonical in-flow toolbox.
- **MistakeCompareCard** — two-column compare: 你的答案 (destructive 8% tint, ✗ glyph) vs 正确答案 (`{colors.mastered-tint}`, ✓ glyph), followed by an AI 解析 strip (primary-tint, sparkles glyph) and source chip; topic tag + date in the header. Scaffold MistakesPage pattern adopted verbatim — it is already right.
- **DifficultyRating** — post-flip trio on FlashcardStudy: 难 / 中 / 易 as outline buttons in destructive / `{colors.partial}` / `{colors.mastered}` (30% borders, 5% hover fills — scaffold trio). Self-rating only.
- **TodayTaskRow `[Phase 2 · demo-live]`** — scaffold Planner row, already live on the retained `/planner` demo page: circular completion toggle (strike-through + 60% opacity when done), duration estimate with clock glyph, priority chip (高 destructive / 中 amber / 低 emerald at 10% tints), ✦ AI-suggested marker on weak-spot tasks; day-progress bar above the list (FR-27).
- **BadgeCard `[Phase 2 · demo-live]`** — scaffold Achievements pattern, already live on the retained `/achievements` page (demo unlocks): 48px emoji-icon tile, title, description; locked = secondary tile + lock glyph at 60% opacity, unlocked = amber-10 tile + 「✓ 已解锁」 line. The FR-28 reference set is the scaffold's 12-badge taxonomy; Phase 2 binds real evidence.
- **TopicStrengthBar `[Phase 2 · demo-live]`** — FR-26's mastery-by-node view: label + tabular % + 8px horizontal bar; live on the retained Analytics page with per-topic data hues (chart palette above), Phase 2 re-points fills at node mastery state colors. Accuracy trend renders as a recharts line in the same card family. ai-vs-manual charts are legacy and never return.
- **SidebarProfileFooter** — current-user card anchoring the sidebar (`border-t`, `p-4`): 36px circular avatar tile (`bg-primary/10`, primary initial glyph 「学/S」), name (`text-sm font-medium`) + stats line (`text-xs muted` — 等级 N · 积分， read-only garnish per Brand posture), trailing Settings gear (16px, muted → foreground on hover) as the sole desktop entry to `/settings`. Mobile omits it (header carries streak instead). The only profile surface in Phase 1 — no accounts (FR-29 local persistence).
- **StatCard** — Dashboard KPI tile: 32px icon tile (semantic tint) beside an `xs` muted label, `text-2xl` Outfit-bold value, `xs` muted sub-line; `{rounded.lg}` card, 2-col grid on mobile → 4-col `lg`.
- **MiniStat** — Analytics' lighter StatCard: icon + `xs` label row, single `text-xl` Outfit-bold value. Same card family.
- **ChartCard** — Analytics chart container: card + `border-border` + `{rounded.lg}` + `p-6`, display-semibold title + `xs` muted description; recharts styling as authored — dashed grid `chart-grid`, 12px `chart-axis` ticks, 8px-radius bordered tooltip, `chart-accent` fill with 4px top-rounded bars / 2px line with r4 dots. Phase 2 swaps demo series for real evidence (FR-26).
- **OnboardingGoalRow** — full-width option row (`rounded-xl border`): 20px icon + `sm` medium label; selected = primary border + `primary/5` fill + `ring-2 primary/20`; continue stays disabled (40% opacity) until ≥1 selected. The scaffold onboarding's four goals (备战考试 / 深入理解概念 / 高效复习 / 做题练习) are the same set FR-1 names for Phase 2 plan-generation.
- **ChatPageFurniture** — the retained AI Tutor page's chrome around the CompanionBubble transcript: sticky header bar (`border-b`, `bg-card`: 36px primary avatar chip + title + `xs` muted subtitle), empty state (56px primary-tint sparkle tile, display-semibold prompt, 2×2 suggestion chips — border cards, primary icon, hover `primary/30` border), typing indicator (3 bouncing 8px dots in a CompanionBubble), sticky composer (`border-t`, `bg-card`: `bg-secondary rounded-xl` input + 44px primary send button, `active:scale-95`).
- **FileIcon** — file-type glyphs on Material cards are functional emoji (📄 PDF / 📝 Markdown / 📊 slides-when-PPT-lands) on a secondary tile — warm and language-neutral; they are content markers, not UI chrome.
- **StructureCard** — the AI-proposed plan skeleton in creation chat: stage-grouped node list, each node row editable-on-click, confirm / regenerate actions. Reads as a proposal, not a done deal.
- **ReadinessBadge** — the 100% state: mastered-tint pill, check icon, "可以进考场了 / Ready." One confetti burst (existing token) allowed, once, on first reaching 100%.
- **HubPlaceholder** — sidebar hub pages in Phase 1: scaffold card, icon, one honest line of what lands post-demo, no fake data.
- **SelectionBar `[stretch]`** — floating toolbar on text selection: two actions (问 Companion / 快测). Card + shadow, `{rounded.md}`.
- **MasteryMarkButton `[stretch]`** — per-section affordance in Markdown reader; marked section background = `{colors.mastery-marked-section}` tint (claim, not evidence — copy says so).
- **EvidencePopover** — `EvidencePopover` anchors to a `NodeRow`: card surface, list of evidence entries (quiz name, date, per-question verdict glyphs ✓/◐/✗), `{rounded.md}`. Reads like a receipt, not a dashboard.
- **Flashcard** — flip card, `{rounded.lg}`, front term / back answer, keyboard-flippable; card back carries its source citation chip.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Carry every study state as icon + label + tint | Communicate state by color alone (green-only mastery fails colorblind users) |
| Use semantic tokens (`bg-primary`, `text-muted-foreground`, `{colors.mastered-tint}`) | Use raw Tailwind palette classes — the annotation set is the only sanctioned exception (user content marks) |
| Size buttons/chips for the English string | Lay out to the Chinese string and clip English (NFR-5) |
| Keep "Synapse" untranslated in both languages | Translate or transliterate the brand |
| Treat Companion copy as hint-first ("先想想…/ Try this first…") | Promise "answers" in any surface's copy |
| One confetti burst, at 100%, once | Celebration loops, praise emoji on verdicts, 👍/💪 result screens |
| Motivation = evidence-based StreakChip + FR-28 badges (P2); the scaffold's points/level display stays read-only garnish on retained pages | Build new engagement mechanics on points/minutes/logins (SM-C3), celebration loops, praise emoji on verdicts |
| Functional emoji as content markers (FileIcon glyphs, badge icons) | Emoji as UI chrome, verdicts, or Companion voice |
| `muted-foreground` for captions and secondary labels | Set body-critical or quiz content in `muted-foreground` |
| Design light-theme-only, and say so | Assume or imply dark mode exists in Phase 1 |
| Restyle Markdown materials via `reader-body`; leave PDFs as authored | Restyle or re-theme the user's uploaded document |
