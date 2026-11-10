# 03: Mistake-first due ordering + resolved-mistake re-open

**What to build:** When mistakes and flashcards are due the same day, mistakes list first (the review queue leads with known weak spots). A resolved mistake keeps its scheduled reviews (resolution means "currently recalled", not "never seen again" — the scan keeps ignoring `resolved`), but answering it wrong — or partially, or forfeiting — in any later quiz flips it back to unresolved, so the mistakes hub resurfaces it live.

**Blocked by:** None (can start immediately — file-disjoint from 01/02 except shared spec conventions).

**Status:** ready-for-agent

- [ ] The due list orders by `next_due_at` ascending, ties break mistakes before flashcards, then by id — asserted at the dueItems/Today query seam
- [ ] Resolved mistakes remain scheduled (scan unchanged on `resolved`) — pinned by a spec so a future "prune resolved" regression fails loudly
- [ ] Recording `wrong` or `partial` evidence for a question with a resolved MistakeEntry flips it back to `resolved = false` in the same fold; `correct` never touches it
- [ ] A forfeited answer re-opens identically (forfeits are graded wrong — no separate path)
- [ ] Request specs: ordering tie-break, re-open on wrong/partial/forfeit, no-op on correct; hub surface reflects the flipped entry through the existing mistakes queries
- [ ] Gates green: rspec, rubocop
