/**
 * The creation chat surface (FR-1; Q4; epic-27 rework): ONE free-form message
 * plus optional material attachments (≤ 5, the upload-validation rules) stream
 * the Companion's plan-structure proposal live — tailored to the message and
 * the attached materials' client-extracted text (parsing stays client-side,
 * AD-7) — resolve into a stage-grouped structure card, and confirm into a real
 * persisted plan whose staged files attach through the standard upload flow
 * (never re-uploaded). Shared by the Plans-Home empty state and the /plan/new
 * route; confirming always lands on that plan's Plan Home.
 */
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Paperclip, RotateCcw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import ChatMarkdown from "@/components/shared/chat-markdown";
import { CopyButton } from "@/components/shared/copy-button";
import { useCreatePlanMutation, newClientUuid } from "@/api";
import { useMaterialUpload } from "@/api/queries/material-queries";
import { useParseMaterialMutation } from "@/features/reader";
import type { ProposalMaterial } from "@/ai/types";
import { isPptxUpload, validateUpload } from "./upload-validation";
import { cn } from "@/lib/utils";
import { proposalNodeKey, toPlanCreateInput } from "./creation-mapping";
import { useCreationChat } from "./use-creation-chat";

const STREAM_DISPLAY_CAP = 900;
/** The creation-time attachment cap (epic-27 — payload sanity; FR-2's union
 * stays open for post-creation attaches). */
const MAX_CREATION_MATERIALS = 5;
/** The command's per-material text bound (mirrored client-side so a huge file
 * is sliced before it ever rides the ticket). */
const MAX_MATERIAL_TEXT_CHARS = 20_000;

/** One staged attachment: the file (for the confirm-time upload) + its row identity. */
interface StagedFile {
  file: File;
  title: string;
  kind: "pdf" | "markdown";
}

/** A parse failure that carries its own i18n key (the honest refusal). */
class MaterialError extends Error {
  constructor(public readonly messageKey: string) {
    super(messageKey);
  }
}

/** The file's bytes: `arrayBuffer` where the host has it (every real
 * browser), the FileReader fallback where it doesn't (jsdom's File). */
async function fileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === "function") return new Uint8Array(await file.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsArrayBuffer(file);
  });
}

/** Extract each staged file's text through the client parse pipeline (AD-7)
 * and bound it to the command's per-material cap. Empty extraction and parse
 * failures refuse with their bilingual keys (the parse pipeline's own reason
 * map) — never a silently empty input. */
async function extractMaterials(staged: StagedFile[], language: "zh" | "en"): Promise<ProposalMaterial[]> {
  const { parseFile, PARSE_REASON_MESSAGE_KEY } = await import("@/features/reader/parse");
  const out: ProposalMaterial[] = [];
  for (const item of staged) {
    let text = "";
    try {
      const bytes = await fileBytes(item.file);
      const outcome = await parseFile({ bytes, kind: item.kind, language });
      if (outcome.state === "failed") {
        throw new MaterialError(PARSE_REASON_MESSAGE_KEY[outcome.reason ?? "unknown"]);
      }
      text = outcome.sections.map((section) => section.text).join("\n\n").slice(0, MAX_MATERIAL_TEXT_CHARS);
    } catch (error) {
      if (error instanceof MaterialError) throw error;
      throw new MaterialError("errors.parseUnknown");
    }
    if (text.trim().length === 0) throw new MaterialError("errors.parseEmpty");
    out.push({ title: item.title, kind: item.kind, text });
  }
  return out;
}

export default function CreationChat() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const chat = useCreationChat(language);
  const [createPlan, { loading: planCreating }] = useCreatePlanMutation();
  const upload = useMaterialUpload();
  const parseMaterial = useParseMaterialMutation();

  const [messageDraft, setMessageDraft] = useState("");
  // The staged attachments survive the send (the confirm-time attach needs
  // the FILES, not just the extracted text) — the ref is the truth, the chips
  // are the view; sending clears the chips, confirming consumes the ref.
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const stagedRef = useRef<StagedFile[]>([]);
  const [reading, setReading] = useState(false);
  const [attaching, setAttaching] = useState(false);
  // Epic P2-11 T1 (FR-38): the plan's starting visibility, chosen at the
  // confirm step (default private — the Square opt-in needs the same
  // structure-only disclosure as the plan-home flip).
  const [createVisibility, setCreateVisibility] = useState<"private" | "public">("private");
  // Renames are keyed by the node's proposal-wide order index (proposalNodeKey),
  // never by title — duplicate titles in one draft must rename independently.
  const [renames, setRenames] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stageFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const accepted: StagedFile[] = [];
    for (const file of Array.from(files)) {
      if (staged.length + accepted.length >= MAX_CREATION_MATERIALS) {
        toast.error(t("plans.materialCap", { n: MAX_CREATION_MATERIALS }));
        break;
      }
      const verdict = validateUpload(file);
      if ("messageKey" in verdict) {
        toast.error(t(verdict.messageKey));
        continue;
      }
      // epic-13 T5: a pptx rides the markdown pipeline — the text-only
      // limitation stated once, at stage time (the attach flows' rule).
      if (isPptxUpload(file)) toast.info(t("reader.pptxTextOnlyNote"));
      accepted.push({ file, title: verdict.title, kind: verdict.kind });
    }
    if (accepted.length > 0) {
      const next = [...staged, ...accepted];
      setStaged(next);
      stagedRef.current = next;
    }
  };

  const unstage = (index: number) => {
    const next = staged.filter((_, i) => i !== index);
    setStaged(next);
    stagedRef.current = next;
  };

  const submit = async () => {
    const message = messageDraft.trim();
    // Files-only rounds are honest inputs (2026-11-10): the message may ride
    // empty when at least one staged material carries the turn.
    if ((!message && staged.length === 0) || chat.phase === "streaming" || reading) return;
    setReading(true);
    try {
      const materials = await extractMaterials(staged, language);
      stagedRef.current = staged;
      chat.send(message, materials);
      setMessageDraft("");
      setStaged([]);
    } catch (error) {
      const key = error instanceof MaterialError ? error.messageKey : "errors.parseUnknown";
      toast.error(t(key));
    } finally {
      setReading(false);
    }
  };

  const commitRename = (key: string, original: string) => {
    const next = renameDraft.trim();
    setRenames((r) => {
      const updated = { ...r };
      if (next && next !== original) updated[key] = next;
      else delete updated[key];
      return updated;
    });
    setEditingKey(null);
    setRenameDraft("");
  };

  const regenerate = () => {
    setRenames({});
    setEditingKey(null);
    chat.regenerate();
  };

  const confirm = () => {
    if (!chat.proposal || planCreating || attaching) return;
    const input = toPlanCreateInput(chat.proposal, renames);
    const files = stagedRef.current;
    createPlan({
      variables: {
        input: {
          // AD-12: the client-supplied uuid is the create's idempotency key.
          clientUuid: newClientUuid(),
          topic: input.topic,
          goal: input.goal,
          // FR-38 (epic P2-11 T1): the create-step visibility choice — the
          // api defaults private; the choice is always sent explicitly.
          visibility: createVisibility,
          // epic-16 (FR-5): nodes carry their client-minted ids + metadata;
          // the proposal's title pairs ride as id pairs (unresolvable pairs
          // already dropped at the flatten seam — invalid ones the server
          // drops silently; neither ever blocks the create).
          nodes: input.nodes,
          edges: input.edges,
        },
      },
      onCompleted: async (data) => {
        // Attach-on-confirm (epic-27): the staged files ride the standard
        // attach → presign PUT → eager-parse flow against the REAL plan —
        // they are never re-uploaded. A per-file failure toasts but never
        // blocks landing (the plan exists; re-attach is the normal flow).
        const planId = data.createPlan.plan.id;
        stagedRef.current = [];
        if (files.length > 0) {
          setAttaching(true);
          const results = await Promise.allSettled(
            files.map(async (item) => {
              const material = await upload.attach({ file: item.file, title: item.title, kind: item.kind, planId, taskId: null });
              await parseMaterial.mutate(material.id, material);
            }),
          );
          setAttaching(false);
          if (results.some((result) => result.status === "rejected")) {
            toast.error(t("plans.attachFailed"));
          }
        }
        chat.reset();
        setRenames({});
        setCreateVisibility("private");
        // epic-28 T2: plan landing used to be silent — the key-path toast.
        toast.success(t("plans.createSuccess"));
        navigate(`/plan/${planId}`);
      },
      onError: () => toast.error(t("plans.createError")),
    });
  };

  const suggestions = ["plans.suggestExam", "plans.suggestInterview", "plans.suggestMl"] as const;

  // Proposal nodes in the same enumeration order toPlanCreateInput uses, so the
  // rename keys here match the keys the mapper reads (stage-then-node order).
  let runningIndex = 0;
  const stageEntries = (chat.proposal?.stages ?? []).map((s) => ({
    name: s.name,
    entries: s.nodes.map((node) => ({ title: node.title, key: proposalNodeKey(runningIndex++) })),
  }));

  const inputDisabled = chat.phase === "streaming" || reading;

  return (
    <div className="glass-panel rounded-2xl shadow-raised p-5 mt-4">
      <div className="flex items-start gap-3">
        <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-items-center flex-none">
          <Sparkles className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0 space-y-3">
          {chat.messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "group relative max-w-[85%] text-[13px] leading-[1.55] rounded-2xl px-3.5 py-2",
                m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-card border border-border-soft",
              )}
            >
              {m.role === "user" ? (
                // Files-only rounds carry an empty text — the materials-only
                // placeholder stands in (the chips themselves cleared on send).
                <span className="whitespace-pre-wrap">
                  {m.text || t("plans.sentMaterialsOnly", { n: m.materialCount ?? 0 })}
                </span>
              ) : (
                <ChatMarkdown text={m.text} />
              )}
              <CopyButton
                text={m.text}
                testId={`chat-copy-creation-${m.role}`}
                className={cn(
                  "absolute -top-3 z-10 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity",
                  m.role === "user" ? "left-0" : "right-0",
                )}
              />
            </div>
          ))}

          {chat.phase === "streaming" && (
            <div className="max-w-[85%] text-[13px] leading-[1.6] bg-card border border-border-soft rounded-2xl px-3.5 py-2">
              <ChatMarkdown
                text={
                  chat.streamText.length > STREAM_DISPLAY_CAP
                    ? `${chat.streamText.slice(0, STREAM_DISPLAY_CAP)}…`
                    : chat.streamText
                }
              />
              <span className="animate-pulse">▋</span>
            </div>
          )}

          {chat.phase === "proposed" && chat.proposal && (
            <div className="bg-card border border-border-soft rounded-2xl p-4 max-w-[95%]">
              <p className="eyebrow">{t("plans.draftLabel")}</p>
              {stageEntries.map((stage) => (
                <div key={stage.name} className="mt-3">
                  <p className="text-xs font-bold text-accent-ink">{stage.name}</p>
                  <div className="mt-1 space-y-1">
                    {stage.entries.map((entry) =>
                      editingKey === entry.key ? (
                        <input
                          key={entry.key}
                          autoFocus
                          value={renameDraft}
                          aria-label={t("plans.renameAria")}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onBlur={() => commitRename(entry.key, entry.title)}
                          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                          className="w-full text-sm bg-transparent border-b border-ring outline-none"
                        />
                      ) : (
                        <button
                          key={entry.key}
                          type="button"
                          onClick={() => {
                            setEditingKey(entry.key);
                            setRenameDraft(renames[entry.key] ?? entry.title);
                          }}
                          className="block w-full text-left text-sm px-2 py-1 rounded-lg hover:bg-[var(--glass-2)] cursor-pointer"
                        >
                          {renames[entry.key] ?? entry.title}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              ))}
              {/* Epic P2-11 T1 (FR-38): the create-step visibility choice —
                  the disclosure rides along, whichever way the user picks. */}
              <div className="mt-4 border-t border-border-soft pt-3">
                <p className="text-[11px] text-muted-foreground">{t("visibility.createLabel")}</p>
                <div className="flex items-center gap-1.5 mt-1.5" role="radiogroup" aria-label={t("visibility.createLabel")}>
                  {(["private", "public"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={createVisibility === value}
                      data-testid={`create-visibility-${value}`}
                      onClick={() => setCreateVisibility(value)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[11px] border transition-colors cursor-pointer",
                        createVisibility === value
                          ? "border-[color:var(--accent-edge)] bg-[var(--accent-tint)] text-accent-ink"
                          : "border-border-soft text-muted-foreground hover:bg-[var(--glass-2)]",
                      )}
                    >
                      {t(value === "private" ? "visibility.chipPrivate" : "visibility.chipPublic")}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-[1.5]">{t("visibility.disclosure")}</p>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button size="sm" onClick={confirm} disabled={planCreating || attaching}>
                  {attaching ? t("plans.attaching") : planCreating ? t("plans.creating") : t("plans.confirmCreate")}
                </Button>
                <Button size="sm" variant="ghost" onClick={regenerate} disabled={planCreating || attaching}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> {t("plans.regenerate")}
                </Button>
              </div>
            </div>
          )}

          {chat.phase === "idle" && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMessageDraft((current) => (current ? `${current} ${t(key)}` : t(key)))}
                  className="px-2.5 py-1 rounded-full text-[11px] border border-border-soft text-muted-foreground hover:bg-[var(--glass-2)] cursor-pointer"
                >
                  {t(key)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {/* The staged attachments (chips): removable until send; the confirm
            attaches them to the real plan. */}
        {staged.length > 0 && (
          <div className="flex flex-wrap gap-1.5" data-testid="creation-staged-files">
            {staged.map((item, i) => (
              <span
                key={`${item.title}-${i}`}
                className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-card px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                <Paperclip className="w-3 h-3" aria-hidden="true" />
                {item.title}
                <button
                  type="button"
                  aria-label={t("plans.removeMaterialAria", { title: item.title })}
                  data-testid={`creation-unstage-${i}`}
                  onClick={() => unstage(i)}
                  className="rounded-full p-0.5 hover:bg-[var(--glass-2)] text-muted-foreground hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}
        <textarea
          value={messageDraft}
          onChange={(e) => setMessageDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          disabled={inputDisabled}
          rows={3}
          placeholder={t("plans.messagePlaceholder")}
          aria-label={t("plans.messagePlaceholder")}
          className="w-full resize-y rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm leading-[1.55] placeholder:text-caption-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.md,.markdown,.pptx"
          className="hidden"
          aria-hidden="true"
          onChange={(e) => {
            stageFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={inputDisabled}
            aria-label={t("plans.attachAria")}
          >
            <Paperclip className="w-3.5 h-3.5 mr-1" /> {t("plans.attach")}
          </Button>
          <Button
            className="ml-auto"
            onClick={() => void submit()}
            disabled={(!messageDraft.trim() && staged.length === 0) || inputDisabled}
          >
            {reading ? t("plans.readingMaterials") : t("plans.send")}
          </Button>
        </div>
      </div>
    </div>
  );
}
