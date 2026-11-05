# frozen_string_literal: true

require "rails_helper"

require "active_support/testing/time_helpers"

# The weekly goal read (delta decision 3 — evidence-producing SESSIONS per
# ISO week Mon-UTC, SM-C3) and the 12-badge state computation on read
# (delta decision 1's restated thresholds — the reason each threshold was
# chosen is recorded in the ticket's ## Comments for T6).
RSpec.describe Hubs do
  include ActiveSupport::Testing::TimeHelpers

  let(:user) { create(:user) }
  let(:now) { Time.zone.parse("2026-11-04 12:00:00 UTC") } # Wednesday, current ISO week Mon 2026-11-02

  after { travel_back }

  def evidence_on(node, outcome: "correct", at: now - 1.hour, session: nil)
    create(:evidence_record, user: user, node: node, outcome: outcome,
                             created_at: at, session: session)
  end

  def mastered_node(plan: nil, title: "mastered node")
    node = create(:knowledge_node, user: user, plan_id: plan&.id, title: title)
    [ 3, 2, 1 ].each { |hours_ago| evidence_on(node, at: now - hours_ago.hours) }
    node
  end

  describe ".weekly_goal" do
    it "reads the target default and counts DISTINCT evidence-producing sessions this ISO week" do
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan_id: plan.id)
      session_a = create(:quiz_session, user: user, plan: plan, created_at: now - 1.hour)
      session_b = create(:quiz_session, user: user, plan: plan, created_at: now - 2.hours)
      # session_a answered twice, session_b once → 2 DISTINCT sessions this week
      evidence_on(node, session: session_a, at: Time.zone.parse("2026-11-03 09:00:00 UTC"))
      evidence_on(node, session: session_a, at: Time.zone.parse("2026-11-04 09:00:00 UTC"))
      evidence_on(node, session: session_b, at: Time.zone.parse("2026-11-02 00:00:00 UTC"))
      # sessionless evidence + last week's session do not count
      evidence_on(node, session: nil, at: Time.zone.parse("2026-11-04 10:00:00 UTC"))
      last_week = create(:quiz_session, user: user, plan: plan, created_at: now - 8.days)
      evidence_on(node, session: last_week, at: Time.zone.parse("2026-10-27 12:00:00 UTC"))

      goal = described_class.weekly_goal(user, now: now)

      aggregate_failures do
        expect(goal[:target]).to eq(3) # the delta default
        expect(goal[:current_week_sessions]).to eq(2)
        expect(goal[:current_week_start]).to eq("2026-11-02") # Mon-UTC
      end
    end

    it "counts a session whose evidence spans the week boundary once, for the week it landed in" do
      node = create(:knowledge_node, user: user)
      plan = create(:study_plan, user: user)
      straddler = create(:quiz_session, user: user, plan: plan, created_at: now - 8.days)
      evidence_on(node, session: straddler, at: Time.zone.parse("2026-11-01 23:59:00 UTC"))
      evidence_on(node, session: straddler, at: Time.zone.parse("2026-11-02 00:00:00 UTC"))

      goal = described_class.weekly_goal(user, now: now)

      expect(goal[:current_week_sessions]).to eq(1)
    end

    it "never mixes in a second user's sessions (AD-13)" do
      outsider = create(:user)
      outsider_plan = create(:study_plan, user: outsider)
      session = create(:quiz_session, user: outsider, plan: outsider_plan, created_at: now)
      evidence = create(:evidence_record, user: outsider, node: create(:knowledge_node, user: outsider),
                                          outcome: "correct", session: session, created_at: now)

      goal = described_class.weekly_goal(user, now: now)

      expect(goal[:current_week_sessions]).to eq(0)
    end
  end

  describe ".badge_state (delta decision 1 — thresholds on read)" do
    # The badge clock is pinned for the whole block: factory rows without an
    # explicit created_at then land on `now`, so every counter is deterministic.
    around { |example| travel_to(now) { example.run } }

    def badge(map, id)
      map.fetch(id)
    end

    it "answers all 12 badges in id order, all locked at zero evidence" do
      badges = described_class.badge_state(user, now: now)

      aggregate_failures do
        expect(badges.map(&:id)).to eq(%w[b1 b2 b3 b4 b5 b6 b7 b8 b9 b10 b11 b12])
        expect(badges.map(&:unlocked)).to all(be(false))
        expect(badges.map(&:counter)).to all(be_zero)
      end
    end

    it "b1 first quiz: unlocks at exactly 1 quiz session" do
      create(:quiz_session, user: user)

      badges = described_class.badge_state(user, now: now).index_by(&:id)

      aggregate_failures do
        expect(badge(badges, "b1").counter).to eq(1)
        expect(badge(badges, "b1").threshold).to eq(1)
        expect(badge(badges, "b1").unlocked).to be(true)
      end
    end

    it "b2 streak 3 / b3 streak 7: Mastery's streak at the boundary" do
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan_id: plan.id)
      # 2 consecutive evidence days ending today → both locked
      [ 0, 1 ].each do |days_ago|
        evidence_on(node, at: now - days_ago.days)
      end

      locked = described_class.badge_state(user, now: now).index_by(&:id)
      aggregate_failures do
        expect(locked["b2"].counter).to eq(2)
        expect(locked["b2"].unlocked).to be(false)
        expect(locked["b3"].unlocked).to be(false)
      end

      # 3 consecutive days → b2 unlocks
      evidence_on(node, at: now - 2.days)
      three = described_class.badge_state(user, now: now).index_by(&:id)
      aggregate_failures do
        expect(three["b2"].counter).to eq(3)
        expect(three["b2"].unlocked).to be(true)
        expect(three["b3"].counter).to eq(3)
        expect(three["b3"].unlocked).to be(false)
      end
    end

    it "b3 streak 7: unlocks at the 7th consecutive day" do
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan_id: plan.id)
      [ 0, 1, 2, 3, 4, 5 ].each { |days_ago| evidence_on(node, at: now - days_ago.days) }

      six = described_class.badge_state(user, now: now).index_by(&:id)
      expect(six["b3"].unlocked).to be(false)

      evidence_on(node, at: now - 6.days)
      seven = described_class.badge_state(user, now: now).index_by(&:id)
      aggregate_failures do
        expect(seven["b3"].counter).to eq(7)
        expect(seven["b3"].unlocked).to be(true)
      end
    end

    it "b4 flashcards: unlocks at exactly 10 cards (collection badge — no review-event tracking exists)" do
      create_list(:flashcard, 9, user: user)
      nine = described_class.badge_state(user, now: now).index_by(&:id)
      expect(nine["b4"].unlocked).to be(false)

      create(:flashcard, user: user)
      ten = described_class.badge_state(user, now: now).index_by(&:id)
      aggregate_failures do
        expect(ten["b4"].counter).to eq(10)
        expect(ten["b4"].threshold).to eq(10)
        expect(ten["b4"].unlocked).to be(true)
      end
    end

    it "b5 evidence: unlocks at exactly 100 evidence records" do
      node = create(:knowledge_node, user: user)
      create_list(:evidence_record, 99, user: user, node: node)
      ninety_nine = described_class.badge_state(user, now: now).index_by(&:id)
      expect(ninety_nine["b5"].unlocked).to be(false)

      create(:evidence_record, user: user, node: node)
      hundred = described_class.badge_state(user, now: now).index_by(&:id)
      aggregate_failures do
        expect(hundred["b5"].counter).to eq(100)
        expect(hundred["b5"].threshold).to eq(100)
        expect(hundred["b5"].unlocked).to be(true)
      end
    end

    it "b6 mistakes revisit: evidence on nodes that carry a mistake entry, at exactly 5" do
      plan = create(:study_plan, user: user)
      mistake_node = create(:knowledge_node, user: user, plan_id: plan.id)
      question = create(:question, user: user, node: mistake_node,
                                   source_material: create(:material, user: user))
      create(:mistake_entry, user: user, question: question, node: mistake_node)
      clean_node = create(:knowledge_node, user: user, plan_id: plan.id)

      # 5 records on the mistake node → unlocked; evidence on clean nodes never counts
      create_list(:evidence_record, 5, user: user, node: mistake_node)
      create_list(:evidence_record, 5, user: user, node: clean_node)

      badges = described_class.badge_state(user, now: now).index_by(&:id)
      aggregate_failures do
        expect(badges["b6"].counter).to eq(5)
        expect(badges["b6"].threshold).to eq(5)
        expect(badges["b6"].unlocked).to be(true)
      end

      # boundary below: a fresh user graph with 4
      other = create(:user)
      other_plan = create(:study_plan, user: other)
      other_node = create(:knowledge_node, user: other, plan_id: other_plan.id)
      other_question = create(:question, user: other, node: other_node,
                                         source_material: create(:material, user: other))
      create(:mistake_entry, user: other, question: other_question, node: other_node)
      create_list(:evidence_record, 4, user: other, node: other_node)

      other_badges = described_class.badge_state(other, now: now).index_by(&:id)
      aggregate_failures do
        expect(other_badges["b6"].counter).to eq(4)
        expect(other_badges["b6"].unlocked).to be(false)
      end
    end

    it "b7/b8/b9 tiered node mastery: 1 / 3 / 5 distinct mastered nodes" do
      mastered_node # one mastered node — the plan-with-one-mastered-node shape

      one = described_class.badge_state(user, now: now).index_by(&:id)
      aggregate_failures do
        expect(one["b7"].counter).to eq(1)
        expect(one["b7"].threshold).to eq(1)
        expect(one["b7"].unlocked).to be(true)
        expect(one["b8"].counter).to eq(1)
        expect(one["b8"].unlocked).to be(false)
        expect(one["b9"].unlocked).to be(false)
      end

      2.times { |i| mastered_node(title: "extra mastered #{i}") }
      three = described_class.badge_state(user, now: now).index_by(&:id)
      aggregate_failures do
        expect(three["b8"].counter).to eq(3)
        expect(three["b8"].unlocked).to be(true)
        expect(three["b9"].counter).to eq(3)
        expect(three["b9"].unlocked).to be(false)
      end

      2.times { |i| mastered_node(title: "more mastered #{i}") }
      five = described_class.badge_state(user, now: now).index_by(&:id)
      aggregate_failures do
        expect(five["b9"].counter).to eq(5)
        expect(five["b9"].unlocked).to be(true)
      end
    end

    it "b10 daily grind: max DISTINCT sessions in one UTC day at exactly 3" do
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan_id: plan.id)
      sessions = create_list(:quiz_session, 3, user: user, plan: plan)
      # 3 records but ONE session — the distinct count is 1, locked
      sessions.take(1).each do |session|
        create_list(:evidence_record, 3, user: user, node: node, session: session)
      end

      one_session = described_class.badge_state(user, now: now).index_by(&:id)
      aggregate_failures do
        expect(one_session["b10"].counter).to eq(1)
        expect(one_session["b10"].unlocked).to be(false)
      end

      sessions.each do |session|
        evidence_on(node, session: session, at: Time.zone.parse("2026-11-04 09:00:00 UTC"))
      end

      three_sessions = described_class.badge_state(user, now: now).index_by(&:id)
      aggregate_failures do
        expect(three_sessions["b10"].counter).to eq(3)
        expect(three_sessions["b10"].threshold).to eq(3)
        expect(three_sessions["b10"].unlocked).to be(true)
      end
    end

    it "b11 full-plan mastery: every node of some plan mastered (≥1 node); one straggler keeps it locked" do
      plan = create(:study_plan, user: user)
      mastered_node(plan: plan)
      mastered_node(plan: plan, title: "second of the plan")

      full = described_class.badge_state(user, now: now).index_by(&:id)
      aggregate_failures do
        expect(full["b11"].counter).to eq(1)
        expect(full["b11"].threshold).to eq(1)
        expect(full["b11"].unlocked).to be(true)
      end

      # a second plan with one mastered node + one unmastered straggler does not add
      partial = create(:study_plan, user: user)
      mastered_node(plan: partial, title: "partial plan mastered")
      straggler = create(:knowledge_node, user: user, plan_id: partial.id, title: "straggler")
      evidence_on(straggler, outcome: "wrong")

      still_one = described_class.badge_state(user, now: now).index_by(&:id)
      aggregate_failures do
        expect(still_one["b11"].counter).to eq(1)
        expect(still_one["b11"].unlocked).to be(true)
      end
    end

    it "b11 never unlocks on an empty plan (≥1 node required)" do
      create(:study_plan, user: user) # zero nodes

      badges = described_class.badge_state(user, now: now).index_by(&:id)
      expect(badges["b11"].counter).to eq(0)
    end

    it "b12 perfect node: any node reading exactly score 100 unlocks (99 never does)" do
      plan = create(:study_plan, user: user)
      almost = create(:knowledge_node, user: user, plan_id: plan.id, title: "almost")
      [ 2, 1 ].each { |hours_ago| evidence_on(almost, at: now - hours_ago.hours) }

      ninety_nine = described_class.badge_state(user, now: now).index_by(&:id)
      aggregate_failures do
        expect(ninety_nine["b12"].counter).to eq(0) # capped below the gate
        expect(ninety_nine["b12"].unlocked).to be(false)
      end

      mastered_node # 3 correct, fresh → exactly 100

      hundred = described_class.badge_state(user, now: now).index_by(&:id)
      aggregate_failures do
        expect(hundred["b12"].counter).to eq(1)
        expect(hundred["b12"].threshold).to eq(1)
        expect(hundred["b12"].unlocked).to be(true)
      end
    end

    it "never counts a second user's evidence anywhere (AD-13 two-user graph)" do
      outsider = create(:user)
      outsider_plan = create(:study_plan, user: outsider)
      outsider_node = mastered_node_for(outsider, plan: outsider_plan)
      create_list(:flashcard, 10, user: outsider)
      create_list(:evidence_record, 3, user: outsider, node: outsider_node)
      outsider_session = create(:quiz_session, user: outsider, plan: outsider_plan)
      create_list(:evidence_record, 3, user: outsider, node: outsider_node, session: outsider_session)

      badges = described_class.badge_state(user, now: now).index_by(&:id)

      aggregate_failures do
        expect(badges.values.map(&:counter)).to all(be_zero)
        expect(badges.values.map(&:unlocked)).to all(be(false))
      end
    end

    # A mastered-node builder for an explicit owner (the two-user graph spec).
    def mastered_node_for(owner, plan: nil)
      node = create(:knowledge_node, user: owner, plan_id: plan&.id)
      [ 3, 2, 1 ].each { |hours_ago| create(:evidence_record, user: owner, node: node,
                                                              outcome: "correct",
                                                              created_at: now - hours_ago.hours) }
      node
    end
  end
end
