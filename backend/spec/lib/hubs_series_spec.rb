# frozen_string_literal: true

require "rails_helper"

require "active_support/testing/time_helpers"

# The analytics series (epic P2-09 T1, delta decision 4): per-node mastery
# through the ONE scorer (Mastery, freshness engaged — the same semantics the
# KnowledgeNodeType fields ride), weeklyAccuracy over ISO weeks (Mon-UTC, the
# last 8, only weeks with evidence), consistency over the last 14 UTC days
# (evidence-producing sessions per day, zeros included). The day/week keys
# follow Mastery's day-key convention ("YYYY-MM-DD", UTC).
RSpec.describe Hubs do
  include ActiveSupport::Testing::TimeHelpers

  let(:user) { create(:user) }
  let(:now) { Time.zone.parse("2026-11-04 12:00:00 UTC") } # Wednesday, current ISO week Mon 2026-11-02

  after { travel_back }

  describe ".analytics_series — nodeMastery" do
    it "scores every node through Mastery with freshness, wire conventions intact" do
      plan = create(:study_plan, user: user)
      mastered = create(:knowledge_node, user: user, plan_id: plan.id, order: 1, title: "mastered")
      gated = create(:knowledge_node, user: user, plan_id: plan.id, order: 2, title: "gated")
      stale = create(:knowledge_node, user: user, plan_id: plan.id, order: 3, title: "stale")
      [ 3, 2, 1 ].each do |hours_ago|
        create(:evidence_record, user: user, node: mastered, outcome: "correct",
                                 created_at: now - hours_ago.hours)
        create(:evidence_record, user: user, node: stale, outcome: "correct",
                                 created_at: now - 15.days - (4 - hours_ago).hours)
      end
      create(:evidence_record, user: user, node: gated, outcome: "correct", created_at: now - 1.hour)
      create(:evidence_record, user: user, node: gated, outcome: "correct", created_at: now - 2.hours)

      task = create(:study_task, user: user)

      series = described_class.analytics_series(user, now: now)
      by_title = series[:node_mastery].index_by(&:node_title)

      aggregate_failures do
        expect(by_title["mastered"].score).to eq(100)
        expect(by_title["mastered"].state).to eq("mastered")
        expect(by_title["mastered"].plan_id).to eq(plan.id)
        # below the evidence gate: capped at 99, never mastered
        expect(by_title["gated"].score).to eq(99)
        expect(by_title["gated"].state).to eq("partial")
        # past the freshness window: capped at 99 even with 3 correct
        expect(by_title["stale"].score).to eq(99)
        expect(by_title["stale"].state).to eq("partial")
        # a task-owned node rides too, with a null plan link
        expect(by_title[task.node.title].plan_id).to be_nil
        expect(by_title[task.node.title].score).to eq(0)
        expect(by_title[task.node.title].state).to eq("uncovered")
      end
    end

    it "never mixes in a second user's nodes (AD-13)" do
      outsider = create(:user)
      outsider_node = create(:knowledge_node, user: outsider)
      [ 3, 2, 1 ].each do |hours_ago|
        create(:evidence_record, user: outsider, node: outsider_node, outcome: "correct",
                                 created_at: now - hours_ago.hours)
      end

      series = described_class.analytics_series(user, now: now)

      expect(series[:node_mastery]).to be_empty
    end
  end

  describe ".analytics_series — weeklyAccuracy (ISO weeks, Mon-UTC)" do
    it "buckets evidence by ISO week, correct honestly, weeks without evidence omitted" do
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan_id: plan.id)
      # last ISO week (Mon 2026-10-26): Sun 2026-11-01 23:59 UTC still belongs to it
      last_week_sun = create(:quiz_session, user: user, plan: plan, created_at: now - 3.days)
      create(:evidence_record, user: user, node: node, session: last_week_sun, outcome: "correct",
                               created_at: Time.zone.parse("2026-11-01 23:59:00 UTC"))
      create(:evidence_record, user: user, node: node, session: last_week_sun, outcome: "wrong",
                               created_at: Time.zone.parse("2026-11-01 23:59:00 UTC"))
      # current ISO week (Mon 2026-11-02): Mon 00:00 sharp belongs HERE
      this_week_mon = create(:quiz_session, user: user, plan: plan, created_at: now)
      create(:evidence_record, user: user, node: node, session: this_week_mon, outcome: "correct",
                               created_at: Time.zone.parse("2026-11-02 00:00:00 UTC"))
      create(:evidence_record, user: user, node: node, session: this_week_mon, outcome: "partial",
                               created_at: Time.zone.parse("2026-11-03 08:00:00 UTC"))
      # older than the 8-week window (Sunday of the week starting 2026-09-07)
      create(:evidence_record, user: user, node: node, outcome: "correct",
                               created_at: Time.zone.parse("2026-09-13 12:00:00 UTC"))

      series = described_class.analytics_series(user, now: now)

      aggregate_failures do
        expect(series[:weekly_accuracy].map(&:week_start))
          .to eq([ "2026-10-26", "2026-11-02" ]) # oldest first; empty weeks omitted
        last = series[:weekly_accuracy].first
        expect(last.answered).to eq(2)
        expect(last.correct).to eq(1)
        current = series[:weekly_accuracy].last
        expect(current.answered).to eq(2)
        expect(current.correct).to eq(1) # partial is not correct
      end
    end

    it "caps the window at 8 ISO weeks including the current one" do
      node = create(:knowledge_node, user: user)
      # Sunday of the week starting 2026-09-07 — one week outside the
      # 8-week window (whose oldest week starts 2026-09-14)
      old_session = create(:quiz_session, user: user, created_at: now)
      create(:evidence_record, user: user, node: node, session: old_session, outcome: "correct",
                               created_at: Time.zone.parse("2026-09-13 12:00:00 UTC"))

      series = described_class.analytics_series(user, now: now)

      expect(series[:weekly_accuracy]).to eq([]) # the week 8 back is outside the window
    end

    it "never mixes in a second user's evidence (AD-13)" do
      outsider = create(:user)
      outsider_session = create(:quiz_session, user: outsider, created_at: now)
      create(:evidence_record, user: outsider, node: create(:knowledge_node, user: outsider),
                               session: outsider_session, outcome: "correct", created_at: now)

      series = described_class.analytics_series(user, now: now)

      expect(series[:weekly_accuracy]).to eq([])
      expect(series[:consistency].map(&:session_count).sum).to eq(0)
    end
  end

  describe ".analytics_series — consistency (last 14 UTC days, sessions)" do
    it "emits all 14 days with distinct session counts, zeros included" do
      node = create(:knowledge_node, user: user)
      plan = create(:study_plan, user: user)
      today_session = create(:quiz_session, user: user, plan: plan, created_at: now)
      # today: 2 records, ONE distinct session
      create(:evidence_record, user: user, node: node, session: today_session, outcome: "correct",
                               created_at: Time.zone.parse("2026-11-04 09:00:00 UTC"))
      create(:evidence_record, user: user, node: node, session: today_session, outcome: "wrong",
                               created_at: Time.zone.parse("2026-11-04 10:00:00 UTC"))
      # 13 days back: two distinct sessions
      older = create(:quiz_session, user: user, plan: plan, created_at: now - 13.days)
      older_too = create(:quiz_session, user: user, plan: plan, created_at: now - 13.days)
      create(:evidence_record, user: user, node: node, session: older, outcome: "correct",
                               created_at: Time.zone.parse("2026-10-22 23:59:00 UTC"))
      create(:evidence_record, user: user, node: node, session: older_too, outcome: "correct",
                               created_at: Time.zone.parse("2026-10-22 12:00:00 UTC"))
      # 14 days back — outside the window (the window is today-13..today)
      create(:evidence_record, user: user, node: node, session: older, outcome: "correct",
                               created_at: Time.zone.parse("2026-10-21 23:59:00 UTC"))
      # today but sessionless — not an evidence-producing session
      create(:evidence_record, user: user, node: node, outcome: "correct",
                               created_at: Time.zone.parse("2026-11-04 11:00:00 UTC"))

      series = described_class.analytics_series(user, now: now)
      by_day = series[:consistency].index_by(&:day)

      aggregate_failures do
        expect(series[:consistency].length).to eq(14)
        expect(series[:consistency].first.day).to eq("2026-10-22") # oldest first
        expect(series[:consistency].last.day).to eq("2026-11-04")
        expect(by_day["2026-11-04"].session_count).to eq(1)
        expect(by_day["2026-10-22"].session_count).to eq(2)
        expect(by_day["2026-10-23"].session_count).to eq(0) # a zero day still answers
        expect(by_day["2026-10-21"]).to be_nil # outside the window
      end
    end
  end
end
