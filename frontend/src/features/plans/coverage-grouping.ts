/**
 * The coverage panel's pure grouping logic (FR-45, epic P2-10 T1; delta
 * decision 3): every mapping row lands in exactly ONE group — confirmed →
 * Mapped; rejected → Rejected; proposed + existing node → the node's
 * Proposed group; proposed + gap title → the title's Proposed group;
 * proposed + neither → Unmapped (the explicit orphan list). Nothing is
 * silently dropped. Pure + React-free so the tests pin the partition
 * directly (display-shaping.ts precedent).
 */
import type { MaterialNodeMappingView } from "@/api/views";

export interface ProposedGroup {
  /** `node:<uuid>` for rows pointed at an existing node, `title:<title>` for a gap. */
  key: string;
  label: string;
  rows: MaterialNodeMappingView[];
}

export interface CoverageGroups {
  mapped: MaterialNodeMappingView[];
  proposedGroups: ProposedGroup[];
  rejected: MaterialNodeMappingView[];
  unmapped: MaterialNodeMappingView[];
}

export function coverageGroups(rows: MaterialNodeMappingView[]): CoverageGroups {
  const mapped: MaterialNodeMappingView[] = [];
  const rejected: MaterialNodeMappingView[] = [];
  const unmapped: MaterialNodeMappingView[] = [];
  const proposed = new Map<string, ProposedGroup>();

  for (const row of rows) {
    if (row.status === "confirmed") mapped.push(row);
    else if (row.status === "rejected") rejected.push(row);
    else if (row.nodeId) {
      const key = `node:${row.nodeId}`;
      const group = proposed.get(key) ?? { key, label: row.nodeId, rows: [] };
      group.rows.push(row);
      proposed.set(key, group);
    } else if (row.proposedNodeTitle) {
      const key = `title:${row.proposedNodeTitle}`;
      const group = proposed.get(key) ?? { key, label: row.proposedNodeTitle, rows: [] };
      group.rows.push(row);
      proposed.set(key, group);
    } else {
      unmapped.push(row);
    }
  }

  return { mapped, proposedGroups: [...proposed.values()], rejected, unmapped };
}
