import { Link, useLocation } from "react-router-dom";
import { usePlansQuery } from "@/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

/**
 * The sidebar's plan records (epic-33 T1, DeepTutor records-in-nav pattern):
 * the 学习 group's fixed links gain the user's recent plans as rows, so the
 * sidebar stops being a pure page list and a session stops costing the
 * "Plans Home → card" two-hop tax. Rows come from usePlansQuery
 * (cache-first); the mastery chip renders the SERVER rollup verbatim —
 * rendered, never recomputed (AD-14). Absent entirely at zero plans or while
 * loading (no empty stub, the fixed links never wait); the Companion child
 * rows from the ticket's Q2 are parked — the schema carries no cheap
 * has-companion-activity signal, and the decision caps the ticket at trivial
 * (rows-only ships).
 */

const RECENT_PLAN_CAP = 6;

export default function SidebarPlanTree({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useLanguage();
  const location = useLocation();
  const plansQuery = usePlansQuery();
  const plans = plansQuery.data;
  // Honest-empty: loading or zero plans renders nothing — the group keeps
  // exactly its fixed links, never a skeleton or an empty section.
  if (!plans || plans.length === 0) return null;
  const recent = [...plans]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, RECENT_PLAN_CAP);

  const subRowClass = (isActive: boolean) =>
    cn(
      // Sub-row of the 学习 group's entries: indented, one height step below
      // the h-10 nav rows but the SAME type — 14px medium (T03: aligned to
      // the main nav's text after the owner round).
      "group flex h-9 items-center gap-2 rounded-lg pl-6 pr-2.5 text-sm font-medium transition-all duration-150",
      isActive
        ? "bg-[var(--glass-4)] text-foreground shadow-soft"
        : "text-muted-foreground hover:text-foreground hover:bg-[var(--glass-2)]"
    );

  return (
    <div className="pt-1">
      {/* Regular small label, deliberately NOT the group headings' 9px
          uppercase eyebrow — this names records, not a nav region. */}
      <p className="px-2.5 pb-1 text-xs font-medium text-muted-foreground">
        {t("nav.plansRecent")}
      </p>
      <div className="space-y-0.5">
        {recent.map((plan) => {
          const to = `/plan/${plan.id}`;
          // Exact match + the plan flow's nested quiz/flashcards routes —
          // never a bare startsWith (uuid prefix collision).
          const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`);
          return (
            <Link
              key={plan.id}
              to={to}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              title={plan.topic}
              className={subRowClass(isActive)}
            >
              <span className="min-w-0 flex-1 truncate">{plan.topic}</span>
              {/* Bare accent number — no chip background (T03). The server
                  rollup verbatim, AD-14. */}
              <span
                className="ml-auto flex-none text-[11px] font-semibold tabular-nums text-accent-ink"
                aria-label={t("nav.planMastery", { n: plan.masteryScore })}
              >
                {plan.masteryScore}%
              </span>
            </Link>
          );
        })}
        <Link
          to="/plans"
          onClick={onNavigate}
          aria-current={location.pathname === "/plans" ? "page" : undefined}
          className={cn(subRowClass(location.pathname === "/plans"), "text-muted-foreground")}
        >
          {t("nav.plansViewAll")}
        </Link>
      </div>
    </div>
  );
}
