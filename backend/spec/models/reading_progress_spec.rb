# frozen_string_literal: true

require "rails_helper"

RSpec.describe ReadingProgress, type: :model do
  let(:user) { User.create!(email: "reading-progress-spec@example.com", password_digest: "digest") }
  let(:material) { Material.create!(user: user, title: "Tracked material", kind: "pdf", size_bytes: 15_360) }

  let(:model_attributes) do
    { user: user, material: material, position: { locator: { kind: "pdf", page: 3 }, text: "Where I stopped" } }
  end

  it_behaves_like "a user-owned uuid model"

  it "tracks 1:1 with a material — a second progress row for the same material is rejected" do
    described_class.create!(model_attributes)

    expect { described_class.create!(model_attributes) }
      .to raise_error(ActiveRecord::RecordNotUnique)
  end

  it "keeps the ReadingPosition jsonb verbatim (AD-2: locator + extracted text)" do
    progress = described_class.create!(model_attributes)

    expect(progress.reload.position).to eq(
      "locator" => { "kind" => "pdf", "page" => 3 }, "text" => "Where I stopped"
    )
  end
end
