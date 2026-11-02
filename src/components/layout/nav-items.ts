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
];

export const SETTINGS_ROUTE = { to: "/settings", labelKey: "nav.settings", icon: Settings };

export const flatNav = [...NAV_ROUTES, SETTINGS_ROUTE];

// Prototype BOTTOM_ROUTES
export const mobileNavPaths = ["/dashboard", "/ai-tutor", "/quiz", "/flashcards", "/achievements"];
