# frozen_string_literal: true

module Types
  # One node of a proposed stage (epic-16 T1): the proposal's per-node roadmap
  # metadata — the title plus the one-line description and optional flag the
  # renderer draws. Titles stay the edge vocabulary: the proposal's edges are
  # title-paired and resolve against these titles.
  class ProposedNodeInput < Types::BaseInputObject
    graphql_name "ProposedNodeInput"
    description "One node of a proposed stage, with its roadmap metadata (epic-16)."

    argument :title, String,
             required: true,
             description: "The node's title (unique across the proposal — edges address nodes by it)."

    argument :description, String,
             required: false,
             description: "The node's one-line description (nullable)."

    argument :optional, Boolean,
             required: false,
             description: "Whether the node may be skipped without losing the thread (default false)."
  end
end
