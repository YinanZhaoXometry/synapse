# frozen_string_literal: true

# Where the reader stopped on a material, 1:1. position is the ReadingPosition
# jsonb verbatim ({locator, text}, AD-2) — shared shape with CompanionService
# grounding.
class ReadingProgress < ApplicationRecord
  belongs_to :user
  belongs_to :material
end
