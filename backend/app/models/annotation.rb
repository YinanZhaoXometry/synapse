# frozen_string_literal: true

# The FR-16/17 annotation — user-scoped (AD-13), addressed to one Material:
# a ReadingLocator jsonb ({kind:"pdf",page} | {kind:"markdown",sectionId},
# keys verbatim, AD-2) + the AD-2 range jsonb ({sectionId?|page?, start,
# end, quote} — char offsets + the quoted span for drift verification,
# epic-13 T3 delta 3) + the render surface (kind: highlight | underline;
# color: a nullable named palette key) + the free-text body note (empty for
# pure highlights — the note editor stays a v2). The kind vocabulary is
# pinned twice (the enum here + the annotations_kind_check DB floor); the
# locator/range SHAPE is the command layer's law (Annotations::*Command).
class Annotation < ApplicationRecord
  belongs_to :user
  belongs_to :material

  enum :kind, { highlight: "highlight", underline: "underline" }, scopes: false
end
