# T2 — frontend: one-message creation chat + attach-on-confirm (epic-27)

Status: in-progress

## Scope

- Seam: `CompanionService.generatePlanStructure(message, materials, language,
  onToken?, options?)` — server adapter streams `{op:"proposal", message,
  materials, language}`; sse-client's proposal branch mints
  `{message, materials, language}` tickets; simulated double templates from
  the message. codegen over the re-dumped schema.
- `CreationChat`: ONE multiline textarea (placeholder keeps the COMP5241
  example the e2e matches) + attach button (multi-file, upload-validation's
  accept/20MB rules, staged chips with remove) + send. Goal chips + goal
  override + topic input removed (their i18n keys retired with them — full
  table parity). Suggestions fill the message. Streaming preview unchanged
  (markdown, cap 900).
- Send: staged files parse CLIENT-side (`parseFile` dynamic import — AD-7),
  texts sliced to the command bound, ride the proposal stream.
- Confirm: createPlan → attach every staged file through `useMaterialUpload`
  (+ eager parse, PlanHomePage's handleFiles sequence) → navigate. Per-file
  failure toasts but never blocks landing.
- Stub provider + e2e: matcher follows the new prompt's first line; the e2e
  flows keep typing into the same placeholder and clicking 生成.

## AC

- [ ] Creation flow e2e green (stub provider serves the new prompt shape).
- [ ] Component tests: staged-file chips, remove, parse-then-send payload,
      confirm-attach sequence, goal-chip keys gone.
- [ ] Frontend four gates green; codegen freshness clean.
