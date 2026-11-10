# T2 — Key-path toasts (sonner + i18n zh/en)

Milestone: Phase 2 — post-deadline
Status: pending
Epic: epic-28-ux-hardening
Blocked by: T1 (lands first for the ?next= param keys; no coupling otherwise)

## Problem

Owner: 「用户关键路径的信息提示」缺失. Audit (2026-11-10): login/register success
silent (`LoginPage.tsx:43-45`, `RegisterPage.tsx:38-41`), plan created silent
(`CreationChat.tsx:206-229` onCompleted just navigates), task created silent AND task
create FAILURE silent (`TaskCreatePage.tsx:84-89` — onError only re-enables the
button), material upload success silent (failure toast exists,
`PlanHomePage.tsx:141`), deleteManualTask has NO onCompleted/onError at all
(`PlannerPage.tsx:261`).

## AC

1. Success/error toasts (sonner, `AppError.messageKey → t()` house pattern) at:
   - login success `auth.loginSuccess`, register success `auth.registerSuccess`
     (demo-entry paths included), signed-out via `out=1` param is T1's
     `auth.signedOut` toast.
   - plan created `plans.createSuccess` (CreationChat onCompleted, before navigate).
   - task created `tasks.createSuccess`; task create failure `tasks.createFailed`
     (the silent re-enable bug).
   - material upload success `materials.uploadSuccess` (PlanHomePage + TaskHomePage
     upload handlers).
   - deleteManualTask success `planner.deleteTaskSuccess` + failure
     `planner.deleteTaskFailed` (PlannerPage — today's only fully unguarded mutation).
2. Every new key added to `frontend/src/contexts/i18n-dictionary.ts` with zh+en —
   the full-table parity test is the gate.
3. No double-toasting where an inline error already surfaces (login failure stays
   inline-only; upload validation rejects keep their verdict toasts).
4. Vitest: one spec per added call-site asserting the toast fires on success/error
   (mock sonner or assert toast calls via the app's existing test conventions).
