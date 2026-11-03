/**
 * Task creation route /task/new (FR-37; UJ-6; AD-6/7/8): the second, lighter
 * door — one document in, straight into the Immersive Reader, no plan UI. The
 * flow is the spec's creation sequence: validate the upload through the SAME
 * seam as plan attach (the plans feature's public surface, PDF/Markdown ≤ 20 MB
 * inclusive) → register the Material parse-pending with session-only bytes
 * (AD-4; taskId null — the material cannot know the task yet) → createStudyTask
 * back-links the material and auto-creates its exactly-one KnowledgeNode titled
 * from the material (AD-6) → eager parse through the reader's public parse API
 * (AD-7) → navigate to the reader route. Parse failure never kills the task:
 * the reader's failed-card retry/re-upload is the recovery path. Rejection
 * reasons surface as bilingual sonner toasts (AD-9); every string is a
 * task-namespaced i18n key (zh/en parity) and every color a semantic token.
 */
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateTaskMutation, useRegisterMaterialMutation } from "@/data";
import { cn } from "@/lib/utils";
import { validateUpload, type UploadKind } from "@/features/plans";
import { useParseMaterialMutation } from "@/features/reader";
import { resolveTaskName } from "./task-name";

export default function TaskCreatePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const registerMaterial = useRegisterMaterialMutation();
  const createTask = useCreateTaskMutation();
  const parseMaterial = useParseMaterialMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<{ file: File; kind: UploadKind } | null>(null);
  const [name, setName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [creating, setCreating] = useState(false);

  const openPicker = () => fileInputRef.current?.click();

  const acceptFile = (candidate: File | undefined) => {
    if (!candidate) return;
    const verdict = validateUpload(candidate);
    if ("messageKey" in verdict) {
      toast.error(t(verdict.messageKey));
      return;
    }
    setChosen({ file: candidate, kind: verdict.kind });
    setName(verdict.title); // pre-fill from the filename (T1 AC)
  };

  const confirm = () => {
    if (!chosen || creating) return;
    setCreating(true);
    const { file, kind } = chosen;
    const title = resolveTaskName(name, file.name);
    // Register first with taskId null — createStudyTask then back-links the
    // material (material.taskId) and auto-creates the single node (AD-6).
    registerMaterial.mutate(
      {
        title,
        kind,
        sizeBytes: file.size,
        planId: null,
        taskId: null,
        blob: file, // session-only bytes (AD-4) — the eager parse needs them now
        sections: [],
        parseState: "pending",
      },
      {
        onError: () => setCreating(false),
        onSuccess: ({ material }) =>
          createTask.mutate(
            { materialId: material.id },
            {
              onError: () => setCreating(false),
              onSuccess: () => {
                // Eager parse (AD-7) kicks off before landing: the reader owns
                // the honest pending → parsing → parsed UI from here on.
                parseMaterial.mutate(material.id);
                navigate(`/read/${material.id}`);
              },
            },
          ),
      },
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-[720px] mx-auto">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.md,.markdown,application/pdf,text/markdown"
        className="hidden"
        onChange={(e) => {
          acceptFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => navigate("/plans")}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> {t("tasks.backToPlans")}
      </button>
      <p className="eyebrow mt-2">{t("tasks.eyebrow")}</p>
      <h1 className="page-title mt-1.5">{t("tasks.createTitle")}</h1>

      {!chosen ? (
        <button
          type="button"
          onClick={openPicker}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            acceptFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "w-full mt-6 rounded-2xl border-[1.5px] border-dashed px-4 py-10 text-center cursor-pointer transition-colors",
            dragOver
              ? "border-[var(--accent-ring)] bg-[var(--accent-tint-2)]"
              : "border-[var(--accent-edge)] bg-[var(--accent-tint)] hover:bg-[var(--accent-tint-2)]",
          )}
        >
          <Upload className="w-5 h-5 mx-auto text-accent-ink" aria-hidden="true" />
          <p className="text-sm font-semibold mt-2">{t("tasks.uploadCta")}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {dragOver ? t("tasks.dropActive") : t("tasks.uploadHint")}
          </p>
        </button>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="bg-card border border-border-soft rounded-2xl shadow-raised px-4 py-3 flex items-center gap-3">
            <FileText className="w-4 h-4 text-muted-foreground flex-none" aria-hidden="true" />
            <span className="text-sm truncate flex-1">{chosen.file.name}</span>
            <span className="text-[10px] text-muted-foreground tabular-nums flex-none">
              {t("tasks.sizeMb", { n: (chosen.file.size / 1e6).toFixed(1) })}
            </span>
            <button
              type="button"
              onClick={openPicker}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-ink cursor-pointer hover:underline flex-none"
            >
              <Upload className="w-3 h-3" aria-hidden="true" /> {t("tasks.rechoose")}
            </button>
          </div>
          <div>
            <label htmlFor="task-name" className="text-xs font-medium text-muted-foreground">
              {t("tasks.nameLabel")}
            </label>
            <Input id="task-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
          </div>
          <Button type="button" disabled={creating} onClick={confirm} className="w-full">
            {creating ? t("tasks.creating") : t("tasks.confirm")}
          </Button>
        </div>
      )}
    </div>
  );
}
