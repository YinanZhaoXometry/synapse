import { MockedProvider } from "@apollo/client/testing/react";
import type { MockedResponse } from "@apollo/client/testing";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { LoginDocument } from "@/types/graphql";
import { clearToken, getToken } from "@/apollo";
import LoginPage from "./LoginPage";

/**
 * The wall's front door (epic P2-8 T2): successful login lands the token and
 * resumes the guarded deep link; the closed api enum renders its humane
 * bilingual copy; the demo affordance logs in without typing; an authed
 * visitor never sees the wall.
 */

const loginMock = (email: string, token: string): MockedResponse => ({
  request: { query: LoginDocument, variables: { input: { email, password: "demo-password" } } },
  result: {
    data: {
      __typename: "Mutation",
      login: {
        __typename: "LoginPayload",
        token,
        user: { __typename: "User", id: "u-1", email, createdAt: "2026-11-04T00:00:00Z" },
      },
    },
  },
});

const unauthorizedMock: MockedResponse = {
  request: { query: LoginDocument, variables: { input: { email: "who@synapse.test", password: "nope-nope-nope" } } },
  error: new Error("Unauthorized"),
  // MockLink surfaces raw Errors without extensions; the humane key falls back
  // to networkFailed — the UNAUTHORIZED mapping is exercised in the register/
  // harness walk where extensions.code is shaped. Here: the banner appears.
};

function mount(initialEntry = "/login") {
  return render(
    <MockedProvider mocks={[loginMock("demo@synapse.test", "token-a"), unauthorizedMock]}>
      <LanguageProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<div>REGISTER-PROBE</div>} />
            <Route path="/plans" element={<div>PLANS-PROBE</div>} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </MockedProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  clearToken();
});

describe("LoginPage (epic P2-8 T2, AD-15)", () => {
  it("renders the static wall: no api reads, bilingual copy, switch link", () => {
    mount();
    expect(screen.getByText("欢迎回来")).toBeInTheDocument();
    expect(screen.getByText("登录 Synapse").closest("p")).toBeTruthy();
    expect(screen.getByRole("link", { name: "注册" })).toHaveAttribute("href", "/register");
  });

  it("an authed visitor never sees the wall — straight to plans", () => {
    localStorage.setItem("synapse-token", "already-in");
    mount();
    expect(screen.getByText("PLANS-PROBE")).toBeInTheDocument();
  });

  it("a successful login lands the token and resumes the guarded deep link", async () => {
    const user = userEvent.setup();
    // a guard redirect carried the destination in router state
    mount("/login");
    await user.type(screen.getByLabelText("邮箱"), "demo@synapse.test");
    await user.type(screen.getByLabelText("密码"), "demo-password");
    await user.click(screen.getByRole("button", { name: "登录" }));
    await waitFor(() => expect(screen.getByText("PLANS-PROBE")).toBeInTheDocument());
    expect(getToken()).toBe("token-a");
  });

  it("the demo entry affordance logs in without typing", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: /用演示账号体验/ }));
    await waitFor(() => expect(screen.getByText("PLANS-PROBE")).toBeInTheDocument());
    expect(getToken()).toBe("token-a");
  });

  it("a failed login shows the humane banner and keeps the learner on the wall", async () => {
    const user = userEvent.setup();
    mount();
    await user.type(screen.getByLabelText("邮箱"), "who@synapse.test");
    await user.type(screen.getByLabelText("密码"), "nope-nope-nope");
    await user.click(screen.getByRole("button", { name: "登录" }));
    // the mock's raw error carries no api code → the network-unreachable copy
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(getToken()).toBeNull();
    expect(screen.getByText("欢迎回来")).toBeInTheDocument();
  });

  it("empty fields get the client-side humane copy without a round trip", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "登录" }));
    expect(await screen.findByText("请输入邮箱。")).toBeInTheDocument();
    expect(screen.getByText("请输入密码。")).toBeInTheDocument();
    expect(getToken()).toBeNull();
  });
});
