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
# one note-generation mutation (FR-40, delta decisions 1+4+5); epic P2-09
# ticket 01 with the one weekly-goal setter (FR-25's Phase-2 half, delta
# decision 3); epic P2-09 ticket 03 with the three manual-task ops (FR-27's
# 今日学习 writes); epic P2-09 ticket 04 with the one hub retake (FR-42's
# fresh-attempt generation, deliberately not idempotent); epic P2-11 ticket
# 01 with the one plan-visibility flip (FR-38's Square opt-in/opt-out)
# (byte-level idempotence against the committed schema.graphql
# stays pinned by spec/graphql/schema_dump_spec.rb; this spec pins the
# surface shape itself).
RSpec.describe "GraphQL auth surface (epic P2-2 ticket 02)" do
  it "exposes exactly the auth mutations plus the epic-03 domain mutations plus the epic P2-6 presign, the epic P2-5 AI mutations, the epic P2-8 import, the epic P2-10 mapping + scope mutations, the epic P2-12 note mutation, the epic P2-09 weekly-goal setter, the epic P2-09 T3 manual-task ops, the epic P2-09 T4 hub retake, and the epic P2-11 T1 visibility flip" do
    expect(Types::MutationType.fields.keys).to contain_exactly(
      "register", "login",
      "createPlan", "confirmProposal", "updatePlan", "deletePlan", "setPlanVisibility",
      "createTask", "attachMaterial", "setMaterialParseResult", "setMaterialScope",
      "mapMaterialSections", "confirmMappingProposals", "rejectMappingProposals",
      "createQuizSession", "recordEvidence", "abandonQuizSession", "retakeQuizSession",
      "createFlashcards", "rateFlashcard",
      "appendChatMessage", "saveReadingProgress", "claimSection", "unclaimSection",
      "createMaterialUpload",
      "importDocument",
      "generateQuiz", "generateFlashcards", "gradeOpenAnswer", "createStreamTicket",
      "generateNote",
      "setWeeklyGoal",
      "addManualTask", "setManualTaskDone", "deleteManualTask"
    )
  end

  it "exposes no logout mutation (client-side token discard by design — epic-08)" do
    expect(Types::MutationType.fields.keys).not_to include("logout")
  end

  it "exposes a minimal User type — identity only, no credential material" do
    expect(Types::UserType.fields.keys).to contain_exactly("id", "email", "createdAt")
  end

  # The query-side auth posture, recorded by the epic P2-11 T2 exception:
  # the domain reads stay auth-guarded per kickoff delta 8 (proven on the
  # wire per surface — e.g. spec/requests/graphql_plans_spec.rb answers
  # UNAUTHORIZED for plans/plan without a token), and the schema's ONLY
  # unauthenticated-readable queries are the health liveness probe plus the
  # Square public reads — AD-13's single sanctioned exception (FR-39,
  # unauthenticated-readable BY DESIGN, structure-only via the reduced
  # SquarePlanType set, NFR-7; field-for-field pinned by
  # spec/graphql/square_public_types_spec.rb). This assertion records that
  # exception explicitly so the posture is legible here — it does not
  # weaken the mutation roster above, which is unchanged.
  it "exposes the Square public reads (epic P2-11 T2) — with health, the schema's only unauthenticated-readable queries (the AD-13 exception)" do
    expect(Types::QueryType.fields.keys).to include("squarePlans", "squarePlan")

    public_field_descriptions = Types::QueryType.fields
      .slice("squarePlans", "squarePlan").values.map(&:description).join(" ")
    expect(public_field_descriptions).to include("AD-13")
  end
end
