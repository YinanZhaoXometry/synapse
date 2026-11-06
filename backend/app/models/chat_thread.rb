# frozen_string_literal: true

# The Companion conversation anchored 1:1 to its scope — a material (the
# reader's thread) or a plan (the tutor page's plan-grounded thread,
# epic-25 T1). Exactly one of the two anchors is set: the DB floor is the
# `chat_threads_one_scope` CHECK; the validation below is the model-level
# mirror. messages is the ChatMessage[] jsonb verbatim
# ({id, role, text, citations, createdAt}, AD-2) — the ER has no
# ChatMessage entity, so messages embed.
class ChatThread < ApplicationRecord
  belongs_to :user
  belongs_to :material, optional: true
  belongs_to :plan, class_name: "StudyPlan", optional: true

  validate :exactly_one_scope

  private

  def exactly_one_scope
    return if material_id.present? ^ plan_id.present?

    errors.add(:base, "exactly one of material_id / plan_id must be set")
  end
end
