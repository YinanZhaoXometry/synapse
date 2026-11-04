# frozen_string_literal: true

module Types
  # The open-answer grade (AD-5): outcome + rationale + optional citation —
  # the Phase-1 GradedAnswer shape realized server-side. Pure computation:
  # becoming evidence is recordEvidence's business (the client's follow-up).
  class GradedAnswerType < Types::BaseObject
    description "The server-side grade of an open answer (outcome, rationale, optional citation)."

    field :outcome, String,
          null: false,
          description: "\"correct\" | \"partial\" | \"wrong\" (the evidence vocabulary)."

    field :rationale, String,
          null: false,
          description: "The teaching explanation of the grade (in the requested language)."

    field :citation, Types::CitationType,
          null: true,
          description: "The supporting quote and its locator, when one matched."

    def outcome
      object.outcome
    end

    def rationale
      object.rationale
    end

    def citation
      object.citation
    end
  end
end
