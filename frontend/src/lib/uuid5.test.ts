/**
 * The uuid5 mirror tests (epic-18 T4): `todaySuggestionClientUuid` MUST be a
 * byte-level mirror of backend `Ai::TodaySuggestionKey` (spec decision 9 —
 * the deterministic per-(user, plan, UTC day) replay key the server enforces
 * replay-before-spend on). The exact vectors are the BACKEND UNIT SPEC'S OWN
 * (spec/lib/ai/today_suggestion_key_spec.rb — independently verified there
 * against Python's RFC-4122 uuid.uuid5), pinned here verbatim: if this
 * client derivation ever drifts a hex digit from the server's, same-day
 * regeneration would SPEND instead of replay.
 */
import { describe, expect, it } from "vitest";
import { todaySuggestionClientUuid, uuid5 } from "./uuid5";

describe("uuid5 — the RFC 4122 §4.3 name-based uuid (SHA-1, version 5)", () => {
  it("pins the backend's FIRST exact test vector verbatim", () => {
    // spec/lib/ai/today_suggestion_key_spec.rb — .derive(user_id:, plan_id:, now:)
    // user_id   = 3f9d23ab-1c4e-4f6a-9b2d-8e5c7a1d0e4f (the namespace)
    // plan_id   = a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d
    // UTC day   = 2026-11-06
    expect(uuid5("3f9d23ab-1c4e-4f6a-9b2d-8e5c7a1d0e4f", "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d:2026-11-06")).toBe(
      "8205dada-5e78-5321-8371-91366687a3d7",
    );
  });

  it("pins the backend's SECOND exact test vector (the shape must hold across inputs, not fit one)", () => {
    expect(uuid5("11111111-2222-4333-8444-555555555555", "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee:2026-01-02")).toBe(
      "3cb8e048-55b8-5299-8770-3d465dbb5107",
    );
  });

  it("carries the RFC-4122 version-5 and variant nibbles", () => {
    const derived = uuid5("3f9d23ab-1c4e-4f6a-9b2d-8e5c7a1d0e4f", "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d:2026-11-06");
    expect(derived[14]).toBe("5"); // version nibble
    expect(/[89ab]/.test(derived[19])).toBe(true); // variant 10xx
  });

  it("is deterministic and name-sensitive (different day → a different uuid)", () => {
    const a = uuid5("3f9d23ab-1c4e-4f6a-9b2d-8e5c7a1d0e4f", "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d:2026-11-06");
    const again = uuid5("3f9d23ab-1c4e-4f6a-9b2d-8e5c7a1d0e4f", "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d:2026-11-06");
    const nextDay = uuid5("3f9d23ab-1c4e-4f6a-9b2d-8e5c7a1d0e4f", "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d:2026-11-07");
    const otherPlan = uuid5("3f9d23ab-1c4e-4f6a-9b2d-8e5c7a1d0e4f", "11111111-2222-4333-8444-555555555555:2026-11-06");
    expect(again).toBe(a);
    expect(nextDay).not.toBe(a);
    expect(otherPlan).not.toBe(a);
  });
});

describe("todaySuggestionClientUuid — the cross-stack derivation (Ai::TodaySuggestionKey.derive)", () => {
  it("derives uuid5 over the user uuid as namespace and '<planId>:<UTC day>' as the name", () => {
    expect(todaySuggestionClientUuid("3f9d23ab-1c4e-4f6a-9b2d-8e5c7a1d0e4f", "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", "2026-11-06")).toBe(
      "8205dada-5e78-5321-8371-91366687a3d7",
    );
  });
});
