/**
 * The chrome's session identity (epic-25 T3): ONE derivation every identity
 * render site shares — the sidebar footers' name line, the account-menu
 * avatar letter (UserMenuButton, all three placements), and the Settings
 * profile row. The display name is the email's local-part
 * ("demo@synapse.test" → "demo"); the avatar letter is its first grapheme,
 * uppercased ("demo" → "D").
 *
 * The honesty rule (ticket AC4): while the me read loads (or errors) a
 * placeholder identity renders — the 学/S avatar letter per language and an
 * EMPTY name line — never a wrong identity. The scaffold's hardcoded
 * "Yinan Chen" died here; nothing fake renders even for a frame.
 */
import { useLanguage } from "@/contexts/LanguageContext";
import { useMeQuery } from "@/api";

/** The email's display local-part: everything before the "@". A malformed
 * address (no "@", or an empty local-part) degrades to the placeholder path
 * by returning undefined — the chrome never renders a broken identity. */
export function emailLocalPart(email: string): string | undefined {
  const at = email.indexOf("@");
  const local = at === -1 ? undefined : email.slice(0, at);
  return local || undefined;
}

/** The avatar letter: the local-part's first grapheme, uppercased. */
export function identityLetter(localPart: string): string {
  return (Array.from(localPart)[0] ?? "").toUpperCase();
}

export interface SessionIdentity {
  /** The session email, once the me read lands (Settings profile row). */
  email: string | undefined;
  /** The display name — the email's local-part. Undefined until the read
   * lands (the name line renders nothing rather than a wrong name). */
  name: string | undefined;
  /** The avatar letter — the identity letter once landed, else the 学/S
   * placeholder (per language) while loading or on error. */
  letter: string;
}

export function useSessionIdentity(): SessionIdentity {
  const { language } = useLanguage();
  const me = useMeQuery();
  const localPart = me.data !== undefined ? emailLocalPart(me.data) : undefined;
  return {
    email: me.data,
    name: localPart,
    letter: localPart ? identityLetter(localPart) : language === "zh" ? "学" : "S",
  };
}
