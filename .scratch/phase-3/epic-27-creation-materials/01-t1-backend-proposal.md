# T1 — backend: proposal payload carries message + materials (epic-27)

Status: in-progress

## Scope

- `Types::Ai::ProposalMaterialInput` (new input object: title/kind/text) +
  `createStreamTicket` args: `message` replaces `topic`+`goal`, `materials`
  rides the array. schema.graphql re-dumped (both stacks in the same change).
- `Ai::CreateStreamTicketCommand`: proposal payload = `{message, materials,
  language}` (string-keyed jsonb, TS-keys-verbatim convention). Bounds:
  message ≤ 4,000 chars; ≤ 5 materials; per-material text ≤ 20,000 chars
  (companion's question discipline); blank message / over-bound →
  VALIDATION_FAILED. Frozen-contract note amended in epic-05 ticket 04
  Comments (companion + plan_companion untouched).
- `Ai::Prompts.proposal(message:, materials:, language:)`: the message is the
  driver; materials render as a "Study material context" block (per-material
  8k chars, 30k total — the proposal reads shape, not full text; the quiz
  "ONLY allowed source" law does NOT apply — the message drives, the
  materials ground). Output tag contract unchanged (outline/proposal, 2–5
  stages, ≤ 16 nodes, unique titles, forward-only edges — the epic-16 spec
  pins survive); the proposal JSON's topic becomes "a short plan title
  derived from the message".
- `Api::StreamController#stream_proposal`: feeds the new payload through.

## AC

- [ ] Command specs: message bounds, materials count/text bounds, payload
      shape; companion + plan_companion payloads byte-identical (their specs
      untouched and green).
- [ ] Prompts spec: message renders; materials block renders + slices;
      ≤ 16-node constraint line intact (epic-16's pinned boundary).
- [ ] Stream request spec green over the new payload.
- [ ] rubocop + full rspec green (compose, worktree-isolated project).
