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

**Status:** ready-for-agent

**Bound by:** the GraphqlSpecHelpers idiom (`spec/support/graphql_helpers.rb` — `graphql()`,
`error_code()`, `token_for`), the error-code conventions already on the wire (NOT_FOUND 90 /
VALIDATION_FAILED 53 / UNAUTHORIZED 40 usages), the command specs as the domain-truth source
(`spec/commands/ai/map_material_sections_command_spec.rb`,
`spec/commands/materials/confirm|reject_mapping_proposals_command_spec.rb`), and the
auth_surface_spec field roster (stays green).

- [ ] New mapping-ops request spec: ≥no-token / happy / foreign / validation groups for all three
      mutations, provider stubbed per the graphql_ai_mutations pattern
- [ ] graphql_ai_mutations_spec.rb: the three AI-side wire error paths added
- [ ] graphql_evidence_quiz_flashcards_spec.rb: rateFlashcard VALIDATION_FAILED wire path added
- [ ] Every new assertion derived from an existing command-spec contract (no invented codes)
- [ ] Full backend gates green; wire-map tally updated in Comments (74/74, per-code counts)

## Comments

- (none yet)
