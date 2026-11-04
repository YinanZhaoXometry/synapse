/**
 * /login (epic P2-8 T2; AD-15): the wall's front door — email + password, the
 * demo-account entry affordance, and the deep-link return (the guard stores
 * where the learner was headed; a successful login resumes exactly there).
 * On success the token lands via the apollo seam and the app's own queries
 * refetch under it; the pre-login surface itself made no api reads (NFR-6).
 */
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLoginMutation } from "@/api";
import { getToken, setToken } from "@/apollo";
import { AuthShell, authErrorKey, type AuthFieldErrors } from "./auth-shell";

/** The demo seed's documented dev defaults (backend app/lib/demo_seed.rb) —
 * the demo entry affordance pre-fills them; the server may re-key via ENV. */
const DEMO_EMAIL = "demo@synapse.test";
const DEMO_PASSWORD = "demo-password";

export default function LoginPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [login, { loading: loggingIn }] = useLoginMutation();
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  // Already authed → the wall has nothing to say.
  if (getToken()) return <Navigate to="/plans" replace />;

  const from = (location.state as { from?: string } | null)?.from ?? "/plans";

  const submit = (email: string, password: string) => {
    setError(null);
    const fields: AuthFieldErrors = {};
    if (!email) fields.email = "auth.clientEmailRequired";
    if (!password) fields.password = "auth.clientPasswordRequired";
    setFieldErrors(fields);
    if (fields.email || fields.password) return;
    login({
      variables: { input: { email, password } },
      onCompleted: (data) => {
        setToken(data.login.token);
        navigate(from, { replace: true });
      },
      onError: (e) => setError(authErrorKey(e)),
    });
  };

  const demoEntry = () => {
    setError(null);
    setFieldErrors({});
    login({
      variables: { input: { email: DEMO_EMAIL, password: DEMO_PASSWORD } },
      onCompleted: (data) => {
        setToken(data.login.token);
        navigate(from, { replace: true });
      },
      onError: (e) => setError(authErrorKey(e)),
    });
  };

  return (
    <AuthShell
      eyebrowKey="auth.eyebrow"
      titleKey="auth.loginTitle"
      submitLabelKey="auth.loginSubmit"
      busy={loggingIn}
      fieldErrors={fieldErrors}
      error={error}
      onSubmit={submit}
      switchTo={{ to: "/register", labelKey: "auth.toRegister", hintKey: "auth.registerHint" }}
    >
      {/* The demo-account entry (ticket AC): one honest affordance, pre-seeded
          server-side — never a fake login. */}
      <button
        type="button"
        onClick={demoEntry}
        disabled={loggingIn}
        className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-[var(--glass-4)] px-4 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-[var(--glass-solid)] active:scale-[0.98] cursor-pointer disabled:opacity-60"
      >
        <Sparkles className="w-3.5 h-3.5 text-accent-ink" aria-hidden="true" />
        {loggingIn ? t("auth.submitting") : t("auth.demoEntry")}
      </button>
    </AuthShell>
  );
}

