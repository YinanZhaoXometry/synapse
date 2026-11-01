import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LearningModeProvider } from "@/contexts/LearningModeContext";
import { UserProgressProvider } from "@/contexts/UserProgressContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import AppLayout from "@/components/layout/AppLayout";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <LearningModeProvider>
          <UserProgressProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<OnboardingPage />} />
                <Route element={<AppLayout />}>
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
        </LearningModeProvider>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
