# frozen_string_literal: true

require "rails_helper"

# The StudyFocusSet entity (FR-17, epic-13 T4): ONE active set per
# user+material (the unique index is the storage law — regeneration
# replaces the row's items in place, never forks a second active set).
# `items` is the jsonb array (string-keyed, TS keys verbatim: id, title,
# detail, sourceRange — the AD-2 annotation range verbatim, the deep-link
# shape); `generation` counts replacements (v1 = the first generation);
# `client_uuid` is the replay key of the set's LAST generation (delta-3
# posture — regeneration replaces it; v1 is no longer addressable).
RSpec.describe StudyFocusSet, type: :model do
  let(:user) { create(:user) }
  let(:material) { create(:material, user: user) }

  let(:model_attributes) do
    {
      user: user,
      material: material,
      items: [
        {
          "id" => "item-1",
          "title" => "Raft 的领导者选举",
          "detail" => "Raft 把时间分为任期，每个任期至多一个领导者。",
          "sourceRange" => { "page" => 3, "start" => 12, "end" => 40, "quote" => "leader election" }
        }
      ],
      client_uuid: SecureRandom.uuid
    }
  end

  it_behaves_like "a user-owned uuid model"
  include_examples "user-scoped", described_class

  it "round-trips the items jsonb (TS keys verbatim, sourceRange inside)" do
    set = described_class.create!(model_attributes)

    set.reload
    aggregate_failures do
      expect(set.items).to eq(
        [
          {
            "id" => "item-1",
            "title" => "Raft 的领导者选举",
            "detail" => "Raft 把时间分为任期，每个任期至多一个领导者。",
            "sourceRange" => { "page" => 3, "start" => 12, "end" => 40, "quote" => "leader election" }
          }
        ]
      )
      expect(set.items.sole["sourceRange"]).to eq("page" => 3, "start" => 12, "end" => 40, "quote" => "leader election")
    end
  end

  it "defaults items to the empty array and generation to 1 (the DB floors)" do
    set = described_class.create!(user: user, material: material, client_uuid: SecureRandom.uuid)

    set.reload
    aggregate_failures do
      expect(set.items).to eq([])
      expect(set.generation).to eq(1)
    end
  end

  it "refuses a second active set for the same user+material (the unique index)" do
    described_class.create!(model_attributes)

    expect { described_class.create!(model_attributes.merge(client_uuid: SecureRandom.uuid)) }
      .to raise_error(ActiveRecord::RecordNotUnique, /index_study_focus_sets_on_user_and_material/)
  end

  it "keeps one set per user across materials (the uniqueness is the user+material pair)" do
    described_class.create!(model_attributes)
    other_material = create(:material, user: user)

    expect { described_class.create!(model_attributes.merge(material: other_material, client_uuid: SecureRandom.uuid)) }
      .not_to raise_error
  end
end
