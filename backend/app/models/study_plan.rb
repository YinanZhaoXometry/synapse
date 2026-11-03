# frozen_string_literal: true

# The front door (system gives the plan, never content). The M2M StudyPlan ↔
# Material attachment is realized plan-side via materials.plan_id (no join
# table); nodeIds/materialIds from the Phase-1 TS shape are these inverses.
class StudyPlan < ApplicationRecord
  belongs_to :user

  # The child tables' foreign key is `plan_id` (t.references :plan), not the
  # `study_plan_id` a bare has_many would infer — declared explicitly after
  # the demo-seed spec drove the association for the first time (epic P2-2
  # ticket 03) and surfaced PG::UndefinedColumn on all three.
  has_many :knowledge_nodes, foreign_key: :plan_id
  has_many :materials, foreign_key: :plan_id
  has_many :quiz_sessions, foreign_key: :plan_id

  # FR-38 structural: private by default, public is the Square opt-in.
  # scopes: false — the value `private` would collide with Ruby's Module#private.
  enum :visibility, { private: "private", public: "public" }, default: :private, scopes: false
end
