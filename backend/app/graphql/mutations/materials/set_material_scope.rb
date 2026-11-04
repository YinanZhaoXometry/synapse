# frozen_string_literal: true

module Mutations
  module Materials
    # setMaterialScope (FR-44, epic P2-10 T2): pin an existing material to
    # one plan node or widen it back plan-wide — thin per AD-12. The command
    # owns the whole matrix (pairing rules, task-material rejection, node
    # membership, uniform NOT_FOUND, idempotent replay); failure mapping
    # lives in Mutations::BaseMutation#command_result via the epic-01
    # ErrorPresenter. Deliberately NOT an overload of attachMaterial: the
    # attach's client-uuid replay is a no-op and cannot express a mid-life
    # scope change.
    class SetMaterialScope < BaseMutation
      description "Set a material's attachment scope (FR-44, epic P2-10 T2): pin it to one plan node (attachmentScope \"node\" + nodeId) or widen it back plan-wide (attachmentScope \"plan\" — nodeId must be null). Task materials cannot pin. Idempotent: the same scope returns the row unchanged. Unknown or foreign material/node ids are NOT_FOUND and change nothing."

      argument :material_id, String,
               required: true,
               description: "The material's uuid. Unknown or foreign ids are NOT_FOUND."

      argument :attachment_scope, String,
               required: true,
               description: "\"plan\" (feeds the whole plan's generation surfaces) or \"node\" (feeds only the pinned node's surfaces)."

      argument :node_id, String,
               required: false,
               description: "The plan node to pin to — required with attachmentScope node, refused with plan. Must be a node of the material's plan; unknown or foreign ids are NOT_FOUND."

      field :material, Types::MaterialType,
            null: false,
            description: "The material after the scope change."

      def resolve(material_id:, attachment_scope:, node_id: nil)
        command_result(::Materials::SetMaterialScopeCommand.call(
          current_user: current_user!,
          material_id: material_id,
          attachment_scope: attachment_scope,
          node_id: node_id
        ))
      end
    end
  end
end
