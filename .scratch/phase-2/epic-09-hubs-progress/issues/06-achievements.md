# 06: Achievements — real badge unlocks (FR-28)

**What to build:** `/achievements` renders real unlock states from the read model's badge computation (scaffold's 12-badge taxonomy: quizzes/streaks/flashcards/materials/progress; thresholds per T1's recorded decisions); unlock moments surface once (toast/celebration within existing animation vocabulary); points/level display stays read-only garnish — nothing new builds on it.

**Blocked by:** 1.

**Status:** done (2026-11-05 — branch `epic/p2-09-t06-achievements`; gates: backend untouched / vitest 647 / codegen-fresh + tsc + eslint + build green; two-axis review pending)

**Bound by:** FR-28 (taxonomy reference, no new points mechanics — stance binding), AD-9 (never-color-only states, reduced-motion collapse for celebrations).

- [x] All 12 badges compute on factory evidence; boundary triggers tested
- [x] Unlock surfacing respects reduced-motion + both themes
- [x] Points/level untouched beyond read-only display; `UserProgressContext` deletion completes here with grep-guard

## Comments

Implementation landed 2026-11-05 (frontend only — backend needed nothing: T1's `badgeState`
already carried everything).

**/achievements (FR-28):** the page renders the 12 badges straight off `useBadgeStatesQuery` —
unlocked/locked/counter/threshold are server fields, rendering never recomputes (AD-14); rows
sort into the scaffold's taxonomy order client-side (a rendering concern). Per badge: the shared
emoji face, the scaffold `ach.b*` name + description, honest progress `{done} / {target}` from the
wire counter/threshold (capped at the threshold when the counter overshoots — 9/1 reads absurd,
1/1 is the truth), and a never-color-only state (AD-9): distinct Check/Lock glyph + state word,
both in the card's aria label. Header keeps the scaffold ring (unlocked/12, static SVG —
reduce-motion holds trivially) + two stat cards: the SERVER streak (`useStreakQuery`, the T3
precedent) and the badge count.

**Points/level disposition — dropped.** UserType carries id/email/createdAt only; no points or
level exists on the wire, so per the ticket's "prefer dropping" rule the demo stats died with the
context and nothing replaced them. The demo `ACHIEVEMENTS` fixture, `Badge` interface,
`DEFAULT_PROGRESS`, `DEFAULT_MASTERY` (+ its topics, the context's imports) and the now-consumerless
`fmtNum` all retired from demo-data (T2–T5 comment convention); MaterialsPage's demo materials are
the only demo-data consumers left (their own ticket).

**Unlock surfacing — honest v1, session-only.** `lib/badges.ts` keeps a SESSION-scoped seen-set in
module memory: the first badgeState read of a session is the baseline (already-unlocked badges
never celebrate), each later read celebrates ids that JUST transitioned locked→unlocked — exactly
once, surviving route unmounts/remounts; a reload re-baselines silently. No server unlock-moment
table exists (T1 computes on read), so a persistent once-ever surface is recorded out of scope —
if it lands, it needs that table, not localStorage. The celebration is a sonner success toast
carrying the `animate-confetti` vocabulary (the animation class existed unused since the scaffold
import); under the motion pref it collapses to a plain toast (AD-9), and the global
`body.reduce-motion` class kills CSS animation regardless.

**`UserProgressContext` DELETED (A1 completion).** The provider wiring left `App.tsx`; the reads
left `AppLayout.tsx` (the mobile streak pill re-pointed onto the server read, rendered only once
the read lands — no 0-flash; the sidebar-footer/drawer level·points line dropped — nothing real on
the wire) and `SettingsPage.tsx` (profile meta line dropped; the reset probe's `resetAll()` call
removed — the reset flow's cutover semantics never needed it client-side, and resetTick's last
consumer retired with T3). `frontend/src/contexts/UserProgressContext.tsx` is gone.

**Grep-guard (the deletion's pin):** lives in `frontend/src/test/architecture.guard.test.ts` — the
P2-8 grep-guard precedent, same wiring (a vitest that walks src/**/*.{ts,tsx} in `vitest run`, so
just spec + ci.yml's web job both run it; it skips its own file). Three new rules forbid the
context in its three EFFECTIVE forms: the module path `@/contexts/UserProgressContext` (every
import/mock must carry it), the hook call `useUserProgress(`, and the `UserProgressProvider` name.
Bare-word matching was rejected deliberately — it would false-positive the residue assertions in
the page tests (regex literals naming the very names they forbid). A self-proof test plants all
four reference shapes and asserts each rule catches at least one while a clean import matches
none; the red-phase run additionally proved the rules on real violations (the then-existing file +
four consumers all tripped them).

**i18n — descriptions re-pointed onto the restated thresholds (delta decision 1, zh+en):** b1
进行你的第一次测验 / Take your first quiz (a session IS a quiz taken); b4 collection semantics
闪卡集里集齐 10 张闪卡 / Have 10 flashcards across your decks (no review-event tracking exists);
b6 在错题节点上累计作答 5 次 / Answer 5 times on mistake nodes (复盘 restated — no reviewed flag);
b7/b8/b9 generalized tiers 掌握 1/3/5 个节点 / Master 1/3/5 nodes (names renamed too — the
scaffold's subject-specific 驾驭设计/需求侦探/测试通关 titles no longer describe their badges;
en names followed for parity); b10 单日完成 3 次测验 / 3 quiz sessions in one day (SM-C3 — the
old 60-minute string was minutes, exactly what SM-C3 forbids; the name 专注一小时 → 专注一日 /
Focus hour → Focus day). b2/b3/b5/b11/b12 already matched and are pinned by test. `ach.subtitle`
dropped its 演示/demo claim; `ach.progress` repurposed to `{done} / {target}`; new keys
`ach.unlockedCount` / `ach.loadFailed` / `ach.retry` / `ach.unlockedToastTitle`. Retired keys:
`ach.level`, `common.pointsUnit`, `common.levelUnit`, `settings.profileMeta`;
`settings.profileNote` reworded to the cutover truth (account + study data live on the server).

Tests: 17 new AchievementsPage tests (12-from-wire, state glyphs+text, progress counters incl.
the cap, ring percent, server streak, honest-empty loading, retry banner, celebration
once/baseline/remount/reduced-motion/confetti-vocab, shared-emoji source assertions, demo residue
absence in page + demo-data, i18n parity + pinned restated strings) + the guard self-proof.
Settings reset tests rewritten (probe half retired — nothing client-side holds study state to
re-seed; prefs/token/legacy-document halves unchanged). DashboardPage residue assertions kept
valid. Suite 629 → 647.
- **Two-axis review (2026-11-05, inline):** PASS/PASS — badges render server fields only (AD-14), never-color-only (glyph+word+aria); celebration session-local + baselined (honest, no invented unlock table); guard forbids the three effective reference shapes with a self-proof test (red-proven on real violations); points/level dropped everywhere (nothing real on the wire); the 2 remaining name mentions are retirement comments, not references. A1 COMPLETE. Merged on `epic/p2-09-hubs`.
