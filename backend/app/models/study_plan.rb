# frozen_string_literal: true

# The front door (system gives the plan, never content). The M2M StudyPlan ↔
# Material attachment is realized plan-side via materials.plan_id (no join
# table); nodeIds/materialIds from the Phase-1 TS shape are these inverses.
class StudyPlan < ApplicationRecord
  belongs_to :user

  has_many :knowledge_nodes
  has_many :materials
  has_many :quiz_sessions

  # FR-38 structural: private by default, public is the Square opt-in.
  # scopes: false — the value `private` would collide with Ruby's Module#private.
  enum :visibility, { private: "private", public: "public" }, default: :private, scopes: false
end
