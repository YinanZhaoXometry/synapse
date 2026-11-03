import {
  Home, MessageSquare, BookOpen, HelpCircle,
  Layers, BookmarkMinus, CalendarCheck, Award, BarChart3,
  Settings,
} from "lucide-react";

// Flat nav: 9 items, settings stays a footer/rail destination. Shared by
// AppLayout + CommandPalette. Order is the FR-36 plan-first ordering (epic-7
// T3; the EXPERIENCE.md line-54 trigger fired when the FR-1 front door landed
// in epic-2): the front door (学习计划) leads, hub surfaces follow, the
// retained overview/progress destinations trail.
export const NAV_ROUTES = [
  // 学习计划 → Plans Home (AD-8 front door) — leads the sidebar per FR-36.
  // nav.planner ("Planner") is the old demo page's avoided alias; /planner
  // stays reachable by URL only and returns to the nav when FR-27 lands.
  { to: "/plans", labelKey: "nav.plans", icon: CalendarCheck },
  { to: "/ai-tutor", labelKey: "nav.tutor", icon: MessageSquare },
  { to: "/materials", labelKey: "nav.materials", icon: BookOpen },
  { to: "/mistakes", labelKey: "nav.mistakes", icon: BookmarkMinus },
  { to: "/flashcards", labelKey: "nav.flashcards", icon: Layers },
  { to: "/quiz", labelKey: "nav.quiz", icon: HelpCircle },
  { to: "/dashboard", labelKey: "nav.dashboard", icon: Home },
  { to: "/achievements", labelKey: "nav.achievements", icon: Award },
  { to: "/analytics", labelKey: "nav.analytics", icon: BarChart3 },
] as const;

export const SETTINGS_ROUTE = { to: "/settings", labelKey: "nav.settings", icon: Settings };

// Functional grouping — display order for the sidebar + drawer (the rail
// stays icon-only, no labels). Plan-first per FR-36 (epic-7 T3): 学习 with
// the front door first → 练习 hubs (FR-36's own listing minus Today, which
// has no Phase-1 route) → 总览 → 进度.
export const NAV_GROUPS: ReadonlyArray<{ labelKey: string; items: ReadonlyArray<(typeof NAV_ROUTES)[number]> }> = [
  {
    labelKey: "nav.group.learn",
    items: [NAV_ROUTES[0], NAV_ROUTES[1], NAV_ROUTES[2]], // 学习计划 / AI 导师 / 学习资料
  },
  {
    labelKey: "nav.group.practice",
    items: [NAV_ROUTES[3], NAV_ROUTES[4], NAV_ROUTES[5]], // 错题本 / 闪卡 / 测验
  },
  {
    labelKey: "nav.group.overview",
    items: [NAV_ROUTES[6]], // 仪表盘
  },
  {
    labelKey: "nav.group.progress",
    items: [NAV_ROUTES[7], NAV_ROUTES[8]], // 成就 / 数据分析
  },
];

export const flatNav = [...NAV_ROUTES, SETTINGS_ROUTE];

// Prototype BOTTOM_ROUTES
export const mobileNavPaths = ["/dashboard", "/ai-tutor", "/quiz", "/flashcards", "/achievements"];
