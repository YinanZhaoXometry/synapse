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
  DeleteTaskDocument,
  MaterialsDocument,
  PlanChatThreadDocument,
  PlansDocument,
  PromoteTaskToPlanDocument,
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
  return { data: result.data !== undefined ? tasks : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}

export function useTaskQuery(taskId: string) {
  const result = useQuery(TaskDocument, { variables: { id: taskId }, skip: !taskId });
  const task = result.data?.task ? mapTask(result.data.task) : undefined;
  return { data: result.data !== undefined ? task : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}

/** The task's single owned node (AD-6) — read off the Task document, never re-derived. */
export function useTaskNodeQuery(taskId: string) {
  const result = useQuery(TaskDocument, { variables: { id: taskId }, skip: !taskId });
  const node: KnowledgeNodeView | undefined = result.data?.task ? mapNode(result.data.task.node) : undefined;
  return { data: result.data !== undefined ? node : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}

export function useCreateTaskMutation() {
  return useMutation(CreateTaskDocument, {
    // payload writes task + node; the list + the material's back-link need the sweep.
    refetchQueries: [TasksDocument, MaterialsDocument],
  });
}

/**
 * Delete a study task (epic-28 T4): the server cascade removes the task,
 * its material + auto-node, and every dependent row — sweep the surfaces
 * that aggregated across tasks (the task list, the materials library, the
 * reading-progress list) and evict the task entity so nothing dead lingers.
 * Success/failure toasts live at the call sites (the destructive-confirm
 * flows own their copy).
 */
export function useDeleteTaskMutation() {
  return useMutation(DeleteTaskDocument, {
    refetchQueries: [TasksDocument, MaterialsDocument, ReadingProgressListDocument],
    update(cache, { data }) {
      const deletedTaskId = data?.deleteTask.deletedTaskId;
      if (deletedTaskId) {
        cache.evict({ id: cache.identify({ __typename: "StudyTask", id: deletedTaskId }) });
        cache.gc();
      }
    },
  });
}

/**
 * Promote a task into a plan (FR-37 stretch, epic-14 T2): the created plan
 * returns in the payload — the caller navigates to it. The plans-list
 * read-back sweep makes the new plan appear in 我要学 (Plans Home); the
 * task list re-reads so other surfaces see the pointer state.
 */
export function usePromoteTaskToPlanMutation() {
  const { t } = useLanguage();
  const [mutate, result] = useMutation(PromoteTaskToPlanDocument, {
    refetchQueries: [PlansDocument, TasksDocument],
    onError: () => {
      // Same neutral persistence-failure posture: say it failed, ask for a
      // retry — never alarm, never silent.
      toast.error(t("tasks.promoteFailed"));
    },
  });
  return { mutate, loading: result.loading };
}

export function useReadingProgressQuery(materialId: string) {
  const result = useQuery(ReadingProgressDocument, { variables: { materialId }, skip: !materialId });
  const progress = result.data?.readingProgress ? mapReadingProgress(result.data.readingProgress) : undefined;
  return { data: result.data !== undefined ? progress : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}

/** Every ReadingProgress across materials (Plans Home continue line, FR-25). */
export function useAllReadingProgressQuery() {
  const result = useQuery(ReadingProgressListDocument);
  const progress = (result.data?.readingProgressList ?? []).map(mapReadingProgress);
  return { data: result.data !== undefined ? progress : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
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
  return { data: result.data !== undefined ? thread : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}

/**
 * The plan scope's thread read (epic-25 T2): the tutor page's transcript,
 * hydrated once per plan by use-plan-companion-chat. The material read above
 * stays frozen — this rides T1's NEW planChatThread field.
 */
export function usePlanChatThreadQuery(planId: string) {
  const result = useQuery(PlanChatThreadDocument, { variables: { planId }, skip: !planId });
  const thread: ChatThread | undefined = result.data?.planChatThread ? mapChatThread(result.data.planChatThread) : undefined;
  return { data: result.data !== undefined ? thread : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
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

/**
 * The plan-scoped append (epic-25 T2): the SAME mutation document as the
 * material append (AppendMessageInput takes materialId OR planId — exactly
 * one; call sites pass planId), but the refetch sweep re-reads the PLAN
 * thread, never the material one.
 */
export function useAppendPlanChatMessageMutation() {
  const { t } = useLanguage();
  const [mutate, result] = useMutation(AppendChatMessageDocument, {
    // the message returns, but the plan thread's messages array needs the sweep.
    refetchQueries: [PlanChatThreadDocument],
    onError: () => {
      // Same neutral persistence-failure toast — the transcript itself stays
      // honest (use-plan-companion-chat's persistence rule).
      toast.error(t("errors.persistFailed"));
    },
  });
  return { mutate, result };
}

/** The evidence-day streak (FR-25) — computed by the api (AD-14). */
export function useStreakQuery() {
  const result = useQuery(StreakDocument);
  const streak = result.data?.streak ?? 0;
  return { data: result.data !== undefined ? streak : undefined, loading: result.loading && !result.data, error: result.error, refetch: result.refetch };
}
