# Synapse Product Highlights (Report/PPT Source · English)

> Purpose: product source material for the COMP5241 course report and slides. Quick-card format: each card = **what it is** → experience detail → why it's good.
> State as of 2026-11-07. Sources are file paths you can open live in a demo.

---

## 1. Positioning & Organizing Principle

**One-liner**: Synapse is a bilingual (Chinese/English) AI-guided study platform — **the system supplies the plan, users bring their own materials, and mastery only counts when proven**. The goal: turn "I think I know this" into "I've proven I know this" (100% = exam/interview ready).

### Three product principles

1. **The system gives plans, not content**: the platform never provides study material — it generates structured learning paths; users attach their own PDFs/Markdown/PPTs to nodes. Knowledge ownership stays with the learner.
2. **Evidence-only mastery**: "Mark as mastered" (a claim) **never changes the score** — only quiz evidence does. The score is not a feeling; it's a verified state.
3. **AI-only single mode**: no manual/AI dual-track comparison — AI guidance is the product's only shape, and every feature is designed around it.

### Plan-centric: everything revolves around the study plan

**Claim: the study plan is both the front door and the organizing hub — material attachment, node mapping, quizzes, flashcards, mistakes, review scheduling, and daily suggestions are all organized by plan.**

- The front door `/plans` is the plan list (not a dashboard); the four sidebar hubs (Mistakes / Today / Flashcards / Quiz) group everything by plan.
- Materials only become meaningful when attached to a plan's **nodes**: quiz generation, quick tests, and mastery all land on the node dimension; a single material can be pinned to one node or widened across several (with a mapping-coverage panel).
- **Study Task is the lightweight side door**: just want to understand one document without a plan? Create a task and go straight to the reader — with an "upgrade to plan" path preserved (stable node ids, continuous evidence history).

### The "honest design" philosophy running through everything

- **No engagement theater**: no "great job!" engagement toasts, no study-time displays, no points/addiction mechanics — all explicitly banned by the UX spine's anti-pattern list.
- **No dead buttons**: without materials, quick actions gray out but **clicking explains why** via a toast, instead of silently doing nothing.
- **Empty states that point somewhere**: every empty state tells the user the next step (e.g., AI Tutor honestly points the way when there's no plan, instead of faking replies).
- Tone is brand: "可以进考场了。/ Ready." · "看了答案 = 放弃此题 · 已记入错题" (seeing the answer = giving up this question · recorded to mistakes).

---

## 2. Core User Journey (ten steps, doubles as the demo script)

The ten steps of `docs/demo-script.md`: **front door (empty-state creation chat) → attach materials → Reader flagship (selection bar / marking / annotations / Companion citations) → quick-test loop (wrong answers land in the mistakes hub, mastery visibly moves) → full quiz → the four hubs → Square fork → notes + weak-point reinforcement → task upgraded to plan → Settings (data export / bilingual / three palettes + dark mode)**.

---

## 3. Feature Highlight Cards

### 3.1 Dual-state front door (Plans Home)

- **What**: the `/plans` home shows two different faces — new vs. returning users.
- Details: empty state = the creation chat *is* the main surface, plus a Study Task strip ("只想搞懂一份文档？不需要计划" — just one document? no plan needed); returning state = **Continue Hero** (most recent plan + mastery ring + a cross-material **"last read Lecture 4" resume line** — one click back to the breakpoint) + plan cards (rollup %, node-status mini bar, fork attribution badge).
- Why it's good: the first screen back always answers "where was I, what now"; with zero tasks the whole section doesn't render — no empty-shell UI.

### 3.2 The plan-creation chat

- **What**: type a topic → the AI streams a structured proposal (typewriter cursor) → stage-grouped structure cards → one click to create the plan.
- Details: node titles are **inline click-to-rename** (duplicates independently editable); "regenerate" swaps the whole proposal; 4 named goal chips (exam prep / depth / review / practice, overridable with free text); private/public visibility chosen at creation with disclosure copy.
- Why it's good: building a plan becomes "chat with the AI for a draft, then fine-tune" — the AI supplies the skeleton; the human keeps the final say.

### 3.3 The interactive Roadmap graph

- **What**: the plan home renders the learning path as a **graph view by default** (list view toggleable).
- Details: a hand-rolled SVG DAG — swimlane stage columns + barycenter ordering + orthogonal arrows (an 815-line component, **zero external graph libraries**); optional nodes get dashed borders + an "optional" tag; stage bands show "mastered / total"; top progress bar; `?node=` **deep links** auto-select, pan into view, and open the side panel; **keyboard roaming** (arrows within/across columns, Enter for details, Esc to close); zoom 0.5–2 (buttons + wheel + **two-finger pinch, anchored at the gesture midpoint**); details use a side Sheet so the canvas stays visible.
- Why it's good: the learning path becomes an explorable object rather than a column of checkboxes — with full keyboard, touch, and mouse coverage.

### 3.4 The Square & one-click fork

- **What**: the front door's second tab browses public plans; one click forks one into your own.
- Details: cards show topic/goal/node count/stages; forks carry a permanent "adapted from a public plan" attribution; no demo data — the empty state is honest.
- Why it's good: good plans become reusable assets; disclosure is transparent (FR-38).
- Note: the roadmap.sh import was deliberately ruled **WONTFIX over content licensing** (no redistribution, no permission-seeking; outbound links kept) — scope discipline as a product decision.

### 3.5 The Reader (the official flagship)

- **What**: the reading hub — PDF / Markdown / PPTX (via the markdown pipeline, with an "text-only" toast on mount) all parsed client-side.
- Details:
  - Minimal top bar: back / title / **page pager** / panel collapse / immersive mode;
  - **Three responsive tiers**: desktop right dock (collapsible to a rail) → tablet slide-over + scrim → phone bottom sheet (drag handle; swipe down >80px closes without disturbing the composer) — the same Companion panel in three containers;
  - **Reading-position memory**: PDF by visible page, Markdown by scroll-spy section; debounced persistence + unmount flush; on open, `?page=N` / `#section` anchors take priority, else the saved position is restored;
  - Parse failures show bilingual reasons + retry; after a reload with missing bytes → a presigned GET restores the server copy → and only then guided re-upload.
- Why it's good: reading is a study platform's core dwell surface, and "pick up where I left off" costs nothing.

### 3.6 The selection bar: select, ask, get quizzed on the spot

- **What**: select any passage → a floating bar offers three action groups: **ask the Companion** (quotes the selection visibly into the question) / **quick test** (quizzed right there) / **annotate** (4-color highlight + underline).
- Details: mousedown suppression keeps the selection when clicking the bar; the quick test has an **honesty gate** — with no confirmed node mapping the button is hidden and only a hint line remains ("link a node to enable quick tests"); the quick-test session id lives in the URL and survives refresh; wrong answers auto-enter the mistakes hub with the source section, and evidence lands on the mapped node.
- Why it's good: **immediate reinforcement** — reading any passage, you can instantly "ask about it, test yourself," turning passive reading into active recall practice; and it runs the exact same QuizRunner as the plan/task flows, so evidence semantics stay unified.

### 3.7 Highlights → generation: annotations become output

- **What**: two "generate from highlights" pipelines.
- Details:
  - **Study Focus panel** (FR-17): AI-generated key points from your annotations; items **deep-link back to the source** (scroll + flash); tiered honest empty states (highlight first → generate once annotations exist); regenerate swaps the set with a vN version chip;
  - **Study notes** (FR-22): scope selector (whole plan / node / material) + a weak-point reinforcement toggle (server-side targeting) + free-form "add an illustration here" annotations; note details carry a targeting trace (node title + coverage chip); **exportable as `.md`** (Blob download, markers preserved).
- Why it's good: your highlights stop being dead data and become raw material — "what I highlighted" grows into key-point sets and notes.

### 3.8 Mastery marking + confirmation quiz (the honest claim loop)

- **What**: hover a Markdown section heading → "mark as mastered" → the section tints green at its start.
- Details: the green state embeds a **confirmation-quiz** button (requires a node mapping); **the claim never moves the score** — want a real 100%? Answer evidence-backed questions.
- Why it's good: "I think I've got it" is explicitly modeled as two steps (claim + verify) — the product's core honesty contract, made visible.

### 3.9 The annotation system (4 colors + underline)

- **What**: a persistent multi-color highlight/underline system (FR-16).
- Details: **CSS Custom Highlight API first, wrapped-mark fallback** — dual render paths; panel rows scroll-and-flash to the anchor on click, deletable; **hovering an annotation shows a popover** (source text + remove); drifted/lost ranges get an "original text changed" badge — **never silently misplaced**.
- Why it's good: annotations are a heavy-reader necessity, and "honestly telling the user when the text changed underneath" is something most readers don't do.

### 3.10 The AI Companion

- **What**: an AI study companion in two forms — reading mode and plan mode — streamed from the server.
- Details:
  - **Page-aware grounding**: grounded at the position *at send time* (grounding badge + send gate); answers carry citations;
  - **The hint ladder**: hint → worked step → answer; "show the answer directly" is always available — guidance first, but the direct answer is never withheld;
  - **CitationChip**: "📎 p. 7 · 12.2 Integration Strategy" — click **scrolls in place + flashes the quote** (1.2s), keyboard-focusable, no route jump;
  - **Quiz-me blocks**: interactive questions embedded in replies (single-select choice / open answer with keyword-coverage judging — zero hits say "try again," not "wrong"); locked after submit, revealing the verdict/answer/explanation; **the answer does not exist in the DOM before submit** (NFR-8, enforced by render tests); fences re-parse after reload;
  - Intent chips (explain / quiz me / summarize / analyze my mistakes) **always visible**, disabled while busy; an "analyze my mistakes" turn anchors to that mistake's source section;
  - failures produce a neutral toast + one-click retry with the draft preserved; threads persist across reloads.
- Why it's good: the AI stops being a floating chat box and becomes a companion that knows which page you're on and which question you got wrong.

### 3.11 Quiz: a test designed to *prove* mastery

- **What**: Open / Choice / Mix modes; scope of whole plan or single material; questions strictly generated from the user's materials.
- Details: one question at a time with "Q 3/8" progress; the **attempt gate** (no answer rendered before submit/give-up); the ✦ hint button is **free** but only gives a source-section-title-level hint (no answer leak); giving up = "show the answer," **recorded as wrong into the mistakes hub**; choice questions answer via number keys 1–4, Enter to confirm/advance, Esc with confirmation to exit; open answers show a "grading against your material" shimmer → verdict + reasoning + citations; **the verdict's pace belongs to the user** (the machine has moved on, but the UI pins until Enter); resumed sessions are honestly labeled "continuing from question 1"; the results page has a per-question breakdown (verdict/reason/source excerpt) + affected nodes' mastery deltas + the wrong list + "another round" (the server mints a **new** session — judged answers are never replayed); the `/quiz` hub adds history + row-level retake (same original scope + mode).
- Why it's good: the quiz becomes an evidence-collection ritual — every answer, give-up, and hint has explicit product semantics, all flowing into mastery and the mistakes hub.

### 3.12 Flashcards: recall first, verify second

- **What**: material-generated flashcards with self-rated review.
- Details: Space/click to flip, ←→ to navigate, Esc to exit; **the back face is not in the DOM before the flip** (recall before verification, render-test enforced); hard/medium/easy self-ratings **persist instantly** (a refresh may lose the queue, never the ratings); revisits always show the front first; the end summary includes the rating distribution + "study again" (same queue reopened, not regenerated); **self-ratings produce no evidence** (per ADR-0001); the `/flashcards` hub aggregates all decks across plans with deep links into the flows — the hub never generates.
- Why it's good: flashcards are psychologically about active recall, and the UI contract (answers never pre-rendered) locks that essence in with tests.

### 3.13 The Mistakes hub

- **What**: the management surface for every wrong answer (choice + open + give-ups), grouped by plan/task (FR-23).
- Details: each card has the question, your answer, node chip, date, a **source-section deep link** (anchor channel straight to the original text), and "retest" (node-scoped quick test); the **resolve lifecycle** — manually mark resolved (two-way toggle), resolved cards dim but stay readable, filterable open/resolved.
- Why it's good: mistakes are a to-do list, not a wall of shame; every wrong answer is one click from "where it came from in the text."

### 3.14 Today (the Planner)

- **What**: the daily surface (FR-27): due reviews + manual tasks + weak-spot suggestions.
- Details: due re-queues (mistakes/flashcards) **deep-link into the flow that completes them** — there is no inline "mark done" switch, because done = new evidence; a v1 heuristic weak-node card (permanently labeled "by mastery · v1," never pretending to be AI); **on-demand "generate AI suggestion"** — explicitly triggered, deterministic per (user, plan, UTC-day) uuid so same-day regeneration replays free; an honest "cap reached" state when the AI daily cap is hit; a 14-day consistency strip (evidence days filled, quiet days hollow, out-of-window dashed).
- Why it's good: the daily list is driven by evidence, not check-the-box guilt; AI usage is transparent and user-controlled.

### 3.15 Study Task: straight to one document + an upgrade path

- **What**: the second door — upload a document and go straight to the reader, no plan UI.
- Details: upload validation (PDF/MD ≤20MB, PPTX via the md pipeline with a notice) → idempotent attach → auto-created single-node task → immediate parse → jump to the reader; a failed create retries **reusing the same material** (no orphans); a single-material twin home (mastery ring = its node's server score); the **"upgrade to plan" confirmation dialog** (stable node ids, evidence continuity proven by spec).
- Why it's good: it respects the real "I just want to read this one handout today" scenario while preserving a growth path.

### 3.16 All ten hub pages run on real data

- **Dashboard**: time-of-day greeting (zh morning/noon/evening), server-side streak, 4 KPI cards each deep-linking to its hub, weekly goal ring (current ISO week, capped at 100%, no extrapolation), recent-badge strip.
- **Materials**: full server-side list (type/size/parse-state chip, failure emphasized with a reason tooltip), ownership chips, type filter + search; the upload button is an honest pointer to "attach within a plan."
- **Analytics**: three real series — **node mastery bars (weakest first)**, an 8-ISO-week accuracy trend, a 14-day consistency strip.
- **Achievements**: 12 badges with server-side state (locked ones show capped progress "1 / 5"), non-color-only states, a once-per-session confetti toast on new unlocks (degrading to a plain toast with motion off).
- **AI Tutor**: fake replies retired; replaced by a plan selector + a real plan-grounded CompanionPanel.
- Why it's good: every scaffold-era mock page was replaced with server data — **not a single screen is a fake demo**.

### 3.17 The visual & design system

- **What**: the Northstar visual system — the **Arc Browser design system** selected in OpenDesign produced the visual source of truth, landed via a 12-section mapping into **167 CSS variables / 8 token groups** (including the glass system, brand gradient, and **learning-state semantics**: mastered/partial/citation/four annotation colors).
- Details: **3 palettes** (sunset coral default / twilight / aurora) × **3 modes** (system/light/dark, with system following the OS live); runtime palette hot-swap by rewriting CSS variables (hex→HSL conversion); **dark-mode accent auto-lightened by 14%/30%** for contrast; Source Serif 4 (display) + Inter (body); a motion vocabulary of 10 keyframes (pop/slide-up/pulse-glow/reader-flash/sheet-up/confetti…), each annotated with its originating decision id; the claudette (MIT) reading skin as an optional toggle.
- Why it's good: 3 palettes × light/dark = 6 instantly switchable, globally consistent looks; dedicated semantic colors for learning states let mastery be read in color language everywhere in the UI.

### 3.18 Bilingual i18n

- **What**: fully bilingual copy — **904 keys × 2 languages with full-table parity pinned by a dedicated test** (one missing side turns CI red).
- Details: `t(key, {var})` interpolation; switching applies instantly without reload, persists, and syncs `<html lang>`; a **non-React mirror interface** lets the server-side AI adapter generate quizzes/flashcards in the same language.
- Why it's good: bilingual is not "a translated interface" but a product property protected by a test contract; AI output follows the UI language.

### 3.19 The touch batch

- **What**: **two-finger pinch zoom** on the Roadmap canvas (0.5–2, anchored at the gesture midpoint, with two-finger panning derived from the same math) + **swipe-to-close** for the mobile nav drawer.
- Details: drawer threshold min(40% width, 120px) with a motion-gated 240ms spring-back; `touch-action:pan-y` preserves native vertical scrolling; pointer capture is taken only at the **gesture-confirmation moment** — taps are never swallowed; entry animations play once per open session.
- Why it's good: tablets/phones go from "usable" to "good," with the project's own fix for a known W3C pointerevents defect.

---

## 4. Efficiency & Usability

**Claim: every frequent action has a fast path — a ⌘K command center, instant theme switching, and full keyboard operation.**

- **⌘K Command Center**: global ⌘K/Ctrl+K summons the command palette (a Northstar interaction): **quick navigation to every page destination + settings**, **instant language toggling**, fuzzy-search-to-target (`frontend/src/components/shared/CommandPalette.tsx`).
- **Fast theme & night-mode switching**: in Settings, 3 palette gradient swatches + light/dark modes (incl. follow-system) + a reduce-motion toggle — **applied instantly, globally, without a page reload**, preferences persisted (`frontend/src/pages/SettingsPage.tsx`).
- **Holistic keyboard reachability**: quizzes run fully on number keys 1–4 + Enter; the Roadmap roams on arrows; Esc closes the top layer globally; ⌘K navigates — a keyboard user can run the core study flow almost mouse-free.
- **One toast language**: sonner as the single toast pattern, with a fixed error-code → i18n copy → toast pipeline — no divergent error bubbles.

---

## 5. Experience-Polish Log (real reported issues → shipped fixes)

> This section shows how the product was polished after real use — every item came from the owner's own usage-report batches, all landed.

| Round | Improvement | Landed |
|---|---|---|
| Demo-prep round | **4 logout entry points** (sidebar footer / settings / page tail — logout always reachable); Dashboard pinned to sidebar top; entry copy polish | `72f818a` |
| Demo-prep round | JSON import hardening + state reset on plan switch; nav-history recorder fix | `23da756` |
| Owner issue batch (epic-24) | **GFM tables** in both pipelines (rendering + AI context); annotation **hover-to-remove** popover; claudette reading theme + settings toggle; Companion intent chips always visible + **quiz-me blocks** | PR #21 |
| Touch batch (epic-20) | Canvas pinch zoom with continuous anchoring + drawer swipe-close (fixing the pointerevents defect + entry-animation replay eating taps) | PR #22 |
| Performance batch (epic-19) | Route-level lazy loading, entry −29.5% — directly felt in first-load speed | PR #20 |
| Hub-tails batch (epic-18) | Materials hub server-side, mistake resolve lifecycle, generative AI suggestions on Today | PR #19 |

---

## 6. Perceivable Performance

- **Entry size −29.5%** (1,026 KB → 724 KB min; gzip −26.6%), with an 800 KB CI tripwire against regression — markedly faster first load.
- **Route-level code splitting**: reader/pdfjs downloads only when someone actually starts reading.
- **AI streaming**: SSE token-level typewriter — the first byte of a generated proposal/answer is visible immediately; no full-block waits.
- Instant feedback on safe operations: self-ratings/annotations/checkmarks persist immediately and survive refresh.

---

## 7. Known Gaps / Future Work (honest list)

- Queued: flashcard flip motion (spec'd), the roadmap drag-and-drop editor, AI proposal-quality lift.
- Known edges: no two-finger zoom in the PDF reading branch; drawer focus trap / background scroll lock pending; AI-gated surfaces not in e2e critical flows; ~1-minute free-tier cold start.

---

*Source index: `docs/demo-script.md` · `docs/design/ux-synapse/EXPERIENCE.md` · `frontend/src/features/{plans,reader,companion,quiz,flashcards,tasks}/` · `frontend/src/pages/` · `frontend/src/components/shared/CommandPalette.tsx` · epic status lines across `.scratch/phase-3/`.*
