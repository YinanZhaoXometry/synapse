import {
  LayoutDashboard, MessageSquare, BookOpen, HelpCircle,
  Brain, NotebookPen, CalendarDays, Trophy, BarChart3,
  Settings,
} from "lucide-react";

// Single source of truth for the retained 10-page IA (FR-25/26/28/36/46),
// shared by AppLayout (sidebar/rail/bottom-nav) and CommandPalette.
export const navGroups = [
  {
    labelKey: "nav.group.overview",
    items: [{ to: "/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard" }],
  },
  {
    labelKey: "nav.group.learn",
    items: [
      { to: "/ai-tutor", icon: MessageSquare, labelKey: "nav.aiTutor" },
      { to: "/materials", icon: BookOpen, labelKey: "nav.materials" },
      { to: "/planner", icon: CalendarDays, labelKey: "nav.planner" },
    ],
  },
  {
    labelKey: "nav.group.practice",
    items: [
      { to: "/quiz", icon: HelpCircle, labelKey: "nav.quiz" },
      { to: "/flashcards", icon: Brain, labelKey: "nav.flashcards" },
      { to: "/mistakes", icon: NotebookPen, labelKey: "nav.mistakes" },
    ],
  },
  {
    labelKey: "nav.group.progress",
    items: [
      { to: "/achievements", icon: Trophy, labelKey: "nav.achievements" },
      { to: "/analytics", icon: BarChart3, labelKey: "nav.analytics" },
    ],
  },
  {
    labelKey: null,
    items: [{ to: "/settings", icon: Settings, labelKey: "nav.settings" }],
  },
];

export const flatNav = navGroups.flatMap(g => g.items);

export const mobileNavPaths = ["/dashboard", "/ai-tutor", "/quiz", "/flashcards", "/achievements"];
