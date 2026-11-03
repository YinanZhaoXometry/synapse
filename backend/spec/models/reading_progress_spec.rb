# frozen_string_literal: true

require "rails_helper"

RSpec.describe ReadingProgress, type: :model do
  let(:user) { User.create!(email: "reading-progress-spec@example.com", password_digest: "digest") }
  let(:material) { Material.create!(user: user, title: "Tracked material", kind: "pdf", size_bytes: 15_360) }

  def progress_attributes
    { user: user, material: material, position: { locator: { kind: "pdf", page: 3 }, text: "Where I stopped" } }
  end

  it "fills id from the gen_random_uuid() server default when create omits it" do
    progress = described_class.create!(progress_attributes)

    expect(progress.id).to be_a_uuid
    expect(progress.persisted?).to be(true)
  end

  it "honors a client-supplied id on create (AD-12 idempotent import)" do
    id = SecureRandom.uuid

    progress = described_class.create!(progress_attributes.merge(id: id))

    expect(progress.id).to eq(id)
  end

  it "scopes to a required user_id (AD-13)" do
    association = described_class.reflect_on_association(:user)

    expect(association).to be_present
    expect(association.klass).to eq(User)
    expect(described_class.column_names).to include("user_id")
    expect(described_class.new(progress_attributes.except(:user))).not_to be_valid
  end

  it "carries an indexed foreign key on user_id" do
    indexes = ActiveRecord::Base.connection.indexes(:reading_progresses)

    expect(indexes.map(&:columns)).to include(%w[user_id])
  end

  it "tracks 1:1 with a material — a second progress row for the same material is rejected" do
    described_class.create!(progress_attributes)

    expect { described_class.create!(progress_attributes) }
      .to raise_error(ActiveRecord::RecordNotUnique)
  end

  it "keeps the ReadingPosition jsonb verbatim (AD-2: locator + extracted text)" do
    progress = described_class.create!(progress_attributes)

    expect(progress.reload.position).to eq(
      "locator" => { "kind" => "pdf", "page" => 3 }, "text" => "Where I stopped"
    )
  end
end
