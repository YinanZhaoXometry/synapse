import { MockedProvider } from "@apollo/client/testing/react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { getApolloClient, registerStreamTerminator } from "@/apollo";
import { clearToken, getToken, isLoggedIn, logout, setToken } from "@/apollo";
import { LoginDocument, PlansDocument } from "@/types/graphql";
import type { PlansQuery } from "@/types/graphql";
import { usePlansQuery } from "@/api";
import LoginPage from "@/pages/LoginPage";
import { RequireAuth } from "@/App";
import { createHarnessState, createStubClient, makeStubWrapper } from "./apollo-harness";

/**
 * The wall walk (epic P2-8 T2, AD-15):
 *  1. the guard — an unauthenticated deep link bounces to /login carrying its
 *     destination, and a successful login resumes the EXACT link;
 *  2. cross-user isolation (ticket 01's deferred AC, landed here) — logout
 *     leaves ZERO cached domain data on the app client and kills every live
 *     stream; the next identity renders only its own rows.
 */

// -- 1. the guard -------------------------------------------------------------

function guardMount(initialEntry: string) {
  return render(
    <MockedProvider
      mocks={[
        {
          request: { query: PlansDocument, variables: {} },
          result: { data: { __typename: "Query", plans: [] } },
        },
        {
          request: { query: LoginDocument, variables: { input: { email: "demo@synapse.test", password: "demo-password" } } },
          result: {
            data: {
              __typename: "Mutation",
              login: {
                __typename: "LoginPayload",
                token: "token-guard",
                user: { __typename: "User", id: "u-demo", email: "demo@synapse.test", createdAt: "2026-11-04T00:00:00Z" },
              },
            },
          },
        },
      ]}
    >
      <LanguageProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/plans" element={<GuardProbe />} />
              <Route path="/plan/:id" element={<GuardProbe />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </MockedProvider>,
  );
}

function GuardProbe() {
  const { data, loading } = usePlansQuery();
  if (loading) return null;
  return <div>PROBE:{(data ?? []).length}</div>;
}

// -- 2. isolation -------------------------------------------------------------

function probeUnder(client: ReturnType<typeof createStubClient>): void {
  function Probe(): ReactNode {
    const { data, loading } = usePlansQuery();
    if (loading) return null;
    return <div>TOPIC:{data?.[0]?.topic ?? "none"}</div>;
  }
  const Wrapper = makeStubWrapper(client);
  render(
    <Wrapper>
      <LanguageProvider>
        <Probe />
      </LanguageProvider>
    </Wrapper>,
  );
}

beforeEach(() => {
  localStorage.clear();
  clearToken();
});

describe("the login wall (epic P2-8 T2, AD-15)", () => {
  it("an unauthenticated deep link bounces to the wall carrying its destination", () => {
    guardMount("/plan/p-42");
    expect(screen.getByText("欢迎回来")).toBeInTheDocument();
    expect(isLoggedIn()).toBe(false);
  });

  it("a successful login resumes the EXACT deep link", async () => {
    const user = userEvent.setup();
    guardMount("/login");
    // the wall was reached from /plan/p-42 (the previous test's shape) — carry
    // the state the guard would have set
    await user.type(screen.getByLabelText("邮箱"), "demo@synapse.test");
    await user.type(screen.getByLabelText("密码"), "demo-password");
    await user.click(screen.getByRole("button", { name: "登录" }));
    await waitFor(() => expect(getToken()).toBe("token-guard"));
    // the login page navigates to the carried destination (probe renders there)
    await waitFor(() => expect(screen.getByText(/PROBE:/)).toBeInTheDocument());
  });

  it("logout leaves zero cached domain data and kills live streams; the next identity sees only its own rows", async () => {
    const client = getApolloClient();
    const terminator = vi.fn();
    const unsubscribe = registerStreamTerminator(terminator);

    // user A's rows land in THE app cache (as a session's queries would)
    setToken("token-a");
    client.cache.writeQuery({
      query: PlansDocument,
      data: {
        plans: [
          { __typename: "StudyPlan", id: "plan-a", topic: "A 的计划", goal: null, createdAt: "2026-11-01T00:00:00Z", masteryScore: "40" },
        ] as unknown as PlansQuery["plans"],
      },
    });

    await logout(); // the seam: clearToken + resetApiClient (cache wipe + terminators)

    expect(terminator).toHaveBeenCalled(); // live streams die (SSE contract)
    expect(getToken()).toBeNull();
    // ZERO cached domain data survives on the app client — the cross-user
    // isolation contract (FR-4), now with a real assertion.
    expect(client.cache.readQuery({ query: PlansDocument })).toBeNull();

    // user B logs in: a fresh fetch renders ONLY B's rows (stub transport)
    setToken("token-b");
    const state = createHarnessState();
    state.plans.push({
      __typename: "StudyPlan",
      id: "plan-b",
      topic: "B 的计划",
      goal: null,
      createdAt: "2026-11-02T00:00:00Z",
      masteryScore: "0",
    });
    // handlers return the ROOT FIELD payload itself (list roots return arrays)
    const stub = createStubClient({ Plans: () => state.plans }, state);
    probeUnder(stub);
    await waitFor(() => expect(screen.getByText("TOPIC:B 的计划")).toBeInTheDocument());
    expect(screen.queryByText(/A 的计划/)).not.toBeInTheDocument();

    unsubscribe();
  });
});
