# frozen_string_literal: true

module Mutations
  module Ai
    # generateNote (FR-40, epic P2-12 T1; delta decisions 1+4+5): server-side
    # note generation — the server assembles the scope's context, makes ONE
    # cap-counted provider call, and persists the Markdown reply as a
    # user-scoped Note. The client_uuid keeps its delta-3 replay semantics: a
    # same-user replay returns the existing note without a provider call (a
    # retry never spends two cap calls). Scope: exactly ONE of planId /
    # nodeId / materialId, matching the scope value. The enrichAt input is
    # the user-requested annotation — one [[enrich|user|…]] marker placed
    # after the matching paragraph (substring) or at the end of the body.
    class GenerateNote < BaseMutation
      description "Generate a standalone, exportable Markdown study note in the given scope (plan, node, or material) — server-side AI (FR-40). One AI call per generation (the daily cap counts it); the client uuid replays deterministically."

      argument :client_uuid, String,
               required: true,
               description: "The client-supplied note uuid — the replay key (delta 3). A same-user replay returns the existing note without a provider call."
      argument :scope, String,
               required: true,
               description: "The note's scope: \"plan\" | \"node\" | \"material\" — exactly one scope id must ride with it."
      argument :language, String,
               required: true,
               description: "The reply language: \"zh\" | \"en\" (AD-16 — one parameter, one policy)."
      argument :plan_id, String,
               required: false,
               description: "The plan scope's uuid (the scope must be \"plan\")."
      argument :node_id, String,
               required: false,
               description: "The node scope's uuid — a plan node (the scope must be \"node\")."
      argument :material_id, String,
               required: false,
               description: "The material scope's uuid (the scope must be \"material\")."
      argument :enrich_at, String,
               required: false,
               description: "The user-requested annotation's free text — one [[enrich|user|…]] marker placed right after the paragraph whose text contains it, or at the end of the body when nothing matches."

      field :note, Types::NoteType,
            null: false,
            description: "The created (or replayed) note."

      def resolve(client_uuid:, scope:, language:, plan_id: nil, node_id: nil, material_id: nil, enrich_at: nil)
        command_result(::Ai::GenerateNoteCommand.call(
          current_user: current_user!,
          client_uuid: client_uuid,
          scope: scope,
          language: language,
          plan_id: plan_id,
          node_id: node_id,
          material_id: material_id,
          enrich_at: enrich_at
        ))
      end
    end
  end
end
