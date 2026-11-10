/**
 * The session-exit teardown (epic-28 T1): the errorLink's UNAUTHORIZED cut and
 * the sign-out redirect share this seam — token + cache + streams die through
 * logout(), then a hard reload lands on the wall carrying the return path
 * (?next=) and the reason flag the wall's mount toast reads. The pure helpers
 * (sanitizeReturnPath, sessionExitUrl) pin the URL contract; teardownSession
 * pins the single-flight and wall-surface guards through the location stub
 * (the UserMenuButton.test pattern).
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { getToken, setToken, clearToken } from "./auth-token";
import { sanitizeReturnPath, sessionExitUrl, teardownSession } from "./session";
import * as resetModule from "./reset";

vi.mock("./reset", () => ({ resetApiClient: vi.fn().mockResolvedValue(undefined) }));

const originalLocation = window.location;
let replaceMock: Mock;

beforeEach(() => {
  localStorage.clear();
  vi.mocked(resetModule.resetApiClient).mockClear();
  replaceMock = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { ...originalLocation, replace: replaceMock, pathname: "/plan/abc", search: "?tab=x" },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
});

describe("sanitizeReturnPath", () => {
  it("keeps same-origin paths with query strings", () => {
    expect(sanitizeReturnPath("/plan/abc")).toBe("/plan/abc");
    expect(sanitizeReturnPath("/plan/abc?tab=x")).toBe("/plan/abc?tab=x");
    expect(sanitizeReturnPath("/")).toBe("/");
  });

  it("refuses anything that could leave the origin", () => {
    expect(sanitizeReturnPath(null)).toBeNull();
    expect(sanitizeReturnPath("")).toBeNull();
    expect(sanitizeReturnPath("https://evil.example/steal")).toBeNull();
    expect(sanitizeReturnPath("//evil.example")).toBeNull();
    expect(sanitizeReturnPath("/\\evil")).toBeNull();
    expect(sanitizeReturnPath("javascript:alert(1)")).toBeNull();
    expect(sanitizeReturnPath("/ok\nx")).toBeNull();
  });
});

describe("sessionExitUrl", () => {
  it("carries the destination as ?next= plus the reason flag", () => {
    expect(sessionExitUrl("expired", "/plan/abc?tab=x")).toBe(
      `/login?${new URLSearchParams({ next: "/plan/abc?tab=x", expired: "1" }).toString()}`,
    );
    expect(sessionExitUrl("signout", "/dashboard")).toBe(
      `/login?${new URLSearchParams({ next: "/dashboard", out: "1" }).toString()}`,
    );
  });

  it("keeps the reason flag even without a destination", () => {
    expect(sessionExitUrl("expired", "")).toBe(
      `/login?${new URLSearchParams({ expired: "1" }).toString()}`,
    );
  });
});

describe("teardownSession", () => {
  it("logs out and hard-redirects to the wall with the return path", async () => {
    setToken("stale.jwt.token");
    await teardownSession("expired");
    expect(getToken()).toBeNull();
    expect(resetModule.resetApiClient).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledTimes(1);
    const url = replaceMock.mock.calls[0][0] as string;
    expect(url.startsWith("/login?")).toBe(true);
    expect(url).toContain(`next=${encodeURIComponent("/plan/abc?tab=x")}`);
    expect(url).toContain("expired=1");
  });

  it("is single-flight: no token means no redirect", async () => {
    clearToken();
    await teardownSession("expired");
    expect(resetModule.resetApiClient).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("never tears down on the wall's own surfaces", async () => {
    setToken("stale.jwt.token");
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { ...originalLocation, replace: replaceMock, pathname: "/login", search: "" },
    });
    await teardownSession("expired");
    expect(resetModule.resetApiClient).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
