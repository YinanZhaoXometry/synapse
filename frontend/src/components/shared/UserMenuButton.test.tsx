import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// The contract is the seam: logout() (clearToken + resetApiClient, AD-15) is
// the ONE cut this menu may perform; navigation is asserted through the
// location stub below (the same shape the Settings page's button pins).
vi.mock("@/apollo", () => ({ logout: vi.fn().mockResolvedValue(undefined) }));
import { logout } from "@/apollo";
import { LanguageProvider } from "@/contexts/LanguageContext";
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

const renderMenu = (props: { compact?: boolean; onAction?: () => void } = {}) =>
  render(
    <LanguageProvider>
      <MemoryRouter>
        <UserMenuButton {...props} />
      </MemoryRouter>
    </LanguageProvider>
  );

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

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("compact (tablet rail) placement signs out through the same seam", async () => {
    const user = userEvent.setup();
    renderMenu({ compact: true });
    await user.click(screen.getByRole("button", { name: "账户菜单" }));
    await user.click(screen.getByText("退出登录"));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("onAction fires before the action runs — the mobile drawer's close hook", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderMenu({ onAction });
    await user.click(screen.getByRole("button", { name: "账户菜单" }));
    await user.click(screen.getByText("退出登录"));

    expect(onAction).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"));
  });
});
