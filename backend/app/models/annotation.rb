# frozen_string_literal: true

# The FR-16/17 structural half: a ReadingLocator (jsonb, keys verbatim, AD-2)
# + a body on a material. All annotation behavior lands with epics 10/13 —
# this model only fixes the storage shape.
class Annotation < ApplicationRecord
  belongs_to :user
  belongs_to :material
end
