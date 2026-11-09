# frozen_string_literal: true

module Types
  module Ai
    # ProposalMaterialInput (epic-27): one attached material's client-extracted
    # content riding the proposal stream's ticket (the creation chat's
    # tailoring input). Parsing stays client-side (AD-7) — there is no
    # material row pre-create to presign against, so the extracted text IS the
    # grounding input, bounded at the command like companion's position text.
    class ProposalMaterialInput < Types::BaseInputObject
      description "proposal only: one attached material's client-extracted content (epic-27) — the proposal tailors the plan structure to it."

      argument :title, String,
               required: true,
               description: "The material's title (the filename minus its extension)."
      argument :kind, String,
               required: true,
               description: "\"pdf\" | \"markdown\" (pptx rides markdown — epic-13 T5)."
      argument :text, String,
               required: true,
               description: "The client-extracted plain text (≤ 20,000 chars — the command refuses beyond)."
    end
  end
end
