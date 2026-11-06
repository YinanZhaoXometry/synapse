# frozen_string_literal: true

module Mutations
  module Ai
    # generateTodaySuggestion (epic-18 T2, spec decisions 7–11): the
    # explicit, cap-counted, replay-safe AI generation that proposes ONE
    # "study next" node for a plan with a one-line reason. The heuristic v1
    # card in todayHub is untouched — this is the ADDITION, produced only by
    # this explicit action (never on hub load — no surprise spend). The
    # clientUuid is the DETERMINISTIC per-(user, plan, UTC day) replay key
    # (uuid5 over the user-scoped namespace + planId + UTC day —
    # Ai::TodaySuggestionKey; the frontend derives it, the command
    # re-verifies it server-side): a same-day regeneration returns the
    # persisted row without a provider call (ZERO cap consumption); a new
    # day spends again. The plan must carry ≥1 non-mastered node with a
    # confirmed mapping — INTERNAL honestly when not (nothing is spent); an
    # unusable AI reply (an unresolvable nodeId, no usable reason) is
    # INTERNAL honestly too — the client keeps its v1 card, no fabricated
    # fallback server-side.
    class GenerateTodaySuggestion < BaseMutation
      description "Generate the caller's AI \"study next\" suggestion for one plan — one node + a one-line reason grounded in server-computed mastery facts (epic-18). Server-side AI: one AI call per UTC day (the daily cap counts it); the deterministic client uuid replays the day's row for free; the heuristic v1 Today-hub suggestion stays untouched."

      argument :client_uuid, String,
               required: true,
               description: "The client-derived deterministic replay key — uuid5 over the user-scoped namespace + planId + UTC day (Ai::TodaySuggestionKey's pinned derivation; the frontend mirrors it). A same-day regeneration returns the persisted suggestion without a provider call."

      argument :language, String,
               required: true,
               description: "The reply language: \"zh\" | \"en\" (AD-16 — one parameter, one policy)."

      argument :plan_id, String,
               required: true,
               description: "The plan to suggest for. Unknown, foreign, or malformed ids are NOT_FOUND; a plan with no non-mastered mapped node is INTERNAL (nothing to base a suggestion on, nothing spent)."

      field :today_suggestion, Types::AiTodaySuggestionType,
            null: false,
            description: "The created (or replayed) suggestion."

      def resolve(client_uuid:, language:, plan_id:)
        command_result(::Ai::GenerateTodaySuggestionCommand.call(
          current_user: current_user!,
          client_uuid: client_uuid,
          language: language,
          plan_id: plan_id
        ))
      end
    end
  end
end
