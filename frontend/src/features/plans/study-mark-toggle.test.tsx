import { MockedProvider } from "@apollo/client/testing/react";
import type { MockedResponse } from "@apollo/client/testing";
import { InMemoryCache } from "@apollo/client/cache";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useFragment } from "@apollo/client/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { translations } from "@/contexts/i18n-dictionary";
import { KnowledgeNodePartsFragmentDoc, NodeStudyMarkSetDocument } from "@/types/graphql";
import type { StudyMark } from "@/api/views";
import StudyMarkToggleRow from "./study-mark-toggle";

/**
 * The Study Mark toggle row (epic-28 T4), against the REAL contract: the
 * row displays props (the plan read's server truth); clicking fires
 * nodeId+mark (mark: null = clear) and the optimistic overlay flips the
 * CACHED node instantly — asserted through a useFragment probe, the same
 * absorption the plan read rides in the app. A wire failure drops the
 * overlay, rolling the probe back.
 */

const zhDict = (translations as Record<string, Record<string, string>>).zh;

const wireNode = (mark: StudyMark | null) => ({
  __typename: "KnowledgeNode",
  id: "n-1",
  planId: "plan-1",
  taskId: null,
  stage: "基础",
  title: "Consensus",
  description: null,
  optional: false,
  order: 1,
  masteryScore: "0",
  state: "uncovered",
  studyMark: mark,
  createdAt: "2026-11-11T00:00:00Z",
});

const markMock = (mark: StudyMark | null): MockedResponse => ({
  request: { query: NodeStudyMarkSetDocument, variables: { input: { nodeId: "n-1", mark } } },
  result: {
    data: {
      __typename: "Mutation",
      nodeStudyMarkSet: { __typename: "NodeStudyMarkSetPayload", node: wireNode(mark) },
    },
  },
});

/** A cache probe: the plan read's absorption path, verbatim. */
function Probe({ id }: { id: string }) {
  const { data } = useFragment({
    fragment: KnowledgeNodePartsFragmentDoc,
    from: { __typename: "KnowledgeNode", id },
  });
  return <span data-testid="probe-mark">{data?.studyMark ?? "none"}</span>;
}

const seedCache = (mark: StudyMark | null) => {
  const cache = new InMemoryCache();
  cache.writeFragment({
    id: cache.identify({ __typename: "KnowledgeNode", id: "n-1" }),
    fragment: KnowledgeNodePartsFragmentDoc,
    data: wireNode(mark),
  });
  return cache;
};

const tree = (cache: InMemoryCache, mocks: MockedResponse[], mark: StudyMark | null = null): ReactNode => (
  <MockedProvider mocks={mocks} cache={cache}>
    <LanguageProvider>
      <StudyMarkToggleRow nodeId="n-1" mark={mark} />
      <Probe id="n-1" />
    </LanguageProvider>
  </MockedProvider>
);

describe("StudyMarkToggleRow", () => {
  it("renders the three statuses with aria wiring", () => {
    render(tree(seedCache(null), []));
    expect(screen.getByTestId("study-mark-learning")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("study-mark-toggle")).toHaveAttribute("aria-label", zhDict["plans.markGroupAria"]);
    expect(screen.getByTestId("probe-mark")).toHaveTextContent("none");
  });

  it("setting a mark flips the cached node optimistically, then the wire confirms", async () => {
    render(tree(seedCache(null), [markMock("finished")]));
    fireEvent.click(screen.getByTestId("study-mark-finished"));
    // The optimistic overlay flips the cached node immediately (the wire
    // answer rides the same write).
    await waitFor(() => expect(screen.getByTestId("probe-mark")).toHaveTextContent("finished"));
    await waitFor(() => expect(screen.getByTestId("study-mark-finished")).not.toHaveClass("opacity-70"));
  });

  it("clicking the ACTIVE mark clears it (revocation → mark null on the wire)", async () => {
    const cache = seedCache("skipped");
    render(tree(cache, [markMock(null)], "skipped"));
    expect(screen.getByTestId("probe-mark")).toHaveTextContent("skipped");
    fireEvent.click(screen.getByTestId("study-mark-skipped"));
    await waitFor(() => expect(screen.getByTestId("probe-mark")).toHaveTextContent("none"));
  });
});
