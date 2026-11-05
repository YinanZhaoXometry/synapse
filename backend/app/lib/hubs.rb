# frozen_string_literal: true

require "set"

# The hub read model (epic P2-09 T1, delta decision 4): the aggregation layer
# behind the seven hub queries — mistakesHub, todayHub, flashcardDecksHub,
# quizHistoryHub, analyticsSeries, weeklyGoal, badgeState. Every method reads
# ONLY through the caller's own association paths (AD-13: the scoping IS the
# logic); every mastery read marshals through Mastery (app/lib/mastery.rb —
# the ONE scorer, AD-14/AD-6) with `now` injected so freshness semantics match
# the KnowledgeNodeType fields exactly; every week/day boundary follows the
# streak's UTC convention (ADR-0001, amended 2026-11-04): day keys are
# "YYYY-MM-DD" UTC strings (Mastery's utc_day_key convention) and weeks are
# ISO Monday-UTC. SM-C3: sessions, never minutes.
#
# Pure reads over the caller's rows — the sanctioned bare-read carve-out
# (backend/AGENTS.md): no command wraps a SELECT; these methods add grouping,
# windowing, and threshold decisions, not writes. `now` is always injected by
# the resolvers (Time.current) and by specs (a pinned clock).
module Hubs
  # delta decision 2's suggestion card shape (v1 partial): the web renders and
  # deep-links (/plan/:id/quiz?nodeId=); the server score stays the only truth.
  TodaySuggestion = Struct.new(:plan_id, :plan_title, :node_id, :node_title, keyword_init: true)

  # todayHub's three counts.
  TodaySummary = Struct.new(:due_count, :manual_count, :done_count, keyword_init: true)

  # flashcardDecksHub's one row per material that has flashcards.
  DeckSummary = Struct.new(:material_id, :material_title, :plan_id, :plan_title, :task_id,
                           :card_count, :created_at, keyword_init: true)

  # quizHistoryHub's session row: the score summary counts the session's
  # GRADED answers only (one EvidenceRecord per answered question — the quiz
  # results' own correctness definition, RecordEvidenceCommand); open
  # unanswered/awaiting questions are honestly excluded from correct/answered.
  QuizHistoryEntry = Struct.new(:session_id, :plan_id, :plan_title, :task_id, :mode,
                                :created_at, :question_count, :correct, :answered, keyword_init: true)

  # analyticsSeries' per-node row (masteryScore rides the wire as a String
  # carrying the integer percent — the KnowledgeNodeType convention, AD-6).
  NodeMasteryEntry = Struct.new(:node_id, :node_title, :plan_id, :score, :state, keyword_init: true)

  WeekAccuracyPoint = Struct.new(:week_start, :answered, :correct, keyword_init: true)
  ConsistencyPoint = Struct.new(:day, :session_count, keyword_init: true)

  # badgeState's per-badge row: the raw counter + its threshold — the
  # progressLabel string is T6's rendering concern (delta decision 1).
  BadgeState = Struct.new(:id, :unlocked, :counter, :threshold, keyword_init: true)

  # todayHub's full assembly (a struct so the type reads named members).
  TodayAssembly = Struct.new(:due, :suggestions, :manual, :summary, keyword_init: true)

  # weeklyGoal's row (delta decision 3).
  WeeklyGoal = Struct.new(:target, :current_week_sessions, :current_week_start, keyword_init: true)

  # delta decision 1's restated thresholds (T1 pins, T6 renders).
  THRESHOLDS = {
    "b1" => 1,   # first quiz — any quiz session exists
    "b2" => 3,   # streak 3 — Mastery.compute_streak
    "b3" => 7,   # streak 7
    "b4" => 10,  # flashcards — collection badge (no review-event tracking exists server-side)
    "b5" => 100, # evidence records
    "b6" => 5,   # evidence records whose node carries a mistake entry (复盘 — no reviewed flag exists)
    "b7" => 1,   # distinct mastered nodes, tier 1
    "b8" => 3,   # tier 2
    "b9" => 5,   # tier 3
    "b10" => 3,  # max DISTINCT evidence-producing sessions in one UTC day (SM-C3)
    "b11" => 1,  # a plan (≥1 node) whose every node reads mastered
    "b12" => 1   # any node scoring exactly 100
  }.freeze

  WEEKS_WINDOW = 8   # weeklyAccuracy: the last 8 ISO weeks including the current
  DAYS_WINDOW = 14   # consistency: the last 14 UTC days including today

  class << self
    # mistakesHub: every wrong answer (Choice + Open), flat, newest first —
    # grouping/filtering is the web's rendering concern (T2 decides).
    def mistakes(user)
      user.mistake_entries.order(created_at: :desc, id: :desc)
          .includes(:node, :question)
    end

    # todayHub's due slice — epic-07's due logic VERBATIM (the QueryType
    # dueItems resolver's exact relation: the materialized re-queue schedule,
    # inclusive by the UTC day's end, dead sources skipped) with the date
    # argument collapsed to the injected now. The schedule rows feed the SAME
    # DueItemType the dueItems query answers with.
    def due_items(user, now:)
      day_end = now.end_of_day
      user.requeue_schedules
          .where(next_due_at: ..day_end)
          .order(:next_due_at)
          .includes(:schedulable)
          .select { |schedule| schedule.schedulable }
    end

    # todayHub: due ∥ suggestions (delta decision 2's v1 partial slot) ∥
    # manual tasks, plus the summary counts.
    def today(user, now:)
      due = due_items(user, now: now)
      stats_by_id = node_stats_by_id(user, now: now)
      manual = user.manual_tasks.where(done: false)
                   .order(Arel.sql("due_date ASC NULLS LAST"), :created_at, :id).to_a
      TodayAssembly.new(
        due: due,
        suggestions: suggestions(user, stats_by_id, now: now),
        manual: manual,
        summary: TodaySummary.new(
          due_count: due.length,
          manual_count: manual.length,
          done_count: user.manual_tasks.where(done: true).count
        )
      )
    end

    # flashcardDecksHub: one row per material that has flashcards, grouped
    # server-side. createdAt is the deck MATERIAL's timestamp (the deck's
    # own creation moment — decision recorded in the ticket's ## Comments).
    def flashcard_decks(user)
      counts = user.flashcards.group(:material_id).count
      user.materials.where(id: counts.keys).includes(:plan)
          .sort_by { |material| [ material.created_at, material.id ] }
          .map do |material|
        DeckSummary.new(
          material_id: material.id,
          material_title: material.title,
          plan_id: material.plan_id,
          plan_title: material.plan&.topic,
          task_id: material.task_id,
          card_count: counts.fetch(material.id),
          created_at: material.created_at
        )
      end
    end

    # quizHistoryHub: every session newest first, graded answers only in the
    # score summary. Abandoned/active sessions ride at zero answers (honest).
    def quiz_history(user)
      records = user.evidence_records.order(:created_at, :id).to_a
      evidence_by_session = records.group_by(&:session_id)
      question_counts = user.questions.group(:session_id).count
      user.quiz_sessions.includes(:plan).order(created_at: :desc, id: :desc).map do |session|
        answered_records = evidence_by_session.fetch(session.id, [])
        QuizHistoryEntry.new(
          session_id: session.id,
          plan_id: session.plan_id,
          plan_title: session.plan&.topic,
          task_id: session.task_id,
          mode: session.mode,
          created_at: session.created_at,
          question_count: question_counts.fetch(session.id, 0),
          correct: answered_records.count { |record| record.outcome.to_s == "correct" },
          answered: answered_records.length
        )
      end
    end

    # analyticsSeries: per-node mastery (the ONE scorer), weekly accuracy over
    # the last 8 ISO weeks (weeks with evidence only), consistency over the
    # last 14 UTC days (all days, zeros included — distinct sessions per day).
    def analytics_series(user, now:)
      records = user.evidence_records.order(:created_at, :id).to_a
      {
        node_mastery: node_mastery(user, records, now: now),
        weekly_accuracy: weekly_accuracy(records, now: now),
        consistency: consistency(records, now: now)
      }
    end

    # weeklyGoal (delta decision 3): the target rides users.weekly_goal_target;
    # currentWeekSessions counts DISTINCT evidence-producing sessions in the
    # current ISO week (Mon 00:00 UTC .. now).
    def weekly_goal(user, now:)
      week_start = week_start_date(now)
      week_start_time = Time.utc(week_start.year, week_start.month, week_start.day)
      sessions = user.evidence_records
                     .where(created_at: week_start_time..now)
                     .where.not(session_id: nil)
                     .distinct.count(:session_id)
      WeeklyGoal.new(target: user.weekly_goal_target, current_week_sessions: sessions,
                     current_week_start: day_key(week_start))
    end

    # badgeState: all 12 badges, computed on read (delta decision 1 — eventual
    # consistency is the recorded posture; thresholds in THRESHOLDS with the
    # reasons).
    def badge_state(user, now:)
      records = user.evidence_records.order(:created_at, :id).to_a
      stats_by_id = node_stats_map(records, now: now)
      stats = stats_by_id.values
      mastered_nodes = stats.count { |entry| entry.state == "mastered" }
      streak = Mastery.compute_streak(records, now: now)
      mistake_node_ids = user.mistake_entries.distinct.pluck(:node_id).to_set
      mistake_revisits = records.count { |record| mistake_node_ids.include?(record.node_id) }

      [
        badge("b1", user.quiz_sessions.count),
        badge("b2", streak),
        badge("b3", streak),
        badge("b4", user.flashcards.count),
        badge("b5", records.length),
        badge("b6", mistake_revisits),
        badge("b7", mastered_nodes),
        badge("b8", mastered_nodes),
        badge("b9", mastered_nodes),
        badge("b10", max_daily_sessions(records)),
        badge("b11", fully_mastered_plans(user, stats_by_id, now: now)),
        badge("b12", stats.count { |entry| entry.score == 100 })
      ]
    end

    private

    def badge(id, counter)
      threshold = THRESHOLDS.fetch(id)
      BadgeState.new(id: id, unlocked: counter >= threshold, counter: counter, threshold: threshold)
    end

    # delta decision 2's v1 heuristic, server-computable verbatim: one
    # suggestion per plan that has ≥1 node NOT reading mastered AND ≥1
    # confirmed mapping (a mapped section — the same plan-scope join the
    # planNodeMappings read uses). The card names the weakest node by server
    # score; ties break to the lowest order.
    def suggestions(user, stats_by_id, now:)
      user.study_plans.filter_map do |plan|
        nodes = plan.knowledge_nodes.order(:order, :created_at, :id)
        next if nodes.empty?
        next unless mapped_section?(user, plan)

        candidates = nodes.filter_map do |node|
          entry = stats_by_id[node.id] || Mastery.node_stats([], now: now)
          next if entry.state == "mastered"

          [ node, entry ]
        end
        next if candidates.empty?

        weakest_node, = candidates.min_by { |node, entry| [ entry.score, node.order ] }
        TodaySuggestion.new(plan_id: plan.id, plan_title: plan.topic,
                            node_id: weakest_node.id, node_title: weakest_node.title)
      end
    end

    def mapped_section?(user, plan)
      user.material_node_mappings
          .joins(:node)
          .where(status: "confirmed", knowledge_nodes: { plan_id: plan.id })
          .exists?
    end

    def node_stats_by_id(user, now:)
      node_stats_map(user.evidence_records.order(:created_at, :id).to_a, now: now)
    end

    def node_stats_map(records, now:)
      records.group_by(&:node_id)
             .each_with_object({}) do |(node_id, node_records), map|
        map[node_id] = Mastery.node_stats(node_records, now: now)
      end
    end

    def node_mastery(user, records, now:)
      stats_by_id = node_stats_map(records, now: now)
      user.knowledge_nodes.order(:created_at, :id).map do |node|
        entry = stats_by_id[node.id] || Mastery.node_stats([], now: now)
        NodeMasteryEntry.new(node_id: node.id, node_title: node.title, plan_id: node.plan_id,
                             score: entry.score, state: entry.state)
      end
    end

    def weekly_accuracy(records, now:)
      current = week_start_date(now)
      week_keys = (WEEKS_WINDOW - 1).downto(0).map { |back| day_key(current - (7 * back)) }
      week_key_set = week_keys.to_set
      answered = Hash.new(0)
      correct = Hash.new(0)
      records.each do |record|
        key = day_key(week_start_date(record.created_at))
        next unless week_key_set.include?(key)

        answered[key] += 1
        correct[key] += 1 if record.outcome.to_s == "correct"
      end
      week_keys.filter_map do |key|
        next if answered[key].zero?

        WeekAccuracyPoint.new(week_start: key, answered: answered[key], correct: correct[key])
      end
    end

    def consistency(records, now:)
      today = now.utc.to_date
      day_keys = (DAYS_WINDOW - 1).downto(0).map { |back| day_key(today - back) }
      sessions_by_day = Hash.new { |hash, key| hash[key] = Set.new }
      records.each do |record|
        sessions_by_day[day_key(record.created_at)] << record.session_id if record.session_id
      end
      day_keys.map do |key|
        ConsistencyPoint.new(day: key, session_count: sessions_by_day[key].length)
      end
    end

    def max_daily_sessions(records)
      sessions_by_day(records).values.map(&:length).max || 0
    end

    def sessions_by_day(records)
      by_day = Hash.new { |hash, key| hash[key] = Set.new }
      records.each do |record|
        by_day[day_key(record.created_at)] << record.session_id if record.session_id
      end
      by_day
    end

    def fully_mastered_plans(user, stats_by_id, now:)
      user.study_plans.count do |plan|
        nodes = plan.knowledge_nodes
        nodes.any? && nodes.all? do |node|
          (stats_by_id[node.id] || Mastery.node_stats([], now: now)).state == "mastered"
        end
      end
    end

    # The ISO Monday of the week containing `time` — UTC by contract
    # (ADR-0001's streak boundary; cwday: Mon=1..Sun=7).
    def week_start_date(time)
      date = time.utc.to_date
      date - (date.cwday - 1)
    end

    # Mastery's day-key convention (utc_day_key): "YYYY-MM-DD", UTC.
    def day_key(date_or_time)
      value = date_or_time.is_a?(Date) ? date_or_time : date_or_time.utc.to_date
      value.strftime("%Y-%m-%d")
    end
  end
end
