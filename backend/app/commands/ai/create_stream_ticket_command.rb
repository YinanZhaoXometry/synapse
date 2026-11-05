# frozen_string_literal: true

module Ai
  # CreateStreamTicket (AD-16/AD-15, epic P2-5 ticket 04): mint the opaque
  # single-use secret for one streamed AI op, bound to current_user + op,
  # carrying the grounding inputs INSIDE the payload jsonb (kickoff delta 4
  # — ReadingPosition text is up to 100k chars and query params are
  # log-exposed). Redeemable once, within the TTL (~60s, AD-16), by
  # GET /api/stream?ticket=…&op=….
  #
  # The payload shapes ARE the frozen contract epic-08's client consumes
  # (see ticket 04's ## Comments): companion = {material_id, question,
  # locator, text, escalated, language, selection?} (selection is epic-13
  # T1's FR-13 grounding input — it rides ONLY when present, so the pre-T1
  # shape stays byte-identical for selection-less turns); proposal = {topic,
  # goal, language}; plan_companion = {plan_id, question, language,
  # mistake_entry_id?} (epic P2-12 T3, FR-46) — string-keyed, TS keys
  # verbatim.
  class CreateStreamTicketCommand < ApplicationCommand
    include ReadingLocators

    option :current_user
    option :op
    option :language
    option :material_id, optional: true
    option :question, optional: true
    option :position, optional: true
    option :escalated, optional: true
    option :selection, optional: true
    option :topic, optional: true
    option :goal, optional: true
    option :plan_id, optional: true
    option :mistake_entry_id, optional: true

    MAX_QUESTION_CHARS = 20_000
    MAX_TOPIC_CHARS = 500
    MAX_GOAL_CHARS = 2_000

    # Mint-time hoarding bound (epic review finding P1): the daily cap
    # counts REDEEMS, not mints, so without this a logged-in client could
    # loop createStreamTicket and grow dead rows (each up to ~300KB of
    # payload) forever. A user holds at most this many live (unconsumed,
    # unexpired) tickets; mint #11 is RATE_LIMITED. The count→create
    # window is a tolerated race — the bound is anti-hoarding, not exact.
    MAX_LIVE_TICKETS = 10

    def call
      return Failure(:VALIDATION_FAILED, { message: "op is invalid", field: :op }) unless Ai::STREAM_OPS.include?(op.to_s)
      return Failure(:VALIDATION_FAILED, { message: "language is invalid", field: :language }) unless Ai::LANGUAGES.include?(language.to_s)

      payload = case op.to_s
      when "companion" then companion_payload
      when "proposal" then proposal_payload
      else plan_companion_payload
      end
      return payload if payload.failure?

      if current_user.stream_tickets.where(consumed_at: nil).where(expires_at: Time.current..).count >= MAX_LIVE_TICKETS
        return Failure(:RATE_LIMITED, { message: "too many live stream tickets" })
      end

      ticket = current_user.stream_tickets.create!(
        op: op,
        token: SecureRandom.urlsafe_base64(32),
        payload: payload.value!,
        expires_at: Ai.stream_ticket_ttl_seconds.seconds.from_now
      )
      Success(ticket: ticket)
    end

    private

    # Companion inputs: an owned material (NOT_FOUND otherwise), a bounded
    # question, a validated ReadingPosition (the saveReadingProgress
    # validation, verbatim), and the optional selection grounding text
    # (epic-13 T1's FR-13 — the selection bar's Ask). `escalated` is the
    # ladder-amendment flag — server-side rung derivation reads it (never
    # trust a client-computed rung).
    def companion_payload
      return Failure(:VALIDATION_FAILED, { message: "the companion stream needs a material", field: :materialId }) unless material_id
      return Failure(:NOT_FOUND, { message: "material not found" }) unless material_id.to_s.match?(Accounts::UUID_REGEX)

      material = current_user.materials.find_by(id: material_id)
      return Failure(:NOT_FOUND, { message: "material not found" }) unless material

      question_text = question.to_s.strip
      return Failure(:VALIDATION_FAILED, { message: "the companion stream needs a question", field: :question }) if question_text.empty?
      if question_text.length > MAX_QUESTION_CHARS
        return Failure(:VALIDATION_FAILED, { message: "the question exceeds the length bound", field: :question })
      end

      return Failure(:VALIDATION_FAILED, { message: "the companion stream needs a reading position", field: :position }) unless position.is_a?(Hash)

      # The GraphQL ReadingPositionInput arrives as {locator:, text:} (the
      # saveReadingProgress shape) — validate the locator INSIDE it.
      locator = position[:locator]
      return Failure(:VALIDATION_FAILED, { message: "the reading position needs a locator", field: :position }) unless locator.is_a?(Hash)

      locator_failure = validate_locator!(locator, field: :position)
      return locator_failure if locator_failure

      # The selection grounding input (epic-13 T1, FR-13): the selected text,
      # bounded with the question's discipline. Blank (or absent) → the key
      # never rides — the frozen payload shape is unchanged for turns the
      # bar did not ask.
      selection_text = selection.to_s.strip
      if selection_text.length > MAX_QUESTION_CHARS
        return Failure(:VALIDATION_FAILED, { message: "the selection exceeds the length bound", field: :selection })
      end

      payload = {
        "material_id" => material.id,
        "question" => question_text,
        "locator" => locator_as_jsonb(locator),
        "text" => position[:text].to_s.slice(0, Materials::MAX_SECTION_CHARS),
        "escalated" => escalated == true,
        "language" => language
      }
      payload["selection"] = selection_text unless selection_text.empty?
      Success(payload)
    end

    # Proposal inputs: a bounded topic (+ optional goal). The transcript is
    # ephemeral (AD-5) — the ticket carries only this turn's inputs; the
    # confirmed plan persists through the existing confirmProposal flow.
    def proposal_payload
      topic_text = topic.to_s.strip
      return Failure(:VALIDATION_FAILED, { message: "the proposal stream needs a topic", field: :topic }) if topic_text.empty?
      return Failure(:VALIDATION_FAILED, { message: "the topic exceeds the length bound", field: :topic }) if topic_text.length > MAX_TOPIC_CHARS
      if goal.to_s.length > MAX_GOAL_CHARS
        return Failure(:VALIDATION_FAILED, { message: "the goal exceeds the length bound", field: :goal })
      end

      Success({
        "topic" => topic_text,
        "goal" => goal.to_s.strip,
        "language" => language
      })
    end

    # Plan-level companion inputs (FR-46, epic P2-12 T3): an owned plan
    # (uniform NOT_FOUND for foreign/malformed ids — the reads convention),
    # a question bounded like companion's, and an optional mistake entry
    # resolved through current_user.mistake_entries (the "analyze my
    # mistakes" grounding input — also uniform NOT_FOUND). The plan scope
    # carries no ReadingPosition, so nothing else crosses.
    def plan_companion_payload
      return Failure(:VALIDATION_FAILED, { message: "the plan companion stream needs a plan", field: :planId }) unless plan_id
      return Failure(:NOT_FOUND, { message: "plan not found" }) unless plan_id.to_s.match?(Accounts::UUID_REGEX)

      plan = current_user.study_plans.find_by(id: plan_id)
      return Failure(:NOT_FOUND, { message: "plan not found" }) unless plan

      entry = nil
      if mistake_entry_id
        return Failure(:NOT_FOUND, { message: "mistake entry not found" }) unless mistake_entry_id.to_s.match?(Accounts::UUID_REGEX)

        entry = current_user.mistake_entries.find_by(id: mistake_entry_id)
        return Failure(:NOT_FOUND, { message: "mistake entry not found" }) unless entry
      end

      question_text = question.to_s.strip
      return Failure(:VALIDATION_FAILED, { message: "the plan companion stream needs a question", field: :question }) if question_text.empty?
      if question_text.length > MAX_QUESTION_CHARS
        return Failure(:VALIDATION_FAILED, { message: "the question exceeds the length bound", field: :question })
      end

      payload = {
        "plan_id" => plan.id,
        "question" => question_text,
        "language" => language
      }
      payload["mistake_entry_id"] = entry.id if entry
      Success(payload)
    end
  end
end
