import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "./errors";
import { STORAGE_KEY } from "./document";
import { loadDb, saveDb } from "./store";

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
