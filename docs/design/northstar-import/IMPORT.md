# Northstar Import — new visual direction for Synapse

**Imported:** 2026-11-02 · **Source:** Open Design project `027e68d8-13a5-4ccb-8e5a-2b04a77ae665` ("UI Redesign Plan", prototype "Northstar — your calm workspace")
**Prototype copy (source of truth for the visual layer):** [`northstar-prototype.html`](./northstar-prototype.html) — open it directly in a browser; it is fully self-contained (inline CSS + vanilla JS demo state).

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
3. Sidebar glass uses rgba white layers — on the cream canvas it reads warm; no dark-mode counterpart exists in this import.

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
