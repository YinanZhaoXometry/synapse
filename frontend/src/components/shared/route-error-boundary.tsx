/**
 * The route-level error boundary (2026-11-10): ONE instance around the
 * AppLayout's <Outlet /> covers every in-shell page. The failure class it
 * exists for: a lazy route's dynamic import failing — the dev "Outdated
 * Optimize Dep" 504 when Vite's dep optimizer re-bundles mid-session (a
 * long-lived server discovering a dep only when a lazy route first imports
 * it), and the production stale-chunk 404 after a redeploy. React surfaces
 * both as an uncaught render error and the page white-screens; the boundary
 * classifies chunk-load failures into a "the page has an update — reload"
 * recovery card. ANY other render error gets the same card (the shell never
 * white-screens), with the raw message visible in dev only (the HMR overlay
 * is disabled — the terminal is otherwise the only trace). Keyed by pathname
 * at the mount site, so navigation resets it.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

// The three engines' phrasings for a failed lazy chunk (Chrome dev / Safari /
// Firefox), one pattern, case-insensitive.
const CHUNK_LOAD_PATTERN =
  /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module/i;

function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && CHUNK_LOAD_PATTERN.test(error.message);
}

interface CoreProps {
  children: ReactNode;
  resetKey: string;
}

interface CoreState {
  error: Error | null;
}

class RouteBoundaryCore extends Component<CoreProps, CoreState> {
  state: CoreState = { error: null };

  static getDerivedStateFromError(error: Error): CoreState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[route] page crashed:", error, info.componentStack);
  }

  componentDidUpdate(prevProps: CoreProps) {
    // Navigation resets the boundary — a crashed page must never brick the
    // next page (the remount key is the primary reset; this covers the
    // same-instance transition).
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    return this.state.error ? (
      <RouteRecoveryCard error={this.state.error} />
    ) : (
      this.props.children
    );
  }
}

function RouteRecoveryCard({ error }: { error: Error }) {
  const { t } = useLanguage();
  const chunk = isChunkLoadError(error);
  return (
    <div className="h-full min-h-[50vh] grid place-items-center p-6">
      <div
        data-testid="route-error-boundary"
        className="glass-panel rounded-2xl shadow-raised p-6 max-w-sm text-center space-y-3"
      >
        <span className="mx-auto w-10 h-10 rounded-full bg-primary/10 text-primary grid place-items-center">
          <RefreshCw className="w-5 h-5" aria-hidden="true" />
        </span>
        <p className="font-display font-semibold">
          {t(chunk ? "errors.routeUpdateTitle" : "errors.routeCrashed")}
        </p>
        <p className="text-sm text-muted-foreground leading-[1.55]">
          {t(chunk ? "errors.routeUpdateBody" : "errors.routeCrashedBody")}
        </p>
        {import.meta.env.DEV && !chunk && (
          <p className="text-[11px] text-left font-mono bg-card border border-border-soft rounded-lg p-2 text-muted-foreground break-all">
            {error.message}
          </p>
        )}
        <Button size="sm" data-testid="route-reload" onClick={() => window.location.reload()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
          {t("errors.routeReload")}
        </Button>
      </div>
    </div>
  );
}

export default function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <RouteBoundaryCore resetKey={location.pathname}>
      {children}
    </RouteBoundaryCore>
  );
}
