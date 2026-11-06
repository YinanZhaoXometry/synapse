import { ApolloProvider } from "@apollo/client/react";
import { BrowserRouter, Route, Routes, Navigate, Outlet, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { apolloClient, isLoggedIn } from "@/apollo";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import AppLayout from "@/components/layout/AppLayout";
import NotFound from "@/pages/NotFound";
import { PLANS_HOME_ROUTE, resolveEntryDestination } from "@/features/plans/entry-decision";

// Route-level code splitting (epic-19 T1): every in-shell route is lazy on the
// ONE uniform idiom — `React.lazy(() => import(...))` at the declaration site,
// an inline `<Suspense fallback={null}>` at the route element (the reader/task
// trio's precedent, kept byte-identical). The wall (`/`, `/login`, `/register`,
// NotFound) and the shell (AppLayout) stay eager: pre-login pages make no api
// reads and the shell sits on every in-shell route (AD-15/AD-20, decisions 2–3).
const PlansHomePage = lazy(() => import("@/features/plans/PlansHomePage"));
const PlanCreatePage = lazy(() => import("@/features/plans/PlanCreatePage"));
const PlanHomePage = lazy(() => import("@/features/plans/PlanHomePage"));
const SquarePlanPage = lazy(() => import("@/features/plans/SquarePlanPage"));
const PlanQuizPage = lazy(() => import("@/pages/PlanQuizPage"));
const PlanFlashcardsPage = lazy(() => import("@/pages/PlanFlashcardsPage"));
const TaskQuizPage = lazy(() => import("@/pages/TaskQuizPage"));
const TaskFlashcardsPage = lazy(() => import("@/pages/TaskFlashcardsPage"));
const OnboardingPage = lazy(() => import("@/pages/OnboardingPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const AITutorPage = lazy(() => import("@/pages/AITutorPage"));
const MaterialsPage = lazy(() => import("@/pages/MaterialsPage"));
const QuizPage = lazy(() => import("@/pages/QuizPage"));
const FlashcardsPage = lazy(() => import("@/pages/FlashcardsPage"));
const MistakesPage = lazy(() => import("@/pages/MistakesPage"));
const PlannerPage = lazy(() => import("@/pages/PlannerPage"));
const AchievementsPage = lazy(() => import("@/pages/AchievementsPage"));
const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));

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
          <Toaster />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<EntryGate />} />
              {/* the wall (AD-15): standalone static screens, outside the shell */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route
                  path="/plans"
                  element={
                    <Suspense fallback={null}>
                      <PlansHomePage />
                    </Suspense>
                  }
                />
                {/* The Square preview (epic P2-11 T3, delta decision 3): the
                    广场 card's addressable route — structure-only public
                    render + the adopt CTA; lives inside the shell. */}
                <Route
                  path="/square/:planId"
                  element={
                    <Suspense fallback={null}>
                      <SquarePlanPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/onboarding"
                  element={
                    <Suspense fallback={null}>
                      <OnboardingPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/plan/new"
                  element={
                    <Suspense fallback={null}>
                      <PlanCreatePage />
                    </Suspense>
                  }
                />
                <Route
                  path="/plan/:id"
                  element={
                    <Suspense fallback={null}>
                      <PlanHomePage />
                    </Suspense>
                  }
                />
                {/* The plan-flow quiz session page (epic-6 T2; AD-8) — the
                    session id rides in the URL so a reload resumes. */}
                <Route
                  path="/plan/:id/quiz"
                  element={
                    <Suspense fallback={null}>
                      <PlanQuizPage />
                    </Suspense>
                  }
                />
                {/* The plan-flow flashcards study page (epic-6 T3; AD-8) —
                    deliberately stateless across reloads: ratings persist
                    per card as they happen, a refresh restarts the queue. */}
                <Route
                  path="/plan/:id/flashcards"
                  element={
                    <Suspense fallback={null}>
                      <PlanFlashcardsPage />
                    </Suspense>
                  }
                />
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
                {/* The task-flow quiz session page (epic-6 T4; AD-8) —
                    the plan twin's contract scoped to the task's single material
                    and its auto-owned node (AD-6: planId null, taskId set). */}
                <Route
                  path="/task/:id/quiz"
                  element={
                    <Suspense fallback={null}>
                      <TaskQuizPage />
                    </Suspense>
                  }
                />
                {/* The task-flow flashcards study page (epic-6 T4; AD-8) —
                    the plan twin's contract over the task's single deck. */}
                <Route
                  path="/task/:id/flashcards"
                  element={
                    <Suspense fallback={null}>
                      <TaskFlashcardsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/read/:materialId"
                  element={
                    <Suspense fallback={null}>
                      <ReaderPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <Suspense fallback={null}>
                      <DashboardPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/ai-tutor"
                  element={
                    <Suspense fallback={null}>
                      <AITutorPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/materials"
                  element={
                    <Suspense fallback={null}>
                      <MaterialsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/quiz"
                  element={
                    <Suspense fallback={null}>
                      <QuizPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/flashcards"
                  element={
                    <Suspense fallback={null}>
                      <FlashcardsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/mistakes"
                  element={
                    <Suspense fallback={null}>
                      <MistakesPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/planner"
                  element={
                    <Suspense fallback={null}>
                      <PlannerPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/achievements"
                  element={
                    <Suspense fallback={null}>
                      <AchievementsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/analytics"
                  element={
                    <Suspense fallback={null}>
                      <AnalyticsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <Suspense fallback={null}>
                      <SettingsPage />
                    </Suspense>
                  }
                />
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ThemeProvider>
      </LanguageProvider>
    </TooltipProvider>
  </ApolloProvider>
);

export default App;
