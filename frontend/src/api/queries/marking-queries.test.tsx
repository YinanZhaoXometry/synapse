import { MockedProvider } from "@apollo/client/testing/react";
import type { MockedResponse } from "@apollo/client/testing";
import { act, render, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  ClaimSectionDocument,
  SectionMarkingsDocument,
  UnclaimSectionDocument,
} from "@/types/graphql";
import { useClaimSectionMutation, useSectionMarkingsQuery, useUnclaimSectionMutation } from "./marking-queries";

/**
 * Hook smokes over the house MockedProvider precedent (epic-15 T2): the read
 * is honest-empty while loading and maps rows in server order; each mutation
 * is a raw Apollo tuple whose declared refetch sweep re-reads the claim list.
 */

const wireRow = (overrides: Record<string, unknown> = {}) => ({
  __typename: "SectionMarking",
  id: "sm-1",
  materialId: "mat-1",
  sectionId: "sec-intro",
  claimedAt: "2026-11-06T10:00:00Z",
  clearedAt: null,
  ...overrides,
});

const markingsMock = (rows: Record<string, unknown>[]): MockedResponse => ({
  request: { query: SectionMarkingsDocument, variables: { materialId: "mat-1" } },
  result: { data: { __typename: "Query", sectionMarkings: rows } },
});

const claimMock: MockedResponse = {
  request: { query: ClaimSectionDocument, variables: { input: { materialId: "mat-1", sectionId: "sec-intro" } } },
  result: {
    data: { __typename: "Mutation", claimSection: { __typename: "ClaimSectionPayload", sectionMarking: wireRow({ id: "sm-open" }) } },
  },
};

const unclaimMock: MockedResponse = {
  request: { query: UnclaimSectionDocument, variables: { input: { materialId: "mat-1", sectionId: "sec-intro" } } },
  result: {
    data: {
      __typename: "Mutation",
      unclaimSection: { __typename: "UnclaimSectionPayload", sectionMarking: wireRow({ id: "sm-open", clearedAt: "2026-11-06T11:00:00Z" }) },
    },
  },
};

const wrapper = (mocks: MockedResponse[]) => ({ children }: { children: ReactNode }) => (
  <MockedProvider mocks={mocks}>{children}</MockedProvider>
);

describe("useSectionMarkingsQuery", () => {
  it("loads honest-empty, then maps all rows in server order (open + cleared, newest first)", async () => {
    const { result } = renderHook(() => useSectionMarkingsQuery("mat-1"), {
      wrapper: wrapper([
        markingsMock([
          wireRow({ id: "sm-open", claimedAt: "2026-11-06T10:00:00Z", clearedAt: null }),
          wireRow({ id: "sm-cleared", claimedAt: "2026-11-05T10:00:00Z", clearedAt: "2026-11-05T11:00:00Z" }),
        ]),
      ]),
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeUndefined();
    expect(result.current.data).toEqual([
      { id: "sm-open", materialId: "mat-1", sectionId: "sec-intro", claimedAt: "2026-11-06T10:00:00Z", clearedAt: null },
      { id: "sm-cleared", materialId: "mat-1", sectionId: "sec-intro", claimedAt: "2026-11-05T10:00:00Z", clearedAt: "2026-11-05T11:00:00Z" },
    ]);
    expect(typeof result.current.refetch).toBe("function");
  });
});

describe("useClaimSectionMutation", () => {
  it("returns a raw Apollo tuple and its declared sweep refetches the claim list", async () => {
    // one provider owns both hooks — the sweep only exists against an active read
    let read: ReturnType<typeof useSectionMarkingsQuery> | undefined;
    let claim: ReturnType<typeof useClaimSectionMutation>[0] | undefined;
    const Harness = () => {
      read = useSectionMarkingsQuery("mat-1");
      [claim] = useClaimSectionMutation();
      return null;
    };
    render(
      <MockedProvider mocks={[markingsMock([]), claimMock, markingsMock([wireRow({ id: "sm-open" })])]}>
        <Harness />
      </MockedProvider>,
    );
    await waitFor(() => expect(read?.loading).toBe(false));
    expect(read?.data).toEqual([]);
    await act(async () => {
      const tuple = await claim!({ variables: { input: { materialId: "mat-1", sectionId: "sec-intro" } } });
      expect(tuple.data?.claimSection.sectionMarking.id).toBe("sm-open");
    });
    // the sweep: the read-back carries the fresh claim row (open — clearedAt null)
    await waitFor(() => expect(read?.data).toHaveLength(1));
    expect(read?.data?.[0]).toEqual({
      id: "sm-open",
      materialId: "mat-1",
      sectionId: "sec-intro",
      claimedAt: "2026-11-06T10:00:00Z",
      clearedAt: null,
    });
  });
});

describe("useUnclaimSectionMutation", () => {
  it("returns the cleared claim through the raw tuple (claimedAt stands, clearedAt set)", async () => {
    const { result } = renderHook(() => useUnclaimSectionMutation(), {
      // the trailing read-back mock serves the hook's declared sweep after the mutation
      wrapper: wrapper([unclaimMock, markingsMock([wireRow({ id: "sm-open", clearedAt: "2026-11-06T11:00:00Z" })])]),
    });
    await act(async () => {
      const tuple = await result.current[0]({ variables: { input: { materialId: "mat-1", sectionId: "sec-intro" } } });
      expect(tuple.data?.unclaimSection.sectionMarking.claimedAt).toBe("2026-11-06T10:00:00Z");
      expect(tuple.data?.unclaimSection.sectionMarking.clearedAt).toBe("2026-11-06T11:00:00Z");
    });
  });
});
