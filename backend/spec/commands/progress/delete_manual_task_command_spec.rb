# frozen_string_literal: true

require "rails_helper"

RSpec.describe Progress::DeleteManualTaskCommand do
  # The 今日学习 manual-task delete op (epic P2-09 T3, FR-27): the row goes,
  # nothing else (a manual task has no dependents). Addressing follows the
  # house NOT_FOUND matrix: unknown, foreign, or malformed ids answer
  # uniformly NOT_FOUND (AD-13).

  let(:user) { create(:user) }
  let(:task) { create(:manual_task, user: user) }

  def call(id)
    described_class.call(current_user: user, id: id)
  end

  it "deletes the task and returns its id for cache eviction" do
    result = call(task.id)

    aggregate_failures do
      expect(result.success?).to be(true)
      expect(result.value![:deleted_manual_task_id]).to eq(task.id)
      expect(ManualTask.exists?(task.id)).to be(false)
    end
  end

  it "answers NOT_FOUND for an unknown id" do
    result = call(SecureRandom.uuid)

    expect(result.failure.code).to eq(:NOT_FOUND)
  end

  it "answers NOT_FOUND for a foreign id (another user's row — never deleted, AD-13)" do
    other_task = create(:manual_task)

    result = call(other_task.id)

    aggregate_failures do
      expect(result.success?).to be(false)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end
    expect(ManualTask.exists?(other_task.id)).to be(true)
  end

  it "answers NOT_FOUND for a malformed (non-uuid) id" do
    result = call("not-a-uuid")

    expect(result.failure.code).to eq(:NOT_FOUND)
  end
end
