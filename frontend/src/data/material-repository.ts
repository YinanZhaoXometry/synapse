/**
 * Material repository (AD-3): owns Material entities in synapse-db — metadata,
 * parse state, and the reader's bounded extracted section text. File bytes go
 * to the session-only registry (AD-4) and are deliberately NOT persisted.
 */
import type { Material, MaterialSection, ParseFailureReason, ParseState } from "@/domain/entities";
import { loadDb, saveDb, updateDb } from "./store";
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

/** The reader's parse(file) outcome, as the repository accepts it (AD-7). */
export interface MaterialParseResult {
  sections: MaterialSection[];
  state: "parsed" | "failed";
  reason?: ParseFailureReason;
}

/** Parse state machine step: pending|failed → parsing (eager parse at attach, AD-7). */
export function markMaterialParsing(materialId: string): void {
  updateDb((db) => {
    const material = db.materials.find((m) => m.id === materialId);
    if (material) material.parseState = "parsing";
  });
}

/**
 * Write the parse outcome back: sections (bounded per-section, AD-4) + final
 * parsed|failed state. A failure keeps the material's metadata and stores the
 * reason; a success clears any previous failure. Unknown ids are a no-op (the
 * material may have been deleted while parsing).
 */
export function setMaterialParseResult(materialId: string, result: MaterialParseResult): void {
  updateDb((db) => {
    const material = db.materials.find((m) => m.id === materialId);
    if (!material) return;
    material.parseState = result.state;
    material.sections = result.sections.map((s) => ({ ...s, text: boundText(s.text) }));
    material.parseFailureReason = result.state === "failed" ? (result.reason ?? "unknown") : undefined;
  });
}

export function listMaterialsByPlan(planId: string): Material[] {
  return loadDb().materials.filter((m) => m.planId === planId);
}

export function listMaterialsByTask(taskId: string): Material[] {
  return loadDb().materials.filter((m) => m.taskId === taskId);
}

/** Every material across plans (continue-reading shaping, FR-25). */
export function listMaterials(): Material[] {
  return loadDb().materials;
}
