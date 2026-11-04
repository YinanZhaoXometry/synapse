import { ApolloProvider } from "@apollo/client/react";
import { BrowserRouter, Route, Routes, Navigate, Outlet, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProgressProvider } from "@/contexts/UserProgressContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { apolloClient, isLoggedIn } from "@/apollo";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import { PLANS_HOME_ROUTE, resolveEntryDestination } from "@/features/plans/entry-decision";
import PlansHomePage from "@/features/plans/PlansHomePage";
import PlanCreatePage from "@/features/plans/PlanCreatePage";
import PlanHomePage from "@/features/plans/PlanHomePage";
import PlanQuizPage from "@/pages/PlanQuizPage";
import PlanFlashcardsPage from "@/pages/PlanFlashcardsPage";
import TaskQuizPage from "@/pages/TaskQuizPage";
import TaskFlashcardsPage from "@/pages/TaskFlashcardsPage";
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

// The reader route is lazy (AD-8): pdfjs-dist loads only when someone reads.
const ReaderPage = lazy(() => import("@/features/reader/ReaderPage"));
// The task routes are lazy too (same rule — they pull the reader's parse API).
const TaskCreatePage = lazy(() => import("@/features/tasks/TaskCreatePage"));
const TaskHomePage = lazy(() => import("@/features/tasks/TaskHomePage"));

/**
 * Front-door guard (AD-8, reshaped by ticket 02's login wall): a token sends
 * the root to Plans Home (the creation chat is the front door's primary
 * surface); no token lands on /login — the wall owns the first visit now.
 */
function EntryGate() {
  const destination = resolveEntryDestination(true);
  if (destination === "plans") return <Navigate to={isLoggedIn() ? PLANS_HOME_ROUTE : "/login"} replace />;
  return <Navigate to="/login" replace />;
}

/**
 * The route guard (AD-15, ticket 02): unauthenticated users bounce to /login
 * with their destination carried in router state, so a successful login
 * resumes the exact deep link. The wall pages themselves stay outside this
 * wrapper — the pre-login surface makes no api reads (NFR-6).
 */
export function RequireAuth() {
  const location = useLocation();
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

const App = () => (
  <ApolloProvider client={apolloClient}>
    <TooltipProvider>
      <LanguageProvider>
        <ThemeProvider>
          <UserProgressProvider>
            <Toaster />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<EntryGate />} />
                {/* the wall (AD-15): standalone static screens, outside the shell */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route element={<RequireAuth />}>
                <Route element={<AppLayout />}>
                  <Route path="/plans" element={<PlansHomePage />} />
                  <Route path="/onboarding" element={<OnboardingPage />} />
                  <Route path="/plan/new" element={<PlanCreatePage />} />
                  <Route path="/plan/:id" element={<PlanHomePage />} />
                  {/* The plan-flow quiz session page (epic-6 T2; AD-8) — the
                      session id rides in the URL so a reload resumes. */}
                  <Route path="/plan/:id/quiz" element={<PlanQuizPage />} />
                  {/* The plan-flow flashcards study page (epic-6 T3; AD-8) —
                      deliberately stateless across reloads: ratings persist
                      per card as they happen, a refresh restarts the queue. */}
                  <Route path="/plan/:id/flashcards" element={<PlanFlashcardsPage />} />
                  <Route
                    path="/task/new"
                    element={
                      <Suspense fallback={null}>
                        <TaskCreatePage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/task/:id"
                    element={
                      <Suspense fallback={null}>
                        <TaskHomePage />
                      </Suspense>
                    }
                  />
                  {/* The task-flow quiz session page (epic-6 T4; AD-8) — the
                      plan twin's contract scoped to the task's single material
                      and its auto-owned node (AD-6: planId null, taskId set). */}
                  <Route path="/task/:id/quiz" element={<TaskQuizPage />} />
                  {/* The task-flow flashcards study page (epic-6 T4; AD-8) —
                      the plan twin's contract over the task's single deck. */}
                  <Route path="/task/:id/flashcards" element={<TaskFlashcardsPage />} />
                  <Route
                    path="/read/:materialId"
                    element={
                      <Suspense fallback={null}>
                        <ReaderPage />
                      </Suspense>
                    }
                  />
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
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
            </UserProgressProvider>
        </ThemeProvider>
      </LanguageProvider>
    </TooltipProvider>
  </ApolloProvider>
);

export default App;
