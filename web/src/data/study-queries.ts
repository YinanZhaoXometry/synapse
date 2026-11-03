/** Task + study-state Query hooks (AD-3): thin over the repositories. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ReadingLocator, ReadingPosition } from "@/domain/entities";
import { createStudyTask, getTask, getTaskNode, listTasks } from "./task-repository";
import {
  appendChatMessage,
  getChatThread,
  getReadingProgress,
  listReadingProgress,
  saveReadingProgress,
} from "./progress-repository";
import { queryKeys } from "./query-keys";

export function useTasksQuery() {
  return useQuery({ queryKey: queryKeys.tasks.all, queryFn: listTasks });
}

export function useTaskQuery(taskId: string) {
  return useQuery({ queryKey: queryKeys.tasks.detail(taskId), queryFn: () => getTask(taskId) });
}

export function useTaskNodeQuery(taskId: string) {
  return useQuery({ queryKey: queryKeys.tasks.node(taskId), queryFn: () => getTaskNode(taskId) });
}

export function useCreateTaskMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { materialId: string }) => createStudyTask(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.tasks.all });
      void qc.invalidateQueries({ queryKey: queryKeys.materials.all });
    },
  });
}

export function useReadingProgressQuery(materialId: string) {
  return useQuery({
    queryKey: queryKeys.progress.byMaterial(materialId),
    queryFn: () => getReadingProgress(materialId),
  });
}

/** Every ReadingProgress across materials (Plans Home continue line, FR-25). */
export function useAllReadingProgressQuery() {
  return useQuery({ queryKey: queryKeys.progress.all, queryFn: listReadingProgress });
}

export function useSaveReadingProgressMutation() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: async (input: { materialId: string; position: ReadingPosition }) => {
      saveReadingProgress(input.materialId, input.position);
    },
    onSuccess: (_data, input) => {
      // ["progress"] prefix-matches, so this covers the per-material detail
      // and the cross-material list (Plans Home continue line) in one sweep.
      void qc.invalidateQueries({ queryKey: queryKeys.progress.all });
    },
    // Never silent (UX error state): neutral, actionable — say it failed, ask
    // for a retry, never alarm.
    onError: () => toast.error(t("errors.persistFailed")),
  });
}

export function useChatThreadQuery(materialId: string) {
  return useQuery({
    queryKey: queryKeys.chat.byMaterial(materialId),
    queryFn: () => getChatThread(materialId),
  });
}

export function useAppendChatMessageMutation() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: async (input: {
      materialId: string;
      message: { role: "user" | "companion"; text: string; citations: ReadingLocator[] },
    }) => appendChatMessage(input.materialId, input.message),
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: queryKeys.chat.byMaterial(input.materialId) });
    },
    // Same neutral persistence-failure toast — the transcript itself stays
    // honest (use-companion-chat's persistence rule).
    onError: () => toast.error(t("errors.persistFailed")),
  });
}
