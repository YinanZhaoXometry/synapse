# 02: Close — spine row with numbers, board row, baselines

**What to build:** the honest record: the spine Deferred row gains the measured numbers and the live tripwire; the board row 19 closes with baselines; the epic record is complete.

**Blocked by:** 1.

**Status:** done (2026-11-06; spine Deferred row closed with the measured numbers + the live tripwire, board row 19 done with baselines, epic record closed; web gates green on the records-only diff — backend untouched, e2e not re-run (21 green at T1 on the identical tree; this ticket edits records only))

**Bound by:** scope exception: THIS ticket edits `.scratch/phase-3/` + the ONE spine row ("Bundle code-splitting beyond lazy pdfjs") in `docs/architecture/architecture-synapse/architecture-synapse.md` only.

- [ ] Spine Deferred row → updated: code splitting landed (epic-19, 2026-11-06) with the measured before/after entry numbers; tripwire live (CI size-summary step + chunkSizeWarningLimit); consciously deferred follow-ups noted (vendor manualChunks; skeleton fallback)
- [ ] Board (`.scratch/phase-3/roadmap.md`): row 19 → done with baselines (rspec/vitest/e2e counts + the entry before/after deltas); epic.md Status → done; tickets → done
- [ ] Full gates green: `just spec` (web + api) — rspec ≥ 1452 asserted untouched, vitest ≥ 920, codegen fresh, mastery-vector anti-drift green (asserted untouched); e2e 21 green
- [ ] Memory notes reported to the coordinator (coordinator archives)

## Comments

- (none yet)
