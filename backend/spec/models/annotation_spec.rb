# frozen_string_literal: true

require "rails_helper"

RSpec.describe Annotation, type: :model do
  let(:user) { User.create!(email: "annotation-spec@example.com", password_digest: "digest") }
  let(:material) { Material.create!(user: user, title: "Annotated material", kind: "pdf", size_bytes: 10_240) }

  def annotation_attributes
    { user: user, material: material, locator: { kind: "pdf", page: 5 }, body: "Remember this" }
  end

  it "fills id from the gen_random_uuid() server default when create omits it" do
    annotation = described_class.create!(annotation_attributes)

    expect(annotation.id).to be_a_uuid
    expect(annotation.persisted?).to be(true)
  end

  it "honors a client-supplied id on create (AD-12 idempotent import)" do
    id = SecureRandom.uuid

    annotation = described_class.create!(annotation_attributes.merge(id: id))

    expect(annotation.id).to eq(id)
  end

  it "scopes to a required user_id (AD-13)" do
    association = described_class.reflect_on_association(:user)

    expect(association).to be_present
    expect(association.klass).to eq(User)
    expect(described_class.column_names).to include("user_id")
    expect(described_class.new(annotation_attributes.except(:user))).not_to be_valid
  end

  it "carries an indexed foreign key on user_id" do
    indexes = ActiveRecord::Base.connection.indexes(:annotations)

    expect(indexes.map(&:columns)).to include(%w[user_id])
  end

  it "carries a ReadingLocator jsonb + body (FR-16/17 structural half)" do
    annotation = described_class.create!(annotation_attributes)

    expect(annotation.reload.locator).to eq("kind" => "pdf", "page" => 5)
    expect(annotation.body).to eq("Remember this")
  end
end
