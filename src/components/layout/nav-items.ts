import {
  Home, MessageSquare, BookOpen, HelpCircle,
  Layers, BookmarkMinus, CalendarCheck, Award, BarChart3,
  Settings,
} from "lucide-react";

// Flat nav per prototype v2 (app.js NAV_ROUTES): 9 items, settings stays a
// footer/rail destination. Shared by AppLayout + CommandPalette.
export const NAV_ROUTES = [
  { to: "/dashboard", labelKey: "nav.dashboard", icon: Home },
  { to: "/ai-tutor", labelKey: "nav.tutor", icon: MessageSquare },
  { to: "/materials", labelKey: "nav.materials", icon: BookOpen },
  { to: "/quiz", labelKey: "nav.quiz", icon: HelpCircle },
  { to: "/flashcards", labelKey: "nav.flashcards", icon: Layers },
  { to: "/mistakes", labelKey: "nav.mistakes", icon: BookmarkMinus },
  { to: "/planner", labelKey: "nav.planner", icon: CalendarCheck },
  { to: "/achievements", labelKey: "nav.achievements", icon: Award },
  { to: "/analytics", labelKey: "nav.analytics", icon: BarChart3 },
] as const;

export const SETTINGS_ROUTE = { to: "/settings", labelKey: "nav.settings", icon: Settings };

// Functional grouping (restored from the original scaffold's navGroups — owner
// round 2026-11-02: the flat list lost it during the prototype port). Display
// order for the sidebar + drawer; the rail stays icon-only (no labels).
export const NAV_GROUPS: ReadonlyArray<{ labelKey: string; items: ReadonlyArray<(typeof NAV_ROUTES)[number]> }> = [
  {
    labelKey: "nav.group.overview",
    items: [NAV_ROUTES[0]], // 仪表盘
  },
  {
    labelKey: "nav.group.learn",
    items: [NAV_ROUTES[1], NAV_ROUTES[2], NAV_ROUTES[6]], // AI 导师 / 学习资料 / 学习计划
  },
  {
    labelKey: "nav.group.practice",
    items: [NAV_ROUTES[3], NAV_ROUTES[4], NAV_ROUTES[5]], // 测验 / 闪卡 / 错题本
  },
  {
    labelKey: "nav.group.progress",
    items: [NAV_ROUTES[7], NAV_ROUTES[8]], // 成就 / 数据分析
  },
];

export const flatNav = [...NAV_ROUTES, SETTINGS_ROUTE];

// Prototype BOTTOM_ROUTES
export const mobileNavPaths = ["/dashboard", "/ai-tutor", "/quiz", "/flashcards", "/achievements"];
