# T4: Material attach — dropzone → registered, pending-parse Material (FR-2)

Status: done
Milestone: Phase 1 — Nov 6 core
Blocked by: 03-plan-home-light.md

## Parent

[Epic 2](../epic.md) (spec: [spec.md](../spec.md)).

## What to build

Attaching materials to a plan (FR-2, Q1): an upload dropzone on Plan Home (the attach CTA card when no materials exist; an upload action in the materials header afterwards) accepts PDF and Markdown up to 20 MB and rejects anything else with a clear bilingual reason. A valid file registers metadata + parse state "pending" in the material repository and holds the bytes in the session-blob registry — no parsing (that is the Reader's public API, next slice). The materials list reflects the new attachment immediately, and the plan-level material count updates. After a reload the metadata persists while the row honestly asks for the file again (session-only blob contract, owner-relaxed FR-29). Acceptance/size validation is a pure function, tested at the boundary.

## Acceptance criteria

- [x] Valid PDF or Markdown (≤ 20 MB) attaches to the plan: metadata row (title, kind, size) appears with parse state "pending"; the plan's material count updates (FR-2; AD-4)
- [x] Wrong-type uploads rejected with a bilingual reason naming what is supported today (PPT = Phase 2); oversized files rejected at the 20 MB boundary with a bilingual reason (FR-2)
- [x] File bytes go to the session-blob registry only — nothing persisted, no localStorage growth (AD-4; owner FR-29 decision)
- [x] No parsing happens and no parse-state promise is made beyond "pending" — the Reader owns `parse(file)` (AD-7; Q1)
- [x] After reload: material metadata survives; the row states the file needs re-uploading — reads as a known contract, not data loss (FR-29)
- [x] Attachment gates lift on Plan Home: generation quick actions become enabled-looking once a material exists (their real behavior still arrives with slices 4/6) (Q7)
- [x] Validators (extension/content-type accept list, size boundary) are pure functions with vitest coverage including the 20 MB boundary (Q8)
- [x] All new user-facing strings in the i18n table, zh + en (NFR-5)
- [x] Gates green: `npx tsc -b`, `npm run lint`, `npm run test`; grandfathered scaffold surfaces untouched (AD-9)
