import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProgressProvider } from "@/contexts/UserProgressContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { isOnboardingComplete } from "@/data";
import { PLANS_HOME_ROUTE, resolveEntryDestination } from "@/features/plans/entry-decision";
import PlansHomePage from "@/features/plans/PlansHomePage";
import PlanCreatePage from "@/features/plans/PlanCreatePage";
import PlanHomePage from "@/features/plans/PlanHomePage";
import AppLayout from "@/components/layout/AppLayout";
import PrototypeFinalSystemPage from "@/pages/PrototypeFinalSystemPage";
import OnboardingPage from "@/pages/OnboardingPage";
import DashboardPage from "@/pages/DashboardPage";
import AITutorPage from "@/pages/AITutorPage";
import MaterialsPage from "@/pages/MaterialsPage";
import QuizPage from "@/pages/QuizPage";
import FlashcardsPage from "@/pages/FlashcardsPage";
import MistakesPage from "@/pages/MistakesPage";
import PlannerPage from "@/pages/PlannerPage";
import AchievementsPage from "@/pages/AchievementsPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

/**
 * Front-door guard (AD-8): first run renders the onboarding wizard at `/`,
 * every later visit redirects to Plans Home. The flag read is synchronous —
 * the decision lands before first paint, so a returning user never glimpses
 * the wizard behind a pending query cache.
 */
function EntryGate() {
  const destination = resolveEntryDestination(isOnboardingComplete());
  if (destination === "plans") return <Navigate to={PLANS_HOME_ROUTE} replace />;
  return <OnboardingPage />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <ThemeProvider>
          <UserProgressProvider>
            <Toaster />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<EntryGate />} />
                <Route element={<AppLayout />}>
                  {/* PROTOTYPE (throwaway): final-system walkthrough, /prototype/final-system?scene=… */}
                  <Route path="/prototype/final-system" element={<PrototypeFinalSystemPage />} />
                  <Route path="/plans" element={<PlansHomePage />} />
                  <Route path="/plan/new" element={<PlanCreatePage />} />
                  <Route path="/plan/:id" element={<PlanHomePage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/ai-tutor" element={<AITutorPage />} />
                  <Route path="/materials" element={<MaterialsPage />} />
                  <Route path="/quiz" element={<QuizPage />} />
                  <Route path="/flashcards" element={<FlashcardsPage />} />
                  <Route path="/mistakes" element={<MistakesPage />} />
                  <Route path="/planner" element={<PlannerPage />} />
                  <Route path="/achievements" element={<AchievementsPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
            </UserProgressProvider>
        </ThemeProvider>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
