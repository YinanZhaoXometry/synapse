import { MockedProvider } from "@apollo/client/testing/react";
import type { MockedResponse } from "@apollo/client/testing";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { RegisterDocument } from "@/types/graphql";
import { clearToken, getToken } from "@/apollo";
import RegisterPage from "./RegisterPage";

/**
 * The wall's second door (epic P2-8 T2): client-side checks mirror the api's
 * rules (email shape, password ≥ 8) so the humane copy fires without a round
 * trip; a VALIDATION_FAILED from the server maps to its own key; success
 * lands the token and enters.
 */

const validationMock: MockedResponse = {
  request: { query: RegisterDocument, variables: { input: { email: "a@b.test", password: "short-pass" } } },
  result: {
    data: {
      __typename: "Mutation",
      register: {
        __typename: "RegisterPayload",
        token: "should-not-happen",
        user: { __typename: "User", id: "u-x", email: "a@b.test", createdAt: "2026-11-04T00:00:00Z" },
      },
    },
  },
};

// server-shaped VALIDATION_FAILED (extensions.code) via a result function is
// not possible on MockLink — use the harness instead for the server-rejection
// path: the api enum mapping (auth.validationFailed) is pinned in the wall
// integration walk. Here: client rules + success.
const successMock: MockedResponse = {
  request: { query: RegisterDocument, variables: { input: { email: "new@synapse.test", password: "long-enough-pass" } } },
  result: {
    data: {
      __typename: "Mutation",
      register: {
        __typename: "RegisterPayload",
        token: "token-new",
        user: { __typename: "User", id: "u-new", email: "new@synapse.test", createdAt: "2026-11-04T00:00:00Z" },
      },
    },
  },
};

function mount() {
  return render(
    <MockedProvider mocks={[validationMock, successMock]}>
      <LanguageProvider>
        <MemoryRouter initialEntries={["/register"]}>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<div>LOGIN-PROBE</div>} />
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

describe("RegisterPage (epic P2-8 T2, AD-15)", () => {
  it("renders the wall copy with the switch link back to login", () => {
    mount();
    expect(screen.getByText("创建你的账户")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "登录" })).toHaveAttribute("href", "/login");
  });

  it("client rules fire without a round trip: bad email + short password", async () => {
    const user = userEvent.setup();
    mount();
    await user.type(screen.getByLabelText("邮箱"), "not-an-email");
    await user.type(screen.getByLabelText("密码"), "short");
    await user.click(screen.getByRole("button", { name: "注册并进入" }));
    expect(await screen.findByText("邮箱格式看起来不对。")).toBeInTheDocument();
    expect(screen.getByText("密码至少 8 位。")).toBeInTheDocument();
    expect(getToken()).toBeNull();
  });

  it("a valid registration lands the token and enters", async () => {
    const user = userEvent.setup();
    mount();
    await user.type(screen.getByLabelText("邮箱"), "new@synapse.test");
    await user.type(screen.getByLabelText("密码"), "long-enough-pass");
    await user.click(screen.getByRole("button", { name: "注册并进入" }));
    await waitFor(() => expect(screen.getByText("PLANS-PROBE")).toBeInTheDocument());
    expect(getToken()).toBe("token-new");
  });
});
