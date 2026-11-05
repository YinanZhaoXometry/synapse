# frozen_string_literal: true

require "rails_helper"

RSpec.describe Progress::AddManualTaskCommand do
  # The 今日学习 manual-task add op (epic P2-09 T3, FR-27): the write half T1
  # deferred. Validation is the command's (title bounded, dueDate a plain
  # date or null); persistence rides the owner's association path (AD-13).

  let(:user) { create(:user) }

  def call(title, due_date: nil)
    described_class.call(current_user: user, title: title, due_date: due_date)
  end

  it "creates the task through the owner's association path and returns the row" do
    result = call("整理需求追踪矩阵")

    aggregate_failures do
      expect(result.success?).to be(true)
      task = result.value![:manual_task]
      expect(task.title).to eq("整理需求追踪矩阵")
      expect(task.user_id).to eq(user.id)
      expect(task.done).to be(false)
      expect(task.due_date).to be_nil
      expect(user.manual_tasks.count).to eq(1)
    end
  end

  it "normalizes a dueDate to the plain date it names (a Time input lands as the day)" do
    result = call("读完 Lecture 5", due_date: Time.zone.parse("2026-11-06 09:30:00 UTC"))

    aggregate_failures do
      expect(result.success?).to be(true)
      expect(result.value![:manual_task].due_date).to eq(Date.new(2026, 11, 6))
    end
  end

  it "strips surrounding whitespace off the title" do
    result = call("  复习错题本  ")

    expect(result.value![:manual_task].title).to eq("复习错题本")
  end

  it "refuses a blank title with VALIDATION_FAILED, persisting nothing" do
    aggregate_failures do
      [ "", "   " ].each do |title|
        result = call(title)
        expect(result.success?).to be(false)
        expect(result.failure.code).to eq(:VALIDATION_FAILED)
        expect(result.failure.context[:field]).to eq(:title)
      end
    end
    expect(user.manual_tasks.count).to eq(0)
  end

  it "refuses a title beyond 200 characters with VALIDATION_FAILED" do
    result = call("x" * 201)

    aggregate_failures do
      expect(result.success?).to be(false)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(result.failure.context[:field]).to eq(:title)
    end
    expect(user.manual_tasks.count).to eq(0)
  end

  it "accepts exactly 200 characters" do
    result = call("字" * 200)

    expect(result.success?).to be(true)
  end

  it "refuses a non-date dueDate with VALIDATION_FAILED" do
    result = call("整理错题", due_date: "not-a-date")

    aggregate_failures do
      expect(result.success?).to be(false)
      expect(result.failure.code).to eq(:VALIDATION_FAILED)
      expect(result.failure.context[:field]).to eq(:dueDate)
    end
    expect(user.manual_tasks.count).to eq(0)
  end
end
