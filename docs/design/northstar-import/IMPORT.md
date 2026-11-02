# Northstar Import — new visual direction for Synapse

**Imported:** 2026-11-02 · **Source:** Open Design project `027e68d8-13a5-4ccb-8e5a-2b04a77ae665`
- **Pass 1+2 (visual + pattern layer):** prototype "Northstar — your calm workspace", now preserved as [`prototype-v2/northstar-reference.html`](./prototype-v2/northstar-reference.html); see §5/§6 below.
- **Pass 3 (full product implementation, 2026-11-02):** the Open Design project was rebuilt into a complete **Synapse prototype** (`index.html + styles.css + app.js`, zh-CN default, all 10 routes + onboarding) — archived at [`prototype-v2/`](./prototype-v2/). That prototype is now the design source of truth and has been **ported into the React app wholesale** (see §7).

**Owner directive (2026-11-02):** import this design into the design documentation and the current frontend implementation. This supersedes the *visual* direction of `docs/design/ux-synapse/DESIGN.md` (hue-220 blue "quiet intelligence") for tokens, typography, and surface treatment. The **behavior spine** (`EXPERIENCE.md`) is untouched: IA, i18n, a11y floor, breakpoints, AI guardrails, and all §7 invariants of the handoff remain binding.

---

## 1. What Northstar is

A sidebar-first workspace prototype in one HTML file: warm cream canvas, coral/peach gradient accents, frosted-glass sidebar, serif display type, layered soft shadows. Its reusable parts for Synapse:

| Northstar piece | Synapse mapping |
|---|---|
| `:root` token block (bg/fg/accent/grad/border/glass/elev/radius/motion) | new values for the existing shadcn HSL tokens in `src/index.css` + new `--grad-*` / `--glass-*` extras |
| Glass sidebar (blur 24px + saturate 180%, hairline glass edge) | `AppLayout` desktop sidebar + icon rail restyle (IA unchanged) |
| Gradient brand mark + `.btn-primary` (135° grad-a→grad-b, white text, tinted shadow) | sidebar logo treatment + shadcn `Button` default variant |
| Body background: cream + three fixed radial gradient blobs | `body` rule in `src/index.css` |
| Display serif headings (Source Serif Pro, tight leading, -0.01em tracking) | `font-display` chain + `h1–h6` base rule (zh serif fallbacks added) |
| Card system: white surface, `--border-soft` hairline, `--elev-raised` shadow, 16px radius | `--card`, `--border`, `--radius` token values (pages already use semantic classes, so they inherit automatically) |
| Status pills, chips, activity list, empty-state dash-border | reference patterns for future hub pages (not yet applied — no hub surfaces exist) |

Not imported (documented non-goals):

- **Dark theme** — Northstar ships `body.theme-dark`; Phase 1 is light-only per `DESIGN.md`/handoff §4 ("dark mode explicitly rejected"). The prototype retains it for a future phase.
- **Northstar app logic** (tabs/spaces/command bar JS) — demo content of the prototype, not Synapse product behavior.
- **Spaces switcher / URL bar chrome** — Northstar's own IA; Synapse's 10-page retained IA wins.

## 2. Token mapping (Northstar CSS var → Synapse shadcn HSL token)

| Northstar | Hex | Synapse token | New HSL value |
|---|---|---|---|
| `--bg` | `#fdf3ec` | `--background` | `25 81% 96%` |
| `--surface` | `#ffffff` | `--card`, `--popover` | `0 0% 100%` |
| `--surface-warm` | `#fff4ea` | `--secondary` (warm fill) | `33 100% 96%` |
| `--fg` | `#1a1a1f` | `--foreground` | `240 9% 11%` |
| `--fg-2` | `#54545a` | `--muted-foreground` | `240 6% 34%` |
| `--border` | `#ece5db` | `--border`, `--input` | `36 39% 89%` |
| `--border-soft` | `#f6f0e8` | `--border-soft` (new extra) | `34 50% 94%` |
| `--accent` | `#ff5f5f` | `--primary`, `--accent`, `--ring` | `0 100% 69%` |
| `--grad-a` | `#ff7e5f` | `--grad-a` (new extra) | `12 100% 68%` |
| `--grad-b` | `#feb47b` | `--grad-b` (new extra) | `27 100% 74%` |
| `--radius-md/lg` | 12 / 16px | `--radius` | `0.75rem` (cards may use `rounded-2xl` where they want the 16px look) |
| glass layers | rgba white 0.55–0.92 | `--glass-1..4`, `--glass-edge` (new extras) | kept as rgba, not HSL |
| elevations | `--elev-low/raised/hover` | re-expressed as Tailwind shadow utilities `shadow-soft` / `shadow-raised` / `shadow-hover` | — |

**Unchanged semantic layers** (bound to DESIGN.md study-state semantics, still valid):

- Study states: `--mastered #39AC86` + tint, `--partial #E86E30` + tint, `--uncovered-tint #EDF0F7`, `--citation-tint` — mastery colors are untouched.
- `--destructive` stays the darker `0 72% 51%` red so destructive ≠ brand coral.
- Chart tokens stay semantic; `--chart-accent` shifts from teal to burnt coral `12 100% 55%` for brand coherence (mastery bars stay green/amber).

## 3. Typography

- Display: `'Source Serif Pro', 'Songti SC', 'Noto Serif SC', Georgia, serif` (replaces Outfit in `font-display`, `h1–h6`, `.page-title`, `.mastery-number`). CJK headings fall to system serif — a deliberate trade accepted in the import so zh and en share one family logic.
- Body: Inter unchanged; `.section-label` switches to sans (matches Northstar's sans uppercase labels).
- `text-wrap: balance` on headings retained (load-bearing for bilingual titles).

## 4. Known deviations, logged

1. **Gradient-button contrast:** white text on the coral gradient ≈ 2.8–3.0:1 — below AA for small text (the prototype accepts this; Northstar uses the same). Mitigations kept: buttons are ≥14px medium-weight with large hit areas; primary CTAs carry icons. Logged as a deliberate import deviation from the EXPERIENCE a11y floor — revisit if the owner wants a darkened `--accent-hover` CTA variant.
2. **"Blue = brand/action, never mastery"** (DESIGN.md) becomes **"coral gradient = brand/action"**; the rule's intent (brand color never encodes mastery) is preserved.
3. Sidebar glass uses rgba white layers — on the cream canvas it reads warm; no dark-mode counterpart exists in this import. **→ Resolved in pass 7 (§11):** the Northstar reference's dark counterpart was ported (`.dark` token block + runtime accent/ink lifts + `--scrim`); this deviation no longer applies.

## 5. What changed in the repo

**Pass 1 (2026-11-02, theme layer):**

- `src/index.css` — token values per §2, body background blobs, glass + gradient utilities, serif display chain.
- `tailwind.config.ts` — display font chain, `grad` color pair + `border-soft`, soft/raised/hover shadows.
- `src/components/ui/button.tsx` — default variant now the Northstar gradient primary (`bg-gradient-hero text-white`).
- `src/components/layout/AppLayout.tsx` — glass sidebar, gradient brand mark, Northstar-style nav rows (IA, routes, footer unchanged).

**Pass 2 (2026-11-02, pattern layer — "implement the new design"):**

- `src/components/layout/nav-items.ts` (new) — single source for the retained 10-page IA, shared by shell + palette.
- `src/components/shared/CommandPalette.tsx` (new) — the Northstar ⌘K command bar: global ⌘K/Ctrl+K, grouped page navigation, language-toggle action; built on shadcn `command.tsx` (cmdk).
- `AppLayout.tsx` — sidebar search pill (`nav.search` + ⌘K kbd), palette triggers on desktop sidebar / md icon rail / mobile header; Settings appears as an ungrouped nav group (footer gear retained).
- `StatCard.tsx` — `focal` variant (`.stat-card.focal`: gradient surface, white text, brand shadow) + `shadow-raised` on all stat cards.
- `DashboardPage` — weekly-goal stat is now the focal gradient card.
- `MaterialsPage` — Northstar list view: pill filter chips (`fg`-active like `.chip[aria-pressed]`), gradient upload CTA, dashed-border empty state.
- `MistakesPage` / `PlannerPage` / `QuizPage` / `AITutorPage` — hand-rolled `bg-primary` CTAs → the gradient primary (send button, retry, add-task, start-quiz, tutor header tile).
- `SettingsPage` — restructured into Northstar settings groups: raised card + uppercase group header + label/help rows; language control is a segmented dark-active toggle.
- `OnboardingPage` — glass-panel step cards on the cream canvas, gradient logo tile + CTAs (fixes the "bare centered card" pain point).
- `NotFound` — glass empty-state card with gradient tile + dark pill back link.
- i18n keys added (zh+en): `nav.search`, `command.placeholder|noResults|groupActions|toggleLanguage`, `settings.languageRow`.

All pages/components remain semantic-token-only; no logic, route, or context changes.

## 7. Pass 3 — full prototype ported into the React app (2026-11-02)

The Open Design project evolved into a complete Synapse prototype (`index.html` + `styles.css` 59KB + `app.js` 2586 lines). Owner directive: "implement the design." Archived at `prototype-v2/` and ported:

**Foundation**
- `src/contexts/i18n-dictionary.ts` (new) — the prototype's full I18N copy deck (~370 keys, zh+en, `{var}` interpolation), auto-extracted from `app.js` by script (zero transcription errors); shell keys (`nav.search`, `command.*`) appended inside both language blocks.
- `src/contexts/LanguageContext.tsx` — `t()` re-pointed at the nested `translations[lang][key]` shape (old flat table removed).
- `src/contexts/UserProgressContext.tsx` — prototype defaults (points 1750 / streak 5 / level 4 / weekly 17 of 25), new `mastery` state ({design 84, requirements 61, testing 47}), `applyQuizOutcome` (evidence counters + weekly session + mastery deltas, FR-3/20 semantics), `resetAll` + `resetTick` (Settings 演示数据重置). In-memory, resets on reload — Phase-1 honest.
- `src/lib/demo-data.ts` (new) — MATERIALS (COMP5241 lectures), TAGS, TASKS, ACHIEVEMENTS (12), MISTAKES, FLASHCARDS (8, with sources), QUIZ_BANK (8: choice + open with hints/why/keywords/sources), analytics series, `pickL` helper.
- `src/index.css` — Northstar ink tokens (`--accent-ink #b23a3a`, `--mastered-ink`, `--partial-ink`, `--citation-ink`, `--danger-ink`, `--caption`, `--uncovered-fill`) + ported component utilities: `.eyebrow`, `.pill(+streak/mastered/partial/muted)`, `.tint-*`, `.citation`, `.kbd-hint`, `.hint-box`, `.verdict(+correct/partial/wrong)`, `.compare-*`, `.ai-note`, `.diff-*`, `.deck-dot`, `.step-dot`, `.bar-*`, `.empty-state`, `.warm-value`, `.g-*`.
- Shell: flat 9-item nav (`nav-items.ts`, prototype NAV_ROUTES + `nav.tutor` key), footer persona "Yinan Chen", mobile header streak pill + settings/search buttons; ⌘K CommandPalette retained (shell addition, prototype-external); 8 superseded shared components deleted (AnimatedSection, StatCard, MasteryRing, QuizOptionRow, StateChip, HubPlaceholder, CitationChip, ProgressRing).

**Pages (all 11 rewritten to mirror the prototype's render functions)**
Onboarding (3 steps, dots, goal rows, skip), Dashboard (greeting `em` accent, 4 stat cards, continue-reading, quick grid, weekly ring, achievements strip), AI Tutor (intent chips, keyword detection incl. replyBeyond, demo note), Materials (tag chips + search + rows + reader-deferred toasts), Quiz (start → runner: choice A–D + open keyword-grading, free hint, reveal=forfeit, exit AlertDialog, 1–4/Enter/Esc keyboard, focus management → results: score ring, mastery deltas, mistake cards), Flashcards (recall-first deck, rate trio, deck dots, summary ring), Mistakes (weak-topic bars from live mastery, compare cards), Planner (day progress, task rows reset via resetTick, streak note), Achievements (summary ring + 12-badge grid), Analytics (4 stat cards + hand-rolled SVG charts — gradient weekly bars, accuracy trend, mastery rows + evidence note), Settings (profile / language cards / appearance + demo-reset confirm / keyboard rows), NotFound (empty-state + CTA).

**Verification:** `tsc -b` clean · eslint 0 errors · vitest green · live browser pass: all routes zh+en spot-checked for key leaks (none), full 8-question quiz executed end-to-end (choice + open grading, verdicts, deltas applied 84→90 / 47→53), flashcard flip + rate trio, EN mode, mobile 390×844.

**Known deviations:** none new — prototype fidelity is 1:1 for layout/copy/behavior; the ⌘K palette and md icon rail remain React-shell additions beyond the prototype.

## 8. Pass 4 — owner style-fidelity sweep vs prototype-v2 (2026-11-02)

Owner re-reviewed the React port against the live Open Design prototype and flagged 9 drift spots. Root cause + fixes:

- **Broken warm surfaces (root cause):** `.pill` / `.hint-box` / `.verdict` / `.ai-note` / `.warm-value` used raw `var(--secondary)` (an HSL triplet, not a color) → invalid CSS → **transparent backgrounds**. Added exact `--surface-warm: #fff4ea` (prototype token) and pointed all five at it. This is what made Quiz/Mistakes tags, AI 解析 boxes, and Settings pills look wrong.
- **`--uncovered-fill`** re-tuned `220 25% 95%` → `220 40% 95%` = prototype `--uncovered #edf0f7` exactly (ring tracks, bar tracks, pill-muted).
- **`.pill`** font-size 12→11px (prototype `--text-xs`) + new `.pill > svg { 13px }` rule (prototype `.pill .icon`).
- **AI Tutor**: composer rebuilt as the prototype's unified white shell (`.composer`: border + raised shadow + borderless 14px textarea inside + 42px send btn); tutor-title body-font 18px (was display serif sm); user bubble dark-ink `--fg` (was gradient); msg avatars 30px, AI = coral tint + accent-ink (was gradient white); sub/notes → caption gray; suggest chip hover → warm.
- **Quiz**: cards → prototype `.card` recipe (border-soft / 16px radius / raised shadow); option-mark check 16→15px; open textarea glass `rgba(255,255,255,0.78)` min-h 116px; q-count/start-note → caption 11px.
- **Mistakes**: AI 解析 icon + accent-ink 15px (was unstyled dark 14px); weak-card p-6 raised, section-title 15px body font + chart-sub 10px caption; date → chart-sub; compare-label icons 14→12px.
- **Planner**: AI tag icon 12→11px; streak-note-card warm bg `#fff4ea` + orange border `rgba(232,110,48,.18)` (was gray); task-check icon 14→12px; day-card 16px radius + border-soft.
- **Achievements**: top stats rebuilt as prototype `.ach-stat` warm mini-cards (grid 3 × `#fff4ea`, serif 24px/600 values, 10px caption labels — was bare columns); badge grid 3→4 cols, 16px radius, locked state → caption + opacity .62.
- **Settings**: profile avatar was gradient-white 56px → prototype 46px coral-tint + accent-ink 15px/600 letter; reset button rebuilt to `.btn-danger.btn-sm` (12px/600, 10px radius, inset ring, 7×12px padding); rows 13px, labels 13px, helps 10px caption; lang-card active = focus-ring shadow; grid gap 16px; cards raised.
- **Icon size sweep** (owner: "都偏大"): onboarding mark 28→25px + tile 56→52px, goal icon 20→19px, all pill icons → 13px, compare-labels → 12px, task-check → 12px, option marks → 15px, tutor avatar spark 20→19px.

**Verification:** computed-style audit in browser against prototype-v2 values — settings avatar, reset btn, sidebar footer (avatar/divider/meta), composer shell/textarea/send, user bubble + msg avatars, pills, ai-note, weak card, planner ai-tag + streak note, ach-stat cards + badge state all match prototype exactly. `tsc -b` clean · eslint 0 errors · vitest green.

## 9. Pass 5 — owner round 2: gradient bg, card sweep, remaining drift (2026-11-02)

- **渐变背景恢复（大问题根因）**: `AppLayout` 根元素的 `bg-background`（不透明）把 body 上三块径向渐变完全盖住，导致侧边栏/画布看起来没有渐变。原型 `.app` 是透明的、侧边栏是 glass-1 毛玻璃 —— 渐变透出来才有 Northstar 的暖色调。移除该 class 即恢复。
- **设置页 暖色浅色主题**: prototype 的 spark 图标继承 `.warm-value` 的 fg-2 灰色，React 误加了 accent-ink 珊瑚色 → 移除，图标随文字同色。
- **卡片规范逐页排查**（原型 `.card` = surface 白 + border-soft #f6f0e8 + 16px 圆角 + raised 暖阴影）:
  - Analytics: StatCard + 3 张图表卡 `border rounded-xl` → `border-border-soft rounded-2xl`。
  - Dashboard: StatCard、continue-card（渐变卡）、weekly ring 卡 → border-soft + 16px；ach-mini emoji 底 → surface-warm。
  - Materials: 行/搜索框/筛选 chips/文件 tag 按 `.material-row`(border-soft) / `.search-field`(glass-4 0.78) / `.chip`(glass-3 0.62 + border-soft) / `.tag`(surface-warm) 校准。
  - Flashcards: 开始卡 16px+border-soft；flash-card 圆角 16→**20px**（原型 radius-xl）。
  - Onboarding: onboard-card → 原型配方 rgba(255,255,255,0.82) + blur(24)+saturate(180%) + glass-edge 边框 + 20px 圆角 + p-10；goal 行 bg-card + active=focus-ring 阴影；onboard-lang → glass-4/border-soft/600；三个步骤标题 30/38px semibold。
- **页面容器宽度对齐原型 page 类**: `page`=1120（Dashboard/Materials/Achievements/Analytics）、`page mid`=1000→984（Mistakes/Planner/Settings/Flashcards）、`page narrow`+quiz-shell=720（Quiz 外层 784-64 padding）、AI 导师 900 不变。
- **全局排版**: `.page-title` 24px bold → 原型 **34px semibold -0.025em**（移动端 27px）；`.eyebrow` 12→11px；lucide 全局 stroke-width 1.8（原型 `.icon` 1.8，覆盖 lucide 属性 2；规则必须写在 @layer 外，否则被 Tailwind purge）。
- 验证: tsc clean · lint 0 errors · vitest green · 浏览器 computed-style 审计: body 渐变在、shell 透明、侧边栏 rgba(255,255,255,.55)+blur24、演示数据 pill #fff4ea/11px、stat/chart 卡 border-soft+16px、page-title 34px/600、stroke 1.8、暖色主题图标继承 fg-2 —— 全部与原型一致。

## 10. Pass 6 — owner product deviation: sidebar user-info footer removed (2026-11-02)

Owner call: 侧边栏底部的用户信息（头像 学/S + Yinan Chen + 等级·积分）与设置页「个人资料」卡完全重复，多余。已从 sidebar 移除整块（含 divider），只保留右下角齿轮按钮作为设置入口（⌘K 与移动端头部齿轮不受影响）。这是对 prototype-v2 的首个**有意产品偏离**（原型 .sidebar-foot 含完整用户信息）——其余仍 1:1。侧边栏语言切换（🌐 English/中文）保留未动。

**§10 更正（owner 澄清）**: 上一步误删了整个用户信息脚部 —— owner 本意是**只移除侧边栏语言切换按钮**（🌐 English/中文，与设置页「语言」卡重复）。已恢复脚部原样（头像+姓名+等级行+齿轮+divider），仅去掉语言切换；⌘K 面板和设置页仍可切换语言。md 图标栏与移动端顶栏的语言按钮未动（如需一并移除请说一声）。

## 11. Pass 7 — Settings 深色/主题系统移植 + ⌘K 面板校准 (2026-11-02)

Owner 指定参考 OpenDesign「UI Redesign Plan」项目里的 **northstar-reference.html**（同项目内的另一版 northstar 设计：spaces 工作台版，其 Settings 含 Mode 下拉 + Space theme 色板 + 行为开关），把 Settings 布局与主题功能移植进 React 应用并与现有内容合并。

- **ThemeContext**（新 `src/contexts/ThemeContext.tsx` + `src/lib/themes.ts`）: THEMES 三色板取 northstar `THEMES` 原值 — sunset `#ff5f5f/#ff7e5f→#feb47b`（=现有品牌默认，无漂移）/ twilight `#7f5af0/#7f5af0→#e84393` / aurora `#0d9e8a/#16d2a8→#0db4f7`；mode = system/light/dark（system 监听 `prefers-color-scheme` 变化）；另移植 reduce-motion 开关。持久化沿用 `synapse-lang` 惯例：`synapse-theme` / `synapse-mode` / `synapse-motion`。
- **运行时变量**: ThemeContext 按设计 `applySettings` 写入 `--primary/--accent/--ring/--grad-a/--grad-b/--accent-ink` 及新 tint 族 `--accent-tint(2)/--accent-ring/--accent-edge`；dark 时 accent 按设计混白 14%、ink 混白 30%（=设计 `#ff8f8f`）；`dark` 类挂 `<html>`（tailwind darkMode:class）+ `colorScheme`。
- **`.dark` token 块**: northstar `body.theme-dark` 全套 HSL 映射（bg #171318 / card #231d25 / surface-warm #2d252d / border #3a323a / border-soft #2c262c / glass 翻转成暗玻璃 / scrim rgba(0,0,0,.55) / elev 加重 / ink 系提亮 #7ddaba 等）；body 三块径向渐变改为 token 驱动，dark 下按设计减淡。
- **SettingsPage 重写**: 移植 northstar Settings CSS 成工具类（`.settings-group` 白卡+uppercase 小标头 / `.setting-row` 16×24px+分隔线 / `.theme-swatches`+`.swatch` 34px 渐变圆点 / `.switch` 46×28 药丸开关），三组卡片：个人资料（头像行+语言卡）/ 外观（模式 select + 主题 swatches + 减少动效 switch）/ 通用（演示数据重置+键盘说明）。语言卡、重置对话框等现有交互全保留。
- **⌘K 面板校准**（owner 四点反馈）: ① mask `bg-black/80` → `var(--scrim)`（dialog/alert-dialog/sheet/drawer 四处，浅色 rgba(26,26,31,.3)/深色 rgba(0,0,0,.55) = 设计 `dialog::backdrop`）；② hover/选中 `bg-accent`（亮珊瑚）→ `var(--surface-warm)` 暖 tint = 设计 `.cmd-item.selected`；③ icon 20→16px；④ icon-文字 gap 显式 12px，item px-4/py-3/15px/10px 圆角，输入行 18px/h-14/px-5，列表 320px p-2，面板 520px rounded-2xl+border-soft+`0 24px 64px` 阴影，去掉 DialogContent 自带的 X（`[&>button]:hidden`）。
- **硬编码色扫换**（dark 可用性的前提）: `bg-white/[0.42/0.62/0.78]`、`bg-white/70/75`、`hover:bg-white` → glass token；`rgba(255,95,95,*)` 13 处 → accent tint 族 token；`.glass-mobile-bar/.glass-bottom-nav` → `--glass-bar`；`.shadow-soft/raised/hover` → `--elev-*`；`.deck-dot/.step-dot` 黑色 → `--ink-soft`；`.tint-coral` → `--accent-tint`。共 8 个 tsx 文件 + index.css。
- **i18n**: 新增 17 组双语 key（mode/themeHelp/reduceMotion/general/theme.sunset 等），移除过期 `settings.appearanceValue`/`settings.lightOnly`。
- **验证**: `tsc -b` clean · eslint 0 errors · vitest green · IAB 截图审计：深色 Settings 全页（三组卡+swatches+switch+深玻璃侧栏）、暮光主题全局切换（渐变/头像/语言卡环/背景 blob）、⌘K 浅/深两态（mask 深浅、暖 hover、16px icon、无 X）。

## 11. Pass 7 — responsive chrome per prototype (Pad rail + mobile drawer, 2026-11-02)

Owner round: **Pad (md–lg 图标栏)** — 语言切换按钮移除（同桌面侧边栏的决策）；补上设计图里有而移植遗漏的**用户头像**（原型平板态 `.sidebar-foot` = 文字隐藏、头像+齿轮保留）。图标栏底部现在是：搜索 → 头像「学/S」→ 齿轮。

**手机 (<md)** — 顶栏右侧的语言 Globe 与设置齿轮按钮移除（原型移动顶栏本就只有品牌/菜单/搜索/连续天数）；**左侧新增汉堡按钮**（`nav.menu` 打开导航，i18n key 原型词典自带）打开**抽屉导航**：off-canvas 侧边栏（`min(290px,84vw)` 玻璃面板 + `rgba(26,20,18,.32)` scrim + 左滑入动画），内容 = 桌面侧边栏同构（品牌 / ⌘K 搜索 / 9 项导航 / 用户脚部含设置齿轮，无语言切换）；scrim 点击、Esc、点导航项/齿轮均关闭（原型 `body.side-open` 行为对齐）。移动端设置入口 = 抽屉脚部齿轮。

**Verification:** 820px（图标栏：头像 ✓ 齿轮 ✓ globe 0）与 390px（汉堡 x=6 ✓、顶栏仅搜索+连续天数 ✓、抽屉 9 项+脚部齿轮 ✓、点导航跳转并关闭 ✓、scrim 清除 ✓）浏览器实测；tsc clean · lint 0 errors · vitest green。

## 12. Pass 8 — sidebar menu-item height 40px (2026-11-02)

Owner: PC 侧边栏菜单项设计值 40px，实测只有 36px。原因：React 用 `py-2`(8) + `text-sm` 行高 20 → 36px；原型 `.nav-item` = `padding 9px 10px` + 14px 文字（行高 1.55）≈ 40px。修复：桌面导航项改 `h-10`（显式 40px，items-center 居中；注意 `leading-*` 会被 `text-sm` 的复合行高压过，不要用行高凑高度）；Pad 图标栏同步校准 `py-[11px]`（原型平板态 11+18=40px，原为 38px）。抽屉复用同一 renderLink，自动一致。实测 1440px 与 820px 下 9 项全部 40px；tsc/lint green。
