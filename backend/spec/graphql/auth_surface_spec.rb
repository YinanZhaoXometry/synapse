# frozen_string_literal: true

require "rails_helper"

# The contract immobility guard, kept current with the schema's growth: the
# epic P2-2 ticket 02 surface was exactly register/login + User; epic P2-3
# ticket 01 legitimately grew MutationType with the four Plans mutations,
# ticket 02 with the three Tasks/Materials mutations, ticket 03 with the
# five Quiz/Flashcards mutations, and ticket 04 with the four Chat/Progress/
# Markings mutations; epic P2-6 ticket 02 with the one Storage presign
# mutation; epic P2-5 tickets 03+04 with the three server-side AI mutations and the ticket mint;
# epic P2-8 ticket 03 with the one first-login import mutation;
# epic P2-10 ticket 01 with the three mapping mutations (the AI map run +
# the user's bulk confirm/reject verdicts, FR-45) and ticket 02 with the one
# attachment-scope mutation (pin/widen, FR-44); epic P2-12 ticket 01 with the
# one note-generation mutation (FR-40, delta decisions 1+4+5)
# (byte-level idempotence against the committed schema.graphql
# stays pinned by spec/graphql/schema_dump_spec.rb; this spec pins the
# surface shape itself).
RSpec.describe "GraphQL auth surface (epic P2-2 ticket 02)" do
  it "exposes exactly the auth mutations plus the epic-03 domain mutations plus the epic P2-6 presign, the epic P2-5 AI mutations, the epic P2-8 import, the epic P2-10 mapping + scope mutations, and the epic P2-12 note mutation" do
    expect(Types::MutationType.fields.keys).to contain_exactly(
      "register", "login",
      "createPlan", "confirmProposal", "updatePlan", "deletePlan",
      "createTask", "attachMaterial", "setMaterialParseResult", "setMaterialScope",
      "mapMaterialSections", "confirmMappingProposals", "rejectMappingProposals",
      "createQuizSession", "recordEvidence", "abandonQuizSession",
      "createFlashcards", "rateFlashcard",
      "appendChatMessage", "saveReadingProgress", "claimSection", "unclaimSection",
      "createMaterialUpload",
      "importDocument",
      "generateQuiz", "generateFlashcards", "gradeOpenAnswer", "createStreamTicket",
      "generateNote"
    )
  end

  it "exposes no logout mutation (client-side token discard by design — epic-08)" do
    expect(Types::MutationType.fields.keys).not_to include("logout")
  end

  it "exposes a minimal User type — identity only, no credential material" do
    expect(Types::UserType.fields.keys).to contain_exactly("id", "email", "createdAt")
  end
end
