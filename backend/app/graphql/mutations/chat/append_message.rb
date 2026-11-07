# frozen_string_literal: true

module Mutations
  module Chat
    # Append one message to a scope's Companion transcript (a material's
    # reader thread, or — epic-25 T1 — a plan's tutor thread) — thin per
    # AD-12: parse → authorize (current_user!) → command → map. Every rule
    # (the exactly-one of materialId/planId addressing, the 1:1 thread
    # created on first append, the server-minted id/createdAt, role/locator
    # validation, the NOT_FOUND scope addressing) lives in
    # ::Chat::AppendMessageCommand — note the leading :: (ticket 01's trap:
    # a bare Chat:: inside Mutations::Chat lexically resolves to
    # Mutations::Chat::); failure mapping lives in
    # Mutations::BaseMutation#command_result via the epic-01 ErrorPresenter.
    # materialId required→optional is wire-compatible for existing clients
    # (epic-25 decision 2) — the command's exactly-one rule is the gate.
    class AppendMessage < BaseMutation
      description "Append one message to a scope's Companion transcript — a material's (the reader) or a plan's (the tutor page; exactly one of materialId / planId is required). The thread is created on first append (1:1 with its scope, AD-5). The message id and createdAt are server-minted. Not replay-idempotent: every call appends (no client uuid exists on the Phase-1 op). Cross-user scope ids are NOT_FOUND."

      argument :material_id, String,
               required: false,
               description: "The anchored material's uuid (the material scope). Unknown, foreign, or malformed ids are NOT_FOUND. Exactly one of materialId / planId is required."

      argument :plan_id, String,
               required: false,
               description: "The anchored plan's uuid (the plan scope, epic-25 T1). Unknown, foreign, or malformed ids are NOT_FOUND. Exactly one of materialId / planId is required."

      argument :message, Types::ChatMessageInput,
               required: true,
               description: "The message: role, text, citations."

      field :message, Types::ChatMessageType,
            null: false,
            description: "The stored message as read back (with its server-minted id and createdAt)."

      def resolve(material_id: nil, plan_id: nil, message:)
        command_result(::Chat::AppendMessageCommand.call(
          current_user: current_user!,
          material_id: material_id,
          plan_id: plan_id,
          message: message.to_h
        ))
      end
    end
  end
end
