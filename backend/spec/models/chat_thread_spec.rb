# frozen_string_literal: true

require "rails_helper"

RSpec.describe ChatThread, type: :model do
  let(:user) { User.create!(email: "chat-thread-spec@example.com", password_digest: "digest") }
  let(:material) { Material.create!(user: user, title: "Thread anchor", kind: "markdown", size_bytes: 256) }

  let(:model_attributes) { { user: user, material: material } }

  it_behaves_like "a user-owned uuid model"

  it "anchors 1:1 to a material — a second thread for the same material is rejected" do
    described_class.create!(model_attributes)

    expect { described_class.create!(model_attributes) }
      .to raise_error(ActiveRecord::RecordNotUnique)
  end

  it "starts with an empty messages jsonb (no ChatMessage entity in the ER — embedded)" do
    thread = described_class.create!(model_attributes)

    expect(thread.messages).to eq([])
  end
end
