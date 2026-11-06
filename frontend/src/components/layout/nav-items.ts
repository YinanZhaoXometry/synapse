import {
  Home, MessageSquare, BookOpen, HelpCircle,
  Layers, BookmarkMinus, CalendarCheck, Award, BarChart3,
  ListChecks,
  Settings,
} from "lucide-react";

// Flat nav: 10 items, settings stays a footer/rail destination. Shared by
// AppLayout + CommandPalette. Order is the FR-36 plan-first ordering (epic-7
// T3; the EXPERIENCE.md line-54 trigger fired when the FR-1 front door landed
// in epic-2): the front door (学习计划) leads, hub surfaces follow, the
// retained overview/progress destinations trail.
export const NAV_ROUTES = [
  // 学习计划 → Plans Home (AD-8 front door) — leads the sidebar per FR-36.
  { to: "/plans", labelKey: "nav.plans", icon: CalendarCheck },
  { to: "/ai-tutor", labelKey: "nav.tutor", icon: MessageSquare },
  { to: "/materials", labelKey: "nav.materials", icon: BookOpen },
  { to: "/mistakes", labelKey: "nav.mistakes", icon: BookmarkMinus },
  // 今日学习 → the FR-27 daily list (epic P2-09 T3). nav.planner was the old
  // demo page's avoided alias; the label rule now holds (zh 今日学习, en
  // Today) and the hub returned to the nav per nav-items' own recorded intent.
  { to: "/planner", labelKey: "nav.planner", icon: ListChecks },
  { to: "/flashcards", labelKey: "nav.flashcards", icon: Layers },
  { to: "/quiz", labelKey: "nav.quiz", icon: HelpCircle },
  { to: "/dashboard", labelKey: "nav.dashboard", icon: Home },
  { to: "/achievements", labelKey: "nav.achievements", icon: Award },
  { to: "/analytics", labelKey: "nav.analytics", icon: BarChart3 },
] as const;

export const SETTINGS_ROUTE = { to: "/settings", labelKey: "nav.settings", icon: Settings };

// Functional grouping — display order for the sidebar + drawer (the rail
// stays icon-only, no labels). Owner ruling 2026-11-06: 总览(仪表盘) leads
// the sidebar — this overrides the FR-36 plan-first display order (epic-7 T3)
// for the grouped surfaces; the flat order (NAV_ROUTES — rail, ⌘K palette,
// mobile nav source) keeps the FR-36 sequence. 练习 hubs follow FR-36's own
// listing (错题本 / 今日学习 / 闪卡 / 测验 — Today returned when FR-27
// landed, epic P2-09 T3) → 学习 → 进度.
export const NAV_GROUPS: ReadonlyArray<{ labelKey: string; items: ReadonlyArray<(typeof NAV_ROUTES)[number]> }> = [
  {
    labelKey: "nav.group.overview",
    items: [NAV_ROUTES[7]], // 仪表盘
  },
  {
    labelKey: "nav.group.learn",
    items: [NAV_ROUTES[0], NAV_ROUTES[1], NAV_ROUTES[2]], // 学习计划 / AI 导师 / 学习资料
  },
  {
    labelKey: "nav.group.practice",
    items: [NAV_ROUTES[3], NAV_ROUTES[4], NAV_ROUTES[5], NAV_ROUTES[6]], // 错题本 / 今日学习 / 闪卡 / 测验
  },
  {
    labelKey: "nav.group.progress",
    items: [NAV_ROUTES[8], NAV_ROUTES[9]], // 成就 / 数据分析
  },
];

export const flatNav = [...NAV_ROUTES, SETTINGS_ROUTE];

// Prototype BOTTOM_ROUTES
export const mobileNavPaths = ["/dashboard", "/ai-tutor", "/quiz", "/flashcards", "/achievements"];
