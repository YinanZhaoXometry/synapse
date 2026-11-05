# frozen_string_literal: true

# The front door (system gives the plan, never content). The M2M StudyPlan ↔
# Material attachment is realized plan-side via materials.plan_id (no join
# table); nodeIds/materialIds from the Phase-1 TS shape are these inverses.
class StudyPlan < ApplicationRecord
  belongs_to :user

  # The fork attribution (OQ-12, epic P2-11 T3): the Square source the
  # structure was copied from — null on every hand-made/generated plan. The
  # DB FK nullifies on the source's deletion; forked_from_topic keeps the
  # fork-time snapshot, so the attribution line survives the source.
  belongs_to :forked_from, class_name: "StudyPlan", foreign_key: :forked_from_plan_id,
                           optional: true, inverse_of: false

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

  # FR-38 flip semantics (epic P2-11 T1): the Square read path's (T2)
  # governing scope — a public plan is in, a private one is out, the moment
  # the column flips. Declared by hand (the enum's scopes are off for the
  # `private` collision above), so the name can't drift with the enum.
  scope :publicly_visible, -> { where(visibility: "public") }
end
