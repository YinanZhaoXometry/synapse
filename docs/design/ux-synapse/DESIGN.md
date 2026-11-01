---
name: Synapse
description: Bilingual AI-guided study platform — plan-first entry, immersive reader with a page-aware Companion, evidence-based mastery. shadcn/ui + the scaffold's Tailwind token set inherited; this file pins the study-semantic brand layer.
status: final
created: 2026-11-01
updated: 2026-11-01
ui_system: shadcn/ui + Tailwind CSS-variable tokens (scaffold-inherited)
colors:
  # Mirrored from the scaffold's HSL tokens (src/index.css) so {colors.*} references
  # resolve here; the CSS variables remain the implementation truth.
  primary: '#406ABF'          # --primary  hsl(220 50% 50%)
  primary-foreground: '#FFFFFF'
  muted-foreground: '#6A7181' # --muted-foreground  hsl(220 10% 46%)
  # Study-state semantics — the Synapse brand layer on top of the scaffold.
  mastered: '#39AC86'         # scaffold --emerald  hsl(160 50% 45%)
  mastered-tint: '#E6F4EE'    # mastered at ~12% over card white
  partial: '#E86E30'          # scaffold --amber  hsl(20 80% 55%)
  partial-tint: '#FBEEE6'     # partial at ~12% over white
  uncovered-tint: '#EDF0F7'   # scaffold --secondary — uncovered node fill
  citation-tint: '#ECF0F9'    # primary at ~10% over white
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
2. **Progress is honest.** Numbers come from evidence. Uncovered reads as uncovered, never as weakly-green. No vanity metrics, no time-in-app displays (counter-metric SM-C3). The one motivational glyph — the streak flame — counts *evidence days* (consecutive days with ≥1 evidence-producing session, FR-25), never minutes or logins; the motivational layer stops at streak + Phase 2 badges, with no XP/points/level economy.
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

## Layout & Spacing

Tailwind's 4px grid inherited. Named decisions:

- **App shell:** fixed sidebar `{spacing.sidebar}` + fluid content. Sidebar hidden below `md` (mobile header + bottom nav).
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
- **QuickActionCard** — scaffold dashboard action tile: 40px icon tile (semantic tint), label, one-line description, trailing arrow that nudges on hover; `{rounded.lg}`, card surface. Grid of 4 on Plan Home (出题 / 闪卡 / 上传 / 问 Companion — the last tagged P2).
- **MistakeCompareCard** — two-column compare: 你的答案 (destructive 8% tint, ✗ glyph) vs 正确答案 (`{colors.mastered-tint}`, ✓ glyph), followed by an AI 解析 strip (primary-tint, sparkles glyph) and source chip; topic tag + date in the header. Scaffold MistakesPage pattern adopted verbatim — it is already right.
- **DifficultyRating** — post-flip trio on FlashcardStudy: 难 / 中 / 易 as outline buttons in destructive / `{colors.partial}` / `{colors.mastered}` (30% borders, 5% hover fills — scaffold trio). Self-rating only.
- **TodayTaskRow `[Phase 2]`** — scaffold Planner row: circular completion toggle (strike-through + 60% opacity when done), duration estimate with clock glyph, priority chip (高 destructive / 中 amber / 低 emerald at 10% tints), ✦ AI-suggested marker on weak-spot tasks; day-progress bar above the list (FR-27).
- **BadgeCard `[Phase 2]`** — scaffold Achievements pattern: 48px emoji-icon tile, title, description; locked = `{colors.uncovered-tint}` tile + lock glyph at 60% opacity, unlocked = amber-10 tile. The FR-28 reference set is the scaffold's 12-badge taxonomy.
- **TopicStrengthBar `[Phase 2]`** — FR-26's mastery-by-node view: label + tabular % + 8px horizontal bar, fill = node mastery state color; the scaffold's topic-strength pattern re-pointed at Knowledge Nodes. Accuracy trend renders as a recharts line in the same card family. ai-vs-manual charts are legacy and never return.
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
| Motivation = evidence-based StreakChip + FR-28 badges (P2) — nothing else | XP / points / level economies, engagement nudges, time-in-app metrics (SM-C3) |
| Functional emoji as content markers (FileIcon glyphs, badge icons) | Emoji as UI chrome, verdicts, or Companion voice |
| `muted-foreground` for captions and secondary labels | Set body-critical or quiz content in `muted-foreground` |
| Design light-theme-only, and say so | Assume or imply dark mode exists in Phase 1 |
| Restyle Markdown materials via `reader-body`; leave PDFs as authored | Restyle or re-theme the user's uploaded document |
