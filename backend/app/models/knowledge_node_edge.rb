# frozen_string_literal: true

# One prerequisite edge of a plan's roadmap (FR-5 data half, epic-16 T1): a
# from→to learning-order dependency between two of the plan's own nodes.
# Pure structure — edges carry no progress semantics (evidence-only mastery,
# ADR-0001/AD-6/14). Validity (membership, stage-forward, dedupe) is a
# creation-time rule in Plans::PlanCreation (invalid edges drop
# silently-but-logged); the DB floor is the unique [from_node_id, to_node_id]
# index, so a pair can never double-store.
class KnowledgeNodeEdge < ApplicationRecord
  belongs_to :user
  belongs_to :plan, class_name: "StudyPlan"
  belongs_to :from_node, class_name: "KnowledgeNode"
  belongs_to :to_node, class_name: "KnowledgeNode"
end
