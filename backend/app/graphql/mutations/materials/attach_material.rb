# frozen_string_literal: true

module Mutations
  module Materials
    # Attach a material — thin per AD-12: parse → authorize (current_user!) →
    # command → map. Every attach rule (payload validation, the delta-6
    # section cap, idempotent replay, uuid ownership, plan/task scoping)
    # lives in ::Materials::AttachMaterialCommand; failure mapping lives in
    # Mutations::BaseMutation#command_result via the epic-01 ErrorPresenter.
    # No bytes argument exists — parsing stays client-side (AD-7) and file
    # bytes are epic-06's storage story (AD-13).
    class AttachMaterial < BaseMutation
      description "Attach a material (AD-7): metadata, client-extracted sections, and parse state — with file bytes explicitly absent. Idempotent on clientUuid: a re-upload replays to the existing row; a uuid owned by another user fails VALIDATION_FAILED. Per-section text is capped at 100,000 characters (VALIDATION_FAILED beyond)."

      argument :client_uuid, String,
               required: true,
               description: "Client-supplied material uuid (AD-12) — the idempotency key for the attach."

      argument :title, String,
               required: true,
               description: "The document title."

      argument :kind, String,
               required: true,
               description: "\"pdf\" or \"markdown\" (the Phase-1 Material kinds)."

      argument :size_bytes, Int,
               required: true,
               description: "The document's size in bytes, as reported by the client."

      argument :plan_id, String,
               required: false,
               description: "Attach under a plan (the FR-2 default attachment). Unknown or foreign ids are NOT_FOUND."

      argument :task_id, String,
               required: false,
               description: "Attach under a task. A task always already studies its material (the link is created with the task), so this conflicts VALIDATION_FAILED against a live task."

      argument :attachment_scope, String,
               required: false,
               description: "Where the material's content feeds (FR-44): \"plan\" (default — the whole plan's generation surfaces) or \"node\" (pinned to one node's surfaces only)."

      argument :node_id, String,
               required: false,
               description: "The plan node to pin to — required with attachmentScope node, refused otherwise. Must be a node of the material's plan; unknown or foreign ids are NOT_FOUND."

      argument :sections, [ Types::MaterialSectionInput ],
               required: true,
               description: "The client-extracted sections (Phase-1 MaterialSection[]). May be empty when nothing was parsed yet."

      argument :parse_state, String,
               required: false,
               description: "pending | parsing | parsed | failed. Defaults per Phase-1: \"parsed\" when sections exist, \"pending\" otherwise."

      argument :parse_failure_reason, String,
               required: false,
               description: "corrupt | encrypted | empty | unknown — only while parseState is failed."

      field :material, Types::MaterialType,
            null: false,
            description: "The attached (or replayed) material."

      def resolve(client_uuid:, title:, kind:, size_bytes:, sections:, plan_id: nil, task_id: nil,
                  attachment_scope: nil, node_id: nil, parse_state: nil, parse_failure_reason: nil)
        command_result(::Materials::AttachMaterialCommand.call(
          current_user: current_user!,
          client_uuid: client_uuid,
          title: title,
          kind: kind,
          size_bytes: size_bytes,
          plan_id: plan_id,
          task_id: task_id,
          attachment_scope: attachment_scope,
          node_id: node_id,
          sections: sections.map(&:to_h),
          parse_state: parse_state,
          parse_failure_reason: parse_failure_reason
        ))
      end
    end
  end
end
