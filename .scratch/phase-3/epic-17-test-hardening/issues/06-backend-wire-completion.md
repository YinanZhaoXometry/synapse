# 06: Backend wire completion — 74/74 GraphQL ops exercised over HTTP; 4 weak mutations get error codes

**What to build:** close the wire map's last holes. (a) New
`spec/requests/graphql_material_mapping_ops_spec.rb` gives the three mapping mutations what every
other mutation has: no-token UNAUTHORIZED group, happy path (mapMaterialSections against the same
provider-stub pattern the AI mutation specs use → proposals minted → confirm → rows read back via
materialNodeMappings; the reject path too), foreign-id scoping per the commands' pinned contracts
(uniform NOT_FOUND / VALIDATION_FAILED), and the validation legs (empty id list, detached
material, unknown ids). (b) Amend the existing request specs so the four happy-only mutations
assert their failure codes over the wire: generateFlashcards (CAP_REACHED, foreign material
NOT_FOUND), gradeOpenAnswer (VALIDATION_FAILED, CAP_REACHED), createStreamTicket (CAP_REACHED at
mint), rateFlashcard (VALIDATION_FAILED on a bad outcome).

**Blocked by:** —.

**Status:** done (2026-11-06)

**Bound by:** the GraphqlSpecHelpers idiom (`spec/support/graphql_helpers.rb` — `graphql()`,
`error_code()`, `token_for`), the error-code conventions already on the wire (NOT_FOUND 90 /
VALIDATION_FAILED 53 / UNAUTHORIZED 40 usages), the command specs as the domain-truth source
(`spec/commands/ai/map_material_sections_command_spec.rb`,
`spec/commands/materials/confirm|reject_mapping_proposals_command_spec.rb`), and the
auth_surface_spec field roster (stays green).

- [x] New mapping-ops request spec: no-token / happy / foreign / validation groups for all three
      mutations, provider stubbed per the graphql_ai_mutations pattern
- [x] graphql_ai_mutations_spec.rb: the AI-side wire error paths added
- [x] graphql_evidence_quiz_flashcards_spec.rb: rateFlashcard VALIDATION_FAILED wire path added
- [x] Every new assertion derived from an existing command-spec contract (no invented codes)
- [x] Full backend gates green; wire-map tally updated in Comments

## Comments

- **Wire map now 74/74** — every Query and Mutation field is executed as a real GraphQL document
  over HTTP. Suite moved 1290 → **1304 examples, 0 failures**; rubocop clean.
- New file `spec/requests/graphql_material_mapping_ops_spec.rb` (10 examples): no-token
  UNAUTHORIZED ×3; mapMaterialSections happy (document-order payload, proposed statuses, nodeId /
  proposedNodeTitle / Unmapped row, cap counter == 1) + foreign NOT_FOUND (adapter never called,
  counter empty) + three VALIDATION_FAILED legs (bad language / no sections / detached material);
  confirm happy (ONE deduped node for the proposed-title group, order max+1, row flip incl.
  onto-existing) + empty-list VALIDATION_FAILED + unknown-id NOT_FOUND with nothing changed;
  reject happy (proposal kept as history) + foreign NOT_FOUND.
- Amendments: generateFlashcards +CAP_REACHED (counter pre-seeded via the
  `:ai_usage_counter` factory — plain `create!` fails on the nil `day` column) and +foreign
  NOT_FOUND; gradeOpenAnswer +VALIDATION_FAILED (20_001-char answer, refused before the seam) and
  +CAP_REACHED; createStreamTicket +RATE_LIMITED (MAX_LIVE_TICKETS=10 live tickets — mint-side
  has NO cap: CAP_REACHED lives in the adapter seam, reached only at redemption/stream, already
  covered by api_stream_spec — the ticket's original wording was corrected here); rateFlashcard
  +VALIDATION_FAILED (`difficulty: "brutal"`).
- Ruby heredoc trap worth remembering: `graphql(<<~TAG, variables: { ...multiline hash... })`
  parses the hash's continuation lines as the heredoc body — the file's established idiom
  (assign `variables` first, keep the heredoc line short) exists for exactly this reason; the
  first draft tripped it.
