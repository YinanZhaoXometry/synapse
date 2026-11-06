/**
 * newClientUuid (AD-12 idempotency keys): the native crypto.randomUUID path
 * and the secure-context fallback. The fallback is load-bearing on plain-IP
 * / hosts-alias origins (the LAN demo access, http://192.168.x.x:8080) where
 * randomUUID does not exist — before it, every create-shaped mutation and
 * Companion send threw `crypto.randomUUID is not a function`.
 */
import { afterEach, describe, expect, it } from "vitest";
import { newClientUuid } from "./uuid";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Shadow the native method for one test, then restore whatever was there. */
function stubRandomUUID(value: unknown): () => void {
  const owner = "randomUUID" in crypto ? crypto : Object.getPrototypeOf(crypto);
  const descriptor = Object.getOwnPropertyDescriptor(owner, "randomUUID");
  Object.defineProperty(crypto, "randomUUID", { value, configurable: true });
  return () => {
    if (descriptor) Object.defineProperty(owner, "randomUUID", descriptor);
    else delete (crypto as { randomUUID?: unknown }).randomUUID;
  };
}

const restore: Array<() => void> = [];
afterEach(() => {
  while (restore.length) restore.pop()!();
});

describe("newClientUuid", () => {
  it("mints a valid v4 uuid on the native path", () => {
    expect(newClientUuid()).toMatch(UUID_V4);
  });

  it("mints a valid v4 uuid when randomUUID is missing (insecure origin)", () => {
    restore.push(stubRandomUUID(undefined));
    expect(typeof crypto.randomUUID).toBe("undefined");
    expect(newClientUuid()).toMatch(UUID_V4);
  });

  it("mints distinct ids on consecutive fallback calls", () => {
    restore.push(stubRandomUUID(undefined));
    expect(newClientUuid()).not.toBe(newClientUuid());
  });
});
