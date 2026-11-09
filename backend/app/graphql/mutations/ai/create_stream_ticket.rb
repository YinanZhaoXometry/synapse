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
      description "Mint a single-use stream ticket for a streamed AI op (companion chat / plan proposal / plan-scope companion) — AD-16."

      argument :op, String,
               required: true,
               description: "The streamed op: \"companion\" | \"proposal\" | \"plan_companion\"."
      argument :language, String,
               required: true,
               description: "The reply language: \"zh\" | \"en\" (AD-16 — one parameter, one policy)."
      argument :material_id, String,
               required: false,
               description: "companion only: the material's uuid (ownership-checked)."
      argument :question, String,
               required: false,
               description: "companion / plan_companion: the learner's question."
      argument :position, Types::ReadingPositionInput,
               required: false,
               description: "companion only: the current ReadingPosition (the grounding input). The text is truncated to the 100k section bound when carried into the ticket."
      argument :selection, String,
               required: false,
               description: "companion only: the text selection the question grounds on (FR-13, epic-13 T1 — the reader's selection bar). Bounded like the question; blank input never rides the ticket."
      argument :escalated, Boolean,
               required: false,
               description: "companion only: the escalation flag (the ladder amendment — true means the answer rung)."
      argument :message, String,
               required: false,
               description: "proposal only: the learner's free-form creation message — topic, goal, any requirements, one text (epic-27)."
      argument :materials, [ Types::Ai::ProposalMaterialInput ],
               required: false,
               description: "proposal only: the attached materials' client-extracted content (≤ 5; parsing stays client-side, AD-7 — epic-27)."
      argument :plan_id, String,
               required: false,
               description: "plan_companion only: the plan's uuid (ownership-checked — FR-46, epic P2-12 T3)."
      argument :mistake_entry_id, String,
               required: false,
               description: "plan_companion only: the optional mistake entry's uuid — the \"analyze my mistakes\" grounding input (ownership-checked)."

      field :token, String,
            null: false,
            description: "The opaque single-use secret — carried as /api/stream?ticket=… (log exposure accepted, AD-16)."
      field :expires_at, Types::DateTime,
            null: false,
            description: "When the ticket dies (~60s TTL; expired → 401)."

      def resolve(op:, language:, material_id: nil, question: nil, position: nil, selection: nil, escalated: nil, message: nil, materials: nil, plan_id: nil, mistake_entry_id: nil)
        result = command_result(::Ai::CreateStreamTicketCommand.call(
          current_user: current_user!,
          op: op,
          language: language,
          material_id: material_id,
          question: question,
          position: position&.to_h,
          selection: selection,
          escalated: escalated,
          message: message,
          materials: materials&.map(&:to_h),
          plan_id: plan_id,
          mistake_entry_id: mistake_entry_id
        ))
        ticket = result[:ticket]
        { token: ticket.token, expires_at: ticket.expires_at }
      end
    end
  end
end
