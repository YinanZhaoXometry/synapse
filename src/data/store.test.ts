import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "./errors";
import { emptyDb, STORAGE_KEY } from "./document";
import { loadDb, resetDb, saveDb } from "./store";

describe("store failure paths (typed AppError, never silent)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("a corrupted document throws STORAGE_CORRUPT with an i18n messageKey", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    try {
      loadDb();
      expect.unreachable("loadDb should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("STORAGE_CORRUPT");
      expect((e as AppError).messageKey).toBe("errors.storageCorrupt");
    }
  });

  it("a failed write throws STORAGE_WRITE_FAILED with an i18n messageKey", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    });
    try {
      saveDb(loadDb());
      expect.unreachable("saveDb should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("STORAGE_WRITE_FAILED");
      expect((e as AppError).messageKey).toBe("errors.storageWriteFailed");
    }
  });

  it("no document at all → fresh empty db, no throw", () => {
    localStorage.removeItem(STORAGE_KEY);
    const db = loadDb();
    expect(db.version).toBe(1);
    expect(db.plans).toEqual([]);
    expect(db.onboardingComplete).toBe(false);
  });
});

describe("resetDb (reset semantics: study data wiped, document + UI prefs kept)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("resets to the empty document — version kept, key retained, nothing else in localStorage touched", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, onboardingComplete: true, plans: [{ id: "p1" }] }));
    localStorage.setItem("synapse-lang", "zh");
    localStorage.setItem("synapse-theme", "aurora");

    resetDb();

    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(loadDb()).toEqual(emptyDb());
    expect(localStorage.getItem("synapse-lang")).toBe("zh");
    expect(localStorage.getItem("synapse-theme")).toBe("aurora");
  });
});
