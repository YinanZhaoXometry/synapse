# frozen_string_literal: true

require "rails_helper"

RSpec.describe Material, type: :model do
  let(:user) { User.create!(email: "material-spec@example.com", password_digest: "digest") }

  let(:model_attributes) { { user: user, title: "Chapter 1", kind: "markdown", size_bytes: 1024 } }

  it_behaves_like "a user-owned uuid model"

  it "starts in the pending parse state (AD-7: parsing stays client-side)" do
    expect(described_class.new.parse_state).to eq("pending")

    material = described_class.create!(model_attributes)

    expect(material.parse_state).to eq("pending")
  end

  it "keeps task_id unique — a task studies exactly one material (spine ER)" do
    index = ActiveRecord::Base.connection.indexes(:materials).find { |i| i.columns == %w[task_id] }

    expect(index).to be_present
    expect(index.unique).to be(true)
  end

  it "extracts sections into a jsonb column — no blob columns (bytes are epic-06)" do
    sections = [ { "id" => "page-1", "title" => "Intro", "text" => "Hello" } ]

    material = described_class.create!(model_attributes.merge(sections: sections))

    expect(material.reload.sections).to eq(sections)
    expect(described_class.column_names).not_to include("blob", "file_data")
  end
end
