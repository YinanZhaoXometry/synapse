# frozen_string_literal: true

require "rails_helper"

RSpec.describe SectionMarking, type: :model do
  let(:user) { User.create!(email: "section-marking-spec@example.com", password_digest: "digest") }
  let(:material) { Material.create!(user: user, title: "Marked material", kind: "markdown", size_bytes: 768) }

  let(:model_attributes) { { user: user, material: material, section_id: "page-1", claimed_at: Time.current } }

  it_behaves_like "a user-owned uuid model"

  it "starts unclaimed→claimed with a nullable cleared_at (FR-15: a claim, never evidence)" do
    marking = described_class.create!(model_attributes)

    expect(marking.claimed_at).to be_present
    expect(marking.cleared_at).to be_nil

    marking.update!(cleared_at: Time.current)
    expect(marking.reload.cleared_at).to be_present
  end
end
