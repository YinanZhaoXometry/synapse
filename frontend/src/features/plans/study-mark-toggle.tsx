/**
 * The Study Mark toggle row (FR-47, epic-28 T4): the three self-declared
 * statuses as compact pills — the ONE seam both the hover chips (row 1) and
 * the detail sheet render. Clicking an inactive status sets it; clicking the
 * ACTIVE one clears the mark (revocation).
 *
 * The mutation rides optimisticResponse (instant chip feedback): the paint
 * carries EVERY field the document selects (the use-parse-material lesson —
 * a partial paint dies on Apollo's "Missing field" cache write), read from
 * the normalized cache and overridden with the next mark. A wire failure
 * clears the optimistic layer, rolling the chip back honestly.
 *
 * ORTHOGONALITY (ADR-0002): this component writes study_mark and nothing
 * else — no mastery field is read, rendered, or computed here.
 */
import { useApolloClient, useMutation } from "@apollo/client/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSetStudyMarkMutation } from "@/api";
import type { StudyMark } from "@/api/views";
import { KnowledgeNodePartsFragmentDoc, type NodeStudyMarkSetMutation } from "@/types/graphql";
import { cn } from "@/lib/utils";

const MARKS: { value: StudyMark; labelKey: string; colorVar: string }[] = [
  { value: "learning", labelKey: "plans.markLearning", colorVar: "var(--roadmap-mark-learning)" },
  { value: "finished", labelKey: "plans.markFinished", colorVar: "var(--roadmap-mark-finished)" },
  { value: "skipped", labelKey: "plans.markSkipped", colorVar: "var(--roadmap-mark-skipped)" },
];

export default function StudyMarkToggleRow({
  nodeId,
  mark,
  compact = false,
}: {
  nodeId: string;
  /** The node's current mark (server truth from the plan read). */
  mark: StudyMark | null;
  /** Compact chips (the hover strip) vs the sheet's roomier pills. */
  compact?: boolean;
}) {
  const { t } = useLanguage();
  const client = useApolloClient();
  const [setMark, { loading }] = useSetStudyMarkMutation();

  const toggle = (value: StudyMark) => {
    const next: StudyMark | null = mark === value ? null : value;
    // The optimistic paint: the cached node with only the mark moved. No
    // cached node (plan read still in flight) — fire the mutation bare; the
    // response lands the truth when it arrives.
    const cached = client.cache.readFragment({
      id: client.cache.identify({ __typename: "KnowledgeNode", id: nodeId }),
      fragment: KnowledgeNodePartsFragmentDoc,
    });
    const optimistic = cached
      ? ({
          nodeStudyMarkSet: {
            __typename: "NodeStudyMarkSetPayload",
            node: { ...cached, __typename: "KnowledgeNode", studyMark: next },
          },
        } as unknown as NodeStudyMarkSetMutation)
      : undefined;
    void setMark({
      variables: { input: { nodeId, mark: next } },
      ...(optimistic ? { optimisticResponse: optimistic } : {}),
    });
  };

  return (
    <div
      role="group"
      aria-label={t("plans.markGroupAria")}
      data-testid="study-mark-toggle"
      className={cn("inline-flex items-center gap-1", loading && "opacity-70")}
    >
      {MARKS.map(({ value, labelKey, colorVar }) => {
        const active = mark === value;
        return (
          <button
            key={value}
            type="button"
            data-testid={`study-mark-${value}`}
            data-active={active ? "true" : "false"}
            aria-pressed={active}
            onClick={() => toggle(value)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border font-medium cursor-pointer whitespace-nowrap transition-colors",
              compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
              active ? "font-semibold" : "bg-background hover:bg-accent/40",
            )}
            style={
              active
                ? { borderColor: colorVar, color: colorVar }
                : { borderColor: "hsl(var(--border-soft))", color: "hsl(var(--muted-foreground))" }
            }
          >
            <i className="inline-block h-1.5 w-1.5 flex-none rounded-full" style={{ background: colorVar }} aria-hidden="true" />
            {t(labelKey)}
          </button>
        );
      })}
    </div>
  );
}
