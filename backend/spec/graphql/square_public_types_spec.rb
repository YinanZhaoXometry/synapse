# frozen_string_literal: true

require "rails_helper"

# The Square public types' structural leak-proof AC (epic P2-11 T2, FR-39 /
# NFR-7 / AD-13): the leak-proofing is STRUCTURAL — the public path exposes a
# separate, reduced type set with no content fields to select, not the shared
# authenticated types with fields toggled off (the epic P2-4 forward-note:
# KnowledgeNodeType's score resolvers compute for ANY node handed to them, so
# the public wiring must never hand one over — nor reference the type).
#
# Three axes, all at the schema level:
# 1. the public types expose EXACTLY the sanctioned structure field sets;
# 2. no field name from the authenticated content types' vocabulary appears
#    on the public types beyond that sanctioned set — new authenticated
#    fields automatically join the forbidden list;
# 3. the public types' field GRAPH never unwraps into an authenticated
#    object type — the only object edge is SquarePlanType →
#    SquareNodeSummaryType.
RSpec.describe "Square public types (epic P2-11 T2) — structurally leak-proof" do
  # The authenticated types whose fields are the leak surfaces NFR-7 forbids:
  # plan/node content and scores, materials + sections + the presigned byte
  # URL, evidence, quiz, flashcards, chat, progress, mistakes, mappings,
  # notes, and owner identity. Everything these expose is forbidden on the
  # public path unless explicitly sanctioned below.
  let(:authenticated_types) do
    [
      Types::StudyPlanType, Types::KnowledgeNodeType,
      Types::MaterialType, Types::MaterialSectionType,
      Types::EvidenceRecordType, Types::QuizSessionType,
      Types::FlashcardType, Types::ChatThreadType,
      Types::ReadingProgressType, Types::MistakeEntryType,
      Types::MaterialNodeMappingType, Types::NoteType, Types::UserType
    ]
  end

  # The ONLY wire names the Square may carry: the plan's structure header
  # (id/topic/goal/visibility/createdAt) and the node summary triple
  # (title/stage/order), plus the reduced list field itself.
  let(:sanctioned_names) do
    %w[id topic goal visibility createdAt nodeSummaries title stage order]
  end

  it "exposes exactly the structure-only field set on SquarePlanType" do
    expect(Types::SquarePlanType.fields.keys).to contain_exactly(
      "id", "topic", "goal", "visibility", "createdAt", "nodeSummaries"
    )
  end

  it "exposes exactly title/stage/order on SquareNodeSummaryType" do
    expect(Types::SquareNodeSummaryType.fields.keys).to contain_exactly(
      "title", "stage", "order"
    )
  end

  it "carries none of the ticket-named leak surfaces on either public type" do
    forbidden = %w[
      materials nodes masteryScore state userId downloadUrl
      annotations sections evidenceRecords questions
      quizSessions chatThread readingProgresses user task
    ]
    forbidden.each do |name|
      expect(Types::SquarePlanType.fields.keys).not_to include(name)
      expect(Types::SquareNodeSummaryType.fields.keys).not_to include(name)
    end
  end

  it "carries no authenticated field name beyond the sanctioned set (self-maintaining)" do
    forbidden_vocabulary = authenticated_types.flat_map { |type| type.fields.keys }.uniq - sanctioned_names

    (Types::SquarePlanType.fields.keys + Types::SquareNodeSummaryType.fields.keys).each do |name|
      expect(forbidden_vocabulary).not_to include(name),
        "the public types expose \"#{name}\" — an authenticated-surface field name outside the sanctioned structure set"
    end
  end

  it "never unwraps into an authenticated object type (the only object edge is plan → summary)" do
    all_fields = Types::SquarePlanType.fields.values + Types::SquareNodeSummaryType.fields.values

    all_fields.each do |field|
      expect(authenticated_types).not_to include(field.type.unwrap),
        "#{field.owner.graphql_name}.#{field.name} unwraps into #{field.type.unwrap} — an authenticated type is reachable from the public graph"
    end

    expect(Types::SquarePlanType.fields["nodeSummaries"].type.unwrap).to eq(Types::SquareNodeSummaryType)
  end
end
