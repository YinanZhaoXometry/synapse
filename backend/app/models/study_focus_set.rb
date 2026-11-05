# frozen_string_literal: true

# ONE active Study Focus set per user+material (FR-17, epic-13 T4; OQ-1 —
# the storage shape decision recorded on the ticket): AI-generated,
# regenerable, REPLACEABLE — regeneration updates the row's items in place
# and bumps `generation` (the wire's vN chip); the unique index
# (index_study_focus_sets_on_user_and_material) is the one-active-set law
# at the storage layer. `items` is the jsonb array (string-keyed, TS keys
# verbatim: [{ id, title, detail, sourceRange }] — sourceRange rides the
# AD-2 annotation range jsonb VERBATIM, the deep-link shape). `client_uuid`
# is the delta-3 replay key of the set's LAST generation (globally unique —
# a uuid is owned by exactly one user; regeneration replaces it, so an
# older generation is deliberately no longer addressable — no forked
# history v1).
class StudyFocusSet < ApplicationRecord
  belongs_to :user
  belongs_to :material
end
