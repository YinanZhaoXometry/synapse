# frozen_string_literal: true

module Mutations
  module Ai
    # createStreamTicket (AD-16, epic P2-5 ticket 04): mint the opaque
    # single-use, ~60s-TTL secret for ONE streamed AI op. The grounding
    # inputs ride INSIDE the ticket (not query params — kickoff delta 4);
    # the endpoint /api/stream authenticates by ticket alone. The client
    # disables auto-reconnect: on drop it mints a FRESH ticket and restarts
    # (counted against the cap).
    class CreateStreamTicket < BaseMutation
      description "Mint a single-use stream ticket for a streamed AI op (companion chat / plan proposal) — AD-16."

      argument :op, String,
               required: true,
               description: "The streamed op: \"companion\" | \"proposal\"."
      argument :language, String,
               required: true,
               description: "The reply language: \"zh\" | \"en\" (AD-16 — one parameter, one policy)."
      argument :material_id, String,
               required: false,
               description: "companion only: the material's uuid (ownership-checked)."
      argument :question, String,
               required: false,
               description: "companion only: the learner's question."
      argument :position, Types::ReadingPositionInput,
               required: false,
               description: "companion only: the current ReadingPosition (the grounding input)."
      argument :escalated, Boolean,
               required: false,
               description: "companion only: the escalation flag (the ladder amendment — true means the answer rung)."
      argument :topic, String,
               required: false,
               description: "proposal only: the plan topic."
      argument :goal, String,
               required: false,
               description: "proposal only: the optional goal."

      field :token, String,
            null: false,
            description: "The opaque single-use secret — carried as /api/stream?ticket=… (log exposure accepted, AD-16)."
      field :expires_at, Types::DateTime,
            null: false,
            description: "When the ticket dies (~60s TTL; expired → 401)."

      def resolve(op:, language:, material_id: nil, question: nil, position: nil, escalated: nil, topic: nil, goal: nil)
        result = command_result(::Ai::CreateStreamTicketCommand.call(
          current_user: current_user!,
          op: op,
          language: language,
          material_id: material_id,
          question: question,
          position: position&.to_h,
          escalated: escalated,
          topic: topic,
          goal: goal
        ))
        ticket = result[:ticket]
        { token: ticket.token, expires_at: ticket.expires_at }
      end
    end
  end
end
