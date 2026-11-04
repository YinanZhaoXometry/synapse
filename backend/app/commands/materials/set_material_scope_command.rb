# frozen_string_literal: true

module Materials
  # Set an EXISTING material's attachment scope (FR-44, epic P2-10 T2) — the
  # pin/widen op: scope=node + nodeId pins the material to one plan node (its
  # sections then feed only that node's grounding + generation surfaces —
  # ContextAssembler.node_scope); scope=plan widens it back plan-wide (the
  # "re-attach plan-wide widens" flow, nodeId must be null). Deliberately a
  # separate op from attachMaterial: the attach's idempotent replay is a
  # no-op (delta 3) and can never express a mid-life scope change.
  #
  # Validation mirrors AttachMaterialCommand's matrix: scope=node requires a
  # nodeId and a plan attachment, the node must live in the material's plan,
  # and the task triangle has no node pinning (task materials reject the pin;
  # widening one is the harmless no-op it already reads as). The scope↔node
  # pairing failures are VALIDATION_FAILED; unknown/foreign/malformed
  # material and node ids are uniformly NOT_FOUND (delta 2 — no existence
  # leak). Idempotent: the same request returns the row unchanged (a no-op
  # update never touches the row).
  class SetMaterialScopeCommand < ApplicationCommand
    option :current_user
    option :material_id
    option :attachment_scope
    option :node_id, optional: true

    def call
      material = scoped_material
      return material if material.failure?

      scope_failure = validate_scope!(material.value!)
      return scope_failure if scope_failure

      if scope == "node"
        node = resolve_node
        return node if node.failure?
        unless node.value!.plan_id == material.value!.plan_id
          return Failure(:VALIDATION_FAILED,
                         { message: "the node is not in the material's plan", field: :nodeId })
        end
        material.value!.update!(attachment_scope: "node", node_id: node.value!.id)
      else
        material.value!.update!(attachment_scope: "plan", node_id: nil)
      end

      Success(material: material.value!.reload)
    end

    private

    # The material address is ownership-checked (delta 2): unknown, foreign,
    # and malformed ids are uniformly NOT_FOUND.
    def scoped_material
      return Failure(:NOT_FOUND, { message: "material not found" }) unless material_id.to_s.match?(Accounts::UUID_REGEX)

      material = current_user.materials.find_by(id: material_id)
      material ? Success(material) : Failure(:NOT_FOUND, { message: "material not found" })
    end

    def validate_scope!(material)
      unless Material.attachment_scopes.key?(attachment_scope.to_s)
        return Failure(:VALIDATION_FAILED,
                       { message: "attachment scope is invalid", field: :attachmentScope })
      end
      if material.task_id && (scope == "node" || node_id.present?)
        return Failure(:VALIDATION_FAILED,
                       { message: "a task material cannot pin to a plan node", field: :taskId })
      end
      if scope == "node" && node_id.blank?
        return Failure(:VALIDATION_FAILED,
                       { message: "a node pin needs a node id", field: :nodeId })
      end
      if scope != "node" && node_id.present?
        return Failure(:VALIDATION_FAILED,
                       { message: "a node id requires attachmentScope node", field: :nodeId })
      end
      if scope == "node" && material.plan_id.nil?
        return Failure(:VALIDATION_FAILED,
                       { message: "a node pin needs a plan attachment", field: :nodeId })
      end
      nil
    end

    # The node address is ownership-checked like the material's (delta 2).
    def resolve_node
      unless node_id.to_s.match?(Accounts::UUID_REGEX)
        return Failure(:NOT_FOUND, { message: "node not found" })
      end
      node = current_user.knowledge_nodes.find_by(id: node_id)
      node ? Success(node) : Failure(:NOT_FOUND, { message: "node not found" })
    end

    def scope
      attachment_scope.to_s
    end
  end
end
