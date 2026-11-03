# frozen_string_literal: true

module Mutations
  module Chat
    # Append one message to a material's Companion transcript — thin per
    # AD-12: parse → authorize (current_user!) → command → map. Every rule
    # (the 1:1 thread created on first append, the server-minted id/createdAt,
    # role/locator validation, the NOT_FOUND material addressing) lives in
    # ::Chat::AppendMessageCommand — note the leading :: (ticket 01's trap:
    # a bare Chat:: inside Mutations::Chat lexically resolves to
    # Mutations::Chat::); failure mapping lives in
    # Mutations::BaseMutation#command_result via the epic-01 ErrorPresenter.
    class AppendMessage < BaseMutation
      description "Append one message to a material's Companion transcript — the thread is created on first append (1:1 with the material, AD-5). The message id and createdAt are server-minted. Not replay-idempotent: every call appends (no client uuid exists on the Phase-1 op). Cross-user material ids are NOT_FOUND."

      argument :material_id, String,
               required: true,
               description: "The anchored material's uuid. Unknown, foreign, or malformed ids are NOT_FOUND."

      argument :message, Types::ChatMessageInput,
               required: true,
               description: "The message: role, text, citations."

      field :message, Types::ChatMessageType,
            null: false,
            description: "The stored message as read back (with its server-minted id and createdAt)."

      def resolve(material_id:, message:)
        command_result(::Chat::AppendMessageCommand.call(
          current_user: current_user!,
          material_id: material_id,
          message: message.to_h
        ))
      end
    end
  end
end
