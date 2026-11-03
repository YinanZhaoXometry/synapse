/**
 * The single persisted document (AD-4): one versioned JSON blob under one
 * localStorage key. The adapter owns shape + migrations; nothing else in the
 * app reads or writes this key.
 */
import type {
  ChatThread,
  EvidenceRecord,
  Flashcard,
  KnowledgeNode,
  Material,
  MistakeEntry,
  QuizSession,
  Question,
  ReadingProgress,
  SectionMarking,
  StudyPlan,
  StudyTask,
} from "@/domain/entities";

export const STORAGE_KEY = "synapse-db:v1";

export const SCHEMA_VERSION = 1;

/** All of one user's study data. Material file blobs never live here (AD-4). */
export interface SynapseDb {
  version: number;
  onboardingComplete: boolean;
  plans: StudyPlan[];
  nodes: KnowledgeNode[];
  materials: Material[];
  tasks: StudyTask[];
  sessions: QuizSession[];
  questions: Question[];
  evidence: EvidenceRecord[];
  flashcards: Flashcard[];
  mistakes: MistakeEntry[];
  readingProgress: ReadingProgress[];
  chatThreads: ChatThread[];
  sectionMarkings: SectionMarking[];
}

export function emptyDb(): SynapseDb {
  return {
    version: SCHEMA_VERSION,
    onboardingComplete: false,
    plans: [],
    nodes: [],
    materials: [],
    tasks: [],
    sessions: [],
    questions: [],
    evidence: [],
    flashcards: [],
    mistakes: [],
    readingProgress: [],
    chatThreads: [],
    sectionMarkings: [],
  };
}

/**
 * Ordered migrations, oldest first. Each step takes the previous version's
 * document and returns the next version's — the adapter's exclusive property.
 */
export const migrations: Array<{ to: number; migrate: (raw: Record<string, unknown>) => SynapseDb }> = [
  {
    // v0 → v1 (foundational shape): stamp the version, fill fields added after
    // the first write (plan.goal), materialize collections added later.
    to: 1,
    migrate: (raw) => {
      const legacyPlans = Array.isArray(raw.plans) ? (raw.plans as StudyPlan[]) : [];
      return {
        ...emptyDb(),
        ...raw,
        plans: legacyPlans.map((p) => ({ goal: null, ...p })),
        version: 1,
      } as SynapseDb;
    },
  },
];
