/**
 * Study-state repository (AD-3): ReadingProgress + ChatThread (both 1:1 with a
 * Material) and the onboarding-complete flag (a field of the document, AD-8).
 */
import type { ChatMessage, ChatThread, ReadingPosition, ReadingProgress } from "@/domain/entities";
import { loadDb, saveDb, updateDb } from "./store";

// -- reading progress ---------------------------------------------------------

export function saveReadingProgress(materialId: string, position: ReadingPosition): void {
  updateDb((db) => {
    const existing = db.readingProgress.find((r) => r.materialId === materialId);
    if (existing) {
      existing.position = position;
      existing.updatedAt = new Date().toISOString();
    } else {
      const progress: ReadingProgress = {
        materialId,
        position,
        updatedAt: new Date().toISOString(),
      };
      db.readingProgress.push(progress);
    }
  });
}

export function getReadingProgress(materialId: string): ReadingProgress | undefined {
  return loadDb().readingProgress.find((r) => r.materialId === materialId);
}

/** Every ReadingProgress across materials (continue-reading shaping, FR-25). */
export function listReadingProgress(): ReadingProgress[] {
  return loadDb().readingProgress;
}

// -- chat threads -------------------------------------------------------------

export function appendChatMessage(
  materialId: string,
  message: Omit<ChatMessage, "id" | "createdAt">,
): ChatMessage {
  let stored!: ChatMessage;
  updateDb((db) => {
    stored = {
      ...message,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    let thread = db.chatThreads.find((t) => t.materialId === materialId);
    if (!thread) {
      thread = { materialId, messages: [], updatedAt: stored.createdAt };
      db.chatThreads.push(thread);
    }
    thread.messages.push(stored);
    thread.updatedAt = stored.createdAt;
  });
  return stored;
}

export function getChatThread(materialId: string): ChatThread | undefined {
  return loadDb().chatThreads.find((t) => t.materialId === materialId);
}

// -- onboarding flag (AD-8: entry-state field of the synapse-db document) ------

export function markOnboardingComplete(): void {
  updateDb((db) => {
    db.onboardingComplete = true;
  });
}

export function isOnboardingComplete(): boolean {
  return loadDb().onboardingComplete;
}
