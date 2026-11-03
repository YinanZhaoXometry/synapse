# frozen_string_literal: true

require "rails_helper"

RSpec.describe SectionMarking, type: :model do
  let(:user) { User.create!(email: "section-marking-spec@example.com", password_digest: "digest") }
  let(:material) { Material.create!(user: user, title: "Marked material", kind: "markdown", size_bytes: 768) }

  def marking_attributes
    { user: user, material: material, section_id: "page-1", claimed_at: Time.current }
  end

  it "fills id from the gen_random_uuid() server default when create omits it" do
    marking = described_class.create!(marking_attributes)

    expect(marking.id).to be_a_uuid
    expect(marking.persisted?).to be(true)
  end

  it "honors a client-supplied id on create (AD-12 idempotent import)" do
    id = SecureRandom.uuid

    marking = described_class.create!(marking_attributes.merge(id: id))

    expect(marking.id).to eq(id)
  end

  it "scopes to a required user_id (AD-13)" do
    association = described_class.reflect_on_association(:user)

    expect(association).to be_present
    expect(association.klass).to eq(User)
    expect(described_class.column_names).to include("user_id")
    expect(described_class.new(marking_attributes.except(:user))).not_to be_valid
  end

  it "carries an indexed foreign key on user_id" do
    indexes = ActiveRecord::Base.connection.indexes(:section_markings)

    expect(indexes.map(&:columns)).to include(%w[user_id])
  end

  it "starts unclaimed→claimed with a nullable cleared_at (FR-15: a claim, never evidence)" do
    marking = described_class.create!(marking_attributes)

    expect(marking.claimed_at).to be_present
    expect(marking.cleared_at).to be_nil

    marking.update!(cleared_at: Time.current)
    expect(marking.reload.cleared_at).to be_present
  end
end
