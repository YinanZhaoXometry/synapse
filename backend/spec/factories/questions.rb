# frozen_string_literal: true

# Strictly materials-sourced (FR-18/NFR-1): source_material + a section slug
# (source_section_id is a MaterialSection id string, never a uuid FK). The
# user is passed down so the whole provenance graph shares one owner.
# options/correct_option_index/keywords stay null (an open question).
FactoryBot.define do
  factory :question do
    user
    session { association :quiz_session, user: user }
    node { association :knowledge_node, user: user }
    source_material { association :material, user: user }
    kind { "open" }
    prompt { "How is every user-owned row scoped?" }
    explanation { "By a user_id foreign key on the row itself (AD-13)." }
    source_section_id { "sec-1" }
    # NOT NULL on the ER (the P2-3 review's position column — the generation
    # order). The command stamps real per-input indices; a factory row is a
    # direct row, so a constant satisfies the constraint (read-back ties fall
    # through to created_at/id, the pre-position order).
    position { 0 }
  end
end
