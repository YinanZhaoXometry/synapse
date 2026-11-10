# frozen_string_literal: true

# Epic-31 T2 follow-up: validate the stage check constraint added by
# 20261111100000 (strong-migrations two-step — add unvalidated, then validate).
class ValidateFlashcardsStageCheck < ActiveRecord::Migration[8.1]
  def change
    validate_check_constraint :flashcards, name: "flashcards_stage_check"
  end
end
