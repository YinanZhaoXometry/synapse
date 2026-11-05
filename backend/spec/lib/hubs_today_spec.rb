# frozen_string_literal: true

require "rails_helper"

require "active_support/testing/time_helpers"

# The Today hub assembly (epic P2-09 T1, delta decision 4 + delta decision 2's
# suggestion heuristic v1): due items via epic-07's materialized re-queue
# schedule (the SAME source dueItems reads — never re-derived), the per-plan
# weakest-node suggestions (server state fields only), the manual tasks, and
# the summary counts.
RSpec.describe Hubs do
  include ActiveSupport::Testing::TimeHelpers

  let(:user) { create(:user) }
  let(:now) { Time.zone.parse("2026-11-04 12:00:00 UTC") } # a Wednesday

  after { travel_back }

  describe ".today — the due slice" do
    it "answers the re-queue schedule's due items (epic-07's materialization, inclusive by day end)" do
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan_id: plan.id)
      question = create(:question, user: user, node: node,
                                   source_material: create(:material, user: user))
      create(:mistake_entry, user: user, question: question)
      card = create(:flashcard, user: user, difficulty: "hard", updated_at: Time.current)

      travel_to(now) do
        Requeue::ScanDueItemsCommand.call
        # Fresh mistake → due +1d; hard card → due +2d. At +3d BOTH are due —
        # the inclusive window answers everything scheduled BY the day's end.
        today = described_class.today(user, now: now + 3.days)

        aggregate_failures do
          expect(today[:due].map(&:schedulable_id)).to contain_exactly(question.mistake_entries.first.id, card.id)
          expect(today[:due]).to all(be_a(RequeueSchedule))
        end
      end
    end

    it "keeps the UTC day boundary exact: due 23:59 today is in, due 00:00 tomorrow is out" do
      create(:requeue_schedule, user: user,
                                schedulable: create(:flashcard, user: user),
                                next_due_at: Time.zone.parse("2026-11-04 23:59:00 UTC"))
      tomorrow_card = create(:flashcard, user: user)
      create(:requeue_schedule, user: user, schedulable: tomorrow_card,
                                next_due_at: Time.zone.parse("2026-11-05 00:00:00 UTC"))

      today = described_class.today(user, now: now)

      expect(today[:due].map(&:schedulable_id)).to contain_exactly(
        RequeueSchedule.find_by(next_due_at: Time.zone.parse("2026-11-04 23:59:00 UTC")).schedulable_id
      )
    end

    it "skips a dead source without failing the list (the dueItems parity)" do
      travel_to(now) do
        card = create(:flashcard, user: user, difficulty: "hard", updated_at: Time.current)
        Requeue::ScanDueItemsCommand.call
        card.destroy!

        expect(described_class.today(user, now: now + 3.days)[:due]).to eq([])
      end
    end

    it "never lists a second user's due items (AD-13)" do
      outsider = create(:user)
      create(:requeue_schedule, user: outsider,
                                schedulable: create(:flashcard, user: outsider),
                                next_due_at: now - 1.hour)

      expect(described_class.today(user, now: now)[:due]).to eq([])
    end
  end

  describe ".today — the suggestion slot (delta decision 2, v1 partial)" do
    def mastered_evidence(node)
      [ 3, 2, 1 ].each do |hours_ago|
        create(:evidence_record, user: user, node: node, outcome: "correct",
                                 created_at: now - hours_ago.hours)
      end
    end

    it "suggests the weakest node of each plan that has a non-mastered node and a mapped section" do
      plan = create(:study_plan, user: user, topic: "Weak-plan topic")
      mastered = create(:knowledge_node, user: user, plan_id: plan.id, order: 1, title: "Mastered node")
      weak = create(:knowledge_node, user: user, plan_id: plan.id, order: 2, title: "Weak node")
      untouched = create(:knowledge_node, user: user, plan_id: plan.id, order: 3, title: "Untouched node")
      mastered_evidence(mastered)
      create(:evidence_record, user: user, node: weak, outcome: "wrong", created_at: now - 1.hour)
      material = create(:material, user: user, plan_id: plan.id)
      create(:material_node_mapping, user: user, material: material, node: weak,
                                     section_id: "sec-1", status: "confirmed")

      today = described_class.today(user, now: now)

      aggregate_failures do
        expect(today[:suggestions].length).to eq(1)
        suggestion = today[:suggestions].first
        expect(suggestion.plan_id).to eq(plan.id)
        expect(suggestion.plan_title).to eq("Weak-plan topic")
        # weakest by server score: untouched scores 0, weak scores 0 (one wrong)
        # — the tie breaks to the LOWEST order (weak, order 2 < untouched, order 3)
        expect(suggestion.node_id).to eq(weak.id)
        expect(suggestion.node_title).to eq("Weak node")
      end
    end

    it "prefers the strictly weakest score over a lower order" do
      plan = create(:study_plan, user: user)
      low_order_some_score = create(:knowledge_node, user: user, plan_id: plan.id, order: 1)
      weakest = create(:knowledge_node, user: user, plan_id: plan.id, order: 2)
      create(:evidence_record, user: user, node: low_order_some_score, outcome: "correct",
                               created_at: now - 1.hour)
      material = create(:material, user: user, plan_id: plan.id)
      create(:material_node_mapping, user: user, material: material, node: weakest,
                                     section_id: "sec-1", status: "confirmed")

      today = described_class.today(user, now: now)

      expect(today[:suggestions].first.node_id).to eq(weakest.id) # score 0 beats order 1's 33→99
    end

    it "excludes fully mastered plans and plans without a confirmed mapping" do
      mastered_plan = create(:study_plan, user: user)
      mastered_node = create(:knowledge_node, user: user, plan_id: mastered_plan.id, order: 1)
      mastered_evidence(mastered_node)
      mapped = create(:material, user: user, plan_id: mastered_plan.id)
      create(:material_node_mapping, user: user, material: mapped, node: mastered_node,
                                     section_id: "sec-1", status: "confirmed")

      unmapped_plan = create(:study_plan, user: user)
      create(:knowledge_node, user: user, plan_id: unmapped_plan.id, order: 1)

      expect(described_class.today(user, now: now)[:suggestions]).to eq([])
    end

    it "never suggests from a second user's plans (AD-13)" do
      outsider = create(:user)
      outsider_plan = create(:study_plan, user: outsider)
      create(:knowledge_node, user: outsider, plan_id: outsider_plan.id, order: 1)
      material = create(:material, user: outsider, plan_id: outsider_plan.id)
      create(:material_node_mapping, user: outsider, material: material,
                                     node: outsider_plan.knowledge_nodes.first,
                                     section_id: "sec-1", status: "confirmed")

      expect(described_class.today(user, now: now)[:suggestions]).to eq([])
    end
  end

  describe ".today — manual tasks and summary" do
    it "lists open manual tasks (calendar order, undated last); done ones count separately" do
      earlier = create(:manual_task, user: user, title: "earlier-dated",
                                     due_date: Time.zone.parse("2026-11-04").to_date,
                                     created_at: now - 2.hours)
      later = create(:manual_task, user: user, title: "later-dated",
                                   due_date: Time.zone.parse("2026-11-05").to_date,
                                   created_at: now - 1.hour)
      undated = create(:manual_task, user: user, title: "undated", due_date: nil,
                                     created_at: now - 3.hours)
      create(:manual_task, user: user, title: "done-task",
                       due_date: Time.zone.parse("2026-11-04").to_date, done: true)

      today = described_class.today(user, now: now)

      aggregate_failures do
        expect(today[:manual].map(&:title)).to eq([ "earlier-dated", "later-dated", "undated" ])
        expect(today[:manual].map(&:done)).to all(be(false))
        expect(today[:summary][:due_count]).to eq(0)
        expect(today[:summary][:manual_count]).to eq(3)
        expect(today[:summary][:done_count]).to eq(1)
      end
    end

    it "never mixes in a second user's manual tasks (AD-13)" do
      outsider = create(:user)
      create(:manual_task, user: outsider)

      today = described_class.today(user, now: now)

      aggregate_failures do
        expect(today[:manual]).to be_empty
        expect(today[:summary][:manual_count]).to eq(0)
        expect(today[:summary][:done_count]).to eq(0)
      end
    end
  end
end
