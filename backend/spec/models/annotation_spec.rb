# frozen_string_literal: true

require "rails_helper"

RSpec.describe Annotation, type: :model do
  let(:user) { User.create!(email: "annotation-spec@example.com", password_digest: "digest") }
  let(:material) { Material.create!(user: user, title: "Annotated material", kind: "pdf", size_bytes: 10_240) }

  let(:model_attributes) { { user: user, material: material, locator: { kind: "pdf", page: 5 }, body: "Remember this" } }

  it_behaves_like "a user-owned uuid model"

  it "carries a ReadingLocator jsonb + body (FR-16/17 structural half)" do
    annotation = described_class.create!(model_attributes)

    expect(annotation.reload.locator).to eq("kind" => "pdf", "page" => 5)
    expect(annotation.body).to eq("Remember this")
  end
end
