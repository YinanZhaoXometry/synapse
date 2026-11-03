# 04: ChatThread + ReadingProgress + SectionMarking operations

**What to build:** ChatThread persistence (messages with role/content/citations, plan/task/material anchor); ReadingProgress writes carrying the domain `ReadingPosition` verbatim (locator = PDF page | Markdown section id, + extracted text); SectionMarking claim/unmark (claim, never evidence — FR-15's rule survives server-side).

**Blocked by:** 1.

**Status:** ready-for-agent

**Bound by:** AD-2 (`ReadingPosition` is a domain type — one shape end to end), AD-5 (chat threads anchor to a Material), AD-13 (scoping), FR-15 (marking moves no score).

- [ ] Thread/message persistence ops; citations round-trip
- [ ] ReadingProgress upsert keyed by material; locator+text shape identical to web's domain type
- [ ] Marking claim/unmark ops; evidence table untouched (asserted)
- [ ] Scoping context green across all three
