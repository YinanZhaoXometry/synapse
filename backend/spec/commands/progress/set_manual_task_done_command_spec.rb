# frozen_string_literal: true

require "rails_helper"

RSpec.describe Progress::SetManualTaskDoneCommand do
  # The 今日学习 manual-task completion toggle (epic P2-09 T3, FR-27).
  # Idempotent by law: toggling to the state the row already carries returns
  # the row UNCHANGED — updated_at untouched (no phantom activity). Addressing
  # follows the house NOT_FOUND matrix: unknown, foreign, or malformed ids
  # answer uniformly NOT_FOUND (AD-13 — never another user's row).

  let(:user) { create(:user) }
  let(:task) { create(:manual_task, user: user, title: "整理错题本") }

  def call(id, done)
    described_class.call(current_user: user, id: id, done: done)
  end

  it "marks an open task done and returns the row" do
    result = call(task.id, true)

    aggregate_failures do
      expect(result.success?).to be(true)
      expect(result.value![:manual_task].id).to eq(task.id)
      expect(task.reload.done).to be(true)
    end
  end

  it "marks a done task open again (the toggle works both ways)" do
    task.update!(done: true)

    result = call(task.id, false)

    aggregate_failures do
      expect(result.success?).to be(true)
      expect(task.reload.done).to be(false)
    end
  end

  it "is idempotent: toggling to the carried state returns the row with updated_at untouched" do
    before_updated_at = task.reload.updated_at

    result = call(task.id, false) # the row already reads done: false

    aggregate_failures do
      expect(result.success?).to be(true)
      expect(result.value![:manual_task].id).to eq(task.id)
      expect(task.reload.updated_at).to eq(before_updated_at)
      expect(task.done).to be(false)
    end
  end

  it "answers NOT_FOUND for an unknown id" do
    result = call(SecureRandom.uuid, true)

    aggregate_failures do
      expect(result.success?).to be(false)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end
  end

  it "answers NOT_FOUND for a foreign id (another user's row — never linked, AD-13)" do
    other_task = create(:manual_task)

    result = call(other_task.id, true)

    aggregate_failures do
      expect(result.success?).to be(false)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end
    expect(other_task.reload.done).to be(false)
  end

  it "answers NOT_FOUND for a malformed (non-uuid) id" do
    result = call("../../etc/passwd", true)

    aggregate_failures do
      expect(result.success?).to be(false)
      expect(result.failure.code).to eq(:NOT_FOUND)
    end
  end

  it "refuses a non-boolean done with VALIDATION_FAILED" do
    result = call(task.id, "yes")

    aggregate_failures do
      expect(result.success?).to be(false)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(result.failure.context[:field]).to eq(:done)
    end
    expect(task.reload.done).to be(false)
  end
end
