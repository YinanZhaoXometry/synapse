# frozen_string_literal: true

require "rails_helper"

# Ai::TargetingCandidates (epic P3-17 ticket 07 — first direct spec): the
# ONE builder of the weak-spot bias inputs shared by GenerateQuizCommand and
# GenerateNoteCommand (FR-21/FR-22). The pure weight math next door
# (Ai::Targeting) already has its suite; this pins the DB-facing half: node
# order, the Mastery percent-string form, the mistake join, and the user
# scoping of BOTH evidence and mistakes.
RSpec.describe Ai::TargetingCandidates do
  let(:user) { create(:user) }
  let(:plan) { create(:study_plan, user: user) }

  it "returns candidates in the plan's node order — Targeting's first tie-break" do
    later = create(:knowledge_node, user: user, plan: plan, order: 1)
    earlier = create(:knowledge_node, user: user, plan: plan, order: 0)

    candidates = described_class.for(user: user, plan: plan)

    expect(candidates.map(&:id)).to eq([ earlier.id, later.id ])
  end

  it "carries the Mastery score in its published String! percent form (AD-14)" do
    node = create(:knowledge_node, user: user, plan: plan)
    # Three correct answers pass the evidence gate → uncapped 100.
    create_list(:evidence_record, 3, user: user, node: node, outcome: "correct")

    candidate = described_class.for(user: user, plan: plan).sole

    aggregate_failures do
      expect(candidate.score).to be_a(String)
      expect(candidate.score).to eq(
        Mastery.compute_node_score(node.evidence_records.order(:created_at, :id), now: Time.current).to_s
      )
      expect(candidate.score).to eq("100")
    end
  end

  it "joins the user's own mistake count per node" do
    node = create(:knowledge_node, user: user, plan: plan)
    question = create(:question, user: user, node: node)
    create_list(:mistake_entry, 2, user: user, question: question, node: node)

    candidate = described_class.for(user: user, plan: plan).sole

    expect(candidate.mistakes).to eq(2)
  end

  it "scopes BOTH evidence and mistakes to the requesting user — a foreign user contributes nothing" do
    node = create(:knowledge_node, user: user, plan: plan)
    own_question = create(:question, user: user, node: node)
    foreign_question = create(:question, user: create(:user), node: node)
    # Three own correct answers → uncapped 100. Three foreign WRONG answers
    # would drag the ratio to 50 if the query leaked — the score is the leak
    # detector, no cap hides it at the ≥3-evidence bar.
    create_list(:evidence_record, 3, user: user, node: node, outcome: "correct")
    create_list(:evidence_record, 3, user: foreign_question.user, node: node, outcome: "wrong")
    create(:mistake_entry, user: foreign_question.user, question: foreign_question, node: node)

    candidate = described_class.for(user: user, plan: plan).sole

    aggregate_failures do
      expect(candidate.score).to eq("100")
      expect(candidate.mistakes).to eq(0)
    end
  end

  it "answers an empty plan with an empty candidate list" do
    expect(described_class.for(user: user, plan: plan)).to eq([])
  end
end
