/**
 * The Settings account-surface hooks (epic-14 T1, FR-30 + FR-34's display
 * consequence): the password change (the stateless JWT survives — no token
 * seam touch, the caller keeps its credential), the whole-document data
 * export (an on-demand read → client-side Blob download, the delta-decision-1
 * posture — never cached, the document is only ever shipped whole), and the
 * honest AI-usage read (the live cap counter + the enforced daily limit).
 */
import { useQuery, useApolloClient, useMutation } from "@apollo/client/react";
import { toast } from "sonner";
import { AiUsageTodayDocument, ChangePasswordDocument, ExportDataDocument } from "@/types/graphql";
import { useLanguage } from "@/contexts/LanguageContext";

/** The password change (AD-15, delta decision 2): sessions survive by
 * design — the mutation returns the account, the token seam is untouched.
 * Raw tuple per the house convention: the Settings form owns the closed-enum
 * mapping (VALIDATION_FAILED → wrong-current, RATE_LIMITED → burst, else the
 * generic network fallback), so no hook-level onError competes with it. */
export function useChangePasswordMutation() {
  return useMutation(ChangePasswordDocument);
}

/** The AI usage read (FR-34): today's cap-counter count + the enforced
 * daily limit — server truth, rendered neutrally by the Settings row. */
export interface AiUsageTodayView {
  /** Provider calls counted today (midnight-UTC day key). */
  callsToday: number;
  /** The enforced daily cap (AI_DAILY_CALL_CAP, default 50). */
  dailyLimit: number;
}

export function useAiUsageTodayQuery() {
  const result = useQuery(AiUsageTodayDocument);
  const usage: AiUsageTodayView | undefined = result.data?.aiUsageToday
    ? {
        callsToday: result.data.aiUsageToday.callsToday,
        dailyLimit: result.data.aiUsageToday.dailyLimit,
      }
    : undefined;
  return { data: result.data !== undefined ? usage : undefined, loading: result.loading && !result.data, error: result.error };
}

/** The data export (AD-4/AD-15 round trip): one on-demand, never-cached read
 * of the whole document → a client-side Blob download named
 * synapse-export-<date>.json. The payload rides one JSON string (delta
 * decision 1) and is exactly what the first-login import accepts back. */
export function useExportDataDownload() {
  const client = useApolloClient();
  const { t } = useLanguage();

  const download = async (): Promise<boolean> => {
    try {
      const result = await client.query({
        query: ExportDataDocument,
        fetchPolicy: "no-cache",
      });
      const json = result.data?.exportData?.document;
      if (typeof json !== "string") {
        toast.error(t("settings.exportFailed"));
        return false;
      }

      // The date rides the LOCAL day (the file name is for the human, not
      // the machine — no UTC ceremony).
      const day = new Date();
      const stamp = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      const blob = new Blob([ json ], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `synapse-export-${stamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success(t("settings.exportDone"));
      return true;
    } catch {
      // Honest failure: nothing downloaded, the row stays available.
      toast.error(t("settings.exportFailed"));
      return false;
    }
  };

  return { download };
}
