# frozen_string_literal: true

require "rails_helper"

RSpec.describe QuizSession, type: :model do
  let(:user) { User.create!(email: "quiz-session-spec@example.com", password_digest: "digest") }
  let(:plan) { StudyPlan.create!(user: user, topic: "Quiz session plan") }

  # A session is generated from exactly one of plan/task — the default
  # attributes take the plan side (the factory does the same).
  let(:model_attributes) { { user: user, plan: plan, mode: "open" } }

  it_behaves_like "a user-owned uuid model"

  it "starts active with no completion timestamp" do
    expect(described_class.new.status).to eq("active")
    expect(described_class.new.completed_at).to be_nil

    session = described_class.create!(model_attributes)

    expect(session.status).to eq("active")
  end

  # "Exactly one of plan_id/task_id" — pinned in the database floor by the
  # quiz_sessions_exactly_one_owner_check constraint (migration 090016).
  it "carries a check constraint requiring exactly one of plan_id/task_id" do
    constraint = ActiveRecord::Base.connection.check_constraints(:quiz_sessions)
                                        .find { |c| c.name == "quiz_sessions_exactly_one_owner_check" }

    expect(constraint).to be_present
    expect(constraint.expression).to include("plan_id").and include("task_id")
  end

  it "accepts a plan-only session (plan-side generation)" do
    session = described_class.create!(model_attributes)

    expect(session.plan).to eq(plan)
    expect(session.task_id).to be_nil
  end

  it "accepts a task-only session (task-side generation)" do
    material = Material.create!(user: user, title: "Task-side source", kind: "pdf", size_bytes: 2048)
    node = KnowledgeNode.create!(user: user, title: "Task-side node", order: 0)
    task = StudyTask.create!(user: user, material: material, node: node)

    session = described_class.create!(model_attributes.except(:plan).merge(task: task))

    expect(session.task).to eq(task)
    expect(session.plan_id).to be_nil
  end

  it "rejects a session with both plan_id and task_id set" do
    material = Material.create!(user: user, title: "Both-sides source", kind: "pdf", size_bytes: 4096)
    node = KnowledgeNode.create!(user: user, title: "Both-sides node", order: 0)
    task = StudyTask.create!(user: user, material: material, node: node)

    expect { described_class.create!(model_attributes.merge(task: task)) }
      .to raise_error(ActiveRecord::StatementInvalid, /quiz_sessions_exactly_one_owner_check/)
  end

  it "rejects a session with neither plan_id nor task_id" do
    expect { described_class.create!(model_attributes.except(:plan)) }
      .to raise_error(ActiveRecord::StatementInvalid, /quiz_sessions_exactly_one_owner_check/)
  end
end
