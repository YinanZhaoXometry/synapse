/**
 * Study Mark hooks (FR-47, epic-28 T3). One mutation: set/clear a node's
 * self-declared status. The mutation response spreads the full node
 * fragment, so Apollo's normalized cache absorbs it automatically — every
 * active plan read re-renders with the new mark, no refetch sweep needed.
 * A mark is NEVER evidence: nothing here touches mastery fields (AD-14) and
 * no client uuid is minted (the input has none, AD-12).
 */
import { useMutation } from "@apollo/client/react";
import { NodeStudyMarkSetDocument } from "@/types/graphql";
import type { StudyMark } from "../views";

export function useSetStudyMarkMutation() {
  return useMutation(NodeStudyMarkSetDocument);
}

export type { StudyMark };
