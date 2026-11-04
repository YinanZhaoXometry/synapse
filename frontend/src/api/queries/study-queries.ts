/**
 * Task + study-state query hooks (AD-18, epic P2-8 T1): tasks, reading
 * progress, the companion transcript's persistence half, and the server
 * streak. Names match the retired TanStack hooks one-for-one.
 */
import { useMutation, useQuery } from "@apollo/client/react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  AppendChatMessageDocument,
  ChatThreadDocument,
  CreateTaskDocument,
  MaterialsDocument,
  ReadingProgressDocument,
  ReadingProgressListDocument,
  SaveReadingProgressDocument,
  StreakDocument,
  TaskDocument,
  TasksDocument,
} from "@/types/graphql";
import { mapChatThread, mapNode, mapReadingProgress, mapTask } from "../mappers";
import type { ChatThread, ReadingProgress } from "@/domain/entities";
import type { KnowledgeNodeView } from "../views";

export function useTasksQuery() {
  const result = useQuery(TasksDocument);
  const tasks = (result.data?.tasks ?? []).map(mapTask);
  return { data: result.loading ? undefined : tasks, loading: result.loading, error: result.error, refetch: result.refetch };
}

export function useTaskQuery(taskId: string) {
  const result = useQuery(TaskDocument, { variables: { id: taskId }, skip: !taskId });
  const task = result.data?.task ? mapTask(result.data.task) : undefined;
  return { data: result.loading ? undefined : task, loading: result.loading, error: result.error, refetch: result.refetch };
}

/** The task's single owned node (AD-6) — read off the Task document, never re-derived. */
export function useTaskNodeQuery(taskId: string) {
  const result = useQuery(TaskDocument, { variables: { id: taskId }, skip: !taskId });
  const node: KnowledgeNodeView | undefined = result.data?.task ? mapNode(result.data.task.node) : undefined;
  return { data: result.loading ? undefined : node, loading: result.loading, error: result.error, refetch: result.refetch };
}

export function useCreateTaskMutation() {
  return useMutation(CreateTaskDocument, {
    // payload writes task + node; the list + the material's back-link need the sweep.
    refetchQueries: [TasksDocument, MaterialsDocument],
  });
}

export function useReadingProgressQuery(materialId: string) {
  const result = useQuery(ReadingProgressDocument, { variables: { materialId }, skip: !materialId });
  const progress = result.data?.readingProgress ? mapReadingProgress(result.data.readingProgress) : undefined;
  return { data: result.loading ? undefined : progress, loading: result.loading, error: result.error, refetch: result.refetch };
}

/** Every ReadingProgress across materials (Plans Home continue line, FR-25). */
export function useAllReadingProgressQuery() {
  const result = useQuery(ReadingProgressListDocument);
  const progress = (result.data?.readingProgressList ?? []).map(mapReadingProgress);
  return { data: result.loading ? undefined : progress, loading: result.loading, error: result.error, refetch: result.refetch };
}

export function useSaveReadingProgressMutation() {
  const { t } = useLanguage();
  const [mutate, result] = useMutation(SaveReadingProgressDocument, {
    // the row returns (normalized write); the cross-material list gains rows.
    refetchQueries: [ReadingProgressListDocument],
    onError: () => {
      // Never silent (UX error state): neutral, actionable — say it failed, ask
      // for a retry, never alarm.
      toast.error(t("errors.persistFailed"));
    },
  });
  return { mutate, result };
}

export function useChatThreadQuery(materialId: string) {
  const result = useQuery(ChatThreadDocument, { variables: { materialId }, skip: !materialId });
  const thread: ChatThread | undefined = result.data?.chatThread ? mapChatThread(result.data.chatThread) : undefined;
  return { data: result.loading ? undefined : thread, loading: result.loading, error: result.error, refetch: result.refetch };
}

export function useAppendChatMessageMutation() {
  const { t } = useLanguage();
  const [mutate, result] = useMutation(AppendChatMessageDocument, {
    // the message returns, but the thread's messages array needs the sweep.
    refetchQueries: [ChatThreadDocument],
    onError: () => {
      // Same neutral persistence-failure toast — the transcript itself stays
      // honest (use-companion-chat's persistence rule).
      toast.error(t("errors.persistFailed"));
    },
  });
  return { mutate, result };
}

/** The evidence-day streak (FR-25) — computed by the api (AD-14). */
export function useStreakQuery() {
  const result = useQuery(StreakDocument);
  const streak = result.data?.streak ?? 0;
  return { data: result.loading ? undefined : streak, loading: result.loading, error: result.error, refetch: result.refetch };
}
