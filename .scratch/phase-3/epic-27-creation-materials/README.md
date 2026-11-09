# Epic 27 — creation-materials: the creation chat reads the learner's files

Status: in-progress
Origin: 2026-11-09 owner grilling round — batch ③ of the three-batch consensus
(「全按推荐」, then 「继续完成余下所有」).

## Why

The owner's original product vision: 「在这个计划的页面，我创建新计划的时候，可以
通过上传文件然后附加上一段话的形式，让 AI 根据我的这个文件来为我量身定制一个学习
计划」. The shipped creation chat (FR-1, Q4(a)) generates from topic/goal alone —
the proposal prompt is the only AI surface with NO material context. This epic
reworks the surface to ONE free-form message + optional multi-file attachments,
and retires the goal chips.

## Tickets

- T1 backend proposal payload + prompt — [01-t1-backend-proposal.md](01-t1-backend-proposal.md)
- T2 frontend creation rework + attach-on-confirm — [02-t2-frontend-creation.md](02-t2-frontend-creation.md)

## Decisions

- **One message, no topic/goal fields.** The whole free-form text drives the
  proposal; the AI derives the plan's short topic for the proposal JSON. The
  goal-chip step (FR-1's Phase-2 consequence) is retired — the message subsumes
  it. PRD FR-1 amended (dated).
- **Materials ride the ticket as client-extracted text** (parsing stays
  client-side, AD-7 — the server has no parser and there is no material row
  pre-create to presign against). Same discipline as companion's position text:
  bounded at the command, sliced again at the prompt (the proposal reads the
  materials' shape, not their full text).
- **Attach-on-confirm**: the staged files attach through the standard
  attachMaterial → presign PUT → eager-parse flow right after createPlan
  succeeds (they are never re-uploaded manually). Attach failure per file
  toasts but never blocks landing on the plan (the plan exists; re-attach is
  the normal flow).
- ≤ 5 files at creation (payload sanity; FR-2's union stays open for
  post-creation attaches). ≤ 20 MB each (upload-validation unchanged).
- Stub provider (e2e) matcher updated to the new prompt's first line.
