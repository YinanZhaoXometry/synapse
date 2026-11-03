# frozen_string_literal: true

require "rails_helper"

RSpec.describe Material, type: :model do
  let(:user) { User.create!(email: "material-spec@example.com", password_digest: "digest") }

  def material_attributes
    { user: user, title: "Chapter 1", kind: "markdown", size_bytes: 1024 }
  end

  it "fills id from the gen_random_uuid() server default when create omits it" do
    material = described_class.create!(material_attributes)

    expect(material.id).to be_a_uuid
    expect(material.persisted?).to be(true)
  end

  it "honors a client-supplied id on create (AD-12 idempotent import)" do
    id = SecureRandom.uuid

    material = described_class.create!(material_attributes.merge(id: id))

    expect(material.id).to eq(id)
  end

  it "scopes to a required user_id (AD-13)" do
    association = described_class.reflect_on_association(:user)

    expect(association).to be_present
    expect(association.klass).to eq(User)
    expect(described_class.column_names).to include("user_id")
    expect(described_class.new(material_attributes.except(:user))).not_to be_valid
  end

  it "carries an indexed foreign key on user_id" do
    indexes = ActiveRecord::Base.connection.indexes(:materials)

    expect(indexes.map(&:columns)).to include(%w[user_id])
  end

  it "starts in the pending parse state (AD-7: parsing stays client-side)" do
    expect(described_class.new.parse_state).to eq("pending")

    material = described_class.create!(material_attributes)

    expect(material.parse_state).to eq("pending")
  end

  it "keeps task_id unique — a task studies exactly one material (spine ER)" do
    index = ActiveRecord::Base.connection.indexes(:materials).find { |i| i.columns == %w[task_id] }

    expect(index).to be_present
    expect(index.unique).to be(true)
  end

  it "extracts sections into a jsonb column — no blob columns (bytes are epic-06)" do
    sections = [ { "id" => "page-1", "title" => "Intro", "text" => "Hello" } ]

    material = described_class.create!(material_attributes.merge(sections: sections))

    expect(material.reload.sections).to eq(sections)
    expect(described_class.column_names).not_to include("blob", "file_data")
  end
end
