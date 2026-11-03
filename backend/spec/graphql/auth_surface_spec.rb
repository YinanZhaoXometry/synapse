# frozen_string_literal: true

require "rails_helper"

# The contract immobility guard, kept current with the schema's growth: the
# epic P2-2 ticket 02 surface was exactly register/login + User; epic P2-3
# ticket 01 legitimately grew MutationType with the four Plans mutations,
# ticket 02 with the three Tasks/Materials mutations, and ticket 03 with the
# five Quiz/Flashcards mutations (byte-level idempotence against the
# committed schema.graphql stays pinned by spec/graphql/schema_dump_spec.rb;
# this spec pins the surface shape itself).
RSpec.describe "GraphQL auth surface (epic P2-2 ticket 02)" do
  it "exposes exactly the auth mutations plus the epic-03 Plans/Tasks/Materials/Quiz/Flashcards mutations" do
    expect(Types::MutationType.fields.keys).to contain_exactly(
      "register", "login",
      "createPlan", "confirmProposal", "updatePlan", "deletePlan",
      "createTask", "attachMaterial", "setMaterialParseResult",
      "createQuizSession", "recordEvidence", "abandonQuizSession",
      "createFlashcards", "rateFlashcard"
    )
  end

  it "exposes no logout mutation (client-side token discard by design — epic-08)" do
    expect(Types::MutationType.fields.keys).not_to include("logout")
  end

  it "exposes a minimal User type — identity only, no credential material" do
    expect(Types::UserType.fields.keys).to contain_exactly("id", "email", "createdAt")
  end
end
