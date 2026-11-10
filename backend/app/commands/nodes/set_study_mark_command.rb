# frozen_string_literal: true

module Nodes
  # Set or clear a node's Study Mark (FR-47, epic-28 T1) — the user's
  # self-declared status (`learning | finished | skipped`, nil = unmarked),
  # revocable and idempotent both ways. ORTHOGONAL to mastery by contract
  # (ADR-0002): the write touches only `study_mark` — evidence and Mastery
  # are never read, never written, never consulted (the anti-drift suite
  # pins that nothing moved).
  #
  # Addressing follows the house uniform rule (the ClaimSectionCommand
  # posture): a non-uuid id addresses no row — the same NOT_FOUND a foreign
  # id gets; the node is resolved through the caller's own association path,
  # so another user's node is indistinguishable from an unknown one.
  class SetStudyMarkCommand < ApplicationCommand
    STUDY_MARKS = %w[learning finished skipped].freeze

    option :current_user
    option :node_id
    option :mark # string, or nil to clear

    def call
      return node_not_found unless node_id.to_s.match?(Accounts::UUID_REGEX)
      unless mark.nil? || STUDY_MARKS.include?(mark.to_s)
        return Failure(:VALIDATION_FAILED, { message: "mark must be one of: #{STUDY_MARKS.join(', ')}",
                                             field: :mark })
      end

      node = current_user.knowledge_nodes.find_by(id: node_id)
      return node_not_found unless node

      node.update!(study_mark: mark.nil? ? nil : mark.to_s)
      Success(node: node)
    end

    private

    def node_not_found
      Failure(:NOT_FOUND, { message: "node not found" })
    end
  end
end
