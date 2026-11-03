# frozen_string_literal: true

# The FR-15 Mastery Marking claim — a claim, never evidence; it can never move
# a score. section_id is a section slug. History is preserved: clearing sets
# cleared_at, re-claiming creates a new row (nothing is unique here).
class SectionMarking < ApplicationRecord
  belongs_to :user
  belongs_to :material
end
