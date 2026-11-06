# frozen_string_literal: true

module Ai
  # GenerateTodaySuggestion (epic-18 T2, spec decisions 7–11): the
  # generation-backed Today suggestion — the GenerateStudyFocus/GenerateNote
  # family shape (assemble the context server-side, ONE cap-counted provider
  # call, persist the reply). The heuristic v1 card in Hubs.today is UNTOUCHED
  # by this command (addition, not replacement — decision 7): the AI
  # suggestion is produced ONLY by this explicit mutation (never on hub load
  # — no surprise spend), and the client falls back to v1 on any failure.
  #
  # Replay-before-spend on a DETERMINISTIC client uuid (decision 9): the
  # client derives it as uuid5 over the user-scoped namespace + planId + UTC
  # day (Ai::TodaySuggestionKey — the exact derivation pinned in its unit
  # spec; ticket 04's frontend mirrors it). An owned uuid returns the
  # persisted row with ZERO provider calls and ZERO cap consumption — a
  # regeneration within the same UTC day re-reads for free, a new day spends
  # again; a uuid owned by a different user → VALIDATION_FAILED before
  # anything is spent. The per-(plan, UTC day) law is ALSO server-enforced:
  # a NEW spend must carry exactly the current day's derived uuid — any
  # other uuid-shaped input is VALIDATION_FAILED (the replay check runs
  # FIRST, so an owned older-day uuid still replays free). Replay precedes
  # the usable-candidate gate too — a retry stays safe even if the plan's
  # mappings changed since the original attempt.
  #
  # Candidate assembly (the SAME server-truth sources Hubs.today reads): the
  # plan's nodes that carry a CONFIRMED mapping (the material_node_mappings
  # join the v1 heuristic uses) and do NOT read mastered (Mastery.node_stats
  # — the ONE scorer, AD-14 — with `now` injected, freshness semantics
  # matching the wire), weakest-first (score asc, then order — the v1
  # ordering), each carrying its OPEN MistakeEntry count (`resolved: false` —
  # a reviewed mistake stops feeding the suggestion; the targeting bonus's
  # any-entry rule is quiz-only and untouched). The prompt rides titles +
  # server-computed facts ONLY — no section text, no material content (the
  # title-only leak discipline; the model never sees content it could quote).
  #
  # The reply {nodeId, nodeTitle, reason} is validated against the plan's
  # ACTUAL candidates: the reply's nodeId must resolve to one of the nodes
  # the prompt presented — an invented id, a real-but-outside-vocabulary node
  # (unmapped or mastered), or a reason-less reply is UNUSABLE and fails
  # honestly (INTERNAL, decision 9): no fabricated fallback server-side, the
  # client keeps its v1 card. The reply's nodeTitle echo is never trusted —
  # the wire's title resolves through the persisted row's node (the
  # study-focus posture: the server owns addresses and names).
  #
  # Failure surface: user-arg problems → VALIDATION_FAILED / NOT_FOUND (the
  # plan resolves through current_user uniformly — malformed, unknown, and
  # foreign ids answer the same NOT_FOUND); zero usable candidates →
  # INTERNAL with an honest message (nothing spent — the cap counter does
  # not move); cap → CAP_REACHED (passed through from the seam); an unusable
  # provider reply → INTERNAL (the call already counted — cap law).
  class GenerateTodaySuggestionCommand < ApplicationCommand
    option :current_user
    option :client_uuid
    option :language
    option :plan_id

    def call
      return Failure(:VALIDATION_FAILED, { message: "language is invalid", field: :language }) unless Ai::LANGUAGES.include?(language.to_s)
      return uuid_shape_failure unless client_uuid.to_s.match?(Accounts::UUID_REGEX)

      resolved_plan = resolve_plan
      return resolved_plan if resolved_plan.failure?
      plan = resolved_plan.value!

      # Replay-before-spend (decision 9): an owned uuid returns the
      # persisted row untouched — ZERO provider calls, ZERO cap consumption;
      # a foreign uuid is VALIDATION_FAILED. Ahead of the day-key gate and
      # the usable-candidate gate: a retry must never refuse or spend where
      # its original attempt succeeded.
      existing = TodaySuggestion.find_by(client_uuid: client_uuid.to_s)
      return cross_user_uuid_failure if existing && existing.user_id != current_user.id
      return Success(suggestion: existing) if existing

      now = Time.current
      day = now.utc.to_date
      return key_mismatch_failure unless client_uuid.to_s == TodaySuggestionKey.derive(user_id: current_user.id, plan_id: plan.id, now: now)

      candidates = usable_candidates(plan, now)
      return internal_no_target_failure if candidates.empty?

      provider = Ai::Provider.complete(user: current_user,
                                       messages: Ai::Prompts.today_suggestion(language: language, candidates: candidates))
      return provider if provider.failure?

      chosen = normalize_reply(provider.value!, candidates)
      return internal_payload_failure unless chosen

      Success(suggestion: persist_suggestion(plan, chosen, day))
    end

    private

    # The plan through the owner's association path — malformed, unknown,
    # and foreign ids answer the uniform NOT_FOUND (AD-13, never an
    # existence leak).
    def resolve_plan
      return Failure(:NOT_FOUND, { message: "plan not found" }) unless plan_id.to_s.match?(Accounts::UUID_REGEX)

      plan = current_user.study_plans.find_by(id: plan_id)
      return Failure(:NOT_FOUND, { message: "plan not found" }) unless plan

      Success(plan)
    end

    # The prompt's candidate pool — the plan's non-mastered, CONFIRMED-mapped
    # nodes, weakest-first (score asc, then order — the v1 heuristic's
    # ordering), each with its OPEN mistake count. The server-truth sources
    # are exactly Hubs.today's: Mastery.node_stats + confirmed mappings +
    # MistakeEntry (the flag's open-only filter is THIS surface's ruling;
    # the quiz targeting bonus still rides any entry).
    def usable_candidates(plan, now)
      nodes = plan.knowledge_nodes.order(:order, :id).to_a
      return [] if nodes.empty?

      confirmed_node_ids = current_user.material_node_mappings
                                       .joins(:node)
                                       .where(status: "confirmed", knowledge_nodes: { plan_id: plan.id })
                                       .distinct.pluck(:node_id)
      return [] if confirmed_node_ids.empty?

      evidence = EvidenceRecord.where(user_id: current_user.id, node_id: confirmed_node_ids)
                               .order(:created_at, :id)
                               .group_by(&:node_id)
      open_mistakes = MistakeEntry.where(user_id: current_user.id, node_id: confirmed_node_ids, resolved: false)
                                  .group(:node_id).count

      nodes.filter_map do |node|
        next unless confirmed_node_ids.include?(node.id)

        stats = Mastery.node_stats(evidence[node.id] || [], now: now)
        next if stats.state == "mastered"

        { node: node, score: stats.score, state: stats.state, open_mistakes: open_mistakes[node.id].to_i }
      end.sort_by { |candidate| [ candidate[:score], candidate[:node].order ] }
    end

    # The reply contract: nodeId must resolve to a PRESENTED candidate (the
    # plan's actual usable vocabulary — anything else is unusable) and the
    # reason must be non-empty (the card explains itself or it is nothing).
    # The nodeTitle echo is parsed but never trusted — the wire's title
    # resolves through the persisted node. No fabricated fallback: an
    # unusable reply is an honest INTERNAL.
    def normalize_reply(raw, candidates)
      payload = Ai::ResponseParser.extract_json_object(raw)
      return nil unless payload

      parsed = JSON.parse(payload)
      return nil unless parsed.is_a?(Hash)

      chosen = candidates.find { |candidate| candidate[:node].id == parsed["nodeId"].to_s.strip }
      return nil unless chosen

      reason = parsed["reason"].to_s.strip
      return nil if reason.empty?

      { node: chosen[:node], reason: reason }
    end

    # The one write path: ONE row per (user, plan, UTC day) — the
    # deterministic client uuid (verified above to be the day's derived
    # key) is the unique replay address; the day stamp is the server's UTC
    # day.
    def persist_suggestion(plan, chosen, day)
      TodaySuggestion.create!(user: current_user, plan: plan, node: chosen[:node],
                              reason: chosen[:reason], client_uuid: client_uuid.to_s, day: day)
    end

    def internal_no_target_failure
      Failure(:INTERNAL,
              { message: "no usable suggestion target — the plan has no non-mastered node with a confirmed mapping" })
    end

    def internal_payload_failure
      Failure(:INTERNAL, { message: "ai today suggestion payload was unusable — the node id did not resolve to a candidate" })
    end

    def cross_user_uuid_failure
      Failure(:VALIDATION_FAILED,
              { message: "client uuid already belongs to another user's today suggestion", field: :clientUuid })
    end

    def key_mismatch_failure
      Failure(:VALIDATION_FAILED,
              { message: "client uuid is not this plan's deterministic key for the current UTC day", field: :clientUuid })
    end

    def uuid_shape_failure
      Failure(:VALIDATION_FAILED, { message: "client uuid is not uuid-shaped", field: :clientUuid })
    end
  end
end
