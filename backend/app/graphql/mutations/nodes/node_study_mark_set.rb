# frozen_string_literal: true

module Mutations
  module Nodes
    # Set or clear a node's Study Mark (FR-47, epic-28 T1) — thin per AD-12:
    # parse → authorize (current_user!) → command → map. Every rule (the
    # enum membership, the uniform NOT_FOUND addressing, the idempotent
    # set/clear) lives in ::Nodes::SetStudyMarkCommand; failure mapping
    # lives in Mutations::BaseMutation#command_result via the epic-01
    # ErrorPresenter.
    class NodeStudyMarkSet < BaseMutation
      description "Set or clear a node's Study Mark (FR-47) — the user's self-declared status: learning | finished | skipped, or null to clear (idempotent both ways). A mark is a claim about where the user says they are, NEVER evidence — it can never move a Mastery Score. Cross-user node ids are NOT_FOUND."

      argument :node_id, String,
               required: true,
               description: "The marked node's uuid. Unknown, foreign, or malformed ids are NOT_FOUND."

      argument :mark, String,
               required: false,
               description: "The mark to set: learning | finished | skipped. Omitted or null clears the mark."

      field :node, Types::KnowledgeNodeType,
            null: false,
            description: "The updated node (with the new studyMark)."

      def resolve(node_id:, mark: nil)
        command_result(::Nodes::SetStudyMarkCommand.call(
          current_user: current_user!,
          node_id: node_id,
          mark: mark
        ))
      end
    end
  end
end
