/** Task + study-state Query hooks (AD-3): thin over the repositories. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReadingPosition } from "@/domain/entities";
import { createStudyTask, getTask, getTaskNode, listTasks } from "./task-repository";
import {
  appendChatMessage,
  getChatThread,
  getReadingProgress,
  saveReadingProgress,
} from "./progress-repository";

export function useTasksQuery() {
  return useQuery({ queryKey: ["tasks"], queryFn: listTasks });
}

export function useTaskQuery(taskId: string) {
  return useQuery({ queryKey: ["tasks", taskId], queryFn: () => getTask(taskId) });
}

export function useTaskNodeQuery(taskId: string) {
  return useQuery({ queryKey: ["tasks", taskId, "node"], queryFn: () => getTaskNode(taskId) });
}

export function useCreateTaskMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { materialId: string }) => createStudyTask(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      void qc.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}

export function useReadingProgressQuery(materialId: string) {
  return useQuery({
    queryKey: ["progress", materialId],
    queryFn: () => getReadingProgress(materialId),
  });
}

export function useSaveReadingProgressMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { materialId: string; position: ReadingPosition }) => {
      saveReadingProgress(input.materialId, input.position);
    },
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: ["progress", input.materialId] });
    },
  });
}

export function useChatThreadQuery(materialId: string) {
  return useQuery({
    queryKey: ["chat", materialId],
    queryFn: () => getChatThread(materialId),
  });
}

export function useAppendChatMessageMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      materialId: string;
      message: { role: "user" | "companion"; text: string; citations: [] },
    }) => appendChatMessage(input.materialId, input.message),
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: ["chat", input.materialId] });
    },
  });
}
