# frozen_string_literal: true

require "rails_helper"

# The hub read model's list aggregations (epic P2-09 T1, delta decision 4):
# mistakesHub's newest-first flat list, flashcardDecksHub's per-material
# grouping, quizHistoryHub's session rows with the honest score summary
# (correct = the graded-correct count; open unanswered/awaiting questions
# excluded — one EvidenceRecord per ANSWERED question is the quiz results'
# own correctness definition, RecordEvidenceCommand).
RSpec.describe Hubs do
  let(:user) { create(:user) }
  let(:now) { Time.zone.parse("2026-11-04 12:00:00 UTC") }

  describe ".mistakes" do
    it "returns the caller's mistake entries newest-first as a flat list" do
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan_id: plan.id)
      material = create(:material, user: user, plan_id: plan.id)
      session = create(:quiz_session, user: user, plan: plan)
      older = create(:question, user: user, session: session, node: node,
                                source_material: material, created_at: now - 2.days)
      newer = create(:question, user: user, session: session, node: node,
                                source_material: material, created_at: now - 1.hour)
      create(:mistake_entry, user: user, question: older, node: node,
                             session: session, created_at: older.created_at)
      create(:mistake_entry, user: user, question: newer, node: node,
                             session: session, created_at: newer.created_at)

      mistakes = described_class.mistakes(user)

      aggregate_failures do
        expect(mistakes.map(&:question_id)).to eq([ newer.id, older.id ]) # newest first
        expect(mistakes.map(&:class).uniq).to eq([ MistakeEntry ])
      end
    end

    it "never lists a second user's mistakes (AD-13)" do
      outsider = create(:user)
      create(:mistake_entry, user: outsider)

      expect(described_class.mistakes(user)).to be_empty
    end
  end

  describe ".flashcard_decks" do
    it "groups the caller's decks one row per material that has flashcards" do
      plan = create(:study_plan, user: user)
      deck_material = create(:material, user: user, plan_id: plan.id)
      other_material = create(:material, user: user)
      empty_material = create(:material, user: user) # no cards → no row
      create_list(:flashcard, 3, user: user, material: deck_material)
      create(:flashcard, user: user, material: other_material)

      decks = described_class.flashcard_decks(user)

      aggregate_failures do
        expect(decks.length).to eq(2)
        by_material = decks.index_by(&:material_id)
        expect(by_material.keys).to contain_exactly(deck_material.id, other_material.id)
        expect(by_material[deck_material.id].card_count).to eq(3)
        expect(by_material[other_material.id].card_count).to eq(1)
        expect(by_material[deck_material.id].plan_id).to eq(plan.id)
        expect(by_material[deck_material.id].plan_title).to eq(plan.topic)
        expect(by_material[other_material.id].plan_id).to be_nil
        expect(by_material[deck_material.id].material_title).to eq(deck_material.title)
        expect(by_material[deck_material.id].created_at).to eq(deck_material.created_at)
        expect(by_material[deck_material.id].task_id).to be_nil
      end
    end

    it "carries the task id for a task-owned deck material" do
      task = create(:study_task, user: user)
      create(:flashcard, user: user, material: task.material)

      decks = described_class.flashcard_decks(user)

      aggregate_failures do
        expect(decks.length).to eq(1)
        expect(decks.first.task_id).to eq(task.id)
        expect(decks.first.plan_id).to be_nil
      end
    end

    it "never mixes in a second user's decks (AD-13)" do
      outsider = create(:user)
      create(:flashcard, user: outsider, material: create(:material, user: outsider))

      expect(described_class.flashcard_decks(user)).to be_empty
    end
  end

  describe ".quiz_history" do
    it "summarizes each session honestly: graded answers only, unanswered excluded" do
      plan = create(:study_plan, user: user)
      node = create(:knowledge_node, user: user, plan_id: plan.id)
      material = create(:material, user: user, plan_id: plan.id)
      session = create(:quiz_session, user: user, plan: plan, created_at: now - 1.day)
      answered_correct = create(:question, user: user, session: session, node: node,
                                           source_material: material, created_at: now - 1.day)
      answered_wrong = create(:question, user: user, session: session, node: node,
                                         source_material: material, created_at: now - 1.day)
      create(:question, user: user, session: session, node: node,
                        source_material: material, created_at: now - 1.day) # never answered
      create(:evidence_record, user: user, node: node, session: session,
                               question: answered_correct, outcome: "correct",
                               created_at: now - 1.hour)
      create(:evidence_record, user: user, node: node, session: session,
                               question: answered_wrong, outcome: "wrong",
                               created_at: now - 30.minutes)

      history = described_class.quiz_history(user)

      aggregate_failures do
        expect(history.length).to eq(1)
        entry = history.first
        expect(entry.session_id).to eq(session.id)
        expect(entry.plan_id).to eq(plan.id)
        expect(entry.plan_title).to eq(plan.topic)
        expect(entry.question_count).to eq(3)
        expect(entry.correct).to eq(1)
        expect(entry.answered).to eq(2) # the graded questions only
        expect(entry.mode).to eq("open")
      end
    end

    it "lists every session newest-first, ungraded ones at zero answers" do
      node = create(:knowledge_node, user: user)
      newer = create(:quiz_session, user: user, created_at: now - 1.hour, status: "abandoned")
      older = create(:quiz_session, user: user, created_at: now - 1.day)
      create(:question, user: user, session: newer, node: node,
                        source_material: create(:material, user: user))
      create(:question, user: user, session: newer, node: node,
                        source_material: create(:material, user: user))

      history = described_class.quiz_history(user)

      aggregate_failures do
        expect(history.map(&:session_id)).to eq([ newer.id, older.id ])
        ungraded = history.first
        expect(ungraded.correct).to eq(0)
        expect(ungraded.answered).to eq(0)
        expect(ungraded.question_count).to eq(2)
      end
    end

    it "carries the task scope for a task-side session (plan fields null)" do
      task = create(:study_task, user: user)
      # the factory's default plan association must be nulled — exactly one owner
      session = create(:quiz_session, user: user, task: task, plan: nil)

      history = described_class.quiz_history(user)

      aggregate_failures do
        expect(history.first.task_id).to eq(task.id)
        expect(history.first.plan_id).to be_nil
        expect(history.first.plan_title).to be_nil
      end
    end

    it "never mixes in a second user's sessions (AD-13)" do
      outsider = create(:user)
      create(:quiz_session, user: outsider)

      expect(described_class.quiz_history(user)).to be_empty
    end
  end
end
