/**
 * The login wall's shared shell (epic P2-8 T2; AD-9/AD-15): a centered glass
 * card on the app gradient — the pre-login surface stays fully static
 * (NFR-6): no api reads, only semantic tokens, both themes, both languages.
 * Error display rides the closed api enum (code → t() key, never the message).
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CircleAlert } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { sanitizeReturnPath } from "@/apollo/session";
import { apiErrorCode, isNetworkError, type ApiErrorCode } from "@/api/errors";
import type { ErrorLike } from "@apollo/client";

export interface AuthFieldErrors {
  email?: string;
  password?: string;
}

/** The closed enum → the humane bilingual key (ticket AC: shown humanely). */
export function authErrorKey(error: ErrorLike | undefined): string {
  const code: ApiErrorCode | null = apiErrorCode(error);
  if (code === "UNAUTHORIZED") return "auth.invalidCredentials";
  if (code === "RATE_LIMITED") return "auth.rateLimited";
  if (code === "VALIDATION_FAILED") return "auth.validationFailed";
  if (isNetworkError(error)) return "auth.networkFailed";
  return "auth.networkFailed";
}

/**
 * Where a successful auth lands (epic-28 T1): the guard's deep-link state
 * (`state.from`, test-pinned) wins, then the session-exit redirect's
 * sanitized `?next=`, then the plans home. Non-same-origin nexts are refused
 * by sanitizeReturnPath — the wall never bounces off-origin.
 */
export function useAuthReturnDestination(): string {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  return (
    (location.state as { from?: string } | null)?.from ??
    sanitizeReturnPath(searchParams.get("next")) ??
    "/plans"
  );
}

/**
 * The wall's "why am I here" toast (epic-28 T1): the session-exit redirect
 * tags its URL with the reason (`expired=1` after the errorLink's teardown,
 * `out=1` after sign-out); the wall surfaces it once on mount. The pinned
 * deep-link path (state.from) carries no flag — silent, as before.
 */
export function useSessionExitNotice(): void {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("expired") === "1") toast(t("errors.sessionExpired"));
    else if (searchParams.get("out") === "1") toast(t("auth.signedOut"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once notice: the flags come from the session-exit redirect, never from in-wall navigation
  }, []);
}

const PRIMARY_CTA =
  "w-full inline-flex items-center justify-center rounded-xl bg-gradient-hero text-white shadow-brand px-4 py-2.5 text-sm font-semibold transition-all " +
  "hover:shadow-brand-hover hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed";

const FIELD =
  "w-full rounded-xl border border-border bg-[var(--glass-4)] px-3.5 py-2.5 text-sm font-medium placeholder:text-caption focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AuthShell({
  eyebrowKey,
  titleKey,
  submitLabelKey,
  busy,
  fieldErrors,
  error,
  onSubmit,
  switchTo,
  children,
}: {
  eyebrowKey: string;
  titleKey: string;
  submitLabelKey: string;
  busy: boolean;
  fieldErrors: AuthFieldErrors;
  error: string | null;
  onSubmit: (email: string, password: string) => void;
  switchTo: { to: "/register" | "/login"; labelKey: string; hintKey: string };
  children?: ReactNode;
}) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-[400px]">
        <div className="glass-panel rounded-2xl shadow-raised p-7">
          <p className="eyebrow text-center">{t(eyebrowKey)}</p>
          <h1 className="font-display font-semibold text-[26px] text-center leading-[1.2] tracking-[-0.02em] mt-1">
            {t(titleKey)}
          </h1>

          {/* noValidate: THIS form owns validation — the humane bilingual copy
              (AD-9) must run, never the browser's English-only native bubbles,
              which would also block the submit before our checks fire. */}
          <form
            noValidate
            className="mt-6 flex flex-col gap-3.5"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit(email.trim(), password);
            }}
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">{t("auth.emailLabel")}</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={FIELD}
                aria-invalid={fieldErrors.email ? true : undefined}
              />
              {fieldErrors.email && <span className="text-[11px] text-danger-ink">{t(fieldErrors.email)}</span>}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">{t("auth.passwordLabel")}</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={FIELD}
                aria-invalid={fieldErrors.password ? true : undefined}
              />
              {fieldErrors.password && <span className="text-[11px] text-danger-ink">{t(fieldErrors.password)}</span>}
            </label>

            {error && (
              <p className="flex items-start gap-1.5 rounded-xl border border-border-soft tint-danger px-3 py-2 text-xs leading-[1.5]" role="alert">
                <CircleAlert className="w-3.5 h-3.5 mt-[1px] flex-none" aria-hidden="true" />
                {t(error)}
              </p>
            )}

            <button type="submit" className={PRIMARY_CTA} disabled={busy}>
              {busy ? t("auth.submitting") : t(submitLabelKey)}
            </button>
          </form>

          {children}

          <p className="text-xs text-muted-foreground text-center mt-5">
            {t(switchTo.hintKey)}{" "}
            <Link to={switchTo.to} className="font-semibold text-accent-ink hover:underline">
              {t(switchTo.labelKey)}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
