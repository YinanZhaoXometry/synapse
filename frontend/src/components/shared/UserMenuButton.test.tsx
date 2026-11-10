import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// The contract is the seam: logout() (clearToken + resetApiClient, AD-15) is
// the ONE cut this menu may perform; navigation is asserted through the
// location stub below (the same shape the Settings page's button pins).
// sessionExitUrl stays REAL (epic-28 T1) — the ?next=/out=1 URL shape is part
// of the pinned contract.
vi.mock("@/apollo", async () => {
  const session = await vi.importActual<typeof import("@/apollo/session")>("@/apollo/session");
  return { logout: vi.fn().mockResolvedValue(undefined), sessionExitUrl: session.sessionExitUrl };
});
import { logout } from "@/apollo";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { createHarnessState, createStubClient, makeStubWrapper } from "@/test/apollo-harness";
import UserMenuButton from "./UserMenuButton";

/** jsdom cannot navigate — stub the whole location so `replace` is observable
 * (the SettingsPage.test pattern). */
const originalLocation = window.location;
let replaceMock: Mock;

beforeEach(() => {
  localStorage.clear();
  // Re-prime the seam every test: restoreAllMocks would wipe the factory's
  // mockResolvedValue and leave logout() returning undefined.
  vi.mocked(logout).mockReset();
  vi.mocked(logout).mockResolvedValue(undefined);
  replaceMock = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { ...originalLocation, replace: replaceMock },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
});

/** The stub-GraphQL client (the house harness): the Me read answers the
 * demo session's email by default; a test wires its own handler to vary it. */
const stubWrapper = (meHandler: () => unknown = () => ({ __typename: "Me", email: "demo@synapse.test" })) => {
  const client = createStubClient({ Me: meHandler }, createHarnessState());
  return makeStubWrapper(client);
};

const renderMenu = (props: { compact?: boolean; onAction?: () => void } = {}, meHandler?: () => unknown) => {
  const Wrapper = stubWrapper(meHandler);
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <Wrapper>
          <UserMenuButton {...props} />
        </Wrapper>
      </MemoryRouter>
    </LanguageProvider>
  );
};

describe("UserMenuButton (the sidebar account menu)", () => {
  it("opens the popover with the settings link and the sign-out item (zh)", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "账户菜单" }));

    expect(screen.getByText("退出登录")).toBeInTheDocument();
    expect(screen.getByText("设置").closest("a")).toHaveAttribute("href", "/settings");
  });

  it("sign out runs the ONE logout seam exactly once and lands on the login wall", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "账户菜单" }));
    await user.click(screen.getByText("退出登录"));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login?next=%2F&out=1"));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("compact (tablet rail) placement signs out through the same seam", async () => {
    const user = userEvent.setup();
    renderMenu({ compact: true });
    await user.click(screen.getByRole("button", { name: "账户菜单" }));
    await user.click(screen.getByText("退出登录"));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login?next=%2F&out=1"));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("onAction fires before the action runs — the mobile drawer's close hook", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderMenu({ onAction });
    await user.click(screen.getByRole("button", { name: "账户菜单" }));
    await user.click(screen.getByText("退出登录"));

    expect(onAction).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login?next=%2F&out=1"));
  });
});

describe("UserMenuButton avatar letter (the session identity, epic-25 T3)", () => {
  it("renders the 学 placeholder while me loads, then the email's first grapheme once it lands", async () => {
    // The stub link answers on the next tick, so the first paint IS the
    // loading frame — placeholder letter, never a wrong identity.
    renderMenu();
    expect(screen.getByRole("button", { name: "账户菜单" })).toHaveTextContent("学");

    await waitFor(() => expect(screen.getByRole("button", { name: "账户菜单" })).toHaveTextContent("D"));
  });

  it("the en placeholder is S and dies the same way (demo → D)", async () => {
    localStorage.setItem("synapse-lang", "en");
    renderMenu();
    // the aria-label localizes too — query the menu's only button
    expect(screen.getByRole("button")).toHaveTextContent("S");

    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("D"));
  });

  it("on error the placeholder letter stays (a failed identity read never invents one)", async () => {
    renderMenu({}, () => {
      throw new Error("me is unreachable");
    });
    expect(screen.getByRole("button", { name: "账户菜单" })).toHaveTextContent("学");

    // let the error settle — the letter never leaves the placeholder
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(screen.getByRole("button", { name: "账户菜单" })).toHaveTextContent("学");
  });

  it("the letter is the local-part's first grapheme, not the email's", async () => {
    renderMenu({}, () => ({ __typename: "Me", email: "yinan.chen@polyu.edu.hk" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "账户菜单" })).toHaveTextContent("Y"));
  });
});
