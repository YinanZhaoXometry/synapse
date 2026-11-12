/**
 * /register (epic P2-8 T2; AD-15): create an account and land inside — same
 * wall contract as login (static surface, enum-mapped errors, deep-link
 * return). Client-side checks mirror the api's own rules (email shape,
 * password ≥ 8) so the humane copy fires without a round trip; the server
 * remains the authority (VALIDATION_FAILED maps to its own key).
 */
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useRegisterMutation } from "@/api";
import { getToken, setToken } from "@/apollo";
import { useLanguage } from "@/contexts/LanguageContext";
import { AuthShell, authErrorKey, useAuthReturnDestination, useSessionExitNotice, type AuthFieldErrors } from "./auth-shell";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [register, { loading: registering }] = useRegisterMutation();
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  useSessionExitNotice();
  const from = useAuthReturnDestination();

  // Same return-aware authed-redirect as LoginPage: Router 7's startTransition
  // navigations race the token-write render here too — /plans hard-coded would
  // swallow a deep-link ?next= (see LoginPage for the full race note).
  if (getToken()) return <Navigate to={from} replace />;

  const submit = (email: string, password: string) => {
    setError(null);
    const fields: AuthFieldErrors = {};
    if (!EMAIL_SHAPE.test(email)) fields.email = "auth.clientEmailInvalid";
    if (password.length < 8) fields.password = "auth.clientPasswordShort";
    setFieldErrors(fields);
    if (fields.email || fields.password) return;
    register({
      variables: { input: { email, password } },
      onCompleted: (data) => {
        setToken(data.register.token);
        toast.success(t("auth.registerSuccess"));
        navigate(from, { replace: true });
      },
      onError: (e) => setError(authErrorKey(e)),
    });
  };

  return (
    <AuthShell
      eyebrowKey="auth.eyebrow"
      titleKey="auth.registerTitle"
      submitLabelKey="auth.registerSubmit"
      busy={registering}
      fieldErrors={fieldErrors}
      error={error}
      onSubmit={submit}
      switchTo={{ to: "/login", labelKey: "auth.toLogin", hintKey: "auth.loginHint" }}
    >
      <p className="text-[11px] leading-[1.5] text-muted-foreground mt-3">{t("auth.passwordHint")}</p>
    </AuthShell>
  );
}
