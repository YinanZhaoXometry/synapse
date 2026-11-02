/**
 * Material repository (AD-3): owns Material entities in synapse-db — metadata,
 * parse state, and the reader's bounded extracted section text. File bytes go
 * to the session-only registry (AD-4) and are deliberately NOT persisted.
 */
import type { Material, MaterialSection, ParseState } from "@/domain/entities";
import { loadDb, saveDb } from "./store";
import type { SessionBlobRegistry } from "./session-blobs";
import { sessionBlobs } from "./session-blobs";

/** Per-section text bound — keeps one document far below the ~5MB quota (AD-4). */
export const MATERIAL_SECTION_MAX_CHARS = 2000;

export interface RegisterMaterialInput {
  title: string;
  kind: "pdf" | "markdown";
  sizeBytes: number;
  planId: string | null;
  taskId: string | null;
  /** File bytes — held in memory only (session-only, AD-4). */
  blob?: Blob;
  blobRegistry?: SessionBlobRegistry;
  /** The reader's parse(file) output — passed as data; the reader epic owns parsing. */
  sections: MaterialSection[];
  parseState?: ParseState;
}

function boundText(text: string): string {
  return text.length > MATERIAL_SECTION_MAX_CHARS ? text.slice(0, MATERIAL_SECTION_MAX_CHARS) : text;
}

export function registerMaterial(input: RegisterMaterialInput): { material: Material } {
  const material: Material = {
    id: crypto.randomUUID(),
    title: input.title,
    kind: input.kind,
    sizeBytes: input.sizeBytes,
    planId: input.planId,
    taskId: input.taskId,
    parseState: input.parseState ?? (input.sections.length > 0 ? "parsed" : "pending"),
    sections: input.sections.map((s) => ({ ...s, text: boundText(s.text) })),
    createdAt: new Date().toISOString(),
  };

  if (input.blob) {
    (input.blobRegistry ?? sessionBlobs).put(material.id, input.blob);
  }

  const db = loadDb();
  db.materials.push(material);
  if (input.planId) {
    const plan = db.plans.find((p) => p.id === input.planId);
    if (plan) plan.materialIds.push(material.id);
  }
  saveDb(db);
  return { material };
}

export function getMaterial(id: string): Material | undefined {
  return loadDb().materials.find((m) => m.id === id);
}

export function listMaterialsByPlan(planId: string): Material[] {
  return loadDb().materials.filter((m) => m.planId === planId);
}

export function listMaterialsByTask(taskId: string): Material[] {
  return loadDb().materials.filter((m) => m.taskId === taskId);
}
