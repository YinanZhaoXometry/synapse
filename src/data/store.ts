/**
 * Local store adapter (AD-3/4): the only code that touches the synapse-db
 * localStorage key. Synchronous full-document writes; migrations applied on
 * load; failures throw typed AppError — never silent, never fake success.
 */
import { emptyDb, migrations, SCHEMA_VERSION, STORAGE_KEY, type SynapseDb } from "./document";
import { AppError } from "./errors";

/** Read the document, applying pending migrations. Missing file → fresh empty doc. */
export function loadDb(): SynapseDb {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    throw new AppError("STORAGE_READ_FAILED", "errors.storageReadFailed");
  }
  if (raw === null) return emptyDb();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new AppError("STORAGE_CORRUPT", "errors.storageCorrupt");
  }
  return migrate(parsed);
}

/** Full-document synchronous write (AD-4). */
export function saveDb(db: SynapseDb): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    throw new AppError("STORAGE_WRITE_FAILED", "errors.storageWriteFailed");
  }
}

/** Read-mutate-write in one synchronous pass (full-document writes are atomic). */
export function updateDb(mutate: (db: SynapseDb) => void): void {
  const db = loadDb();
  mutate(db);
  saveDb(db);
}

/** Clear all data, keeping the versioned document itself (reset semantics). */
export function resetDb(): void {
  saveDb(emptyDb());
}

/** Migrations run oldest-first until the document reaches SCHEMA_VERSION. */
function migrate(raw: Record<string, unknown>): SynapseDb {
  const fromVersion = typeof raw.version === "number" ? raw.version : 0;
  let doc = raw;
  for (const step of migrations) {
    if (step.to > fromVersion) doc = step.migrate(doc) as unknown as Record<string, unknown>;
  }
  return { ...emptyDb(), ...(doc as unknown as SynapseDb), version: SCHEMA_VERSION };
}
