import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import type { MaterialNodeMappingView, MaterialView } from "@/api/views";
import { useAutoMapping } from "./use-auto-mapping";

/**
 * useAutoMapping — the plan-page auto-fire effect (epic-34 T3; GLOSSARY
 * Auto-mapping) at the hook seam, with the api layer mocked at the module
 * boundary (the AppLayout.drawer / CompanionPanel.plan-mode convention —
 * the mutation's wire behavior is mapping-queries' own concern):
 *
 *   1. one eligible material → the existing mapping mutation fires EXACTLY
 *      once with that material's id, silently (no toast on start or success
 *      — the coverage panel is the surface).
 *   2. the session guard is component-lifetime: re-renders never re-fire a
 *      fired material, while a material attached LATER does fire (the
 *      post-creation path and the later-attach path behave identically);
 *      a fresh mount (the next visit) naturally retries a failed material.
 *   3. firing is one-in-flight: the next eligible material waits for the
 *      current call to settle.
 *   4. CAP_REACHED flips the hook's cap state (the panel's「额度已用完」),
 *      stops the remaining queue (never a second attempt), and toasts
 *      exactly once through the closed-enum key map.
 *   5. any other failure toasts exactly once (AppError→messageKey→t()) and
 *      leaves the guard standing — no silent retry loop.
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;

const mutate = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>();
  return {
    ...actual,
    // Apollo's tuple: [mutateFn, result] — the same shape mapping-queries returns.
    useMapMaterialSectionsMutation: () => [mutate, { loading: false }],
  };
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: toastError, success: toastSuccess, info: vi.fn() }),
}));

const material = (overrides: Partial<MaterialView> & { id: string }): MaterialView => ({
  title: `材料 ${overrides.id}`,
  kind: "markdown",
  sizeBytes: 64,
  planId: "plan-1",
  taskId: null,
  attachmentScope: "plan",
  nodeId: null,
  parseState: "parsed",
  sections: [{ id: `${overrides.id}-sec-1`, title: "第一节", text: "内容" }],
  createdAt: "2026-11-11T00:00:00Z",
  downloadUrl: null,
  ...overrides,
});

const row = (overrides: Partial<MaterialNodeMappingView> & { id: string; materialId: string }): MaterialNodeMappingView => ({
  nodeId: null,
  sectionId: "sec-1",
  proposedNodeTitle: null,
  status: "proposed",
  createdAt: "2026-11-11T00:00:00Z",
  ...overrides,
});

const wrapper = ({ children }: { children: ReactNode }) => createElement(LanguageProvider, null, children);

function mountHook(materials?: MaterialView[], mappingRows?: MaterialNodeMappingView[]) {
  return renderHook(({ materials, mappingRows }: { materials?: MaterialView[]; mappingRows?: MaterialNodeMappingView[] }) => useAutoMapping({ materials, mappingRows }), {
    initialProps: { materials, mappingRows },
    wrapper,
  });
}

beforeEach(() => {
  mutate.mockReset();
  mutate.mockResolvedValue({ data: { mapMaterialSections: { mappings: [] } } });
  toastError.mockClear();
  toastSuccess.mockClear();
});

describe("useAutoMapping", () => {
  it("fires the eligible material exactly once, silently, with the material id and the ui language", async () => {
    const { result } = mountHook([material({ id: "m-1" })], []);

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate).toHaveBeenCalledWith({
      variables: { input: { materialId: "m-1", language: "zh" } },
    });
    await waitFor(() => expect(result.current.autoRunningFor).toBeNull());
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(result.current.capReached).toBe(false);
  });

  it("never re-fires across re-renders, but a later-attached material does fire (one trigger point per arrival)", async () => {
    const { result, rerender } = mountHook([material({ id: "m-1" })], []);
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));

    // The reads re-land (fresh array identities, the hooks layer maps anew
    // every render) — the fired guard stands.
    rerender({ materials: [material({ id: "m-1" })], mappingRows: [] });
    await waitFor(() => expect(result.current.autoRunningFor).toBeNull());
    expect(mutate).toHaveBeenCalledTimes(1);

    // A material attached after mount is a fresh arrival: it fires.
    rerender({ materials: [material({ id: "m-1" }), material({ id: "m-2" })], mappingRows: [] });
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(2));
    expect(mutate).toHaveBeenLastCalledWith({
      variables: { input: { materialId: "m-2", language: "zh" } },
    });
  });

  it("runs one call at a time — the second eligible material waits for the first to settle", async () => {
    let settleA: (value: unknown) => void = () => {};
    mutate.mockImplementationOnce(() => new Promise((resolve) => (settleA = resolve)));
    const { result } = mountHook([material({ id: "m-1" }), material({ id: "m-2" })], []);

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(result.current.autoRunningFor).toBe("m-1");
    // Still in flight: the queue holds.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mutate).toHaveBeenCalledTimes(1);

    settleA({ data: { mapMaterialSections: { mappings: [] } } });
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(2));
    expect(mutate).toHaveBeenLastCalledWith({
      variables: { input: { materialId: "m-2", language: "zh" } },
    });
    await waitFor(() => expect(result.current.autoRunningFor).toBeNull());
  });

  it("skips materials that already carry rows or are not parsed-and-sectioned", async () => {
    mountHook(
      [material({ id: "m-ok" }), material({ id: "m-pending", parseState: "pending" }), material({ id: "m-empty", sections: [] })],
      [row({ id: "r-1", materialId: "m-mapped", status: "rejected", proposedNodeTitle: "旧概念" })],
    );
    // Only one fixture (m-ok) is eligible — m-mapped is not among the props.
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate).toHaveBeenCalledWith({
      variables: { input: { materialId: "m-ok", language: "zh" } },
    });
    expect(mutate).not.toHaveBeenCalledWith(
      expect.objectContaining({ variables: { input: { materialId: "m-pending", language: "zh" } } }),
    );
  });

  it("selects nothing while either read is still loading (undefined)", async () => {
    const view = mountHook(undefined, []);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mutate).not.toHaveBeenCalled();
    expect(view.result.current.autoRunningFor).toBeNull();

    view.rerender({ materials: [material({ id: "m-1" })], mappingRows: undefined });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mutate).not.toHaveBeenCalled();
  });

  it("CAP_REACHED: one toast, the cap state flips, the queue stops — no second attempt", async () => {
    mutate.mockRejectedValueOnce(
      new CombinedGraphQLErrors({ errors: [{ message: "daily cap reached", extensions: { code: "CAP_REACHED" } }] }),
    );
    const { result } = mountHook([material({ id: "m-1" }), material({ id: "m-2" })], []);

    await waitFor(() => expect(result.current.capReached).toBe(true));
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(zhDict["mapping.capReached"]);
    // The queue stopped: m-2 never fires, this mount session spends no more.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(result.current.autoRunningFor).toBeNull();
  });

  it("a non-cap failure toasts exactly once and the guard holds for this mount; a fresh mount retries naturally", async () => {
    mutate.mockRejectedValueOnce(new Error("network down"));
    const first = mountHook([material({ id: "m-1" })], []);
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastError).toHaveBeenCalledWith(zhDict["mapping.failed"]);
    expect(first.result.current.capReached).toBe(false);

    // The failed material does not re-fire within the same mount.
    first.rerender({ materials: [material({ id: "m-1" })], mappingRows: [] });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mutate).toHaveBeenCalledTimes(1);
    first.unmount();

    // The next visit (fresh mount) naturally retries — transient failures
    // self-heal without the user filing anything.
    mutate.mockRejectedValueOnce(new Error("network down again"));
    const second = mountHook([material({ id: "m-1" })], []);
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(2));
    second.unmount();
  });
});
