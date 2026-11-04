# frozen_string_literal: true

require "rails_helper"

RSpec.describe MaterialNodeMapping, type: :model do
  let(:user) { User.create!(email: "material-node-mapping-spec@example.com", password_digest: "digest") }
  let(:material) { Material.create!(user: user, title: "Mapped material", kind: "markdown", size_bytes: 768) }

  let(:model_attributes) { { user: user, material: material, section_id: "sec-1" } }

  it_behaves_like "a user-owned uuid model"

  it "starts proposed (the map run's only write state)" do
    expect(described_class.new.status).to eq("proposed")
  end

  it "pins the status vocabulary to the closed three values (delta decision 4)" do
    mapping = described_class.create!(model_attributes)
    mapping.update!(status: "confirmed")
    expect(mapping.reload.status).to eq("confirmed")
    mapping.update!(status: "rejected")
    expect(mapping.reload.status).to eq("rejected")

    expect { described_class.new(status: "unknown") }.to raise_error(ArgumentError)
  end

  it "keeps ONE ACTIVE row per user+material+section (the unique index)" do
    described_class.create!(model_attributes)

    expect {
      described_class.create!(model_attributes)
    }.to raise_error(ActiveRecord::RecordNotUnique)
  end

  it "points at nothing while proposed — node and title are independently nullable" do
    orphan = described_class.create!(model_attributes)
    expect(orphan.node_id).to be_nil
    expect(orphan.proposed_node_title).to be_nil

    gap = described_class.create!(model_attributes.merge(section_id: "sec-2", proposed_node_title: "New node"))
    expect(gap.node_id).to be_nil
    expect(gap.reload.proposed_node_title).to eq("New node")
  end
end
