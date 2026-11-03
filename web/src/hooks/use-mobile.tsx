import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

/**
 * The reader's responsive ladder (UX responsive rows; T6): ≥1024px desktop
 * (Companion docked), 768–1023px tablet (right overlay), <768px mobile (bottom
 * sheet). Same matchMedia pattern as useIsMobile, extended to the ladder's two
 * edges; the initial compute runs in useLayoutEffect so the first paint already
 * knows the tier. Before that effect lands the hook reads as desktop — the
 * desktop dock is CSS-gated anyway, so a phone never flashes it (the floating
 * layers render only on a resolved tablet/mobile tier).
 */
export type ViewportTier = "desktop" | "tablet" | "mobile";

const DESKTOP_MIN = 1024;

export function useViewportTier(): ViewportTier {
  const [tier, setTier] = React.useState<ViewportTier | undefined>(undefined);

  React.useLayoutEffect(() => {
    const compute = () =>
      setTier(
        window.innerWidth >= DESKTOP_MIN
          ? "desktop"
          : window.innerWidth >= MOBILE_BREAKPOINT
            ? "tablet"
            : "mobile",
      );
    // The two ladder edges are the only change points; either firing recomputes.
    const edges = [
      window.matchMedia(`(min-width: ${DESKTOP_MIN}px)`),
      window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT}px)`),
    ];
    for (const mql of edges) mql.addEventListener("change", compute);
    compute();
    return () => {
      for (const mql of edges) mql.removeEventListener("change", compute);
    };
  }, []);

  return tier ?? "desktop";
}
