import { useState } from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { apiErrorCode, useImportDocumentMutation, useMaterialUpload } from "@/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { markImportOfferDone, shouldOfferImport } from "@/lib/import-offer";
import { readLocalDocument, toImportDocumentInput } from "@/lib/local-document";

/**
 * The first-login import offer (epic P2-8 T3, AD-15/AD-20): a one-time
 * bilingual dialog on Plans Home when the legacy local document
 * holds data. Import runs the WHOLE document as ONE mutation — the doc's own
 * uuids are the idempotency keys, so a retry is always safe; success marks
 * the done marker (the offer never re-shows) and sweeps the queries (the
 * hook's refetchQueries). A failure is honest: the error renders, the offer
 * stays, the local document is never touched (the rollback substrate).
 * Success then offers the re-attach invite: imported materials carry no
 * bytes — each can take its original file back through the epic-06 presign
 * flow (refreshBytes, matched by id); skipped PDFs render text-only.
 */
export default function ImportOfferDialog() {
  const { t } = useLanguage();
  const [importDocumentMutation, { loading: importing }] = useImportDocumentMutation();
  const { refreshBytes } = useMaterialUpload();
  const [open, setOpen] = useState(() => shouldOfferImport());
  const [doc] = useState(() => readLocalDocument());
  const [step, setStep] = useState<"offer" | "reattach">("offer");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [attachState, setAttachState] = useState<Record<string, "busy" | "done" | "failed">>({});

  if (!open || doc === null) return null;

  const runImport = () => {
    setErrorKey(null);
    importDocumentMutation({
      variables: { input: { document: toImportDocumentInput(doc) } },
      onCompleted: (data) => {
        markImportOfferDone();
        toast.success(
          t("import.successToast", {
            imported: data.importDocument?.imported ?? 0,
            skipped: data.importDocument?.skipped ?? 0,
          }),
        );
        setStep("reattach");
      },
      onError: (error) => {
        const code = apiErrorCode(error);
        setErrorKey(
          code === "VALIDATION_FAILED"
            ? "import.failedValidation"
            : code === "UNAUTHORIZED"
              ? "import.failedSession"
              : "import.failedGeneric",
        );
      },
    });
  };

  const notNow = () => {
    // the one-time decision, spent either way — but the document itself is
    // never deleted or renamed (AD-20's rollback substrate).
    markImportOfferDone();
    setOpen(false);
  };

  const reattach = async (materialId: string, file: File | undefined) => {
    if (!file) return;
    setAttachState((prev) => ({ ...prev, [materialId]: "busy" }));
    try {
      await refreshBytes(materialId, file);
      setAttachState((prev) => ({ ...prev, [materialId]: "done" }));
    } catch {
      // honest failure: the row stays byteless (the reader renders it
      // text-only) and the invite stays available for another try.
      setAttachState((prev) => ({ ...prev, [materialId]: "failed" }));
      toast.error(t("import.reattachFailed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg rounded-2xl border border-border-soft bg-card max-h-[85vh] overflow-y-auto">
        {step === "offer" ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-lg">{t("import.offerTitle")}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground leading-[1.6]">{t("import.offerBody")}</p>
            {errorKey && <p className="text-sm font-medium text-destructive leading-[1.5]">{t(errorKey)}</p>}
            <div className="flex flex-wrap justify-end gap-2 mt-1">
              <Button variant="outline" onClick={notNow}>
                {t("import.notNow")}
              </Button>
              <Button onClick={runImport} disabled={importing}>
                {importing ? t("import.importing") : t("import.importAction")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-lg">{t("import.reattachTitle")}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground leading-[1.6]">{t("import.reattachBody")}</p>
            <div className="space-y-2">
              {(doc.materials ?? []).map((material) => (
                <div
                  key={material.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border-soft bg-[var(--glass-4)] px-3 py-2.5"
                >
                  <FileUp className="w-4 h-4 text-accent-ink flex-none" aria-hidden="true" />
                  <span className="text-sm font-semibold truncate flex-1 min-w-[140px]" title={material.title}>
                    {material.title}
                  </span>
                  {attachState[material.id] === "done" ? (
                    <span className="text-xs font-semibold text-accent-ink">{t("import.reattached")}</span>
                  ) : (
                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-ink cursor-pointer hover:underline">
                      <input
                        type="file"
                        className="sr-only"
                        accept={material.kind === "pdf" ? "application/pdf" : ".md,.markdown,text/markdown,text/plain"}
                        onChange={(e) => reattach(material.id, e.target.files?.[0])}
                      />
                      {attachState[material.id] === "busy" ? t("import.reattaching") : t("import.reattachAction")}
                    </label>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-1">
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t("import.reattachDone")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
