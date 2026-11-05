# frozen_string_literal: true

module Progress
  # The 今日学习 manual-task add op (FR-27, epic P2-09 T3): the write half
  # T1 deferred (the table + read model landed there). Validation is the
  # command's per the contract — the title is bounded (≤200 characters,
  # VALIDATION_FAILED), the dueDate is a plain date or null (a Time input
  # normalizes to the day it names; the day is the fact, the ManualTaskType
  # reads it back at midnight). Persistence rides the owner's association
  # path (AD-13). No client-uuid replay: a task row is a jotting, not an
  # idempotent create — the add form's resubmit is the caller's concern.
  class AddManualTaskCommand < ApplicationCommand
    option :current_user
    option :title
    option :due_date, optional: true

    TITLE_MAX = 200

    def call
      clean_title = title.to_s.strip
      if clean_title.empty?
        return Failure(:VALIDATION_FAILED, { message: "title is required", field: :title })
      end
      if clean_title.length > TITLE_MAX
        return Failure(:VALIDATION_FAILED,
                       { message: "title is longer than #{TITLE_MAX} characters", field: :title })
      end

      normalize_due_date.bind do |due|
        task = current_user.manual_tasks.create!(title: clean_title, due_date: due)
        Success(manual_task: task)
      end
    end

    private

    # nil stays null (the unscheduled task); a Date passes through; a time
    # value (the DateTime scalar's coerced shape — Time / TimeWithZone /
    # DateTime) collapses to the day it names; anything else is a shape
    # refusal. `acts_like_time?` over bare `respond_to?(:to_date)` — a String
    # answers to_date too (and raises on garbage, which would INTERNAL).
    def normalize_due_date
      return Success(nil) if due_date.nil?
      return Success(due_date) if due_date.is_a?(Date)
      if due_date.respond_to?(:acts_like_time?) && due_date.respond_to?(:to_date)
        return Success(due_date.to_date)
      end

      Failure(:VALIDATION_FAILED, { message: "dueDate is not a date", field: :dueDate })
    end
  end
end
